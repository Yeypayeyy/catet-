// Isi awal untuk user baru. Dipakai dua tempat: seed demo dan login pertama.
// Sengaja tanpa import apapun supaya bisa dipanggil script node maupun Next.

export const DEFAULT_ACCOUNTS = [
  { name: "myBCA", kind: "bank" as const, initBalance: 0n },
  { name: "Cash", kind: "cash" as const, initBalance: 0n },
  { name: "GoPay", kind: "ewallet" as const, initBalance: 0n },
];

// Ikonnya juga diisi ke kategori lama bernama sama oleh migrasi 0004 —
// ubah di sini, ubah juga di sana.
export const DEFAULT_CATEGORIES = [
  { name: "Makan & Minum", icon: "🍜" },
  { name: "Jajan", icon: "🍩" },
  { name: "Belanja Harian", icon: "🛒" },
  { name: "Transport", icon: "🚌" },
  { name: "Bensin", icon: "⛽" },
  { name: "Pulsa & Internet", icon: "📶" },
  { name: "Listrik & Air", icon: "💡" },
  { name: "Sewa & Kos", icon: "🏠" },
  { name: "Kesehatan", icon: "💊" },
  { name: "Pendidikan", icon: "🎓" },
  { name: "Hiburan", icon: "🎬" },
  { name: "Olahraga", icon: "⚽" },
  { name: "Donasi", icon: "🤲" },
  { name: "Transfer", icon: "🔁" },
  { name: "Gaji", icon: "💰" },
];
