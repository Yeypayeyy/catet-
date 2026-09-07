package dev.frlagee.catet

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * Kabar "saya masih hidup" ke server tiap enam jam.
 *
 * Dikirim dengan token device, bukan polos: server mencatat `last_seen_at`
 * saat memverifikasi token. Tanpa itu ping ini cuma jadi hiasan — web tidak
 * akan pernah tahu kapan device terakhir terdengar, dan banner peringatan
 * "device diam lebih dari 24 jam" tidak punya dasar apa pun.
 */
class HealthWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val server = Prefs.serverUrl(applicationContext)
        val token = Prefs.deviceToken(applicationContext)
        if (server.isEmpty() || token.isEmpty()) return Result.success()

        val request = Request.Builder()
            .url("$server/api/health")
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        return try {
            klien.newCall(request).execute().use { response ->
                Log.d(TAG, "ping health: HTTP ${response.code}")
                if (response.isSuccessful) Result.success() else Result.retry()
            }
        } catch (e: Exception) {
            Log.w(TAG, "ping health gagal: ${e.message}")
            Result.retry()
        }
    }

    companion object {
        const val TAG = "CatetHealth"
        private const val NAMA = "health-ping"

        private val klien = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()

        fun berkala(context: Context) {
            val kerja = PeriodicWorkRequestBuilder<HealthWorker>(6, TimeUnit.HOURS)
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
                )
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(NAMA, ExistingPeriodicWorkPolicy.KEEP, kerja)
        }
    }
}
