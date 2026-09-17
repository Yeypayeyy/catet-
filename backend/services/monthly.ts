// Total pemasukan dan pengeluaran per bulan dalam satu tahun, untuk tampilan
// Bulanan di layar Transaksi.
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/backend/db";
import { transactions } from "@/backend/db/schema";
import { isiDuaBelasBulan, type MonthRow } from "@/backend/services/monthly-rows";
import { batasTahun } from "@/backend/services/wib";

/**
 * `categoryId` menyempitkan ke satu kategori — dipakai layar detail kategori di Statistik.
 * `mulai` = tanggal awal bulan milik user (1–28).
 */
export async function monthlyTotals(
  userId: string,
  year: number,
  categoryId?: string,
  mulai = 1,
): Promise<MonthRow[]> {
  // Jam Jakarta, dimundurkan (mulai - 1) hari lalu dimajukan sebulan:
  // 28 Agu dengan mulai 28 jatuh ke September, 27 Sep tetap September.
  // Aman karena mulai paling besar 28.
  // Angkanya ditulis langsung, bukan parameter: SELECT dan GROUP BY akan dapat
  // $1 dan $5 yang berbeda, dan Postgres menolak karena ekspresinya tidak sama.
  const mundur = Math.trunc(mulai) - 1;
  if (mundur < 0 || mundur > 27) throw new Error("mulai harus 1-28");
  const bulan = sql<number>`extract(month from (${transactions.occurredAt} at time zone 'Asia/Jakarta') - interval '${sql.raw(String(mundur))} days'${sql.raw(mundur ? " + interval '1 month'" : "")})::int`;
  const { awal, akhir } = batasTahun(year, mulai);

  const rows = await db
    .select({
      month: bulan,
      income: sql<string>`coalesce(sum(case when ${transactions.direction} = 'credit' then ${transactions.amount} else 0 end), 0)::text`,
      spending: sql<string>`coalesce(sum(case when ${transactions.direction} = 'debit' then ${transactions.amount} else 0 end), 0)::text`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        categoryId ? eq(transactions.categoryId, categoryId) : undefined,
        gte(transactions.occurredAt, awal),
        lt(transactions.occurredAt, akhir),
      ),
    )
    .groupBy(bulan);

  return isiDuaBelasBulan(year, rows);
}
