# Catatan Harian

Catatan apa yang dikerjakan per hari, termasuk yang gagal dan kenapa. Ditulis
supaya keputusan yang sudah diambil tidak diulang perdebatannya, dan supaya
temuan lapangan tidak hilang.

Urutan langkah mengikuti `docs/panduan-eksekusi.md`.

---

## 3 September 2026 — Fase 0.1 sampai 0.3

Sumber: riwayat git. Detail di luar itu tidak tercatat.

**14:21 — Scaffold** (`f363fac`, `ac7387d`, `21a5192`)

Next.js + Drizzle + Tailwind berdiri. Endpoint `/api/health` sebagai bukti
koneksi database jalan. PRD dan panduan eksekusi masuk ke `docs/`.

**14:50 — Batas backend/frontend** (`92d0d05`, lalu `c1d26cc`)

Kode server dipindah keluar dari `app/`, awalnya ke `server/`, lalu diganti
nama jadi `backend/`. Batasnya tidak cuma konvensi: ditegakkan lewat aturan
`no-restricted-imports` di `eslint.config.mjs`.

- `app/`, `components/`, `lib/` tidak boleh mengimpor `backend/`
- `backend/` tidak boleh mengimpor React, `next/*`, atau kode frontend
- `app/api/**` dikecualikan dari larangan pertama — itu lapisan HTTP

Aturan kedua kelak memaksa keputusan desain di Fase 1.1.

**15:01 — Skema database** (`8df15be`)

Enam tabel: `users`, `devices`, `accounts`, `categories`, `inbox_events`,
`transactions`. Uang disimpan `bigint` satuan minor. Soft delete lewat
`deleted_at`. Unique index di `client_uuid` untuk idempotency. Seed demo
membuat user `demo@catet.local` dengan token `wh_demo_token`.

**15:16 — Parser myBCA** (`5ebde31`)

`parseMybca()` sebagai fungsi murni: string masuk, `{amount, direction,
bankCategory}` atau `null` keluar. Tidak pernah melempar. Tanpa float sama
sekali — konversi langsung dari string digit ke `BigInt`. 20 unit test.

Catatan penting: parser ini dibangun **hanya dari satu contoh string di
dokumen**, belum pernah melihat notifikasi asli. Array `REAL_SAMPLES` di
berkas test dibiarkan kosong. Ini baru ketahuan jadi masalah keesokan harinya.

---

## 4 September 2026 — Fase 0.4, 0.5, dan Fase 1.1–1.2

### 20:25 — Endpoint ingest (`904868b`)

`POST /api/ingest`. Urutannya bukan selera:

1. Simpan payload mentah ke `inbox_events` **sebelum** parsing. Selalu.
2. Idempotency disandarkan ke unique index `client_uuid` di database
   (`ON CONFLICT DO NOTHING`), bukan pola "select dulu baru insert" yang bisa
   balapan antar dua retry.
3. Parse gagal → `parse_status=failed`, tetap balas 200 supaya device tidak
   retry sia-sia, dan **tidak ada transaksi yang dibuat**.
4. Sukses → transaksi dengan `category_id` null dan `is_reviewed` false.

Auth pakai token device (SHA-256, plaintext tidak pernah disimpan), bukan
session user. Nominal dikirim sebagai **string** di JSON, bukan number.

### 21:00-an — Parser ternyata belum tervalidasi

Ketahuan bahwa Langkah 0.3 selesai secara kode tapi belum pernah diuji
terhadap kenyataan. `REAL_SAMPLES` kosong, regex-nya di-anchor ketat, dan
formatnya cuma tebakan dari dokumen.

Percobaan pertama mengumpulkan sampel salah sasaran: yang dikirim adalah
**struk di dalam aplikasi myBCA**, bukan teks notifikasi. Dua hal berbeda —
notification listener cuma menerima `title` dan `body`, bukan layar aplikasi.

Struknya tetap berguna: mengkonfirmasi format uang BCA `IDR 20,000.00`
(locale English), dan bahwa nama merchant bisa mengandung koma
(`GRAZIE BARBERSHOP, DEPOK`) sehingga parser tidak boleh memotong per koma.

### 21:30-an — Pembanding: zero-friction-erp

Sempat membandingkan dengan `github.com/raditazar/zero-friction-erp`, aplikasi
sejenis punya teman. Arsitekturnya kebalikan:

