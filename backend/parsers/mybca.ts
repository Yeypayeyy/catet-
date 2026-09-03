// Parser notifikasi myBCA "Catatan Finansial".
//
// TITIK KRITIS. Salah di sini = data keuangan salah, dan salahnya senyap.
// Aturan yang dipegang:
//   1. Tidak pernah throw. Input apapun -> ParsedNotification atau null.
//   2. Tidak pernah pakai float. Tidak ada parseFloat, Number(), atau Intl.
//      Konversi ke BigInt langsung dari string digit yang sudah dibersihkan.
//   3. Ragu = null. Lebih baik masuk dead letter dan dilihat manusia
//      daripada menyimpan nominal yang salah.

export const MYBCA_PARSER_VERSION = 1;

export type ParsedNotification = {
  /** Satuan minor = rupiah utuh. 10000 berarti Rp10.000. */
  amount: bigint;
  direction: "debit" | "credit";
  /** Kategori dari BCA. Arsip saja, tidak dipakai untuk kategorisasi. */
  bankCategory: string | null;
};

// "Pengeluaran sebesar IDR 10,000.00 di kategori Belanja."
//  ^kata           ^nominal        ^kategori (opsional)
//
// Nominal sengaja dibatasi ke pola locale English: kelompok 3 digit dipisah koma,
// desimal dipisah titik. Format Indonesia (10.000,00) TIDAK cocok dengan pola ini
// sehingga jatuh ke null, bukan salah baca jadi 10.
const PATTERN =
  /^(Pengeluaran|Pemasukan)\s+sebesar\s+IDR\s+(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?(?:\s+di\s+kategori\s+(.+?))?\s*\.?\s*$/i;

export function parseMybca(body: string): ParsedNotification | null {
  try {
    if (typeof body !== "string") return null;

    const match = PATTERN.exec(body.trim());
    if (!match) return null;

    const [, kata, integerPart, fractionPart, kategori] = match;

    // Rupiah tidak punya sen dalam praktik. Kalau desimalnya bukan nol,
    // asumsi kita tentang format salah -> serahkan ke manusia lewat DLQ.
    if (fractionPart !== undefined && /[^0]/.test(fractionPart)) return null;

    // Koma di sini hanya bisa pemisah ribuan, sudah dijamin PATTERN.
    const digits = integerPart.replace(/,/g, "");
    const amount = BigInt(digits);

    // Nominal nol tidak bermakna sebagai transaksi.
    if (amount === 0n) return null;

    const direction = kata.toLowerCase() === "pengeluaran" ? "debit" : "credit";

    const bankCategory = kategori?.trim().replace(/\.+$/, "") || null;

    return { amount, direction, bankCategory };
  } catch {
    // Lapis terakhir. Tidak ada input yang boleh membuat fungsi ini melempar.
    return null;
  }
}
