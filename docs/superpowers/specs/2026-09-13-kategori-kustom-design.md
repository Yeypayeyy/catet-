# Kategori kustom: jenis, urutan, sembunyikan, pemilih grid

Menyusul ikon kategori (selesai). Mengikuti pola app lama (Money Manager):
kategori pengeluaran dan pemasukan terpisah, urutannya diatur sendiri, dan
dipilih dari grid.

## Tujuan

- App membawa **kategori bawaan**; user boleh **menambah** kategori sendiri.
- Kategori bawaan yang tidak dipakai **disembunyikan** (bisa dipakai lagi);
  kategori buatan sendiri **dihapus**.
- Kategori **pengeluaran** dan **pemasukan** terpisah, masing-masing dengan
  **urutan manual** yang diatur dengan menyeret ☰.
- Kategori dipilih dari **grid 3 kolom**, dengan ✎ yang langsung membuka
  pengelola kategori.

Di luar lingkup: sub kategori, impor dari Money Manager (spec terpisah).

## Data — migrasi 0005

Kolom baru di `categories`:

| Kolom | Tipe | Isi |
|---|---|---|
| `kind` | enum `category_kind` (`expense`, `income`), `NOT NULL DEFAULT 'expense'` | arah transaksi yang boleh memakai kategori ini |
| `sort_order` | `integer NOT NULL DEFAULT 0` | urutan dalam satu `kind`, kecil di atas |
| `is_default` | `boolean NOT NULL DEFAULT false` | kategori bawaan app |
| `hidden_at` | `timestamptz NULL` | kapan disembunyikan; `NULL` = aktif |

`hidden_at` sengaja terpisah dari `deleted_at`: disembunyikan bisa dibatalkan
dan tetap tampil sebagai label transaksi lama; dihapus tidak.

Isi migrasi untuk baris yang sudah ada (ditulis di file SQL yang sama,
setelah `ALTER TABLE`):

- `kind = 'income'` untuk nama `Gaji`; sisanya tetap `expense`.
- `is_default = true` untuk nama yang persis ada di `DEFAULT_CATEGORIES`.
- `sort_order` = posisi nama di `DEFAULT_CATEGORIES`; baris lain diberi
  urutan setelahnya, per user, urut nama (`row_number()`).

`DEFAULT_CATEGORIES` di `backend/db/defaults.ts` menjadi
`{ name, icon, kind }[]` dan mendapat kategori pemasukan tambahan:
💰 Gaji (sudah ada, dipindah ke `income`), 🎁 Hadiah, 💵 Pemasukan Lain.
User baru (`ensureProfile`, `seed.ts`) mendapat `is_default: true` dan
`sort_order` sesuai posisi. Kategori pemasukan tambahan **tidak** disuntikkan
ke user lama oleh migrasi; user lama menambahkannya sendiri kalau perlu.

## API

### `GET /api/categories`

Setiap item: `{ id, name, icon, kind, sort_order, is_default, hidden, parent_id }`
(`hidden` = `hidden_at IS NOT NULL`). Urut `kind`, lalu `sort_order`, lalu
`name`. Kategori tersembunyi ikut dikirim; penyaringan untuk pemilih
dilakukan di browser.

### `POST /api/categories`

Body: `name`, `icon`, **`kind` wajib**. Server mengisi `is_default = false` dan
`sort_order = max(sort_order) + 1` dalam `kind` itu milik user. `is_default`
dan `sort_order` dari body diabaikan.

### `PATCH /api/categories/:id`

Boleh mengubah `name`, `icon`, `hidden` (boolean → `hidden_at = now()` atau
`NULL`). `kind` tidak bisa diubah setelah dibuat (transaksi lama sudah
memakainya di arah itu).

### `DELETE /api/categories/:id`

Kategori `is_default = true` → **409** `DEFAULT_CATEGORY`, pesan "Kategori
bawaan disembunyikan, bukan dihapus." Lainnya soft delete seperti sekarang.

`app/api/crud.ts` mendapat satu kait opsional di `CrudSpec`:
`beforeDelete?(userId, id) => Promise<Response | null>`; hanya kategori yang
memakainya.

### `PUT /api/categories/order`

Body: `{ kind: "expense" | "income", ids: uuid[] }` (1–200, tanpa duplikat).
Service `reorderCategories(userId, kind, ids)` di `backend/services/catalog.ts`:
dalam satu transaksi, cek semua id milik user, belum dihapus, dan ber-`kind`
sama — kalau tidak, 404 `NOT_FOUND`; lalu satu `UPDATE … FROM (VALUES …)`
yang mengisi `sort_order` = indeks. Respons 204.

