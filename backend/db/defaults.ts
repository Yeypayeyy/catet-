// Isi awal untuk user baru. Dipakai dua tempat: seed demo dan login pertama.
// Sengaja tanpa import apapun supaya bisa dipanggil script node maupun Next.

export const DEFAULT_ACCOUNTS = [
  { name: "myBCA", kind: "bank" as const, initBalance: 0n },
  { name: "Cash", kind: "cash" as const, initBalance: 0n },
  { name: "GoPay", kind: "ewallet" as const, initBalance: 0n },
];

// Ikon, jenis, dan urutannya juga diisi ke kategori lama bernama sama oleh
// migrasi 0004 dan 0005 — ubah di sini, ubah juga di sana. Urutan dalam
// daftar ini = sort_order awal di masing-masing jenis.
const BAWAAN = [
  { name: "Makan & Minum", icon: "🍜", kind: "expense" },
  { name: "Jajan", icon: "🍩", kind: "expense" },
  { name: "Belanja Harian", icon: "🛒", kind: "expense" },
  { name: "Transport", icon: "🚌", kind: "expense" },
  { name: "Bensin", icon: "⛽", kind: "expense" },
  { name: "Pulsa & Internet", icon: "📶", kind: "expense" },
  { name: "Listrik & Air", icon: "💡", kind: "expense" },
  { name: "Sewa & Kos", icon: "🏠", kind: "expense" },
  { name: "Kesehatan", icon: "💊", kind: "expense" },
  { name: "Pendidikan", icon: "🎓", kind: "expense" },
  { name: "Hiburan", icon: "🎬", kind: "expense" },
  { name: "Olahraga", icon: "⚽", kind: "expense" },
  { name: "Donasi", icon: "🤲", kind: "expense" },
  { name: "Transfer", icon: "🔁", kind: "expense" },
  { name: "Gaji", icon: "💰", kind: "income" },
  { name: "Hadiah", icon: "🎁", kind: "income" },
  { name: "Pemasukan Lain", icon: "💵", kind: "income" },
] as const;

export const DEFAULT_CATEGORIES = BAWAAN.map((c) => ({
  ...c,
  isDefault: true,
  sortOrder: BAWAAN.filter((x) => x.kind === c.kind).indexOf(c),
}));
