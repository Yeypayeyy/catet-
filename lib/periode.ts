// Periode untuk layar Transaksi: bulan menurut jam Jakarta, dan pengelompokan
// per hari. Konversi ke Asia/Jakarta hanya terjadi di UI — jadi di sini.

// WIB tidak punya DST, jadi offset tetap cukup.
const WIB_MS = 7 * 60 * 60 * 1000;

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const p2 = (n: number) => String(n).padStart(2, "0");

/** "2026-09" untuk bulan yang sedang berjalan di Jakarta. */
export function bulanWib(sekarang = new Date()): string {
  const w = new Date(sekarang.getTime() + WIB_MS);
  return `${w.getUTCFullYear()}-${p2(w.getUTCMonth() + 1)}`;
}

export function bulanValid(key: string | null | undefined): key is string {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key ?? "");
}

export function geserBulan(key: string, n: number): string {
  const d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}`;
}

/** "Sep 2026" */
export function labelBulan(key: string): string {
  return `${BULAN_PENDEK[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
}

/**
 * Rentang bulan untuk filter API. `to` dikurangi 1 ms karena filter `to` di
 * API inklusif — tanpa itu transaksi tepat 00:00 tanggal 1 ikut dua bulan.
 */
export function batasBulanWib(key: string): { from: string; to: string } {
  const awal = Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1) - WIB_MS;
  const akhir = Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 1) - WIB_MS;
  return { from: new Date(awal).toISOString(), to: new Date(akhir - 1).toISOString() };
}

/**
 * Periode dari query string: `?bulan=2026-09` atau `?tampilan=<perTahun>&tahun=2026`.
 * Nilai yang tidak valid jatuh ke bulan berjalan, bukan error — URL ini
 * diketik tangan dan dibagikan, jadi harus memaafkan.
 */
export function bacaPeriode(
  sp: { get(k: string): string | null },
  bulanIni: string,
  nilaiPerTahun: string,
): { bulan: string; tahun: number; perTahun: boolean } {
  const b = sp.get("bulan");
  const bulan = bulanValid(b) ? b : bulanIni;
  const t = Number(sp.get("tahun"));
  const tahun = Number.isInteger(t) && t >= 2000 && t <= 2100 ? t : Number(bulan.slice(0, 4));
  return { bulan, tahun, perTahun: sp.get("tampilan") === nilaiPerTahun };
}

type Bernominal = { occurred_at: string; amount: string; direction: "debit" | "credit" };

export function jumlahkan(items: Bernominal[]): { masuk: bigint; keluar: bigint } {
  let masuk = 0n;
  let keluar = 0n;
  for (const t of items) {
    if (t.direction === "credit") masuk += BigInt(t.amount);
    else keluar += BigInt(t.amount);
  }
  return { masuk, keluar };
}

export type Hari<T> = {
  /** "2026-09-01", tanggal di Jakarta. */
  tanggal: string;
  /** "01" */
  angka: string;
  /** "Sel" */
  namaHari: string;
  masuk: bigint;
  keluar: bigint;
  items: T[];
};

/** Kelompok per tanggal WIB, hari terbaru dulu. Urutan di dalam hari dipertahankan. */
export function kelompokkanPerHari<T extends Bernominal>(items: T[]): Hari<T>[] {
  const peta = new Map<string, Hari<T>>();
  for (const t of items) {
    const w = new Date(new Date(t.occurred_at).getTime() + WIB_MS);
    const tanggal = `${w.getUTCFullYear()}-${p2(w.getUTCMonth() + 1)}-${p2(w.getUTCDate())}`;
    let h = peta.get(tanggal);
    if (!h) {
      h = {
        tanggal,
        angka: p2(w.getUTCDate()),
        namaHari: HARI_PENDEK[w.getUTCDay()],
        masuk: 0n,
        keluar: 0n,
        items: [],
      };
      peta.set(tanggal, h);
    }
    h.items.push(t);
    if (t.direction === "credit") h.masuk += BigInt(t.amount);
    else h.keluar += BigInt(t.amount);
  }
  return [...peta.values()].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
}

/**
 * Nilai awal <input type="datetime-local"> saat menambah transaksi dari
 * kepala hari di layar Transaksi: tanggal yang ditekan, jam sekarang.
 * Tanggal rusak (termasuk "2026-02-30") jatuh ke waktu sekarang.
 */
export function waktuAwal(tanggal: string | null | undefined, sekarang = new Date()): string {
  const jam = `${p2(sekarang.getHours())}:${p2(sekarang.getMinutes())}`;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggal ?? "");
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]) return `${tanggal}T${jam}`;
  }
  return `${sekarang.getFullYear()}-${p2(sekarang.getMonth() + 1)}-${p2(sekarang.getDate())}T${jam}`;
}
