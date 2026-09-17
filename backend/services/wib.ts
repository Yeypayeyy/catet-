// Batas waktu menurut jam Jakarta, dikembalikan sebagai waktu UTC untuk query.
// Murni, tanpa import database, supaya bisa diuji dengan `node --test`.

// WIB tidak punya DST. Bulan berjalan dihitung menurut jam Jakarta, bukan UTC,
// supaya transaksi jam 7 pagi tanggal 1 tidak jatuh ke bulan sebelumnya.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const HARI_MS = 24 * 60 * 60 * 1000;

/**
 * Batas bulan menurut WIB, dikembalikan sebagai waktu UTC untuk query.
 * `mulai` = tanggal awal bulan milik user (1–28): bulan "2026-09" dengan
 * mulai 28 adalah 28 Agustus s.d. 27 September — dinamai bulan berakhirnya.
 */
export function batasBulan(key?: string, sekarang = new Date(), mulai = 1) {
  const wib = new Date(sekarang.getTime() + WIB_OFFSET_MS);
  // Sejak tanggal gajian, sudah masuk periode bulan depan.
  const geser = !key && mulai > 1 && wib.getUTCDate() >= mulai ? 1 : 0;
  const k = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() + geser, 1));
  const tahun = key ? Number(key.slice(0, 4)) : k.getUTCFullYear();
  const bulan = key ? Number(key.slice(5, 7)) - 1 : k.getUTCMonth();

  const mundur = mulai > 1 ? 1 : 0;
  const awal = new Date(Date.UTC(tahun, bulan - mundur, mulai) - WIB_OFFSET_MS);
  const akhir = new Date(Date.UTC(tahun, bulan + 1 - mundur, mulai) - WIB_OFFSET_MS);

  // Berapa hari periode ini sudah berjalan; untuk periode lampau, penuh.
  const habis = sekarang >= akhir;
  const hari = Math.max(1, Math.ceil(((habis ? akhir : sekarang).getTime() - awal.getTime()) / HARI_MS));

  const labelTanggal = (d: Date) => {
    const w = new Date(d.getTime() + WIB_OFFSET_MS);
    return `${w.getUTCDate()} ${NAMA_BULAN[w.getUTCMonth()].slice(0, 3)}`;
  };

  return {
    key: `${tahun}-${String(bulan + 1).padStart(2, "0")}`,
    label:
      mulai === 1
        ? `${NAMA_BULAN[bulan]}${tahun === wib.getUTCFullYear() ? "" : ` ${tahun}`}`
        : `${labelTanggal(awal)} – ${labelTanggal(new Date(akhir.getTime() - 1))}`,
    awal,
    akhir,
    hari,
  };
}

/** Satu tahun menurut WIB: dua belas bulan yang mulai tanggal `mulai`. `akhir` eksklusif. */
export function batasTahun(tahun: number, mulai = 1) {
  return {
    awal: new Date(Date.UTC(tahun, mulai > 1 ? -1 : 0, mulai) - WIB_OFFSET_MS),
    akhir: new Date(Date.UTC(tahun + 1, mulai > 1 ? -1 : 0, mulai) - WIB_OFFSET_MS),
  };
}
