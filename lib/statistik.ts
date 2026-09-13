// Hitungan untuk layar Statistik. Murni: tanpa fetch, tanpa React.
//
// Persen dihitung dengan BigInt, bukan float — nominal tidak pernah lewat
// float. `pecahan` float cuma dipakai untuk menggambar irisan donat.

export type BarisKategori = { id: string | null; name: string; icon: string | null; total: string };

export type Irisan = BarisKategori & { id: string; persen: string; pecahan: number };

/** "33,3" — satu desimal berkoma, dibulatkan setengah ke atas. */
export function persen(bagian: bigint, total: bigint): string {
  if (total === 0n) return "0,0";
  const negatif = bagian < 0n;
  const b = negatif ? -bagian : bagian;
  const persepuluh = (b * 2000n + total) / (2n * total);
  return `${negatif ? "−" : ""}${persepuluh / 10n},${persepuluh % 10n}`;
}

/** (pemasukan − pengeluaran) / pemasukan. Tanpa pemasukan, rasionya tidak ada. */
export function rasioNabung(masuk: bigint, keluar: bigint): string {
  if (masuk === 0n) return "—";
  return `${persen(masuk - keluar, masuk)}%`;
}

/**
 * `n` kategori terbesar, sisanya digabung jadi "Lainnya". Donat dengan dua
 * belas irisan tipis tidak terbaca; totalnya tetap sama dengan masukan.
 * Masukan diasumsikan sudah urut dari yang terbesar (begitu API mengirimnya).
 */
export function potongIrisan(rows: BarisKategori[], n = 7): Irisan[] {
  const total = rows.reduce((a, r) => a + BigInt(r.total), 0n);
  const atas = rows.slice(0, n);
  const sisa = rows.slice(n).reduce((a, r) => a + BigInt(r.total), 0n);

  const semua: BarisKategori[] =
    sisa > 0n ? [...atas, { id: "lainnya", name: "Lainnya", icon: null, total: sisa.toString() }] : atas;

  return semua.map((r) => ({
    ...r,
    // "Belum dikategorikan" datang ber-id null; donat butuh kunci yang stabil.
    id: r.id ?? "belum",
    persen: persen(BigInt(r.total), total),
    pecahan: total === 0n ? 0 : Number(r.total) / Number(total),
  }));
}
