// Batas waktu menurut jam Jakarta, dikembalikan sebagai waktu UTC untuk query.
// Murni, tanpa import database, supaya bisa diuji dengan `node --test`.

// WIB tidak punya DST. Bulan berjalan dihitung menurut jam Jakarta, bukan UTC,
// supaya transaksi jam 7 pagi tanggal 1 tidak jatuh ke bulan sebelumnya.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Batas bulan menurut WIB, dikembalikan sebagai waktu UTC untuk query. */
export function batasBulan(key?: string, sekarang = new Date()) {
  const wib = new Date(sekarang.getTime() + WIB_OFFSET_MS);
  const tahun = key ? Number(key.slice(0, 4)) : wib.getUTCFullYear();
  const bulan = key ? Number(key.slice(5, 7)) - 1 : wib.getUTCMonth();

  const awal = new Date(Date.UTC(tahun, bulan, 1) - WIB_OFFSET_MS);
  const akhir = new Date(Date.UTC(tahun, bulan + 1, 1) - WIB_OFFSET_MS);

  // Berapa hari bulan ini sudah berjalan; untuk bulan lampau, sebulan penuh.
  const habis = sekarang >= akhir;
  const hari = habis
    ? new Date(Date.UTC(tahun, bulan + 1, 0)).getUTCDate()
    : Math.max(1, wib.getUTCDate());

  return {
    key: `${tahun}-${String(bulan + 1).padStart(2, "0")}`,
    label: `${NAMA_BULAN[bulan]}${tahun === wib.getUTCFullYear() ? "" : ` ${tahun}`}`,
    awal,
    akhir,
    hari,
  };
}

/** Satu tahun kalender menurut WIB. `akhir` eksklusif. */
export function batasTahun(tahun: number) {
  return {
    awal: new Date(Date.UTC(tahun, 0, 1) - WIB_OFFSET_MS),
    akhir: new Date(Date.UTC(tahun + 1, 0, 1) - WIB_OFFSET_MS),
  };
}
