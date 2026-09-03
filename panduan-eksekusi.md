# Panduan Eksekusi — Vibecode dengan Claude Code + Claude Design

Berbasis PRD v2 (thin-native). Urutan di bawah dirancang supaya tiap langkah bisa diverifikasi sebelum lanjut, karena vibecode gagal bukan karena kodenya jelek — tapi karena menumpuk terlalu banyak kode yang belum pernah dijalankan.

---

## Aturan Main

**1. Satu prompt = satu unit yang bisa diverifikasi.**
Jangan minta "bikin backendnya". Minta "bikin skema Drizzle untuk tabel X, Y, Z beserta migrasinya". Lalu jalankan. Lalu lanjut.

**2. Jalankan setiap kali selesai satu langkah.**
Kalau lo baru sadar ada yang salah setelah 10 langkah, debugging-nya lebih lama daripada nulis manual.

**3. Commit tiap langkah selesai.**
Ini jaring pengaman lo. Kalau Claude Code merusak sesuatu, `git reset` lebih cepat daripada minta perbaikan.

**4. Ada tiga hal yang WAJIB lo baca manual, bukan dipercaya begitu saja:**
- Parser myBCA (salah = data keuangan lo salah)
- Logika idempotency & dedupe (salah = transaksi dobel atau hilang)
- Auth & token webhook (salah = orang lain bisa nyuntik data)

Sisanya boleh lo percaya lalu verifikasi lewat pemakaian.

**5. Kalau Claude Code ngasih solusi yang lo nggak paham, tanya dulu sebelum terima.**
Lo yang bakal maintain ini.

---

## Fase 0 — Spike Tasker (2–3 hari)

Tujuan: buktikan pipeline tanpa Kotlin, sekaligus kumpulkan data uji nyata.

### Langkah 0.1 — Setup repo + Supabase

**Manual dulu, sebelum Claude Code:**
1. Buat project di supabase.com (free tier)
2. Settings → Database → Connection string → pilih **Transaction pooler** (port 6543), bukan Direct connection
3. Salin ke `.env` sebagai `DATABASE_URL`

> Pooler itu wajib untuk Vercel serverless. Pakai direct connection dan database bakal nolak koneksi begitu request agak rame.

Prompt ke Claude Code:
```
Buat monorepo Next.js 15 dengan TypeScript strict, Tailwind, App Router.
Struktur: /app, /lib, /db, /components.
Setup Drizzle ORM dengan PostgreSQL via DATABASE_URL (Supabase pooler connection).
Gunakan driver postgres-js, bukan node-postgres — lebih cocok untuk serverless.
Set max connection pool kecil (1-2) karena sudah di belakang pooler.
Belum ada tabel — cuma koneksi dan health check di /api/health yang melakukan ping database.
```
**Verifikasi:** `pnpm dev`, buka `/api/health`, dapat 200 dengan ping database sukses. Cek juga tabel muncul di Supabase Table Editor nanti setelah migrasi.
**Commit.**

### Langkah 0.2 — Skema minimal
```
Buat skema Drizzle untuk tabel: users, devices, accounts, inbox_events, transactions, categories.
Ikuti aturan ini:
- Semua uang bigint dalam satuan minor (10000 = Rp10.000)
- Semua tabel punya id (uuid), user_id, created_at, updated_at, deleted_at
- inbox_events menyimpan payload mentah: package_name, title, body, posted_at, client_uuid (unique), parse_status, parser_version
- transactions punya client_uuid unique untuk idempotency
Buat migrasi dan seed: 1 user demo, 3 account, 15 kategori Indonesia yang umum.
```
**Verifikasi:** migrasi jalan, seed masuk, cek lewat `drizzle-kit studio`.
**Commit.**

### Langkah 0.3 — Parser + test
```
Buat parser myBCA sebagai fungsi murni di /lib/parsers/mybca.ts.
Input: string body notifikasi. Output: { amount: bigint, direction, bankCategory } atau null.
Format: "Pengeluaran sebesar IDR 10,000.00 di kategori Belanja."
PENTING: format angka pakai locale English (koma = ribuan, titik = desimal).
Jangan pakai parseFloat atau NumberFormat default.
Tulis unit test dengan Vitest, termasuk edge case: nominal jutaan, Pemasukan, format tak dikenal, string kosong.
Parser tidak boleh throw dalam kondisi apapun.
```
**Verifikasi:** test hijau. **Baca kodenya baris per baris.** Ini titik paling kritis.
**Commit.**

