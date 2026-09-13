# Transaksi per periode

Bagian kedua dari tiga: ikon kategori (selesai) → **transaksi per periode** →
layar statistik.

## Tujuan

Layar `/transaksi` sekarang berupa satu daftar panjang dengan tombol "Muat
lagi". Diganti menjadi daftar yang dibaca **per periode**: pilih bulan, lihat
transaksinya dikelompokkan per hari beserta subtotalnya; atau pilih tahun,
lihat total per bulan.

Dua tampilan: **Harian** dan **Bulanan**. Kalender, Tutup buku, Memo, dan
pencarian di luar lingkup.

## Layar `/transaksi`

```
Transaksi
  <   Sep 2026   >
 [ Harian ] [ Bulanan ]
 Pemasukan      Pengeluaran     Selisih
 +Rp0           Rp913.000       −Rp913.000
```

- **Navigasi periode:** panah kiri/kanan menggeser satu bulan (Harian) atau
  satu tahun (Bulanan). Tampilan dipilih lewat dua chip.
- **Periode ada di URL:** `?bulan=2026-09` untuk Harian,
  `?tampilan=bulanan&tahun=2026` untuk Bulanan. Tanpa parameter berarti Harian
  bulan berjalan menurut WIB. Tombol kembali dan refresh tetap di periode yang
  sama. Parameter yang tidak valid diperlakukan seperti tanpa parameter.
- **Ringkasan periode:** Pemasukan `+Rp…` dengan `--income`, Pengeluaran
  dengan `--danger`, Selisih netral (`--ink`), bertanda `−` kalau negatif
  lewat `formatRupiah`. Ini satu-satunya tempat pengeluaran diberi warna;
  baris-baris di bawahnya tetap netral.
- **Saring kategori:** chip yang sudah ada tetap, di bawah ringkasan, hanya di
  Harian. Ringkasan periode ikut tersaring.
- **Tambah:** tombol bulat 56px `--accent` berikon `tambah` di kanan bawah,
  mengambang di atas nav bawah, menuju `/transaksi/baru`. Tombol "Tambah" di
  kepala layar dihapus.

## Tampilan Harian

- Satu kartu (`--surface`, garis 1px, radius 20) per hari yang punya
  transaksi, terbaru di atas.
- **Kepala kartu:** tanggal besar (`09`) dan hari singkat (`Rab`) di kiri;
  di kanan subtotal hari itu — pemasukan `+Rp…` hijau kalau ada, lalu
  pengeluaran netral.
- **Baris transaksi**, dipisah garis `--border`:
  - kiri, lebar tetap ~104px, `--ink-3`, satu baris terpotong: `labelKategori`,
    atau `Belum` kalau belum dikategorikan;
  - tengah: judul (`note ?? merchant ?? "—"`) dan nama akun kecil di bawahnya;
  - kanan: `Amount` ukuran `sm`.
- Menekan baris membuka `/transaksi/[id]`.
- Kosong: `EmptyState` "Belum ada transaksi di Sep 2026."

Barisnya komponen baru kecil di dalam file halaman; `TransactionCard` tidak
diubah karena masih dipakai Review dan Ringkasan.

## Tampilan Bulanan

- 12 baris Januari–Desember dalam satu kartu. Tiap baris: nama bulan di kiri;
  di kanan pengeluaran (netral), dengan pemasukan `+Rp…` hijau dan selisih
  kecil di bawahnya.
- Bulan tanpa transaksi tetap tampil dengan warna `--ink-3`.
- Menekan satu bulan pindah ke `?bulan=YYYY-MM` (Harian).
- Ringkasan periode di atas = jumlah 12 bulan itu.

## Data

### Harian — endpoint yang sudah ada

- `GET /api/transactions?from=…&to=…&limit=200[&category_id=…]`.
- Batas bulan dihitung di browser menurut WIB: `from` = tanggal 1 pukul 00:00
  WIB, `to` = tanggal 1 bulan berikutnya 00:00 WIB **dikurangi 1 ms** (filter
  `to` di API inklusif).
- Kalau `next_offset` tidak `null`, halaman berikutnya diambil sampai habis.
- Nama akun untuk baris diambil dari `GET /api/accounts`, nama kategori dari
  `GET /api/categories` — sama seperti sekarang.
- Pengelompokan per hari (tanggal WIB), subtotal, dan ringkasan periode
  dihitung di browser dengan `BigInt`. Konversi ke Asia/Jakarta memang hanya
  boleh di UI.

### Bulanan — endpoint baru

`GET /api/transactions/monthly?year=2026`

- Route handler: validasi Zod `year` (bilangan bulat 2000–2100, default tahun
  berjalan WIB), panggil service, bentuk respons. 401 tanpa session.
- Service `monthlyTotals(userId, year)` di `backend/services/monthly.ts`:
  satu query, `WHERE user_id = … AND deleted_at IS NULL` dan rentang tahun
  WIB, `GROUP BY` bulan dari `occurred_at AT TIME ZONE 'Asia/Jakarta'`,
  menjumlahkan debit dan credit terpisah.
- Hasil query diteruskan ke fungsi murni `isiDuaBelasBulan(year, rows)` di
  `backend/services/monthly-rows.ts` (tanpa import database, seperti
  `category-rank.ts`) yang selalu mengembalikan 12 entri; bulan tanpa baris
  diisi nol.
- Respons:

```json
{
  "year": 2026,
  "months": [
    { "month": "2026-01", "income": "0", "spending": "0" },
    { "month": "2026-09", "income": "0", "spending": "913000" }
  ]
}
```

  (12 entri; nominal string satuan minor.)

## Uji

- `lib/periode.test.ts` untuk fungsi murni di `lib/periode.ts`:
  - `batasBulanWib("2026-09")` → `from` 2026-08-31T17:00:00.000Z,
    `to` 2026-09-30T16:59:59.999Z;
  - pergeseran bulan melewati tahun (`2026-12` + 1 → `2027-01`);
  - `kelompokkanPerHari`: transaksi 2026-08-31T17:30Z masuk ke tanggal
    **1 Sep** WIB, bukan 31 Agustus; subtotal debit dan credit terpisah;
    urutan hari terbaru dulu.
- `backend/services/monthly-rows.test.ts` untuk `isiDuaBelasBulan`: bulan kosong
  jadi nol, urutan Januari–Desember, nominal tetap string.
- `node --test`, `eslint`, `next build` lulus.
- Server lokal: `GET /api/transactions/monthly` tanpa session → 401 (session
  dicek sebelum query, seperti route lain, jadi `year=abc` tanpa session juga
  401). `monthlyTotals` dicocokkan dengan query mentah ke database.

## Di luar lingkup

- Kalender, Tutup buku, Memo, pencarian.
- Saring per akun atau arah.
- Mengubah Ringkasan atau Review.
