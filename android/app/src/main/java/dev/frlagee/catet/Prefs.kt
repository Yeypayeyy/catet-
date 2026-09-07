package dev.frlagee.catet

import android.content.Context
import android.content.SharedPreferences

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
}