### Langkah 0.4 — Endpoint ingest
```
Buat POST /api/ingest.
Auth: header Authorization: Bearer wh_..., cocokkan ke tabel devices.
Body: { client_uuid, package_name, title, body, posted_at }
Alur:
1. Simpan ke inbox_events APA ADANYA, sebelum parsing
2. Kalau client_uuid sudah ada, kembalikan hasil sebelumnya (idempoten), jangan buat duplikat
3. Parse. Gagal → parse_status=failed, tetap balas 200, jangan bikin transaksi
4. Sukses → buat transaction dengan category_id null, is_reviewed false
5. Balas { transaction_id, amount, direction, suggested_categories: [3 kategori] }
Untuk sekarang suggested_categories cukup 3 kategori pertama dari database.
```
**Verifikasi:** tembak pakai curl dua kali dengan `client_uuid` sama — harus cuma ada satu transaksi.
**Commit.**

### Langkah 0.5 — Sambungkan Tasker
Manual, tanpa Claude Code.
1. Deploy ke Vercel (atau pakai ngrok kalau masih lokal)
2. Tasker: Profile → Event → Notification, filter app myBCA
3. Task → HTTP Request POST ke `/api/ingest`, body JSON dengan `%evtprm()` sebagai isi notifikasi
4. Generate `client_uuid` pakai variable random Tasker

**Verifikasi:** transaksi Rp10.000 sungguhan → cek database → tercatat.

> **Ini momen paling penting di seluruh proyek.** Kalau ini jalan, sisanya cuma pekerjaan. Pakai selama beberapa hari, kumpulkan variasi notifikasi asli, tambahkan sebagai test case parser.

---

## Fase 1 — Backend Lengkap (1 minggu)

### Langkah 1.1 — Auth Google

Dua opsi, pilih salah satu:

**Opsi A — Supabase Auth** (lebih ringkas, tapi terikat Supabase)
```
Setup Supabase Auth dengan Google provider via @supabase/ssr.
Session di cookie HTTP-only, dibaca di server component dan route handler.
Tabel users pakai auth.users bawaan Supabase, buat tabel profiles untuk data tambahan.
Middleware lindungi seluruh /api kecuali /api/ingest dan /api/health.
/api/ingest pakai token device, bukan session.
```

**Opsi B — Auth.js** (portabel, bisa pindah database kapan saja)
```
Setup Auth.js (NextAuth v5) dengan Google provider dan Drizzle adapter.
Session di cookie HTTP-only.
Middleware lindungi seluruh /api kecuali /api/ingest dan /api/health.
/api/ingest pakai token device, bukan session.
```

Gue saranin **Opsi B** kalau lo mungkin pindah ke Neon/Railway nanti, **Opsi A** kalau mau cepat dan yakin tetap di Supabase.

> Apapun pilihannya: jangan pakai Supabase client SDK untuk query dari frontend, dan jangan andalkan RLS sebagai satu-satunya lapisan keamanan. Semua akses data tetap lewat API routes lo — logika idempotency, DLQ, dan mesin saran kategori butuh tempat, dan `/api/ingest` autentikasinya pakai token device, bukan session user.
**Verifikasi:** login jalan, endpoint terlindungi menolak request tanpa session.
**Commit.**

### Langkah 1.2 — Device & token
```
Buat CRUD device: daftar device, generate token webhook (prefix wh_, simpan hash saja bukan plaintext),
cabut token, catat last_seen_at.
Token ditampilkan sekali saja saat dibuat.
Endpoint: GET/POST /api/devices, DELETE /api/devices/:id
```
**Verifikasi:** token dicabut → ingest ditolak 401. **Baca kode hashing-nya.**
**Commit.**

### Langkah 1.3 — Mesin saran kategori
```
Buat tabel category_rules dan merchants sesuai PRD.
Fungsi suggestCategories(userId, amount, occurredAt):
- Cari rule cocok berdasarkan nominal persis, lalu rentang nominal, lalu window waktu
- Urutkan by hit_count desc, priority desc
- Fallback: 3 kategori tersering milik user
- Selalu kembalikan tepat 3
Saat transaksi dikategorikan: naikkan hit_count, atau buat rule baru dengan is_auto_learned=true.
Sambungkan ke response /api/ingest.
```
**Verifikasi:** unit test — pilih kategori 3x untuk nominal sama, kategori itu harus naik ke posisi pertama.
**Commit.**

