// Transaksi: baca, tulis, ubah, hapus. Semua query difilter user_id — tanpa
// kecuali, termasuk saat id-nya sudah kelihatan spesifik.
import { and, count, desc, eq, gte, inArray, isNull, lte, type SQL } from "drizzle-orm";
import { db } from "@/backend/db";
import { accounts, categories, tags, transactionTags, transactions } from "@/backend/db/schema";
import { learnCategory } from "@/backend/services/suggest-categories";

export type TransactionJson = {
  id: string;
  account_id: string;
  category_id: string | null;
  // String, bukan number. Uang tidak pernah lewat float, termasuk di JSON.
  amount: string;
  direction: "debit" | "credit";
  occurred_at: string;
  note: string | null;
  merchant: string | null;
  bank_category: string | null;
  source: "notification" | "manual";
  is_reviewed: boolean;
  tag_ids: string[];
};

export type ListFilter = {
  from?: Date;
  to?: Date;
  categoryId?: string;
  accountId?: string;
  direction?: "debit" | "credit";
  isReviewed?: boolean;
  limit: number;
  offset: number;
};

export type WriteInput = {
  accountId?: string;
  categoryId?: string | null;
  amount?: bigint;
  direction?: "debit" | "credit";
  occurredAt?: Date;
  note?: string | null;
  merchant?: string | null;
  isReviewed?: boolean;
  tagIds?: string[];
};

export type WriteResult =
  | { status: "ok"; transaction: TransactionJson }
  | { status: "not_found" }
  | { status: "bad_ref"; message: string };

const COLUMNS = {
  id: transactions.id,
  accountId: transactions.accountId,
  categoryId: transactions.categoryId,
  amount: transactions.amount,
  direction: transactions.direction,
  occurredAt: transactions.occurredAt,
  note: transactions.note,
  merchant: transactions.merchant,
  bankCategory: transactions.bankCategory,
  source: transactions.source,
  isReviewed: transactions.isReviewed,
};

type Row = {
  id: string;
  accountId: string;
  categoryId: string | null;
  amount: bigint;
  direction: "debit" | "credit";
  occurredAt: Date;
  note: string | null;
  merchant: string | null;
  bankCategory: string | null;
  source: "notification" | "manual";
  isReviewed: boolean;
};

function toJson(row: Row, tagIds: string[]): TransactionJson {
  return {
    id: row.id,
    account_id: row.accountId,
    category_id: row.categoryId,
    amount: row.amount.toString(),
    direction: row.direction,
    occurred_at: row.occurredAt.toISOString(),
    note: row.note,
    merchant: row.merchant,
    bank_category: row.bankCategory,
    source: row.source,
    is_reviewed: row.isReviewed,
    tag_ids: tagIds,
  };
}

/** Tag per transaksi, satu query untuk seluruh halaman. */
async function tagsFor(ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({ transactionId: transactionTags.transactionId, tagId: transactionTags.tagId })
    .from(transactionTags)
    .where(inArray(transactionTags.transactionId, ids));
  for (const r of rows) map.set(r.transactionId, [...(map.get(r.transactionId) ?? []), r.tagId]);
  return map;
}

export async function listTransactions(userId: string, f: ListFilter) {
  const where: SQL[] = [eq(transactions.userId, userId), isNull(transactions.deletedAt)];
  if (f.from) where.push(gte(transactions.occurredAt, f.from));
  if (f.to) where.push(lte(transactions.occurredAt, f.to));
  if (f.categoryId) where.push(eq(transactions.categoryId, f.categoryId));
  if (f.accountId) where.push(eq(transactions.accountId, f.accountId));
  if (f.direction) where.push(eq(transactions.direction, f.direction));
  if (f.isReviewed !== undefined) where.push(eq(transactions.isReviewed, f.isReviewed));
  const filter = and(...where);

  const rows = await db
    .select(COLUMNS)
    .from(transactions)
    .where(filter)
    .orderBy(desc(transactions.occurredAt), desc(transactions.id))
    .limit(f.limit)
    .offset(f.offset);

  const [{ total }] = await db.select({ total: count() }).from(transactions).where(filter);

  const tagMap = await tagsFor(rows.map((r) => r.id));
  return {
    items: rows.map((r) => toJson(r, tagMap.get(r.id) ?? [])),
    total,
    // ponytail: offset pagination. Cukup untuk daftar transaksi satu orang;
    // ganti ke keyset kalau daftarnya sudah puluhan ribu baris.
    next_offset: f.offset + rows.length < total ? f.offset + rows.length : null,
  };
}

