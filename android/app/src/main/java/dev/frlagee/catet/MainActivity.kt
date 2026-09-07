package dev.frlagee.catet

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast

/**
 * Satu-satunya layar. Isinya cuma yang tidak bisa dikerjakan di web: alamat
 * server, token device, dan status izin notifikasi.
 */
class MainActivity : Activity() {

    private lateinit var serverInput: EditText
    private lateinit var tokenInput: EditText
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        serverInput = findViewById(R.id.server_url)
        tokenInput = findViewById(R.id.device_token)
        statusText = findViewById(R.id.listener_status)

        serverInput.setText(Prefs.serverUrl(this))
        tokenInput.setText(Prefs.deviceToken(this))

        findViewById<Button>(R.id.save).setOnClickListener { simpan() }
        findViewById<Button>(R.id.open_settings).setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
    }

    override fun onResume() {
        super.onResume()
        // Izin bisa berubah di layar Settings, jadi statusnya dibaca ulang tiap
        // kembali ke sini, bukan sekali saat dibuat.
        tampilkanStatus()
    }

    private fun simpan() {
        val url = serverInput.text.toString().trim().trimEnd('/')
        val token = tokenInput.text.toString().trim()

        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            toast(getString(R.string.server_url_invalid))
            return
        }
        if (!token.startsWith("wh_")) {
            toast(getString(R.string.token_invalid))
            return
        }

        Prefs.save(this, url, token)
        serverInput.setText(url)
        tokenInput.setText(token)
        toast(getString(R.string.saved))
        tampilkanStatus()
    }

    private fun tampilkanStatus() {
        val izin = notificationAccessGranted()
        val siap = izin && Prefs.isConfigured(this)
        statusText.text = when {
            siap -> getString(R.string.status_ready)
            !izin -> getString(R.string.status_no_access)
            else -> getString(R.string.status_not_configured)
        }
    }

    /**
     * Tidak ada API resmi untuk menanyakan izin ini, jadi dibaca dari daftar
     * listener yang diaktifkan user di Settings.
     */
    private fun notificationAccessGranted(): Boolean {
        val aktif = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        return aktif?.split(':')?.any { it.substringBefore('/') == packageName } == true
    }

    private fun toast(pesan: String) = Toast.makeText(this, pesan, Toast.LENGTH_SHORT).show()
}
