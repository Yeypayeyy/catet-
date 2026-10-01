// Warna kategori: tiap kategori dapat satu slot tetap (1–12), jadi "Makan"
// berwarna sama di Ringkasan, Transaksi, Statistik, dan bulan mana pun. Slot 0
// netral untuk "Lainnya" dan yang belum dikategorikan.
//
// Slot dibagi berurutan mengikuti daftar kategori user (urutan /api/categories),
// dihitung per jenis — pengeluaran dan pemasukan masing-masing mulai dari slot 1
// — dengan kategori tersembunyi di belakang. Jadi dua belas kategori aktif
// pertama dalam satu jenis tidak pernah kembar warna. Posisi itu dicatat tiap
// kali daftar kategori dimuat, dan disimpan di localStorage supaya layar yang
// tidak memuat daftarnya tetap pakai warna yang sama. Kategori yang belum pernah
// tercatat jatuh ke hash id.

/** Banyaknya slot berwarna; harus sama dengan --cat-1..N di globals.css. */
export const JUMLAH_WARNA = 12;

let posisi: Map<string, number> | null = null;

/** Panggil setiap kali daftar kategori dari /api/categories selesai dimuat. */
export function catatUrutanKategori(kategori: { id: string; kind?: string; hidden?: boolean }[]) {
  const urut = [...kategori.filter((k) => !k.hidden), ...kategori.filter((k) => k.hidden)];
  const perJenis = new Map<string, number>();
  const pasangan: [string, number][] = urut.map((k) => {
    const n = perJenis.get(k.kind ?? "") ?? 0;
    perJenis.set(k.kind ?? "", n + 1);
    return [k.id, n];
  });
  posisi = new Map(pasangan);
  try {
    localStorage.posisiKategori = JSON.stringify(pasangan);
  } catch {}
}

function bacaPosisi(): Map<string, number> | null {
  if (posisi) return posisi;
  try {
    const isi: unknown = JSON.parse(localStorage.posisiKategori ?? "null");
    if (Array.isArray(isi)) posisi = new Map(isi as [string, number][]);
  } catch {}
  return posisi;
}

export function slotKategori(id: string | null | undefined): number {
  // "lainnya" dan "belum" = id buatan lib/statistik.ts untuk irisan non-kategori.
  if (!id || id === "lainnya" || id === "belum") return 0;
  const i = bacaPosisi()?.get(id);
  if (i !== undefined) return (i % JUMLAH_WARNA) + 1;
  let h = 0;
  for (let j = 0; j < id.length; j++) h = (h * 31 + id.charCodeAt(j)) >>> 0;
  return (h % JUMLAH_WARNA) + 1;
}

export function warnaKategori(id: string | null | undefined) {
  const n = slotKategori(id);
  return { bg: `var(--cat-${n}-bg)`, ink: `var(--cat-${n}-ink)`, bar: `var(--cat-${n}-bar)` };
}