### Langkah 1.4 — REST API untuk web
```
CRUD lengkap: transactions (dengan filter periode/kategori/account, pagination),
categories, accounts, merchants, tags.
PATCH /api/transactions/:id khusus untuk kategorisasi cepat dari notifikasi.
Semua query WAJIB difilter user_id. Soft delete pakai deleted_at.
Endpoint GET /api/transactions?is_reviewed=false untuk antrian review.
```
**Verifikasi:** coba akses data user lain lewat ID — harus 404, bukan 403.
**Commit.**

### Langkah 1.5 — Dead letter queue
```
Tambah tabel dead_letters. inbox_events yang gagal parse 3x masuk ke sini.
Endpoint admin: GET /api/dead-letters, POST /api/dead-letters/:id/reparse.
Buat juga script reparse batch untuk seluruh inbox_events lama dengan parser versi terbaru.
```
**Verifikasi:** kirim notifikasi format ngaco → masuk DLQ → perbaiki parser → reparse → jadi transaksi.
**Commit.**

---

## Fase 2 — Web PWA (1–1.5 minggu)

### Langkah 2.1 — Claude Design: sistem desain dulu
**Jangan minta layar. Minta sistem.**

Prompt ke Claude Design:
```
Aku bikin app pencatatan keuangan personal, dipakai harian di HP.
Kebanyakan interaksi terjadi dalam 5 detik: lihat sisa uang, rapikan transaksi, cek pengeluaran.
Nuansa: tenang, dipercaya, bukan playful. Angka harus jadi elemen paling menonjol.
Wajib dark mode.

Buatkan design system:
- Palet warna light + dark, termasuk warna semantik untuk pengeluaran vs pemasukan
- Skala tipografi, dengan penekanan pada tampilan angka/nominal
- Skala spacing
- Style komponen inti: kartu transaksi, chip kategori, tombol, input, empty state, banner peringatan
```
Iterasi sampai lo suka. **Lalu minta token-nya dalam bentuk CSS variables.**

### Langkah 2.2 — Terapkan token
```
Terapkan design token berikut ke Tailwind config dan globals.css: [paste token]
Buat komponen dasar sesuai style tersebut: Button, Card, Chip, Input, Badge, EmptyState.
Dark mode via class strategy.
```
**Verifikasi:** bikin satu halaman showcase berisi semua komponen, cek light & dark.
**Commit.**

### Langkah 2.3 — Layar, satu per satu
Minta desain per layar ke Claude Design, lalu implementasi ke Claude Code. Urutan:

1. **Review Queue** — layar paling sering dipakai, kerjakan duluan
2. **Dashboard** — ringkasan bulan, breakdown kategori
3. **Daftar transaksi** — filter, pagination
4. **Detail/Edit transaksi** — termasuk input manual
5. **Kategori & Account** — CRUD
6. **Pengaturan** — device, status, DLQ

Satu layar = satu prompt = satu commit.

### Langkah 2.4 — PWA
```
Tambahkan manifest.json, icon (192, 512, maskable), service worker untuk app shell caching.
Jangan cache response API.
Tambah prompt install.
```
**Verifikasi:** install ke home screen HP, buka, jalan.
**Commit.**

---

## Fase 3 — Android Thin Native (3–5 hari)

Baru sekarang Kotlin. Semua kontrak sudah pasti.

### Langkah 3.1 — Project kosong
```
Buat project Android: Kotlin, min SDK 26, target 35, tanpa Compose (View biasa cukup).
Satu Activity dengan: input URL server, input token, tombol simpan (SharedPreferences),
indikator status listener, tombol buka Settings notification access.
Dependency: OkHttp, WorkManager. Tidak perlu Room, DI, atau arsitektur.
```
**Verifikasi:** app build, install, tombol Settings membuka halaman yang benar.
**Commit.**

### Langkah 3.2 — Listener, log dulu
```
Buat NotificationListenerService.
Filter package com.bca.mybca.omni.android dan title "Catatan Finansial".
Untuk sekarang HANYA Log.d isi notifikasi. Belum simpan, belum kirim.
Daftarkan di manifest dengan permission BIND_NOTIFICATION_LISTENER_SERVICE.
```
**Verifikasi:** buat app dummy penembak notifikasi (satu Activity, satu tombol). Lihat Logcat.

