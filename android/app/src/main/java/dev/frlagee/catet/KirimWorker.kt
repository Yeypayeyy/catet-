package dev.frlagee.catet

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
            val hasil = kirim("$server/api/ingest", token, item.payloadJson)
            if (hasil == null) {
                outbox.tandaiTerkirim(item.id)
                Log.d(TAG, "terkirim uuid=${item.clientUuid.take(8)}")
            } else {
                gagal++
                outbox.catatGagal(item.id, hasil)
                Log.w(TAG, "gagal uuid=${item.clientUuid.take(8)}: $hasil")
            }
        }

        // Satu saja gagal, seluruh job dijadwalkan ulang. Yang sudah terkirim
        // tidak ikut dikirim lagi karena sent_at-nya sudah terisi.
        return if (gagal > 0) Result.retry() else Result.success()
    }

    /** null = berhasil. Selain itu, pesan kegagalan untuk disimpan. */
    private fun kirim(url: String, token: String, payload: String): String? {
        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .post(payload.toRequestBody(JSON))
            .build()

        return try {
            klien.newCall(request).execute().use { response ->
                // Parse gagal pun dijawab 200 oleh server: payloadnya sudah aman
                // tersimpan di sana, jadi device tidak perlu mencoba lagi.
                if (response.isSuccessful) null
                else "HTTP ${response.code}"
            }
        } catch (e: Exception) {
            e.message ?: e.javaClass.simpleName
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