| | zero-friction-erp | proyek ini |
|---|---|---|
| Capture | iOS Shortcut, share sheet, manual | NotificationListener, pasif |
| Ekstraksi | Gemini LLM (teks + gambar) | regex ketat |
| Uang | `float64` | `bigint` |
| Kalau ragu | tetap simpan, manusia approve | `null`, tidak menyimpan apa-apa |
| Pihak ketiga | daftar wallet & kategori dikirim ke Google | tidak ada |

Kesimpulannya: dia menukar presisi dengan fleksibilitas, dan itu sah untuk
alur yang manusianya memang ikut campur tiga kali. Proyek ini memilih arah
sebaliknya karena targetnya satu tap.

### 21:45 — Mengejar format notifikasi asli

Urutan pengecekan yang akhirnya membuahkan hasil:

1. Cek myBCA → Cashflow. **Catatan Finansial aktif.** Nama kategori BCA
   terlihat: Transfer Rekening, Makanan, Belanja, plus kategori pengecualian
   Pembayaran Kartu Kredit/Paylater dan Tabungan.
2. Cek Setelan Android → Notifikasi → myBCA. myBCA cuma punya **satu saluran
   notifikasi**: "General Notification". Tidak dipisah antara transaksi,
   promo, dan OTP — jadi penyaringan harus lewat isi, bukan saluran.
3. Saluran itu setelannya senyap: notifikasi mengambang mati, tanpa suara,
   tanpa getar. Kemungkinan besar notifikasi transaksi selama ini memang
   masuk tapi tidak pernah terlihat.
4. Tarik laci notifikasi → ketemu.

### 21:53 — Format notifikasi myBCA, akhirnya

```
package : com.bca.mybca.omni.android
title   : Catatan Finansial
body    : Pengeluaran sebesar IDR 10,000.00 di kategori Belanja.
```

Persis seperti yang diasumsikan dokumen. Parser membacanya benar tanpa
perubahan satu baris pun: `10000n`, `debit`, `Belanja`.

**Temuan yang mengikat desain berikutnya:**

- **Judul `Catatan Finansial` adalah satu-satunya penyaring yang andal.**
  Karena myBCA cuma punya satu saluran, promo dan OTP lewat pintu yang sama.
  Filter di judul membuat keduanya tidak perlu dikirim ke server sama sekali.
- **Tidak ada nama merchant di notifikasi.** Struknya menyebut
  `FLOW FOTO COPY 24 POGUNG`, notifikasinya cuma bilang "kategori Belanja".
  Merchant tidak akan pernah datang lewat jalur ini — itu sebabnya rencana
  Fase 3.5 menyediakan RemoteInput untuk mengetik merchant.
- **Tidak ada nomor referensi maupun jam di dalam teks.** Dua transaksi
  Rp10.000 di hari yang sama menghasilkan string identik.
  **Konsekuensi keras: deduplikasi tidak boleh bersandar pada isi teks.**
  `client_uuid` harus dibuat di device tiap notifikasi masuk.

### 21:55 — Sampel asli masuk test (`ebe5e29`)

`REAL_SAMPLES` diisi. Test jadi 20 pass, 0 skip. Langkah 0.3 baru benar-benar
selesai.

### 22:00-an — Verifikasi Langkah 0.4

Empat jalur diuji lewat curl:

| Uji | Hasil |
|---|---|
| Kirim dua kali, `client_uuid` sama | `transaction_id` identik, DB berisi 1 transaksi 1 event |
| Token salah | 401 `UNAUTHORIZED`, bukan stack trace |
| Notifikasi promo | `parse_status: failed`, 0 transaksi, teks mentah tetap tersimpan |
| Nominal di JSON | `"10000"` string, bukan number |

### 22:10–22:45 — Langkah 0.5, menyambungkan Tasker

Rangkaian hambatan, dicatat karena bisa terulang:

**Tasker berbayar.** Diselesaikan dengan trial 7 hari dari
`tasker.joaoapps.com` (unduh APK langsung). Cukup, karena Tasker memang cuma
jembatan sementara sampai app Android jadi di Fase 3. Alternatif gratis
permanen yang sempat dipertimbangkan: MacroDroid (Play Store, tier gratis
cukup) dan Automate.

