// Ikon garis untuk kategori. Kategori menyimpan emoji (dipilih user, atau
// bawaan dari backend/db/defaults.ts); di layar emoji itu diganti ikon garis
// supaya seragam dengan sistem desain. Emoji yang tidak dikenal tetap tampil
// apa adanya — pilihan user tidak hilang.

import type { NamaIkon } from "@/components/Icon";

const DARI_EMOJI: Record<string, NamaIkon> = {
  "🍜": "makan",
  "🍩": "jajan",
  "🛒": "belanja",
  "🚌": "bus",
  "⛽": "bensin",
  "📶": "sinyal",
  "💡": "lampu",
  "🏠": "rumah",
  "💊": "obat",
  "🎓": "toga",
  "🎬": "film",
  "⚽": "aktivitas",
  "🤲": "hati",
  "🔁": "tukar",
  "💰": "dompet",
  "🎁": "hadiah",
  "💵": "uang",
  "☕": "kopi",
};

// Untuk kategori tanpa emoji: tebak dari namanya. Urutan penting, yang
// pertama cocok menang.
const DARI_NAMA: [RegExp, NamaIkon][] = [
  [/kopi|cafe|kafe/i, "kopi"],
  [/makan|minum|resto|kuliner/i, "makan"],
  [/jajan|camilan|snack/i, "jajan"],
  [/belanja|groceries|toko/i, "belanja"],
  [/transport|ojek|grab|gojek|kereta|bus/i, "bus"],
  [/bensin|bbm|parkir/i, "bensin"],
  [/pulsa|internet|data|wifi/i, "sinyal"],
  [/listrik|air|token|tagihan/i, "lampu"],
  [/sewa|kos|rumah/i, "rumah"],
  [/sehat|obat|dokter/i, "obat"],
  [/didik|kuliah|sekolah|kursus|buku/i, "toga"],
  [/hibur|film|nonton|game/i, "film"],
  [/olahraga|gym|fitness/i, "aktivitas"],
  [/donasi|sedekah|zakat|amal/i, "hati"],
  [/transfer/i, "tukar"],
  [/gaji|upah/i, "dompet"],
  [/hadiah|bonus|kado/i, "hadiah"],
  [/pemasukan|pendapatan|uang/i, "uang"],
];

/**
 * Ikon garis untuk satu kategori, atau null kalau emojinya tidak dikenal
 * (pemanggil lalu menampilkan emojinya). Tanpa emoji dan tanpa nama yang
 * cocok jatuh ke "label".
 */
export function ikonKategori(icon: string | null | undefined, name: string): NamaIkon | null {
  if (icon) return DARI_EMOJI[icon.replace(/️/g, "")] ?? null;
  for (const [pola, ikon] of DARI_NAMA) if (pola.test(name)) return ikon;
  return "label";
}
