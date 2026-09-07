package dev.frlagee.catet

import android.content.Context
import android.content.SharedPreferences
import android.os.SystemClock

/**
 * Satu-satunya tempat penyimpanan di HP selain outbox nanti: alamat server dan
 * token device. Tidak ada salinan data transaksi — itu urusan web.
 */
object Prefs {
    private const val FILE = "catet"
    private const val KEY_SERVER = "server_url"
    private const val KEY_TOKEN = "device_token"

    private fun of(context: Context): SharedPreferences =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    /** Selalu tanpa garis miring di ujung, supaya penyambungan path tidak dobel. */
    fun serverUrl(context: Context): String =
        of(context).getString(KEY_SERVER, "").orEmpty()

    fun deviceToken(context: Context): String =
        of(context).getString(KEY_TOKEN, "").orEmpty()

    fun save(context: Context, serverUrl: String, deviceToken: String) {
        of(context).edit()
            .putString(KEY_SERVER, serverUrl.trim().trimEnd('/'))
            .putString(KEY_TOKEN, deviceToken.trim())
            .apply()
    }

    fun isConfigured(context: Context): Boolean =
        serverUrl(context).isNotEmpty() && deviceToken(context).isNotEmpty()

    /**
     * Penanda sesi nyala HP. Waktu dinding dikurangi lama menyala = kira-kira
     * kapan HP booting, dan angkanya tetap sama sepanjang sesi itu. Dibulatkan
     * ke menit supaya pergeseran kecil jam sistem tidak dianggap reboot.
     */
    private fun bootId(): Long =
        (System.currentTimeMillis() - SystemClock.elapsedRealtime()) / 60_000

    private const val KEY_BOOT = "listener_boot_id"

    /** Dipanggil listener setiap kali sistem mengikatnya. */
    fun tandaiListenerTersambung(context: Context) {
        of(context).edit().putLong(KEY_BOOT, bootId()).apply()
    }

    /**
     * Apakah listener pernah tersambung sejak HP menyala terakhir kali.
     *
     * Ini yang membedakan "izinnya belum diberikan" dari "izinnya ada tapi
     * MIUI menolak mengikatnya sesudah reboot" — dua keadaan yang di layar
     * kelihatan sama persis, padahal obatnya beda.
     */
    fun listenerHidupSejakBoot(context: Context): Boolean =
        of(context).getLong(KEY_BOOT, Long.MIN_VALUE) == bootId()
}