**"Setelan terbatas" Android.** Karena dipasang dari APK dan bukan Play Store,
Android 13+ memblokir pemberian izin akses notifikasi. Dibuka lewat
Setelan → Aplikasi → Kelola aplikasi → Tasker → titik tiga →
**Izinkan setelan terbatas**. Menu itu baru muncul setelah sekali diblokir.

**Nama variabel Tasker.** Tebakan awal salah. Diperiksa dulu dengan task
sementara yang menulis `1=[%evtprm1] 2=[%evtprm2] 3=[%evtprm3]` ke variabel
global — bukan lewat Flash, karena Flash terlalu cepat untuk dibaca.
Hasilnya:

```
%evtprm1 = nama paket
%evtprm2 = judul
%evtprm3 = isi notifikasi   ← ini yang dipakai
```

**Setelan Tasker yang jalan:**

- Profile → Event → UI → Notification
  - Owner Application: myBCA
  - Title: `Catatan Finansial`
- Task "Catat BCA", empat aksi berurutan:
  1. Variables → Variable Set: `%NOTIFBODY` = `%evtprm3`
  2. Code → JavaScriptlet: membuat UUID v4 dan menyusun `%PAYLOAD`
  3. Net → HTTP Request: POST ke `/api/ingest`
  4. Alert → Flash: `%HTTPR` (untuk melihat kode balasan server)

Urutan 1→2→3 wajib; masing-masing menyiapkan bahan untuk berikutnya.

Dua jebakan di JavaScriptlet: penanda unik **harus** format UUID (server
menolak selainnya, jadi `%RAND` tidak bisa), dan waktunya **harus milidetik**
(`Date.now()`; `%TIMES` punya Tasker satuannya detik dan akan tercatat 1970).

### 22:47 — Transaksi asli pertama tercatat

```
22:47:29  notifikasi myBCA muncul di HP
22:47:32  tersimpan di database
```

Tiga detik. Rp10.000, debit, kategori bank "Belanja", belum direview. Fase 0
tamat. Ini titik yang panduan sebut "momen paling penting di seluruh proyek".

Catatan: transaksi ini masih tercatat atas nama user demo, karena Tasker masih
memakai `wh_demo_token`.

### 23:00-an — Langkah 1.1, Auth Google (`8d2fba1`)

Dipilih **Opsi A, Supabase Auth**.

**Penyimpangan dari panduan, disengaja.** Panduan menyarankan memakai
`auth.users` dan membuat tabel `profiles` terpisah. Yang dilakukan: tabel
`users` dipertahankan sebagai profil, `id`-nya diisi id dari `auth.users`.
Hasilnya sama, tapi seluruh relasi yang sudah ada (`devices`, `accounts`,
`transactions`, `inbox_events`) tidak perlu disentuh, dan user demo yang
sedang dipakai Tasker tetap hidup. Tanpa foreign key ke `auth.users`, justru
karena user demo tidak punya pasangan di sana.

**Dua hal teknis yang menghabiskan waktu:**

- **Next 16 mengganti `middleware.ts` menjadi `proxy.ts`.** Ketahuan dari
  `node_modules/next/dist/docs/`. Kalau tidak dicek dulu, berkasnya tidak
  akan pernah dijalankan dan tidak ada error apa pun yang muncul.
- **`backend/` tidak boleh mengimpor `next/*`** (aturan eslint sendiri dari
  3 September), padahal Supabase butuh membaca cookie. Diselesaikan dengan
  membuat `createSupabaseServerClient()` menerima cookie store dari
  pemanggil; `next/headers` cuma dipanggil di lapisan `app/api/`.

**Yang harus dikerjakan manual di luar kode:**

1. Google Cloud Console → OAuth consent screen (External, email sendiri
   ditambahkan sebagai Test user) → Credentials → OAuth client ID (Web)
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → Google → aktifkan, tempel Client
   ID + Secret. **Bukan di `.env`** — yang menukar kode dengan Google adalah
   Supabase, bukan aplikasi ini.
4. Supabase → Authentication → URL Configuration → Redirect URLs tambahkan
   `http://localhost:3000/api/auth/callback`
5. `.env`: `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_ANON_KEY`

Cara cepat memastikan provider sudah aktif tanpa membuka browser:

```bash
curl -s "https://<project-ref>.supabase.co/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2Flocalhost%3A3000"
```

Kalau belum aktif jawabannya `"Unsupported provider: provider is not enabled"`.

