// Pemformat untuk tampilan. Hanya dipakai frontend; tidak pernah dipanggil
// dari backend/, dan tidak pernah mengubah nilai — cuma cara menampilkannya.

/**
 * Satuan minor -> "Rp10.000". Tanpa spasi, tanpa desimal, ribuan titik.
 *
 * Menerima bigint, number, atau string, karena nominal datang dari API sebagai
 * string (uang tidak pernah lewat float, termasuk di JSON). Konversinya lewat
 * BigInt, bukan Number, supaya nominal besar tidak kehilangan digit.
 */
export function formatRupiah(value: bigint | number | string): string {
  let n: bigint;
  try {
    n = typeof value === "bigint" ? value : BigInt(String(value ?? 0).replace(/[^\d-]/g, "") || 0);
  } catch {
    return "Rp0";
  }
  const negatif = n < 0n;
  const digit = (negatif ? -n : n).toString();
  const berkelompok = digit.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  // U+2212 minus, bukan tanda hubung: sejajar dengan angka di font tabular.
  return (negatif ? "−" : "") + "Rp" + berkelompok;
}

const WAKTU = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
});

const TANGGAL = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
});

/**
 * Waktu disimpan UTC; konversi ke Asia/Jakarta cuma terjadi di sini.
 *
 * Jamnya selalu ikut ditampilkan. "Kemarin" saja tidak cukup untuk mengenali
 * transaksi mana yang mana — kalau sehari ada empat kali jajan, yang
 * membedakan justru jamnya.
 */
export function formatWaktu(iso: string, sekarang = new Date()): string {
  const t = new Date(iso);
  const jam = WAKTU.format(t);
  const hari = (d: Date) => TANGGAL.format(d);
  const kemarin = new Date(sekarang.getTime() - 24 * 60 * 60 * 1000);

  if (hari(t) === hari(sekarang)) return jam;
  if (hari(t) === hari(kemarin)) return `Kemarin ${jam}`;
  return `${hari(t)} ${jam}`;
}

/**
 * ISO UTC -> nilai untuk <input type="datetime-local">.
 *
 * Pakai waktu lokal perangkat, bukan Asia/Jakarta yang dipakai tampilan.
 * Input tanggal bawaan browser memang berpikir dalam waktu perangkat, dan
 * memaksanya ke WIB cuma bikin jam yang ditulis beda dengan jam yang dipilih.
 */
export function toInputLocal(iso: string): string {
  const t = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`;
}

/** Kebalikannya: nilai input -> ISO dengan offset, seperti yang diminta API. */
export function fromInputLocal(nilai: string): string {
  return new Date(nilai).toISOString();
}

/**
 * Ketikan nominal -> digit satuan minor. "Rp10.000" dan "10000" sama saja.
 * Nol di depan dibuang supaya "0100" tidak lolos sebagai nominal.
 */
export function hanyaDigit(teks: string): string {
  return teks.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}
