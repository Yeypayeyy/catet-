// Warna kategori: tiap kategori dapat satu slot tetap (1–7) dari id-nya, jadi
// "Makan" berwarna sama di Ringkasan, Statistik, dan bulan mana pun. Slot 8
// netral untuk "Lainnya" dan yang belum dikategorikan.
//
// ponytail: hash sederhana, dua kategori bisa kebagian slot sama. Kalau itu
// mengganggu, simpan slot sebagai kolom di tabel categories.

export function slotKategori(id: string | null | undefined): number {
  // "lainnya" dan "belum" = id buatan lib/statistik.ts untuk irisan non-kategori.
  if (!id || id === "lainnya" || id === "belum") return 8;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 7) + 1;
}

export function warnaKategori(id: string | null | undefined) {
  const n = slotKategori(id);
  return { bg: `var(--cat-${n}-bg)`, ink: `var(--cat-${n}-ink)`, bar: `var(--cat-${n}-bar)` };
}
