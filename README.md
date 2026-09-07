# Catet!

Pencatatan keuangan yang tidak minta dicatat.

Bayar pakai QRIS, notifikasi m-banking ditangkap otomatis, transaksinya masuk
sendiri. Yang tersisa buat kamu cuma satu tap untuk memilih kategori — tanpa
membuka aplikasi apa pun.

## Masalah yang dipecahkan

1. **Lupa mencatat.** Aplikasi keuangan menunggu diingat. Yang ini datang
   sendiri lewat notifikasi begitu ada transaksi terdeteksi.
2. **Bolak-balik dua aplikasi untuk satu transaksi.** Nominalnya sudah ada di
   notifikasi bank. Tidak ada alasan mengetik ulang.

## Cara kerjanya

```
bayar QRIS
   ↓
notifikasi myBCA muncul
   ↓
Android menangkap  →  POST /api/ingest
   ↓
payload mentah disimpan dulu, apa adanya
   ↓
parser baca nominal & arah
   ↓
transaksi tersimpan, kategori masih kosong
   ↓
notifikasi balik ke HP: "Rp10.000" + 3 tombol kategori
   ↓
satu tap. selesai.
```

Kalau notifikasinya tidak terbaca, parser mengembalikan `null` dan **tidak ada
transaksi yang dibuat** — payload mentahnya tetap tersimpan untuk diperiksa
belakangan. Lebih baik tidak mencatat daripada mencatat angka yang salah.

## Prinsip

- **Uang selalu `bigint` satuan minor.** Tidak pernah float, termasuk di JSON —
  nominal dikirim sebagai string.
- **Simpan mentah sebelum parsing.** Selalu. Parser boleh salah, data tidak
  boleh hilang.
- **Ragu berarti berhenti.** Tidak ada tebakan yang disimpan sebagai fakta.
- **Tanpa LLM.** Kategorisasi berbasis aturan, belajar dari kebiasaan sendiri.
- **Tidak ada data yang keluar** ke pihak ketiga mana pun.
- **Android setipis mungkin.** Apa pun yang bisa dikerjakan di web, tidak masuk
  ke Android.

## Stack

| | |
|---|---|
| Backend + Web | Next.js 16 App Router, TypeScript strict, Tailwind |
| Database | Supabase PostgreSQL lewat transaction pooler, Drizzle ORM |
| Android | Kotlin, min SDK 26. Tanpa Compose, Room, atau DI |
| Deploy | Vercel |

## Struktur

Satu app, satu deploy. Pemisahan backend/frontend ditegakkan lewat folder dan
aturan eslint, bukan lewat infrastruktur.

```
backend/       Logika domain. Tidak boleh diimpor komponen React.
  db/          skema Drizzle, client postgres-js, migrasi
  parsers/     parser notifikasi per bank
  services/    ingest, saran kategori, DLQ
  auth/        session user + verifikasi token device
app/api/       Lapisan HTTP. Tipis: validasi Zod → service → response.
app/           Halaman & layout.
components/    Komponen UI.
lib/           Helper frontend.
```

`app/`, `components/`, dan `lib/` tidak pernah mengimpor `backend/` — akses data
hanya lewat HTTP. Sebaliknya `backend/` tidak pernah menyentuh React atau
`next/*`. Keduanya dijaga `no-restricted-imports` di `eslint.config.mjs`.

## Menjalankan

```bash
pnpm install
```

Isi `.env` mengikuti `.env.example`:

- `DATABASE_URL` — Supabase → Settings → Database → **transaction pooler**,
  port 6543. Bukan direct connection.
- `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_ANON_KEY` — Supabase → Settings → API

Untuk login Google, aktifkan provider Google di Supabase → Authentication →
Providers, dan daftarkan `<url>/api/auth/callback` di Redirect URLs.

```bash
pnpm db:migrate    # jalankan migrasi
pnpm db:seed       # data demo, idempoten
pnpm dev
pnpm test          # unit test murni, tanpa database
pnpm test:db       # pemeriksaan yang butuh database sungguhan
pnpm reparse       # proses ulang inbox_events yang belum jadi transaksi
```

`pnpm test:db` membuat dua user sementara lalu menghapusnya lagi. Yang dijaga
di sana satu hal, tapi yang paling mahal kalau salah: setiap query difilter
`user_id`, dan relasi milik user lain ditolak.

## Status

Fase 0, 1, dan 3 selesai. Rantai penuhnya sudah berjalan dengan transaksi
sungguhan: notifikasi bank → Android → server → prompt kategori → satu tap.
Yang belum ada tinggal antarmuka webnya.

| | |
|---|---|
| ✅ | Skema database, parser myBCA, endpoint ingest |
| ✅ | Login Google, device & token webhook |
| ✅ | Mesin saran kategori — rule-based, belajar dari `hit_count` |
| ✅ | REST API: transaksi, kategori, wallet, merchant, tag |
| ✅ | Dead letter queue + reparse batch |
| ✅ | App Android: listener, outbox, pengiriman, prompt kategori |
| ⬜ | Web PWA — halaman `/` masih bawaan Next |

> **Catatan lapangan.** Di HyperOS, listener notifikasi tidak diikat lagi
> sesudah reboot — MIUI menolaknya, dan tidak ada API yang bisa memaksanya dari
> dalam app. Catet! mendeteksinya lalu memasang notifikasi yang mengarahkan ke
> layar izin untuk dinyalakan ulang. Rinciannya di catatan harian.

## Dokumen

- [`docs/PRD-v2-thin-native.md`](docs/PRD-v2-thin-native.md) — spesifikasi lengkap
- [`docs/panduan-eksekusi.md`](docs/panduan-eksekusi.md) — urutan pengerjaan
- [`docs/catatan-harian.md`](docs/catatan-harian.md) — catatan harian, keputusan,
  dan temuan lapangan soal notifikasi myBCA
