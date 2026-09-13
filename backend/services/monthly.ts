// Total pemasukan dan pengeluaran per bulan dalam satu tahun, untuk tampilan
// Bulanan di layar Transaksi.
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/backend/db";
import { transactions } from "@/backend/db/schema";
import { isiDuaBelasBulan, type MonthRow } from "@/backend/services/monthly-rows";

// WIB tidak punya DST. Tahun dan bulan dihitung menurut jam Jakarta, supaya
// transaksi 00:30 tanggal 1 tidak jatuh ke bulan sebelumnya.
const WIB_MS = 7 * 60 * 60 * 1000;

export async function monthlyTotals(userId: string, year: number): Promise<MonthRow[]> {
  const bulan = sql<number>`extract(month from ${transactions.occurredAt} at time zone 'Asia/Jakarta')::int`;

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
        gte(transactions.occurredAt, new Date(Date.UTC(year, 0, 1) - WIB_MS)),
        lt(transactions.occurredAt, new Date(Date.UTC(year + 1, 0, 1) - WIB_MS)),
      ),
    )
    .groupBy(bulan);

  return isiDuaBelasBulan(year, rows);
}
