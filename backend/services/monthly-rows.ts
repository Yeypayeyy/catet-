// Bagian murni dari total per bulan: tanpa import database, supaya bisa diuji
// dengan `node --test` saja (sama seperti category-rank.ts).

export type MonthRow = { month: string; income: string; spending: string };

/**
 * Hasil GROUP BY cuma berisi bulan yang punya transaksi. Layar Bulanan butuh
 * dua belas baris tetap, jadi yang bolong diisi nol di sini.
 */
export function isiDuaBelasBulan(
  year: number,
  rows: { month: number; income: string; spending: string }[],
): MonthRow[] {
  const peta = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: 12 }, (_, i) => {
    const r = peta.get(i + 1);
    return {
      month: `${year}-${String(i + 1).padStart(2, "0")}`,
      income: r?.income ?? "0",
      spending: r?.spending ?? "0",
    };
  });
}
