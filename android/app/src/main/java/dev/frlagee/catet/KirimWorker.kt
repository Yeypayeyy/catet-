package dev.frlagee.catet

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Mengosongkan outbox ke `/api/ingest`.
 *
 * Yang berhasil ditandai `sent_at`. Yang gagal tetap di antrian dengan
 * `attempt_count` naik — tidak pernah dihapus, karena kehilangan transaksi
 * tidak bisa diterima. WorkManager yang mengurus penjadwalan ulang dan
 * backoff-nya.
 */
class KirimWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    // Pemicu langsung dan job berkala adalah dua unique work yang berbeda, jadi
    // WorkManager tidak mencegah keduanya jalan bersamaan. Tanpa kunci ini
    // dua worker sempat membaca antrian yang sama dan mengirim baris yang sama
    // dua kali. Server menolaknya lewat client_uuid, jadi tidak ada transaksi
    // dobel — tapi tetap saja pekerjaan sia-sia.
    //
    // Keduanya hidup di proses yang sama, jadi kunci JVM biasa sudah cukup.
    override fun doWork(): Result = synchronized(KUNCI) { kirimSemua() }

    private fun kirimSemua(): Result {
        val server = Prefs.serverUrl(applicationContext)
        val token = Prefs.deviceToken(applicationContext)
        // Belum dikonfigurasi bukan kegagalan — tidak ada gunanya retry sampai
        // user mengisi alamat server. Antriannya tetap utuh menunggu.
        if (server.isEmpty() || token.isEmpty()) {
            Log.d(TAG, "server/token belum diisi, tidak ada yang dikirim")
            return Result.success()
        }

        val outbox = Outbox(applicationContext)
        val antrian = outbox.belumTerkirim()
        if (antrian.isEmpty()) return Result.success()

        var gagal = 0
        for (item in antrian) {
            when (val hasil = kirim(item.metode, "$server${item.path}", token, item.payloadJson)) {
                is Hasil.Berhasil -> {
                    outbox.tandaiTerkirim(item.id)
                    Log.d(TAG, "terkirim uuid=${item.clientUuid.take(8)} ${item.metode} ${item.path}")
                    if (item.metode == "POST") promptKalauJadiTransaksi(hasil.body)
                }
                is Hasil.Gagal -> {
                    gagal++
                    outbox.catatGagal(item.id, hasil.pesan)
                    Log.w(TAG, "gagal uuid=${item.clientUuid.take(8)}: ${hasil.pesan}")
                }
            }
        }

        peringatkanKalauMenumpuk(applicationContext, outbox.jumlahTertunda())

        // Satu saja gagal, seluruh job dijadwalkan ulang. Yang sudah terkirim
        // tidak ikut dikirim lagi karena sent_at-nya sudah terisi.
        return if (gagal > 0) Result.retry() else Result.success()
    }

    private sealed interface Hasil {
        data class Berhasil(val body: String) : Hasil
        data class Gagal(val pesan: String) : Hasil
    }

    private fun kirim(metode: String, url: String, token: String, payload: String): Hasil {
        val badan = payload.toRequestBody(JSON)
        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .method(metode, badan)
            .build()

        return try {
            klien.newCall(request).execute().use { response ->
                // Parse gagal pun dijawab 200 oleh server: payloadnya sudah aman
                // tersimpan di sana, jadi device tidak perlu mencoba lagi.
                if (response.isSuccessful) Hasil.Berhasil(response.body?.string().orEmpty())
                else Hasil.Gagal("HTTP ${response.code}")
            }
        } catch (e: Exception) {
            Hasil.Gagal(e.message ?: e.javaClass.simpleName)
        }
    }

    /**
     * Inti dari seluruh proyek: begitu transaksi tercatat, prompt kategori
     * muncul di HP. Notifikasi yang tidak terbaca parser dijawab
     * `parse_status: failed` dan tidak memunculkan apa-apa — lebih baik diam
     * daripada bertanya tentang transaksi yang tidak ada.
     */
    private fun promptKalauJadiTransaksi(body: String) {
        if (body.isBlank()) return
        try {
            val json = JSONObject(body)
            if (json.optString("parse_status") != "parsed") return

            val saran = json.optJSONArray("suggested_categories")
            val kategori = buildList {
                for (i in 0 until (saran?.length() ?: 0)) {
                    val k = saran!!.getJSONObject(i)
                    add(k.getString("id") to k.getString("name"))
                }
            }

            PromptKategori.tampilkan(
                applicationContext,
                json.getString("transaction_id"),
                json.getString("amount"),
                json.optString("direction", "debit"),
                kategori,
            )
        } catch (e: Exception) {
            // Prompt yang gagal muncul tidak boleh membatalkan pengiriman —
            // transaksinya sudah aman tercatat di server.
            Log.w(TAG, "gagal menampilkan prompt: ${e.message}")
        }
    }

    companion object {
        const val TAG = "CatetKirim"
        private val KUNCI = Any()
        private const val NAMA_SEKALI = "kirim-outbox"
        private const val NAMA_BERKALA = "kirim-outbox-berkala"
        private val JSON = "application/json; charset=utf-8".toMediaType()

        private val klien = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        private val butuhJaringan = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        private const val CHANNEL_PERINGATAN = "peringatan"
        private const val ID_PERINGATAN = 9100

        /** Antrian menumpuk sebanyak ini berarti ada yang salah, bukan sekadar lambat. */
        private const val AMBANG_PERINGATAN = 5

        /**
         * Antrian yang menumpuk artinya transaksi sedang tidak tercatat, dan itu
         * harus kelihatan. Diam-diam menumpuk adalah kegagalan paling mahal yang
         * bisa dialami app ini.
         *
         * Dipanggil dari dua tempat, dan keduanya perlu: sesudah pengiriman
         * (untuk menarik peringatan kalau antrian sudah lega) dan sesudah
         * notifikasi masuk (karena saat offline worker-nya tidak pernah jalan,
         * jadi kalau cuma dari sini peringatannya tidak akan pernah muncul).
         */
        fun peringatkanKalauMenumpuk(context: Context, tertunda: Int) {
            val manager = context.getSystemService(NotificationManager::class.java)
            if (tertunda <= AMBANG_PERINGATAN) {
                // Sudah lega lagi: tarik peringatannya.
                manager.cancel(ID_PERINGATAN)
                return
            }

            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_PERINGATAN,
                    "Peringatan",
                    NotificationManager.IMPORTANCE_DEFAULT,
                )
            )
            val notif = Notification.Builder(context, CHANNEL_PERINGATAN)
                .setSmallIcon(android.R.drawable.stat_notify_error)
                .setContentTitle(context.getString(R.string.peringatan_judul))
                .setContentText(context.getString(R.string.peringatan_isi, tertunda))
                .setOngoing(false)
                .build()
            manager.notify(ID_PERINGATAN, notif)
        }

        /** Dipanggil begitu notifikasi masuk outbox. */
        fun sekarang(context: Context) {
            val kerja = OneTimeWorkRequestBuilder<KirimWorker>()
                .setConstraints(butuhJaringan)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            // APPEND_OR_REPLACE, bukan KEEP: notifikasi yang datang saat job
            // sedang berjalan tetap kebagian giliran, tidak terbuang.
            WorkManager.getInstance(context)
                .enqueueUniqueWork(NAMA_SEKALI, ExistingWorkPolicy.APPEND_OR_REPLACE, kerja)
        }

        /**
         * Jaring pengaman kalau pemicu langsung terlewat — misalnya proses
         * dimatikan sistem sebelum job sempat jalan. 15 menit adalah interval
         * terpendek yang diizinkan WorkManager.
         */
        fun berkala(context: Context) {
            val kerja = PeriodicWorkRequestBuilder<KirimWorker>(15, TimeUnit.MINUTES)
                .setConstraints(butuhJaringan)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(NAMA_BERKALA, ExistingPeriodicWorkPolicy.KEEP, kerja)
        }
    }
}
