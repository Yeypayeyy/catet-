// Warna kategori: tiap kategori dapat satu slot tetap (1–7), jadi "Makan"
// berwarna sama di Ringkasan, Transaksi, Statistik, dan bulan mana pun. Slot 8
// netral untuk "Lainnya" dan yang belum dikategorikan.
//
// Slot dibagi berurutan mengikuti daftar kategori user (urutan /api/categories),
// supaya tujuh kategori pertama tidak pernah kembar warna. Urutan itu dicatat
// tiap kali daftar kategori dimuat, dan disimpan di localStorage supaya layar
// yang tidak memuat daftarnya tetap pakai warna yang sama. Kategori yang belum
// pernah tercatat jatuh ke hash id.

let urutan: Map<string, number> | null = null;

/** Panggil setiap kali daftar kategori dari /api/categories selesai dimuat. */
export function catatUrutanKategori(kategori: { id: string }[]) {
  const ids = kategori.map((k) => k.id);
  urutan = new Map(ids.map((id, i) => [id, i]));
  try {
    localStorage.urutanKategori = JSON.stringify(ids);
  } catch {}
}

function bacaUrutan(): Map<string, number> | null {
  if (urutan) return urutan;
  try {
    const ids: unknown = JSON.parse(localStorage.urutanKategori ?? "null");
    if (Array.isArray(ids)) urutan = new Map(ids.map((id, i) => [String(id), i]));
  } catch {}
  return urutan;
}

export function slotKategori(id: string | null | undefined): number {
  // "lainnya" dan "belum" = id buatan lib/statistik.ts untuk irisan non-kategori.
  if (!id || id === "lainnya" || id === "belum") return 8;
  const i = bacaUrutan()?.get(id);
  if (i !== undefined) return (i % 7) + 1;
  let h = 0;
  for (let j = 0; j < id.length; j++) h = (h * 31 + id.charCodeAt(j)) >>> 0;
  return (h % 7) + 1;
}

export function warnaKategori(id: string | null | undefined) {
  const n = slotKategori(id);
  return { bg: `var(--cat-${n}-bg)`, ink: `var(--cat-${n}-ink)`, bar: `var(--cat-${n}-bar)` };
}
