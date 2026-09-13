// Angka untuk layar Statistik: total periode dan pembagian per kategori,
// terpisah untuk pengeluaran dan pemasukan.
import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/backend/db";
import { categories, transactions } from "@/backend/db/schema";

export type BarisKategori = { id: string | null; name: string; icon: string | null; total: string };

export type Statistik = {
  range: { from: string; to: string };
  income: string;
  spending: string;
  by_category: { debit: BarisKategori[]; credit: BarisKategori[] };
};

/** `awal` inklusif, `akhir` eksklusif — dari batasBulan atau batasTahun. */
export async function statistics(
  userId: string,
  rentang: { awal: Date; akhir: Date },
): Promise<Statistik> {
  const dalamRentang = and(
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
    gte(transactions.occurredAt, rentang.awal),
    lt(transactions.occurredAt, rentang.akhir),
  );

  // Satu query untuk kedua arah; dipisah di bawah. Total periode = jumlah
  // barisnya, jadi kartu angka dan donat tidak mungkin berbeda.
  const rows = await db
    .select({
      direction: transactions.direction,
      id: categories.id,
      name: categories.name,
      icon: categories.icon,
      total: sql<string>`sum(${transactions.amount})::text`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(dalamRentang)
    .groupBy(transactions.direction, categories.id, categories.name, categories.icon)
    .orderBy(desc(sql`sum(${transactions.amount})`));

  const arah = (d: "debit" | "credit"): BarisKategori[] =>
    rows
      .filter((r) => r.direction === d)
      .map((r) => ({
        id: r.id,
        name: r.name ?? "Belum dikategorikan",
        icon: r.icon,
        total: r.total,
      }));

  const debit = arah("debit");
  const credit = arah("credit");
  const jumlah = (xs: BarisKategori[]) => xs.reduce((a, x) => a + BigInt(x.total), 0n).toString();

  return {
    range: { from: rentang.awal.toISOString(), to: rentang.akhir.toISOString() },
    income: jumlah(credit),
    spending: jumlah(debit),
    by_category: { debit, credit },
  };
}