Login berhasil 23:26. Baris di `auth.users` dan `public.users` punya `id` yang
sama.

### 23:33 — Langkah 1.2, Device & token (`0aca86d`)

`GET/POST /api/devices` dan `DELETE /api/devices/:id`. Token 32 byte acak
berawalan `wh_`, ditampilkan sekali di respons pembuatan, database cuma
menyimpan sha256-nya. Pencabutan mengisi `deleted_at`, dan `verifyDeviceToken`
sudah menyaring kolom itu — jadi tidak ada jalur autentikasi kedua yang perlu
dirawat. Device milik user lain dijawab **404, bukan 403**, supaya
keberadaannya tidak ikut bocor.

**Lubang yang ketahuan saat verifikasi.** Ingest dengan token sah membalas
**409 NO_ACCOUNT**, bukan 200. Penyebabnya: user hasil login Google tidak
punya `accounts` maupun `categories` sama sekali — `ensureProfile` cuma
membuat baris profil. Artinya user beneran tidak bisa mencatat apa pun.

Ditambal: `ensureProfile` sekarang mengisi dompet dan kategori bawaan kalau
user belum punya account. Pengecekannya berdasarkan **keberadaan account**,
bukan status insert, supaya user lama yang terlanjur kosong ikut sembuh
sendiri saat login berikutnya. Daftar bawaan dipindah ke
`backend/db/defaults.ts`, dipakai bersama oleh seed dan alur login.

### 23:47 — Tasker dipindah ke token asli

Sempat 401 berulang. Penyebabnya sepele tapi tidak kelihatan: token di header
`Authorization` kelebihan enam huruf, `_token` ikut ter-paste di belakang.

Cara mendiagnosisnya tanpa jajan lagi: jalankan task manual lewat tombol ▶ di
Tasker, lalu baca `%HTTPR`.

| `%HTTPR` | Artinya |
|---|---|
| 400 | request sampai, token sah, isinya saja yang kosong — semua benar |
| 401 | token salah |
| kosong | aksi HTTP tidak jalan, atau HP tidak sampai ke server |

Sinyal lain dari sisi database: kolom `last_seen_at` di tabel `devices` diisi
setiap kali ada token yang cocok. Kalau masih `null`, tidak pernah ada request
bertoken sah yang masuk.

### 23:55 — Verifikasi akhir

Jajan Rp10.000 sungguhan. Tercatat 15 detik kemudian atas nama akun Google
sendiri lewat device "HP Farrel", `is_reviewed` false.

Rantai penuh berjalan: bayar → notifikasi myBCA → Tasker → `/api/ingest` →
parser → transaksi, tanpa membuka aplikasi apa pun.

Lima commit di-push ke `origin/main`.

---

## 6 Sep 2026 — Langkah 1.3, mesin saran kategori

Tabel `category_rules` dan `merchants` masuk. Satu tabel untuk tiga jenis
aturan; yang membedakan cuma kolom mana yang terisi — nominal persis
(`amount_min` = `amount_max`), rentang nominal, atau window waktu WIB.

Bagian yang menentukan urutan (`rankRules`) sengaja dipisah ke
`backend/services/category-rank.ts` tanpa import apa pun, supaya bisa diuji
`node --test` tanpa database. Delapan test, termasuk window yang melewati
tengah malam dan nominal di atas `Number.MAX_SAFE_INTEGER`.

`PATCH /api/transactions/:id` ikut dibuat karena tanpa itu `hit_count` tidak
pernah naik dan langkah ini tidak bisa diverifikasi. Autentikasinya dua jalur:
cookie session dari web, atau `Bearer wh_...` dari Android.

Verifikasi lewat server sungguhan, user demo: pilih satu kategori berulang
untuk nominal Rp10.000, dan kategori itu naik ke posisi pertama pada saran
berikutnya. Nominal lain tidak ikut terpengaruh — jatuh ke fallback tiga
kategori tersering. Idempotensi `client_uuid` masih utuh.

---

## 7 Sep 2026 — Langkah 1.4, REST API untuk web

`transactions` (daftar berfilter + pagination, input manual, detail, ubah,
soft delete), plus CRUD `categories`, `accounts`, `merchants`, `tags`.
Tabel `tags` dan `transaction_tags` ikut masuk.