> App dummy ini investasi terbaik lo. Bikin sekali, hemat puluhan transaksi sungguhan.

**Commit.**

### Langkah 3.3 — Outbox
```
Tambah SQLite mentah (SQLiteOpenHelper, bukan Room) satu tabel outbox:
id, client_uuid, payload_json, created_at, sent_at, attempt_count, last_error.
Listener menulis ke outbox, generate client_uuid pakai UUID.randomUUID().
Belum kirim.
```
**Verifikasi:** notif dummy → cek isi tabel lewat `adb shell` atau App Inspection.
**Commit.**

### Langkah 3.4 — Pengiriman
```
WorkManager job: ambil outbox belum terkirim, POST ke /api/ingest dengan Bearer token.
Sukses → tandai sent_at. Gagal → attempt_count++, retry exponential backoff.
Trigger job saat notifikasi masuk dan periodik tiap 15 menit.
Constraint: butuh koneksi jaringan.
```
**Verifikasi:** matikan internet → notif dummy → nyalakan → transaksi muncul di web.
**Commit.**

### Langkah 3.5 — Prompt kategorisasi
```
Setelah ingest sukses, tampilkan notification:
- Judul: nominal terformat Rp10.000
- Priority HIGH untuk heads-up
- 3 action button dari suggested_categories di response
- 1 RemoteInput untuk mengetik merchant
- Tap body: buka PWA di /transactions/:id
Buat BroadcastReceiver yang menerima tap, panggil PATCH /api/transactions/:id,
lalu dismiss notifikasi. Kalau offline, masuk outbox juga.
```
**Verifikasi:** notif dummy → prompt muncul → tap kategori → cek web, kategorinya terisi. **Tanpa membuka app manapun.**
**Commit.**

### Langkah 3.6 — Ketahanan
```
Tambah BroadcastReceiver BOOT_COMPLETED untuk memastikan service hidup setelah reboot.
Tambah health ping ke /api/health tiap 6 jam via WorkManager.
Tambah notifikasi peringatan lokal kalau outbox menumpuk lebih dari 5 item.
Tambah tombol minta pengecualian battery optimization di layar status.
```
**Verifikasi:** reboot HP, tunggu, kirim notif dummy, harus tetap tertangkap.
**Commit.**

---

## Fase 4 — Hardening (1 minggu)

- Onboarding: QR code di web berisi URL + token, discan Android
- Banner di web kalau device tidak ping > 24 jam
- Uji di HP Xiaomi/Oppo dengan battery optimization **aktif**, biarkan 72 jam
- Uji token dicabut → Android harus kasih error jelas, bukan diam
- Uji offline 24 jam → semua transaksi harus masuk saat online kembali
- Privacy policy di frlagee.dev

---

## Draft `CLAUDE.md`

Taruh di root sebelum langkah 0.1.

```markdown
# Konteks Proyek

App pencatatan keuangan otomatis. Android menangkap notifikasi m-banking,
mengirim ke backend, web PWA jadi antarmuka utama.

## Stack
- Backend + Web: Next.js 15 App Router, TypeScript strict, Tailwind, Drizzle
- Database: Supabase PostgreSQL, SELALU lewat transaction pooler (port 6543)
- Driver: postgres-js, pool kecil (1-2 koneksi)
- Android: Kotlin, min SDK 26, tanpa Compose, tanpa Room, tanpa DI. Sekecil mungkin.
- Deploy: Vercel

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
```

---

## Ringkasan Timeline

| Fase | Durasi | Hasil |
|---|---|---|
| 0 — Spike Tasker | 2–3 hari | Pipeline terbukti, data uji terkumpul |
| 1 — Backend | 1 minggu | API lengkap dan teruji |
| 2 — Web PWA | 1–1.5 minggu | Antarmuka utama siap |
| 3 — Android | 3–5 hari | Capture native menggantikan Tasker |
| 4 — Hardening | 1 minggu | Layak dipakai harian |

**Total: 4–5 minggu.**

Setelah Fase 0 lo sudah punya sesuatu yang berguna. Setelah Fase 2 lo sudah bisa pakai penuh. Fase 3 cuma mengganti Tasker dengan sesuatu yang lebih rapi — bukan syarat agar app berfungsi.