## Saran kategori

`pemberiSaran(userId)` mengembalikan `(amount, occurredAt, direction) => …`.

- Kategori yang boleh disarankan: `kind` sesuai arah (`debit` → `expense`,
  `credit` → `income`), tidak tersembunyi, tidak dihapus.
- Aturan (`category_rules`) yang menunjuk kategori tidak memenuhi syarat itu
  dilewati; cadangan "tersering" disaring dengan syarat yang sama.
- Perakitan hasil (aturan dulu, lalu cadangan, maksimal 3, tanpa duplikat)
  dipindah menjadi fungsi murni `susunSaran(urutanAturan, kategori, cadangan, kind)`
  di `backend/services/category-rank.ts` supaya bisa diuji tanpa database.
- Pemanggil disesuaikan: `ingest.ts`, `inbox.ts`, `transactions.ts`
  (`with_suggestions`), dan `dbcheck.ts`. `suggestCategories` mendapat
  parameter `direction`.

Android tidak berubah: yang menyaring server.

## Web

### `CategoryGrid` (baru, `components/ui.tsx`)

Props: `kategori` (sudah disaring), `terpilih`, `onPilih`, `hrefKelola`.

- Kepala: "Kategori" dan tombol ✎ (ikon `pensil`) menuju `hrefKelola`.
- Grid 3 kolom, sel minimal 56px, garis `--border` antar sel (seperti app
  lama), isi emoji + nama rata tengah, nama boleh dua baris.
- Terpilih: latar `--accent-soft`, garis `--accent`.

Dipakai di:

- **Popup Review** — chip "Saran" tetap di atas, lalu `CategoryGrid` berisi
  kategori aktif ber-`kind` sesuai arah transaksi. `hrefKelola` =
  `/kategori?jenis=pengeluaran|pemasukan`.
- **`TransactionForm`** — menggantikan deretan chip. Mengganti arah
  (Pengeluaran ↔ Pemasukan) mengosongkan pilihan kategori kalau `kind`-nya
  tidak cocok. Menekan ✎ berpindah halaman; isian formulir yang belum
  disimpan hilang — diterima, tidak ditangani.

Kategori tersembunyi yang **sudah** terpasang di transaksi yang sedang diubah
tetap ditampilkan di grid (supaya pilihannya terlihat), diberi `opacity 0.5`.

Chip saring di `/transaksi` memakai kategori aktif kedua `kind`, sesuai urutan.

### Layar `/kategori`

- Tiga tab chip: **Pengeluaran · Pemasukan · Akun**. Tab dari
  `?jenis=pengeluaran|pemasukan|akun`, default pengeluaran.
- Tab kategori:
  - Daftar aktif, satu baris: pegangan ☰ (ikon baru `pegangan`, Lucide
    `grip-vertical`), `labelKategori`, tombol ✎.
  - **Seret:** `pointerdown` pada ☰ memulai; baris mengikuti jari
    (`transform: translateY`), baris lain bergeser saat dilewati setengah
    tingginya; `pointerup` menaruh dan memanggil `PUT /api/categories/order`
    sekali. `touch-action: none` hanya di ☰ supaya daftar tetap bisa digulir.
    Gagal simpan → urutan kembali ke sebelum diseret, `WarningBanner` danger.
  - **+ Tambah** membuat kategori di `kind` tab aktif.
  - Popup ✎: Ikon, Nama, Simpan, lalu **Sembunyikan** (bawaan) atau
    **Hapus** (buatan sendiri, dengan konfirmasi).
  - Bagian **Disembunyikan** di bawah (hanya kalau ada): baris redup; ditekan
    → `PATCH hidden: false`, pindah ke daftar aktif di urutan terakhirnya.
- Tab Akun: isi yang sekarang, tidak berubah.

## Uji

- `lib/urutan.test.ts` — `pindahkan(list, dari, ke)`: ke atas, ke bawah, ke
  posisi sama, batas awal/akhir; masukan tidak dimutasi.
- `backend/services/category-rank.test.ts` — `susunSaran`: kategori beda
  `kind` dan tersembunyi tidak pernah muncul; aturan dulu lalu cadangan;
  maksimal 3; tanpa duplikat.
- Isi migrasi dicek langsung ke database: jumlah per `kind`, `is_default`
  terisi, `sort_order` unik per user dan `kind`.
- `dbcheck.ts` diperbarui ke tanda tangan baru dan tetap lolos typecheck.
- `node --test`, `eslint`, `tsc --noEmit`, `next build` lulus.
- Server lokal: `PUT /api/categories/order` tanpa session → 401.