Empat resource terakhir bentuknya sama persis — milik satu user, soft delete,
beda cuma di kolom isinya. Jadi ditulis sekali sebagai helper generik
(`backend/services/catalog.ts`) plus pabrik route handler
(`app/api/crud.ts`); tiap resource cuma menyumbang skema Zod dan pemetaan
JSON-nya, sekitar 15 baris. Menulis empat modul yang isinya sama adalah cara
paling rapi untuk membuat tiga di antaranya ketinggalan perbaikan bug.

`PATCH /api/transactions/:id` yang dulu khusus kategorisasi sekarang jadi
edit penuh; pembelajaran `hit_count` tetap jalan saat `category_id` diisi.
Autentikasinya tetap dua jalur, tapi hanya PATCH: device boleh mengubah,
tidak boleh membaca. `GET` dengan token device dijawab 401.

Pemeriksaan yang butuh database sungguhan sekarang bisa dijalankan
(`pnpm test:db`) lewat hook kecil di `scripts/` yang menerjemahkan alias
`@/...` untuk node. Isinya: dua user sementara, lalu pastikan user B tidak
bisa membaca, mengubah, maupun menghapus apa pun milik user A, dan relasi
milik user lain ditolak saat dipasang ke transaksi. Semua lulus.

---

## 7 Sep 2026 — Langkah 1.5, dead letter queue

Tabel `dead_letters` cuma menunjuk ke `inbox_events`, tidak menyalin
payloadnya — sudah aman di sana, tidak perlu dua salinan yang bisa beda.

Yang berubah paling banyak justru `ingest.ts`: parsing sampai pembuatan
transaksi dipindah ke `backend/services/inbox.ts` dan dipakai bareng oleh
ingest maupun reparse. Kalau tidak, perbaikan parser cuma berlaku untuk
notifikasi yang akan datang — persis kebalikan dari gunanya DLQ. `ingest.ts`
sekarang tinggal urusan simpan mentah dan dedupe.

Gagal tiga kali berturut-turut, event pindah ke DLQ. Reparse manual me-nol-kan
hitungannya dulu supaya percobaan berikutnya tidak langsung mentok lagi.
Berhasil setelah sempat masuk DLQ: barisnya ditandai `resolved_at`, tidak
dihapus — format yang pernah bikin parser meleset masih perlu kelihatan.

Endpoint `GET /api/dead-letters` (payload mentah ikut terbawa, kalau tidak
tidak ada yang bisa dikerjakan dari halaman itu) dan
`POST /api/dead-letters/:id/reparse`. Batch-nya: `pnpm reparse`.

Diverifikasi di data sungguhan: tiga notifikasi uji yang formatnya ngaco naik
ke `attempt_count` 3 lewat `pnpm reparse` lalu masuk DLQ. Di `pnpm test:db`
ditambah pemeriksaan bahwa DLQ tepat terjadi di percobaan ketiga, user lain
tidak bisa melihat maupun me-reparse milik orang, dan reparse dua kali tetap
menghasilkan satu transaksi.

---

## 7 Sep 2026 — Langkah 3.1, kerangka app Android

Fase 3 dikerjakan mendahului Fase 2. Alasannya bukan teknis: trial Tasker 7
hari mulai 4 Sep, habis sekitar 11 Sep. Kalau urutan panduan dituruti, trial
habis di tengah Fase 2 dan selama 1–1.5 minggu itu tidak ada notifikasi myBCA
asli yang terkumpul — padahal variasi format (transfer, pemasukan, top-up,
tarik tunai) belum pernah kelihatan satu pun. Syarat yang panduan sebut untuk
masuk Kotlin, "semua kontrak sudah pasti", sudah terpenuhi sejak Fase 1 kelar.

Project di `android/`, Gradle terpisah dari build Next. Kotlin, minSdk 26,
targetSdk 35, tanpa Compose. Tanpa AppCompat juga — `Activity` biasa dan tema
bawaan sistem sudah cukup untuk satu layar berisi dua input dan dua tombol,
dan itu satu dependensi lebih sedikit.

Satu layar, isinya cuma yang tidak bisa dikerjakan di web: alamat server,
token device, status izin notifikasi, dan tombol ke setelannya. Disimpan di
SharedPreferences. URL di-`trimEnd('/')` saat disimpan supaya penyambungan
path tidak pernah dobel garis miring.

