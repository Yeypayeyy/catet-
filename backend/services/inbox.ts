// Pengolahan inbox_events jadi transaksi, plus dead letter queue.
//
// Dipakai dua arah: /api/ingest memanggilnya sekali saat notifikasi baru masuk,
// dan reparse memanggilnya lagi untuk event lama dengan parser versi terbaru.
// Satu fungsi untuk keduanya, supaya perbaikan parser tidak cuma berlaku untuk
// notifikasi yang akan datang.
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/backend/db";
import { accounts, deadLetters, inboxEvents, transactions } from "@/backend/db/schema";
import { MYBCA_PARSER_VERSION, parseMybca } from "@/backend/parsers/mybca";
import { suggestCategories, type SuggestedCategory } from "@/backend/services/suggest-categories";

// Gagal sebanyak ini berturut-turut, event pindah ke dead_letters.
export const MAX_ATTEMPTS = 3;

export type ProcessResult =
  | {
      status: "parsed";
      transactionId: string;
      amount: bigint;
      direction: "debit" | "credit";
      suggestedCategories: SuggestedCategory[];
    }
  | { status: "failed"; reason: string; deadLettered: boolean };

export class NoAccountError extends Error {}

export type InboxEvent = {
  id: string;
  userId: string;
  clientUuid: string;
  body: string;
  postedAt: Date;
};

/**
 * Parse satu event lalu bikin transaksinya. Idempoten lewat client_uuid: dipanggil
 * dua kali untuk event yang sama tidak menghasilkan transaksi dobel.
 */
export async function processEvent(event: InboxEvent): Promise<ProcessResult> {
  const parsed = parseMybca(event.body);
  if (!parsed) return await recordFailure(event, "format tidak dikenali");

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, event.userId), isNull(accounts.deletedAt)))
    .orderBy(asc(accounts.createdAt))
    .limit(1);
  if (!account) throw new NoAccountError("User belum punya account");

  // Transaksi belum dikategorikan; itu tugas antrian review.
  const [tx] = await db
    .insert(transactions)
    .values({
      userId: event.userId,
      accountId: account.id,
      inboxEventId: event.id,
      clientUuid: event.clientUuid,
      amount: parsed.amount,
      direction: parsed.direction,
      occurredAt: event.postedAt,
      bankCategory: parsed.bankCategory,
      source: "notification",
      isReviewed: false,
    })
    .onConflictDoNothing({ target: transactions.clientUuid })
    .returning({ id: transactions.id });

  await db
    .update(inboxEvents)
    .set({
      parseStatus: "parsed",
      parserVersion: MYBCA_PARSER_VERSION,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(inboxEvents.id, event.id));

  // Berhasil setelah sempat masuk DLQ: tandai selesai, jangan hapus barisnya.
  await db
    .update(deadLetters)
    .set({ resolvedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(deadLetters.inboxEventId, event.id), isNull(deadLetters.resolvedAt)));

  // tx kosong = transaksinya sudah pernah dibuat. Ikut hasil yang sudah ada.
  const existing = tx ?? (await transactionByClientUuid(event.userId, event.clientUuid));
  if (!existing) return { status: "failed", reason: "transaksi tidak terbentuk", deadLettered: false };

  return {
    status: "parsed",
    transactionId: existing.id,
    amount: parsed.amount,
    direction: parsed.direction,
    suggestedCategories: await suggestCategories(event.userId, parsed.amount, event.postedAt),
  };
}

async function transactionByClientUuid(userId: string, clientUuid: string) {
  const [tx] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.clientUuid, clientUuid), eq(transactions.userId, userId)))
    .limit(1);
  return tx ?? null;
}

/** Naikkan attempt_count; kalau sudah mentok, pindahkan ke dead_letters. */
async function recordFailure(event: InboxEvent, reason: string): Promise<ProcessResult> {
  const [row] = await db
    .update(inboxEvents)
    .set({
      parseStatus: "failed",
      parserVersion: MYBCA_PARSER_VERSION,
      attemptCount: sql`${inboxEvents.attemptCount} + 1`,
      lastError: reason,
      updatedAt: new Date(),
    })
    .where(eq(inboxEvents.id, event.id))
    .returning({ attemptCount: inboxEvents.attemptCount });

  const attempts = row?.attemptCount ?? 1;
  if (attempts < MAX_ATTEMPTS) return { status: "failed", reason, deadLettered: false };

  await db
    .insert(deadLetters)
    .values({ userId: event.userId, inboxEventId: event.id, reason, attemptCount: attempts })
    .onConflictDoUpdate({
      target: deadLetters.inboxEventId,
      set: { reason, attemptCount: attempts, resolvedAt: null, updatedAt: new Date() },
    });

  return { status: "failed", reason, deadLettered: true };
}

