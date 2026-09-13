// Mesin saran kategori (Langkah 1.3).
//
// Rule-based, tanpa LLM. Bagian yang menentukan urutan sengaja jadi fungsi murni
// (`rankRules`) supaya bisa diuji tanpa database — itu satu-satunya bagian yang
// gampang salah diam-diam.
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/backend/db";
import { categories, categoryRules, transactions } from "@/backend/db/schema";
import {
  minuteOfDayWib,
  rankRules,
  susunSaran,
  type KategoriSaran,
} from "@/backend/services/category-rank";

export type SuggestedCategory = { id: string; name: string; icon: string | null };

/**
 * Semua kategori milik user, tersering dulu. Tidak dibatasi tiga: penyaringan
 * per jenis dan yang tersembunyi terjadi sesudahnya, di susunSaran.
 */
async function frequentCategories(userId: string): Promise<KategoriSaran[]> {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      icon: categories.icon,
      kind: categories.kind,
      hiddenAt: categories.hiddenAt,
      n: count(transactions.id),
    })
    .from(categories)
    .leftJoin(
      transactions,
      and(
        eq(transactions.categoryId, categories.id),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ),
    )
    .where(and(eq(categories.userId, userId), isNull(categories.deletedAt)))
    .groupBy(categories.id)
    .orderBy(desc(count(transactions.id)), categories.sortOrder, categories.createdAt);

  return rows.map(({ id, name, icon, kind, hiddenAt }) => ({
    id,
    name,
    icon,
    kind,
    hidden: hiddenAt !== null,
  }));
}

/**
 * Menyiapkan pemberi saran sekali, lalu memakainya berkali-kali.
 *
 * Antrian review butuh saran untuk setiap transaksi di halaman. Kalau tiap
 * transaksi memanggil query sendiri, satu halaman berisi 20 kartu jadi 60
 * query. Aturan, nama kategori, dan daftar fallback tidak berubah di antara
 * kartu — jadi diambil sekali di sini, dan pencocokannya (`rankRules`) murni
 * di memori.
 */
export async function pemberiSaran(
  userId: string,
): Promise<
  (amount: bigint, occurredAt: Date, direction: "debit" | "credit") => SuggestedCategory[]
> {
  // ponytail: seluruh rule milik user ditarik lalu dicocokkan di memori. Aturan
  // ini per-user dan tumbuh pelan (satu per nominal unik). Pindahkan ke WHERE
  // di SQL kalau satu user sudah ribuan rule.
  const rules = await db
    .select({
      categoryId: categoryRules.categoryId,
      amountMin: categoryRules.amountMin,
      amountMax: categoryRules.amountMax,
      minuteStart: categoryRules.minuteStart,
      minuteEnd: categoryRules.minuteEnd,
      priority: categoryRules.priority,
      hitCount: categoryRules.hitCount,
    })
    .from(categoryRules)
    .where(and(eq(categoryRules.userId, userId), isNull(categoryRules.deletedAt)));

  // Daftar tersering sudah memuat semua kategori, jadi sekaligus jadi peta id.
  const cadangan = await frequentCategories(userId);
  const byId = new Map(cadangan.map((c) => [c.id, c]));

  return (amount, occurredAt, direction) =>
    susunSaran(
      rankRules(rules, amount, minuteOfDayWib(occurredAt)),
      byId,
      cadangan,
      direction === "credit" ? "income" : "expense",
    );
}

/** Tiga kategori sejenis arah transaksi — kecuali user memang punya kurang dari 3. */
export async function suggestCategories(
  userId: string,
  amount: bigint,
  occurredAt: Date,
  direction: "debit" | "credit",
): Promise<SuggestedCategory[]> {
  return (await pemberiSaran(userId))(amount, occurredAt, direction);
}

/**
 * Dipanggil saat user mengkategorikan transaksi. Menaikkan hit_count aturan
 * nominal-persis yang sudah ada, atau membuatnya kalau belum.
 */
export async function learnCategory(
  userId: string,
  categoryId: string,
  amount: bigint,
): Promise<void> {
  const updated = await db
    .update(categoryRules)
    .set({ hitCount: sql`${categoryRules.hitCount} + 1`, updatedAt: new Date() })
    .where(
      and(
        eq(categoryRules.userId, userId),
        eq(categoryRules.categoryId, categoryId),
        eq(categoryRules.amountMin, amount),
        eq(categoryRules.amountMax, amount),
        isNull(categoryRules.minuteStart),
        isNull(categoryRules.deletedAt),
      ),
    )
    .returning({ id: categoryRules.id });

  if (updated.length > 0) return;

  await db.insert(categoryRules).values({
    userId,
    categoryId,
    amountMin: amount,
    amountMax: amount,
    hitCount: 1,
    isAutoLearned: true,
  });
}
