// Periode untuk layar Transaksi: bulan menurut jam Jakarta, dan pengelompokan
// per hari. Konversi ke Asia/Jakarta hanya terjadi di UI — jadi di sini.

// WIB tidak punya DST, jadi offset tetap cukup.
const WIB_MS = 7 * 60 * 60 * 1000;

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const p2 = (n: number) => String(n).padStart(2, "0");

/**
 * Tanggal mulai "bulan" milik user (1–28), untuk yang gajian bukan tanggal 1.
 * Bulan "2026-08" dengan awal 28 = 28 Agu s.d. 27 Sep: dinamai bulan mulainya.
 *
 * ponytail: disimpan di localStorage seperti tema, jadi per device. Pindah ke
 * kolom users kalau HP dan laptop harus selalu sepakat.
 */
export function bacaAwalBulan(): number {
  try {
    return awalValid(Number(localStorage.getItem("awalBulan")));
  } catch {
    return 1;
  }
}

export function awalValid(n: number): number {
  return Number.isInteger(n) && n >= 1 && n <= 28 ? n : 1;
}

/** "2026-09" untuk bulan yang sedang berjalan di Jakarta. */
export function bulanWib(sekarang = new Date(), awal = 1): string {
  const w = new Date(sekarang.getTime() + WIB_MS);
  const key = `${w.getUTCFullYear()}-${p2(w.getUTCMonth() + 1)}`;
  return w.getUTCDate() < awal ? geserBulan(key, -1) : key;
}

export function bulanValid(key: string | null | undefined): key is string {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key ?? "");
}

export function geserBulan(key: string, n: number): string {
  const d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}`;
}

/** "Sep 2026", atau "28 Agu – 27 Sep 2026" kalau bulannya tidak mulai tanggal 1. */
export function labelBulan(key: string, awal = 1): string {
  if (awal === 1) return `${BULAN_PENDEK[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  const { from, to } = batasBulanWib(key, awal);
  return labelRentang(tanggalWib(from), tanggalWib(to));
}

/**
 * Rentang bulan untuk filter API. `to` dikurangi 1 ms karena filter `to` di
 * API inklusif — tanpa itu transaksi tepat 00:00 tanggal 1 ikut dua bulan.
 */
export function batasBulanWib(key: string, awal = 1): { from: string; to: string } {
  const mulai = Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, awal) - WIB_MS;
  const akhir = Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), awal) - WIB_MS;
  return { from: new Date(mulai).toISOString(), to: new Date(akhir - 1).toISOString() };
}

/** Rentang bebas dari dua tanggal WIB, keduanya inklusif. */
export function batasRentangWib(dari: string, sampai: string): { from: string; to: string } {
  const [y1, m1, d1] = dari.split("-").map(Number);
  const [y2, m2, d2] = sampai.split("-").map(Number);
  return {
    from: new Date(Date.UTC(y1, m1 - 1, d1) - WIB_MS).toISOString(),
    to: new Date(Date.UTC(y2, m2 - 1, d2 + 1) - WIB_MS - 1).toISOString(),
  };
}

/** "2026-08-28" dari waktu ISO, menurut tanggal Jakarta. */
export function tanggalWib(iso: string): string {
  const w = new Date(new Date(iso).getTime() + WIB_MS);
  return `${w.getUTCFullYear()}-${p2(w.getUTCMonth() + 1)}-${p2(w.getUTCDate())}`;
}

export function tanggalValid(t: string | null | undefined): t is string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t ?? "");
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** "28 Agu – 27 Sep 2026"; tahun awal ditulis hanya kalau beda. */
export function labelRentang(dari: string, sampai: string): string {
  const bagian = (t: string) => `${Number(t.slice(8, 10))} ${BULAN_PENDEK[Number(t.slice(5, 7)) - 1]}`;
  const tahunAwal = dari.slice(0, 4) === sampai.slice(0, 4) ? "" : ` ${dari.slice(0, 4)}`;
  return `${bagian(dari)}${tahunAwal} – ${bagian(sampai)} ${sampai.slice(0, 4)}`;
}

/**
 * Periode dari query string: `?bulan=2026-09`, `?tampilan=<perTahun>&tahun=2026`,
 * atau `?dari=2026-08-28&sampai=2026-09-27`.
 * Nilai yang tidak valid jatuh ke bulan berjalan, bukan error — URL ini
 * diketik tangan dan dibagikan, jadi harus memaafkan.
 */
export function bacaPeriode(
  sp: { get(k: string): string | null },
  bulanIni: string,
  nilaiPerTahun: string,
): {
  bulan: string;
  tahun: number;
  perTahun: boolean;
  rentang: { dari: string; sampai: string } | null;
} {
  const dari = sp.get("dari");
  const sampai = sp.get("sampai");
  const rentang = tanggalValid(dari) && tanggalValid(sampai) && dari <= sampai ? { dari, sampai } : null;
  const b = sp.get("bulan");
  const bulan = bulanValid(b) ? b : rentang ? rentang.dari.slice(0, 7) : bulanIni;
  const t = Number(sp.get("tahun"));
  const tahun = Number.isInteger(t) && t >= 2000 && t <= 2100 ? t : Number(bulan.slice(0, 4));
  return { bulan, tahun, perTahun: !rentang && sp.get("tampilan") === nilaiPerTahun, rentang };
}

type Periode = ReturnType<typeof bacaPeriode>;

/** Batas API untuk periode apa pun. Setahun = dua belas bulan milik user. */
export function batasPeriode(p: Periode, awal = 1): { from: string; to: string } {
  if (p.rentang) return batasRentangWib(p.rentang.dari, p.rentang.sampai);
  if (!p.perTahun) return batasBulanWib(p.bulan, awal);
  return { from: batasBulanWib(`${p.tahun}-01`, awal).from, to: batasBulanWib(`${p.tahun}-12`, awal).to };
}

/** Kebalikan bacaPeriode: potongan query string untuk periode ini. */
export function queryPeriode(p: Periode, nilaiPerTahun: string): string {
  if (p.rentang) return `dari=${p.rentang.dari}&sampai=${p.rentang.sampai}`;
  return p.perTahun ? `tampilan=${nilaiPerTahun}&tahun=${p.tahun}` : `bulan=${p.bulan}`;
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