export type DeadLetterJson = {
  id: string;
  inbox_event_id: string;
  reason: string;
  attempt_count: number;
  resolved_at: string | null;
  created_at: string;
  package_name: string;
  title: string | null;
  // Payload mentah ikut ditampilkan: tanpa itu tidak ada yang bisa dikerjakan
  // dari halaman DLQ selain menatap pesan error.
  body: string;
  posted_at: string;
};

export async function listDeadLetters(
  userId: string,
  opts: { includeResolved?: boolean; limit: number } = { limit: 50 },
): Promise<DeadLetterJson[]> {
  const where = [eq(deadLetters.userId, userId), isNull(deadLetters.deletedAt)];
  if (!opts.includeResolved) where.push(isNull(deadLetters.resolvedAt));

  const rows = await db
    .select({
      id: deadLetters.id,
      inboxEventId: deadLetters.inboxEventId,
      reason: deadLetters.reason,
      attemptCount: deadLetters.attemptCount,
      resolvedAt: deadLetters.resolvedAt,
      createdAt: deadLetters.createdAt,
      packageName: inboxEvents.packageName,
      title: inboxEvents.title,
      body: inboxEvents.body,
      postedAt: inboxEvents.postedAt,
    })
    .from(deadLetters)
    .innerJoin(inboxEvents, eq(inboxEvents.id, deadLetters.inboxEventId))
    .where(and(...where))
    .orderBy(desc(deadLetters.createdAt))
    .limit(opts.limit);

  return rows.map((r) => ({
    id: r.id,
    inbox_event_id: r.inboxEventId,
    reason: r.reason,
    attempt_count: r.attemptCount,
    resolved_at: r.resolvedAt?.toISOString() ?? null,
    created_at: r.createdAt.toISOString(),
    package_name: r.packageName,
    title: r.title,
    body: r.body,
    posted_at: r.postedAt.toISOString(),
  }));
}

/** Coba lagi satu dead letter. null = bukan milik user ini / tidak ada. */
export async function reparseDeadLetter(
  userId: string,
  deadLetterId: string,
): Promise<ProcessResult | null> {
  const [row] = await db
    .select({
      id: inboxEvents.id,
      userId: inboxEvents.userId,
      clientUuid: inboxEvents.clientUuid,
      body: inboxEvents.body,
      postedAt: inboxEvents.postedAt,
    })
    .from(deadLetters)
    .innerJoin(inboxEvents, eq(inboxEvents.id, deadLetters.inboxEventId))
    .where(
      and(
        eq(deadLetters.id, deadLetterId),
        eq(deadLetters.userId, userId),
        isNull(deadLetters.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;

  // Reparse manual: attempt_count di-nolkan dulu supaya percobaan berikutnya
  // dihitung dari awal, bukan langsung mentok lagi.
  await db.update(inboxEvents).set({ attemptCount: 0 }).where(eq(inboxEvents.id, row.id));
  return await processEvent(row);
}

/**
 * Reparse batch seluruh event yang belum jadi transaksi, dengan parser versi
 * sekarang. Dipakai setelah parser diperbaiki. Aman diulang.
 */
export async function reparseAll(opts: { userId?: string; limit?: number } = {}) {
  const where = [ne(inboxEvents.parseStatus, "parsed"), isNull(inboxEvents.deletedAt)];
  if (opts.userId) where.push(eq(inboxEvents.userId, opts.userId));

  const rows = await db
    .select({
      id: inboxEvents.id,
      userId: inboxEvents.userId,
      clientUuid: inboxEvents.clientUuid,
      body: inboxEvents.body,
      postedAt: inboxEvents.postedAt,
    })
    .from(inboxEvents)
    .where(and(...where))
    .orderBy(asc(inboxEvents.createdAt))
    .limit(opts.limit ?? 1000);

  let parsed = 0;
  let failed = 0;
  for (const row of rows) {
    // Satu event bermasalah tidak boleh menghentikan sisanya.
    try {
      const r = await processEvent(row);
      if (r.status === "parsed") parsed++;
      else failed++;
    } catch (e) {
      failed++;
      console.error(`reparse gagal untuk event ${row.id}`, e);
    }
  }
  return { total: rows.length, parsed, failed };
}