Status izin dibaca dari `Settings.Secure.enabled_notification_listeners` —
tidak ada API resmi untuk menanyakannya. Dibaca ulang di `onResume`, karena
izinnya berubah di layar sebelah, bukan di layar ini.

OkHttp dan WorkManager sudah dideklarasikan meski baru dipakai di langkah 3.4;
resolusi dependensi lebih baik meledak sekarang daripada di tengah jalan.

Toolchain di laptop: Android Studio dengan SDK android-35 dan JBR 21. Gradle
wrapper 8.11.1 dibuat dari distribusi yang sudah ada di cache. `assembleDebug`
lulus. Pemasangan ke HP belum — tidak ada device yang tersambung ke `adb`.

---

## 7 Sep 2026 — Langkah 3.2, listener notifikasi

`NotifikasiListener` menyaring paket `com.bca.mybca.omni.android` dan judul
"Catatan Finansial", lalu baru mencatat ke Logcat. Belum menyimpan, belum
mengirim.

Isi notifikasi dibaca dari `EXTRA_BIG_TEXT` dulu, baru `EXTRA_TEXT` sebagai
cadangan — yang kedua dipotong kalau notifikasinya panjang, dan nominal yang
terpotong lebih buruk daripada tidak tercatat sama sekali.

Service ini menerima seluruh notifikasi di HP, termasuk yang isinya pribadi.
Jadi penyaringannya sedini mungkin dan yang tidak lolos tidak pernah ikut
tercatat. Di manifest: `exported="false"` dengan penjaga
`BIND_NOTIFICATION_LISTENER_SERVICE`, izin bertanda tangan — yang boleh
mengikat cuma sistem.

Satu penyimpangan dari panduan: app dummy penembak notifikasi tidak dibuat
sebagai APK terpisah, tapi jadi tombol di dalam app ini yang cuma muncul di
build debug. Alasannya applicationId `com.bca.mybca.omni.android` tidak bisa
dipakai — myBCA asli sudah terpasang di HP dan tanda tangannya beda, jadi
pemasangannya pasti ditolak. Sebagai gantinya listener menerima notifikasi
dari paketnya sendiri, khusus di debug.

Yang perlu diingat gara-gara itu: prompt kategorisasi di langkah 3.5 juga
terbit dari paket ini. Yang mencegah umpan balik cuma judulnya — prompt itu
berjudul nominal, bukan "Catatan Finansial". Jangan pernah disamakan.

Tombol uji menembak empat format bergantian: pengeluaran, nominal jutaan,
pemasukan, dan satu teks promo yang memang tidak dikenali parser. Sejak
Android 13 memasang notifikasi butuh izin runtime, jadi tekanan pertama
meminta izin dan tidak menembak — kalau ditembak sekarang notifikasinya
dibuang diam-diam dan kelihatan seperti listener yang mati.

### Verifikasi di HP (Xiaomi 22021211RG, Android 14 / HyperOS)

```
D CatetListener: TANGKAP pkg=dev.frlagee.catet body=Pengeluaran sebesar IDR 1,250,000.00 di kategori Belanja.
D CatetListener: TANGKAP pkg=dev.frlagee.catet body=Pemasukan sebesar IDR 5,000,000.00 di kategori Gaji.
D CatetListener: TANGKAP pkg=dev.frlagee.catet body=Nikmati diskon 50% di merchant pilihan!
D CatetListener: TANGKAP pkg=dev.frlagee.catet body=Pengeluaran sebesar IDR 10,000.00 di kategori Belanja.
```

Keempat format tertangkap utuh, termasuk nominal jutaan yang komanya paling
gampang bikin parser meleset.

### Tiga jebakan adb di HyperOS

Ketiganya menghabiskan waktu lebih lama daripada menulis listener-nya sendiri,
jadi ditulis di sini supaya tidak diulang.

**1. `adb install -r` memutus ikatan listener.** Setelah pasang ulang, service
tetap terdaftar di `enabled_notification_listeners` tapi tidak terikat lagi —
`dumpsys activity services dev.frlagee.catet` kosong. Tidak perlu buka Settings;
matikan lalu nyalakan dari shell:

```
adb shell cmd notification disallow_listener dev.frlagee.catet/dev.frlagee.catet.NotifikasiListener
adb shell cmd notification allow_listener   dev.frlagee.catet/dev.frlagee.catet.NotifikasiListener
```

