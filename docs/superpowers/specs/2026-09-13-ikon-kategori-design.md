# Ikon kategori (emoji)

Bagian pertama dari tiga perubahan berurutan: **ikon kategori** → transaksi per
periode → layar statistik. Dua yang terakhir menampilkan ikon ini, jadi ini
dikerjakan duluan.

## Tujuan

Setiap kategori boleh punya satu emoji (🍜, ☕, ⛽) yang tampil di depan
namanya di semua tempat kategori muncul. Tujuannya pengenalan cepat saat
menggulir, bukan dekorasi.

Emoji asli, bukan ikon garis Lucide: disimpan sebagai teks, diketik dari
keyboard HP, sehingga kategori apa pun bisa punya ikon tanpa daftar yang
disiapkan di kode. Aturan "tanpa emoji" di `CLAUDE.md` dipersempit menjadi
"tanpa emoji di kalimat UI"; ikon kategori dikecualikan.

## Data

- Kolom baru `categories.icon text NULL`. Kosong berarti kategori tampil tanpa
  ikon, bukan error.
- Migrasi Drizzle (`pnpm db:generate`) untuk kolomnya, ditambah `UPDATE` di
  file migrasi yang sama untuk mengisi emoji ke kategori yang **namanya persis**
  salah satu nama default. Kategori buatan sendiri tidak disentuh.
- `DEFAULT_CATEGORIES` di `backend/db/defaults.ts` berubah dari daftar nama
  menjadi daftar `{ name, icon }`. Pemanggilnya (seed dan login pertama)
  ikut disesuaikan.

| Nama | Ikon |
|---|---|
| Makan & Minum | 🍜 |
| Jajan | 🍩 |
| Belanja Harian | 🛒 |
| Transport | 🚌 |
| Bensin | ⛽ |
| Pulsa & Internet | 📶 |
| Listrik & Air | 💡 |
| Sewa & Kos | 🏠 |
| Kesehatan | 💊 |
| Pendidikan | 🎓 |
| Hiburan | 🎬 |
| Olahraga | ⚽ |
| Donasi | 🤲 |
| Transfer | 🔁 |
| Gaji | 💰 |

## API

- `app/api/categories/spec.ts`: body menerima `icon: z.string().trim().max(16).nullish()`;
  string kosong disimpan sebagai `NULL`. JSON mengembalikan `icon`. Tidak ada
  pengecekan "benar-benar emoji" — keyboard yang menjaga, dan teks pendek lain
  tidak merusak apa pun.
- `CATALOG.categories.columns` di `backend/services/catalog.ts` ikut memuat `icon`.
- `SuggestedCategory` menjadi `{ id, name, icon }` — terbawa otomatis ke
  `suggested_categories` di `/api/transactions?with_suggestions=true` dan
  respons `/api/ingest`.
- `by_category` di `/api/summary` menjadi `{ id, name, icon, total }`. Baris
  "Belum dikategorikan" ber-`icon: null`.

## Web

- Helper `labelKategori({ name, icon })` di `lib/format.ts` → `"🍜 Makan & Minum"`,
  atau `"Makan & Minum"` kalau ikon kosong. Satu-satunya tempat format ini
  dirakit.
- Dipakai di: chip di `/review`, `/transaksi` (filter), `TransactionForm`;
  baris kategori di `TransactionCard` (lewat prop `category` yang sudah ada);
  breakdown di Ringkasan; daftar di `/kategori`.
- Popup `/kategori` untuk jenis kategori mendapat kolom **Ikon** (satu `Input`
  pendek, placeholder `🍜`) di atas **Nama**. Tanpa picker buatan.

Tidak ada komponen di `components/ui.tsx` yang berubah strukturnya; chip dan
kartu tetap menerima label berupa string.

## Android

- `KirimWorker.kt`: saat membaca `suggested_categories`, label tombol dirakit
  dari `optString("icon")` + nama. `optString` supaya server yang belum
  mengirim `icon` tetap aman.
- Berlaku setelah APK di-build dan dipasang ulang; web tidak bergantung padanya.

## Uji

- `lib/format.test.ts`: `labelKategori` dengan ikon, tanpa ikon (`null`), dan
  ikon string kosong.
- `node --test`, `eslint`, `next build` lulus.
- Server lokal: `GET /api/categories` mengembalikan `icon`; `PATCH` dengan
  `icon: ""` menyimpan `null`.

## Di luar lingkup

- Warna per kategori (untuk pie chart) — dibahas di spec statistik.
- Picker emoji, ikon untuk akun, ikon Lucide.
