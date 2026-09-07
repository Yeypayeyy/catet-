package dev.frlagee.catet

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.View
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

        // Tombol uji cuma ada di build debug; di rilis tidak ikut terpasang.
        val tombolUji = findViewById<Button>(R.id.fire_test)
        tombolUji.visibility = if (BuildConfig.DEBUG) View.VISIBLE else View.GONE
        tombolUji.setOnClickListener {
            // Kalau izinnya baru diminta, jangan tembak dulu — notifikasinya
            // akan dibuang diam-diam dan kelihatan seperti listener yang mati.
            if (izinNotifikasiSiap()) toast(NotifikasiUji.tembak(this))
            else toast(getString(R.string.need_notif_permission))
        }

        tembakKalauDiminta(intent)
        dumpOutboxKalauDiminta(intent)
    }

    // am start menghidupkan ulang Activity yang sudah ada lewat sini, bukan
    // lewat onCreate. Tanpa ini penembakan kedua dan seterusnya tidak terjadi.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        tembakKalauDiminta(intent)
        dumpOutboxKalauDiminta(intent)
    }

    /**
     * Menumpahkan isi outbox ke Logcat. Sebagian HP tidak punya sqlite3 di
     * `run-as`, jadi ini cara paling murah untuk melihat tabelnya:
     *
     *   adb shell am start --activity-single-top      *     -n dev.frlagee.catet/.MainActivity --ez dump true
     */
    private fun dumpOutboxKalauDiminta(intent: Intent?) {
        if (!BuildConfig.DEBUG) return
        if (intent?.getBooleanExtra("dump", false) != true) return
        val outbox = Outbox(this)
        Log.d(NotifikasiListener.TAG, "DUMP tertunda=${outbox.jumlahTertunda()}")
        outbox.ringkasan().forEach { Log.d(NotifikasiListener.TAG, "DUMP $it") }
    }

    /**
     * Menembak notifikasi uji dari baris perintah, supaya pengujian tidak selalu
     * butuh tangan di layar:
     *
     *   adb shell am start --activity-single-top      *     -n dev.frlagee.catet/.MainActivity --ez tembak true
     *
     * --activity-single-top wajib. Tanpa itu Activity yang sudah di depan cuma
     * dibawa ke muka tanpa intent baru, jadi tidak ada yang tertembak dan
     * kelihatan seperti listener yang mati.
     */
    private fun tembakKalauDiminta(intent: Intent?) {
        if (!BuildConfig.DEBUG) return
        if (intent?.getBooleanExtra("tembak", false) != true) return
        NotifikasiUji.tembak(this)
    }

    /**
     * Sejak Android 13 memasang notifikasi butuh izin runtime. Cuma dipakai
     * tombol uji dan, nanti, prompt kategorisasi.
     *
     * false berarti izinnya baru saja diminta; dialognya masih di layar.
     */
    private fun izinNotifikasiSiap(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            return true
        }
        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        return false
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
        val dasar = when {
            siap -> getString(R.string.status_ready)
            !izin -> getString(R.string.status_no_access)
            else -> getString(R.string.status_not_configured)
        }
        val tertunda = Outbox(this).jumlahTertunda()
        statusText.text = if (tertunda > 0) {
            dasar + "\n" + getString(R.string.status_pending, tertunda)
        } else {
            dasar
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
