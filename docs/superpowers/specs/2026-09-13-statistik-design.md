# Statistik

Bagian ketiga dari tiga: ikon kategori (selesai) → transaksi per periode
(selesai) → **statistik**.

## Tujuan

Satu layar untuk menjawab "uangku ke mana, dan bagaimana dibanding bulan
lain": empat angka periode, donat per kategori, dan tren dua belas bulan.

Di luar lingkup: Analisis Cerdas / rekomendasi, Ekspor, preset 7 hari /
30 hari / YTD / Kustom, menekan kategori untuk membuka daftar transaksinya.

## Navigasi

- Nav bawah menjadi empat tujuan: **Ringkasan · Review · Transaksi ·
  Statistik**. Ikon baru `statistik` di `components/Icon.tsx` (path Lucide
  `chart-column`). Komentar "tiga tujuan, tidak lebih" di `BottomNav`
  diperbarui.
- Kartu "Pengeluaran {bulan}" di Ringkasan menjadi tautan ke
  `/statistik?bulan={month.key}`.

## Layar `/statistik`

Urutan dari atas:

1. `ScreenHeader` "Statistik".
2. **Navigasi periode** `< Sep 2026 >` dan chip **Bulanan / Tahunan**.
   Periode di URL: `?bulan=2026-09` atau `?tampilan=tahunan&tahun=2026`.
   Tanpa parameter atau parameter tidak valid = bulan berjalan WIB. Aturan
   sama persis dengan `/transaksi`.
3. **Empat kartu angka** (grid 2×2, kartu `--surface`):
   - Pemasukan `+Rp…` `--income`
   - Pengeluaran `Rp…` `--danger`
   - Arus kas bersih = pemasukan − pengeluaran, `--ink`, `−` kalau negatif
   - Rasio nabung = (pemasukan − pengeluaran) / pemasukan, satu desimal
     dengan koma (`72,3%`); `—` kalau pemasukan nol. Boleh negatif.
4. **Chip Pengeluaran / Pemasukan** (state lokal, default Pengeluaran).
5. **Donat** dalam kartu: diameter ~200px, total jenis terpilih di tengah
   (`Amount` `md`). Irisan: 7 kategori terbesar dengan `--chart-1…7`, sisanya
   digabung jadi "Lainnya" dengan `--chart-8` (abu-abu). "Belum
   dikategorikan" diperlakukan seperti kategori biasa.
6. **Daftar kategori** di bawah donat, satu baris per irisan: kotak warna
   10px, `labelKategori` (atau "Lainnya"), persen, nominal. Warna chart
   hanya muncul di donat dan kotak ini.
7. **Tren {tahun}**: kartu berisi 12 pasang batang (pemasukan `--income`,
   pengeluaran `--danger`), tinggi relatif ke nilai terbesar setahun, label
   bulan satu huruf di bawah. Pada tampilan Bulanan, pasangan bulan terpilih
   penuh dan yang lain `opacity: 0.45`. Menekan satu pasangan pindah ke
   `?bulan=YYYY-MM`.

Kosong: kalau total jenis terpilih nol, donat dan daftar diganti
`EmptyState` "Belum ada pengeluaran di Sep 2026." (atau "pemasukan",
atau "di 2026"). Kartu angka dan tren tetap tampil.

## Komponen

- `components/Periode.tsx` (baru): `NavPeriode` dan `RingkasanPeriode`
  dipindah dari `app/transaksi/page.tsx` apa adanya, lalu diimpor oleh
  Transaksi dan Statistik. Tidak ada perubahan perilaku di Transaksi.
- `Donat` dan `Tren` ditulis di `app/statistik/page.tsx` sebagai SVG:
  - Donat: satu `<circle>` per irisan dengan `stroke-dasharray` /
    `stroke-dashoffset`, diputar -90° supaya mulai dari atas.
  - Tren: `<rect>` per batang di `viewBox` tetap, lebar mengikuti kartu.
- `app/globals.css`: token `--chart-1` … `--chart-8` di `:root` dan `.dark`,
  plus pemetaan `@theme inline` kalau pola file itu memerlukannya. Nilai
  dipilih supaya bisa dibedakan berdampingan dan kontras di kedua tema;
  `--chart-8` netral abu-abu.

## Data

### `GET /api/statistics?month=2026-09` | `?year=2026`

- Zod: `month` regex `YYYY-MM`, `year` bilangan bulat 2000–2100; boleh salah
  satu, keduanya ditolak 400, tidak ada = bulan berjalan WIB. 401 tanpa
  session (dicek duluan, seperti route lain).
- Service `statistics(userId, rentang)` di `backend/services/statistics.ts`:
  - total pemasukan dan pengeluaran dalam rentang;
  - `by_category` per arah: `LEFT JOIN categories`, `GROUP BY` kategori,
    urut total terbesar; baris tanpa kategori → `{ id: null, name:
    "Belum dikategorikan", icon: null }`.
  - Semua query `user_id = …` dan `deleted_at IS NULL`.
- Batas WIB: `batasBulan` dipindah dari `summary.ts` ke file murni
  `backend/services/wib.ts` (tanpa import database) bersama `batasTahun(year)`
  yang baru. `summary.ts` mengimpornya dan tetap mengekspor ulang
  `batasBulan`, supaya `dbcheck.ts` tidak berubah.
- Respons:

```json
{
  "range": { "from": "2026-08-31T17:00:00.000Z", "to": "2026-09-30T17:00:00.000Z" },
  "income": "20000000",
  "spending": "5535000",
  "by_category": {
    "debit": [{ "id": "…", "name": "Makan & Minum", "icon": "🍜", "total": "484000" }],
    "credit": [{ "id": null, "name": "Belum dikategorikan", "icon": null, "total": "20000000" }]
  }
}
```

  `to` eksklusif. Nominal string satuan minor.

### Tren

Memakai `GET /api/transactions/monthly?year=…` yang sudah ada.

### Di browser — `lib/statistik.ts` (murni)

- `potongIrisan(rows, n = 7)` → `n` teratas + satu "Lainnya" (id `"lainnya"`)
  kalau sisa > 0; jumlah total tidak berubah. Setiap irisan membawa `persen`
  dan `pecahan`.
- `persen(bagian, total)` → string satu desimal berkoma, dihitung dengan
  BigInt (`bagian * 1000n / total`, dibulatkan setengah ke atas); `"0,0"`
  kalau total nol. `pecahan` (float 0–1) hanya untuk menggambar.
- `rasioNabung(masuk, keluar)` → `"72,3%"`, atau `"—"` kalau `masuk` nol.

## Uji

- `lib/statistik.test.ts`: potong 9 kategori → 7 + Lainnya dengan total
  sama; ≤ 7 kategori → tanpa Lainnya; `persen` pembulatan (1/3 → `"33,3"`,
  2/3 → `"66,7"`); total nol; `rasioNabung` untuk nol, positif, negatif.
- `backend/services/wib.test.ts`: `batasTahun(2026)` → 2025-12-31T17:00Z
  sampai 2026-12-31T17:00Z; `batasBulan("2026-09")` tetap sama.
- `node --test`, `eslint`, `next build` lulus; `dbcheck` yang memakai
  `batasBulan` masih bisa dijalankan.
- `statistics()` dicocokkan dengan query mentah ke database untuk
  September 2026: total pengeluaran sama dengan jumlah `by_category.debit`.
