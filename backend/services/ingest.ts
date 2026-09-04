// Alur ingest notifikasi. Urutannya bukan selera:
//   simpan mentah dulu -> baru parse. Kalau parser salah, datanya masih ada.
//
// Idempotency disandarkan ke unique index client_uuid di database, bukan ke
// pengecekan "select dulu baru insert" yang bisa balapan antar dua retry.
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/backend/db";
import { accounts, categories, inboxEvents, transactions } from "@/backend/db/schema";
import { MYBCA_PARSER_VERSION, parseMybca } from "@/backend/parsers/mybca";
import type { DeviceIdentity } from "@/backend/auth/device";

export type IngestInput = {
  clientUuid: string;
  packageName: string;
  title: string | null;
  body: string;
  postedAt: Date;
};

export type SuggestedCategory = { id: string; name: string };

export type IngestResult =
  | {
      status: "parsed";
      transactionId: string;
      amount: bigint;
      direction: "debit" | "credit";
      suggestedCategories: SuggestedCategory[];
    }
  | { status: "failed"; reason: string };

export class NoAccountError extends Error {}

// ponytail: 3 kategori pertama milik user. Mesin saran beneran menyusul di Fase 1.3.
async function suggestCategories(userId: string): Promise<SuggestedCategory[]> {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(and(eq(categories.userId, userId), isNull(categories.deletedAt)))
    .orderBy(asc(categories.createdAt))
    .limit(3);
}

export async function ingestNotification(
  device: DeviceIdentity,
  input: IngestInput,
): Promise<IngestResult> {
  // 1. Mentah dulu, sebelum parsing. Selalu.
  const [event] = await db
    .insert(inboxEvents)
    .values({
      userId: device.userId,
      deviceId: device.deviceId,
      clientUuid: input.clientUuid,
      packageName: input.packageName,
      title: input.title,
      body: input.body,
      postedAt: input.postedAt,
    })
    .onConflictDoNothing({ target: inboxEvents.clientUuid })
    .returning({ id: inboxEvents.id });

  // 2. client_uuid sudah pernah masuk: kembalikan hasil yang dulu, jangan bikin lagi.
  if (!event) return await previousResult(device.userId, input.clientUuid);

  // 3. Parse.
  const parsed = parseMybca(input.body);
  if (!parsed) {
    await db
      .update(inboxEvents)
      .set({
        parseStatus: "failed",
        parserVersion: MYBCA_PARSER_VERSION,
        attemptCount: 1,
        lastError: "format tidak dikenali",
        updatedAt: new Date(),
      })
      .where(eq(inboxEvents.id, event.id));
    return { status: "failed", reason: "format tidak dikenali" };
  }

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, device.userId), isNull(accounts.deletedAt)))
    .orderBy(asc(accounts.createdAt))
    .limit(1);
  if (!account) throw new NoAccountError("User belum punya account");

  // 4. Transaksi belum dikategorikan; itu tugas antrian review.
  const [tx] = await db
    .insert(transactions)
    .values({
      userId: device.userId,
      accountId: account.id,
      inboxEventId: event.id,
      clientUuid: input.clientUuid,
      amount: parsed.amount,
      direction: parsed.direction,
      occurredAt: input.postedAt,
      bankCategory: parsed.bankCategory,
      source: "notification",
      isReviewed: false,
    })
    .onConflictDoNothing({ target: transactions.clientUuid })
    .returning({ id: transactions.id });

  await db
    .update(inboxEvents)
    .set({ parseStatus: "parsed", parserVersion: MYBCA_PARSER_VERSION, updatedAt: new Date() })
    .where(eq(inboxEvents.id, event.id));

  // tx kosong = dua request identik balapan dan yang satunya menang. Ikut hasilnya.
  if (!tx) return await previousResult(device.userId, input.clientUuid);

  return {
    status: "parsed",
    transactionId: tx.id,
    amount: parsed.amount,
    direction: parsed.direction,
    suggestedCategories: await suggestCategories(device.userId),
  };
}

async function previousResult(userId: string, clientUuid: string): Promise<IngestResult> {
  const [tx] = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      direction: transactions.direction,
    })
    .from(transactions)
    .where(and(eq(transactions.clientUuid, clientUuid), eq(transactions.userId, userId)))
    .limit(1);

  if (!tx) return { status: "failed", reason: "sudah diproses, tidak menghasilkan transaksi" };

  return {
    status: "parsed",
    transactionId: tx.id,
    amount: tx.amount,
    direction: tx.direction,
    suggestedCategories: await suggestCategories(userId),
  };
}
