# Konteks Proyek

App pencatatan keuangan otomatis. Android menangkap notifikasi m-banking,
mengirim ke backend, web PWA jadi antarmuka utama.

Spesifikasi lengkap: `docs/PRD-v2-thin-native.md`
Urutan pengerjaan: `docs/panduan-eksekusi.md`

## Stack
- Backend + Web: Next.js 16 App Router, TypeScript strict, Tailwind, Drizzle
- Database: Supabase PostgreSQL, SELALU lewat transaction pooler (port 6543)
- Driver: postgres-js, pool kecil (1-2 koneksi)
- Android: Kotlin, min SDK 26, tanpa Compose, tanpa Room, tanpa DI. Sekecil mungkin.
- Deploy: Vercel

## Struktur: Batas Backend / Frontend

Satu Next.js app, satu deploy. Pemisahan ditegakkan lewat folder, bukan lewat infra.

```
backend/         BACKEND. Tidak boleh diimpor dari komponen React.
  db/            skema Drizzle, client postgres-js, migrasi
  parsers/       parser notifikasi per bank (Fase 0.3)
  services/      logika domain: ingest, saran kategori, DLQ
  auth/          session user + verifikasi token device
app/api/         HTTP layer. Tipis: validasi Zod -> panggil service -> map ke response.
app/             FRONTEND. Halaman & layout.
components/      Komponen UI.
lib/             Helper frontend: formatter, fetcher, hook.
```

Aturan:
1. Logika domain tinggal di `backend/`. Route handler tidak boleh berisi query atau
   aturan bisnis - cuma validasi input, panggil service, bentuk response.
2. `app/`, `components/`, `lib/` TIDAK PERNAH mengimpor `backend/`. Akses data hanya
   lewat HTTP ke `app/api/`.
3. `backend/` tidak pernah mengimpor React, komponen, atau apapun dari `lib/`.
4. Uji sisi backend menyasar fungsi di `backend/`, bukan lewat HTTP.

## Aturan Keras
1. Uang SELALU bigint satuan minor. 10000 = Rp10.000. Tidak pernah float, termasuk di JSON.
2. Parsing angka notifikasi pakai locale English (koma ribuan, titik desimal). Jangan pakai parseFloat mentah.
3. Payload notifikasi disimpan mentah ke inbox_events SEBELUM parsing. Selalu.
4. Semua query WAJIB difilter user_id.
5. Soft delete pakai deleted_at, jangan hard delete.
6. Idempotency lewat client_uuid yang dibuat di device.
7. Android tidak menyimpan salinan data. Hanya outbox.
8. Apapun yang bisa dikerjakan di web, tidak boleh masuk ke Android.

## Konvensi
- Nama tabel dan kolom: snake_case. Kode TypeScript: camelCase.
- Waktu disimpan sebagai timestamptz UTC. Konversi ke Asia/Jakarta hanya di UI.
- Error API: { error: { code, message } }, jangan lempar stack trace.
- Validasi input dengan Zod di setiap route handler.

## Design Token
[isi dari Claude Design setelah Fase 2.1]

## Yang Tidak Boleh Dilakukan
- Jangan tambahkan library baru tanpa ditanyakan dulu
- Jangan tambahkan fitur yang tidak diminta
- Jangan pakai LLM untuk kategorisasi. Rule-based saja.
- Jangan pakai overlay/SYSTEM_ALERT_WINDOW. Heads-up notification saja.
- Jangan kirim data ke pihak ketiga manapun
- Jangan query database dari client component atau Supabase client SDK di browser.
  Semua akses data lewat API routes.
- Jangan pakai direct connection Supabase. Selalu pooler.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