Beri jeda beberapa detik sesudahnya. Tembakan pertama tepat setelah pasang
ulang biasanya hilang karena prosesnya belum sepenuhnya bangun.

**2. `am start` tanpa `--activity-single-top` tidak mengantar intent baru.**
Activity yang sudah di depan cuma dibawa ke muka, `onNewIntent` tidak dipanggil,
tidak ada yang tertembak — dan gejalanya persis sama dengan listener yang mati.
Ini yang paling lama menyesatkan.

**3. `pm grant` dan `input tap` ditolak.** HyperOS mengunci keduanya di balik
"USB debugging (Security settings)" yang butuh akun Xiaomi dan SIM. Jadi izin
runtime harus lewat dialog, dan penekanan tombol tidak bisa diskripkan. Itu
alasan penembak uji dibuat bisa dipanggil lewat `am start`, bukan cuma tombol.

---

## 7 Sep 2026 — Langkah 3.3, outbox SQLite

`SQLiteOpenHelper` mentah, satu tabel `outbox`, tanpa Room. Listener tidak
lagi cuma mencatat ke Logcat: payload disusun jadi JSON persis sebentuk
kontrak `/api/ingest` lalu masuk antrian. Belum dikirim.

`client_uuid` dibuat di device dengan `UUID.randomUUID()` — itu yang jadi
kunci idempotency di server, jadi kirim ulang tidak pernah menggandakan
transaksi.

Ditulis serentak di thread pemanggil, bukan di latar. Kalau prosesnya mati
sesaat setelah notifikasi datang, barisnya harus sudah ada di disk;
kehilangan transaksi lebih mahal daripada callback yang tertahan satu
milidetik.

Ada kolom `dedupe_key` (`paket|postedAt|body`, UNIQUE) untuk mencegat
notifikasi yang sama persis diantar dua kali — terjadi saat listener
terhubung ulang atau callback terpanggil dobel. `client_uuid`-nya akan beda
tiap kali, jadi dedupe di server tidak bisa menolong. Dua transaksi berbeda
dengan nominal sama tidak ikut terbuang karena `postedAt`-nya beda.

Verifikasi di HP, empat tembakan lalu `--ez dump true`:

```
DUMP tertunda=3
DUMP #3 uuid=a8909915 sent=- attempt=0 payload={"client_uuid":"a8909915-…","package_name":"dev.frlagee.catet","title":"Catatan Finansial","body":"Nikmati diskon 50% di merchant pilihan!","posted_at":1788793030917}
DUMP #2 uuid=17dffac8 sent=- attempt=0 payload={… "body":"Pemasukan sebesar IDR 5,000,000.00 di kategori Gaji." …}
DUMP #1 uuid=6efaf785 sent=- attempt=0 payload={… "body":"Pengeluaran sebesar IDR 1,250,000.00 di kategori Belanja." …}
```

Bentuk payloadnya sudah sama persis dengan yang diterima `/api/ingest`, jadi
langkah 3.4 tinggal mengirimkan apa adanya.

Isi tabel dilihat lewat `--ez dump true` ke Logcat, bukan `sqlite3` — biner
itu tidak selalu ada di `run-as` pada HP rilis.

---

## Yang belum

- **Fase 3** sisanya — outbox, pengiriman, prompt kategorisasi
- **Fase 2** — web PWA. Halaman `/` masih bawaan Next. Mulai dari langkah 2.1,
  minta design system ke Claude Design; token CSS-nya masuk ke `CLAUDE.md`
  sebelum ada layar yang dikerjakan.

**Pengingat operasional:** selama masih memakai alamat WiFi lokal
(`192.168.18.52:3000`), laptop harus menyala agar notifikasi terkirim. Tasker
tidak menyimpan antrian — notifikasi yang gagal terkirim hilang begitu saja.
Deploy ke Vercel kalau mau dipakai sehari-hari.

**Yang perlu dikumpulkan sambil jalan:** variasi notifikasi myBCA selain
pengeluaran QRIS — transfer, pemasukan, top-up, tarik tunai, biaya admin.
Yang gagal parse otomatis terarsip di `inbox_events` dan, setelah tiga kali
gagal, muncul di `GET /api/dead-letters` lengkap dengan payload mentahnya.
Jadi tidak ada yang hilang: tambahkan formatnya sebagai test case, perbaiki
parser, lalu `pnpm reparse`.