export async function getTransaction(userId: string, id: string): Promise<TransactionJson | null> {
  const [row] = await db
    .select(COLUMNS)
    .from(transactions)
    .where(
      and(eq(transactions.id, id), eq(transactions.userId, userId), isNull(transactions.deletedAt)),
    )
    .limit(1);
  if (!row) return null;
  return toJson(row, (await tagsFor([row.id])).get(row.id) ?? []);
}

/** Semua relasi harus milik user yang sama, kalau tidak id tebakan bisa nyangkut. */
async function badRef(userId: string, input: WriteInput): Promise<string | null> {
  if (input.accountId) {
    const [a] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, input.accountId),
          eq(accounts.userId, userId),
          isNull(accounts.deletedAt),
        ),
      )
      .limit(1);
    if (!a) return "Account tidak ditemukan";
  }
  if (input.categoryId) {
    const [c] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.id, input.categoryId),
          eq(categories.userId, userId),
          isNull(categories.deletedAt),
        ),
      )
      .limit(1);
    if (!c) return "Kategori tidak ditemukan";
  }
  if (input.tagIds?.length) {
    const owned = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(inArray(tags.id, input.tagIds), eq(tags.userId, userId), isNull(tags.deletedAt)));
    if (owned.length !== new Set(input.tagIds).size) return "Tag tidak ditemukan";
  }
  return null;
}

async function setTags(transactionId: string, tagIds: string[]) {
  await db.delete(transactionTags).where(eq(transactionTags.transactionId, transactionId));
  if (tagIds.length > 0) {
    await db
      .insert(transactionTags)
      .values([...new Set(tagIds)].map((tagId) => ({ transactionId, tagId })));
  }
}

/** Transaksi manual: cash, gesek kartu, tarik tunai. */
export async function createTransaction(
  userId: string,
  input: WriteInput & { accountId: string; amount: bigint; direction: "debit" | "credit" },
): Promise<WriteResult> {
  const problem = await badRef(userId, input);
  if (problem) return { status: "bad_ref", message: problem };

  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId ?? null,
      // Dibuat di server: transaksi manual tidak lewat outbox device.
      clientUuid: crypto.randomUUID(),
      amount: input.amount,
      direction: input.direction,
      occurredAt: input.occurredAt ?? new Date(),
      note: input.note ?? null,
      merchant: input.merchant ?? null,
      source: "manual",
      // Diketik sendiri berarti sudah ditinjau.
      isReviewed: input.isReviewed ?? true,
    })
    .returning(COLUMNS);

  if (input.tagIds) await setTags(row.id, input.tagIds);
  return { status: "ok", transaction: toJson(row, input.tagIds ?? []) };
}

export async function updateTransaction(
  userId: string,
  id: string,
  input: WriteInput,
): Promise<WriteResult> {
  const problem = await badRef(userId, input);
  if (problem) return { status: "bad_ref", message: problem };

  const [row] = await db
    .update(transactions)
    .set({
      ...(input.accountId !== undefined && { accountId: input.accountId }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.direction !== undefined && { direction: input.direction }),
      ...(input.occurredAt !== undefined && { occurredAt: input.occurredAt }),
      ...(input.note !== undefined && { note: input.note }),
      ...(input.merchant !== undefined && { merchant: input.merchant }),
      // Memilih kategori berarti transaksi sudah ditinjau, kecuali diminta lain.
      isReviewed: input.isReviewed ?? (input.categoryId ? true : undefined),
      updatedAt: new Date(),
    })
    .where(
      and(eq(transactions.id, id), eq(transactions.userId, userId), isNull(transactions.deletedAt)),
    )
    .returning(COLUMNS);

  if (!row) return { status: "not_found" };
  if (input.tagIds) await setTags(row.id, input.tagIds);

  // Pembelajaran hit_count. Gagal di sini tidak boleh membatalkan kategorisasi —
  // saran yang meleset jauh lebih murah daripada transaksi yang gagal disimpan.
  if (input.categoryId) {
    try {
      await learnCategory(userId, input.categoryId, row.amount);
    } catch (e) {
      console.error("learnCategory gagal", e);
    }
  }

  const tagIds = input.tagIds ?? (await tagsFor([row.id])).get(row.id) ?? [];
  return { status: "ok", transaction: toJson(row, tagIds) };
}

export async function softDeleteTransaction(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(transactions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(transactions.id, id), eq(transactions.userId, userId), isNull(transactions.deletedAt)),
    )
    .returning({ id: transactions.id });
  return rows.length > 0;
}
