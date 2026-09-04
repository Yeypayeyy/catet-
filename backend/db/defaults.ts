// Isi awal untuk user baru. Dipakai dua tempat: seed demo dan login pertama.
// Sengaja tanpa import apapun supaya bisa dipanggil script node maupun Next.

export const DEFAULT_ACCOUNTS = [
  { name: "myBCA", kind: "bank" as const, initBalance: 0n },
  { name: "Cash", kind: "cash" as const, initBalance: 0n },
  { name: "GoPay", kind: "ewallet" as const, initBalance: 0n },
];

export const DEFAULT_CATEGORIES = [
  "Makan & Minum",
  "Jajan",
  "Belanja Harian",
  "Transport",
  "Bensin",
  "Pulsa & Internet",
  "Listrik & Air",
  "Sewa & Kos",
  "Kesehatan",
  "Pendidikan",
  "Hiburan",
  "Olahraga",
  "Donasi",
  "Transfer",
  "Gaji",
];
