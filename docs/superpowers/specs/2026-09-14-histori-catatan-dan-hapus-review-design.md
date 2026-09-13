# Histori catatan & hapus dari Review

Dua perubahan kecil tanpa migrasi database.

## 1. Hapus transaksi dari Review

Membuang transaksi yang tidak perlu dicatat (salah tangkap notifikasi,
transfer ke rekening sendiri) tanpa harus mengkategorikannya dulu.

- `Sheet` di `components/ui.tsx` mendapat properti opsional `aksi: ReactNode`,
  dirender di kepala popup sebelum tombol ✕. Tanpa `aksi`, tampilan sama
  seperti sekarang.
- Popup "Pilih kategori" di `/review` mengisi `aksi` dengan tombol ikon
  `sampah` (44×44, warna `--danger`, `aria-label="Hapus transaksi"`).
- Tekan → `confirm("Hapus transaksi ini?")` → `DELETE /api/transactions/:id`
  (soft delete, sudah ada).
  - Berhasil: popup tertutup, kartu memudar lalu hilang — alur yang sama
    dengan setelah Simpan.
  - Gagal: popup tetap terbuka, `WarningBanner` danger "Gagal menghapus. Coba lagi."
- Hanya di Review. Formulir ubah transaksi sudah punya tombol Hapus sendiri.

## 2. Histori catatan

Chip catatan yang pernah dipakai di bawah kolom Catatan; tekan untuk mengisi.

### `GET /api/notes?category_id=<uuid>&q=<teks>`

- Zod: `category_id` uuid opsional, `q` string opsional maks 100 (di-trim).
  401 tanpa session.
- Respons `{ "items": ["Sop Pak Samson", "Olive"] }`, maksimal 8.

### Service `noteSuggestions(userId, { categoryId?, q? })` — `backend/services/notes.ts`

Satu query ke `transactions`:

- `user_id = …`, `deleted_at IS NULL`, `occurred_at >= now() - 90 hari`,
  `btrim(note) <> ''`.
- `q` ada → `note ILIKE '%' || pola || '%' ESCAPE '\'`, dengan `pola` =
  `escapeLike(q)`.
- `GROUP BY btrim(note)`.
- Urutan: kalau `categoryId` ada, `bool_or(category_id = categoryId) DESC`
  lebih dulu — catatan yang pernah dipakai dengan kategori itu naik ke atas,
  sisanya menambal sampai 8. Lalu `count(*) DESC`, lalu `max(occurred_at) DESC`.
- `LIMIT 8`.

`escapeLike(teks)` di `backend/services/notes-like.ts` (murni, tanpa import
database): mengawali `\`, `%`, `_` dengan `\`.

### Komponen `NoteSuggestions` — `components/NoteSuggestions.tsx`

Props: `categoryId: string | null`, `teks: string`, `onPilih(note)`.

- Mengambil `/api/notes` saat `categoryId` atau `teks` berubah, dengan jeda
  250 ms; permintaan lama yang selesai belakangan diabaikan.
- Merender `CategoryChip` dalam baris yang membungkus. Chip yang isinya sama
  persis dengan `teks` (setelah trim) disembunyikan.
- Tidak ada saran atau gagal ambil → tidak merender apa-apa.

Dipasang di bawah kolom Catatan pada popup `/review` dan `TransactionForm`
(tambah dan ubah).

## Uji

- `backend/services/notes-like.test.ts`: `escapeLike` untuk `%`, `_`, `\`,
  dan teks biasa.
- `noteSuggestions` dicocokkan ke database: dengan kategori, catatan
  kategori itu di atas; tanpa kategori, urut tersering.
- `GET /api/notes` tanpa session → 401.
- `node --test`, `tsc --noEmit`, `eslint`, `next build` lulus.
