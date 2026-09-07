// Alur ingest notifikasi. Urutannya bukan selera:
//   simpan mentah dulu -> baru parse. Kalau parser salah, datanya masih ada.
//
// Idempotency disandarkan ke unique index client_uuid di database, bukan ke
// pengecekan "select dulu baru insert" yang bisa balapan antar dua retry.
//
// Parsing sampai pembuatan transaksinya sendiri ada di inbox.ts, dipakai bareng
// dengan reparse — supaya perbaikan parser berlaku juga untuk event lama.
import { and, eq } from "drizzle-orm";
import { db } from "@/backend/db";
import { inboxEvents, transactions } from "@/backend/db/schema";
import { processEvent, type ProcessResult } from "@/backend/services/inbox";
import { suggestCategories } from "@/backend/services/suggest-categories";
import type { DeviceIdentity } from "@/backend/auth/device";

export { NoAccountError } from "@/backend/services/inbox";

export type IngestInput = {
  clientUuid: string;
  packageName: string;
  title: string | null;
  body: string;
  postedAt: Date;
};

export type IngestResult = ProcessResult;

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

  // 3. Parse dan bikin transaksinya.
  return await processEvent({
    id: event.id,
    userId: device.userId,
    clientUuid: input.clientUuid,
    body: input.body,
    postedAt: input.postedAt,
  });
}

async function previousResult(userId: string, clientUuid: string): Promise<IngestResult> {
  const [tx] = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      direction: transactions.direction,
      occurredAt: transactions.occurredAt,
    })
    .from(transactions)
    .where(and(eq(transactions.clientUuid, clientUuid), eq(transactions.userId, userId)))
    .limit(1);

  if (!tx) {
    return {
      status: "failed",
      reason: "sudah diproses, tidak menghasilkan transaksi",
      deadLettered: false,
    };
  }

  return {
    status: "parsed",
    transactionId: tx.id,
    amount: tx.amount,
    direction: tx.direction,
    suggestedCategories: await suggestCategories(userId, tx.amount, tx.occurredAt),
  };
}
