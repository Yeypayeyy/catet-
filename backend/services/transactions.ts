// Kategorisasi cepat: satu-satunya operasi transaksi yang dipakai Android.
// CRUD selengkapnya menyusul di Langkah 1.4.
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/backend/db";
import { categories, transactions } from "@/backend/db/schema";
import { learnCategory } from "@/backend/services/suggest-categories";

export type CategorizeInput = {
  categoryId?: string;
  note?: string | null;
  merchant?: string | null;
  isReviewed?: boolean;
};

export type CategorizeResult =
  | { status: "ok"; id: string; categoryId: string | null; isReviewed: boolean }
  | { status: "not_found" }
  | { status: "bad_category" };

export async function categorizeTransaction(
  userId: string,
  transactionId: string,
  input: CategorizeInput,
): Promise<CategorizeResult> {
  // Kategori harus milik user yang sama, kalau tidak transaksi bisa ditempeli
  // kategori orang lain lewat id tebakan.
  if (input.categoryId) {
    const [cat] = await db
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
    if (!cat) return { status: "bad_category" };
  }

  const [tx] = await db
    .update(transactions)
    .set({
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.note !== undefined && { note: input.note }),
      ...(input.merchant !== undefined && { merchant: input.merchant }),
      // Memilih kategori berarti transaksi sudah ditinjau, kecuali diminta lain.
      isReviewed: input.isReviewed ?? (input.categoryId !== undefined ? true : undefined),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ),
    )
    .returning({
      id: transactions.id,
      categoryId: transactions.categoryId,
      amount: transactions.amount,
      isReviewed: transactions.isReviewed,
    });

  if (!tx) return { status: "not_found" };

  // Pembelajaran hit_count. Gagal di sini tidak boleh membatalkan kategorisasi —
  // saran yang meleset jauh lebih murah daripada transaksi yang gagal disimpan.
  if (input.categoryId) {
    try {
      await learnCategory(userId, input.categoryId, tx.amount);
    } catch (e) {
      console.error("learnCategory gagal", e);
    }
  }

  return { status: "ok", id: tx.id, categoryId: tx.categoryId, isReviewed: tx.isReviewed };
}
