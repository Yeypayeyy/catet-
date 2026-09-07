package dev.frlagee.catet

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * Menangkap notifikasi myBCA dan menaruhnya di outbox. Langkah 3.3: belum
 * dikirim, itu tugas WorkManager di langkah berikutnya.
 *
 * Service ini menerima SELURUH notifikasi di HP, termasuk yang isinya pribadi.
 * Karena itu penyaringan dilakukan sedini mungkin dan yang tidak lolos tidak
 * pernah ikut tercatat.
 */
class NotifikasiListener : NotificationListenerService() {

    override fun onListenerConnected() {
        Log.d(TAG, "listener tersambung")
        // Titik hidup paling andal yang dimiliki app ini: dipanggil sistem
        // setiap kali service diikat, termasuk sesudah reboot.
        KirimWorker.berkala(this)
        KirimWorker.sekarang(this)
        HealthWorker.berkala(this)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim()
        // EXTRA_TEXT dipotong kalau notifikasinya panjang; BIG_TEXT isi penuhnya.
        val body = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString()?.trim()

        if (!dariBank(sbn.packageName)) return

        if (title != JUDUL_FINANSIAL) {
            // Bukan yang dicari, tapi patut dilihat: judul lain dari myBCA berarti
            // ada jenis notifikasi yang belum kita kenal.
            if (BuildConfig.DEBUG) Log.d(TAG, "dilewati, judul lain: ${title.ringkas()}")
            return
        }
        if (body.isNullOrBlank()) {
            Log.w(TAG, "judul cocok tapi isinya kosong")
            return
        }

        val outbox = Outbox(this)
        val clientUuid = outbox.simpan(sbn.packageName, title, body, sbn.postTime)
        if (clientUuid == null) {
            Log.d(TAG, "DILEWATI, notifikasi ini sudah ada di outbox")
            return
        }

        val tertunda = outbox.jumlahTertunda()
        Log.d(TAG, "OUTBOX uuid=$clientUuid tertunda=$tertunda body=$body")
        KirimWorker.peringatkanKalauMenumpuk(this, tertunda)
        KirimWorker.sekarang(this)
    }

    private fun dariBank(packageName: String): Boolean {
        if (packageName == PAKET_MYBCA) return true
        // Notifikasi uji dari app ini sendiri, supaya tidak perlu belanja
        // sungguhan tiap kali mau mencoba. Hanya di build debug.
        //
        // ponytail: prompt kategorisasi di langkah 3.5 juga terbit dari paket
        // ini. Yang menyelamatkannya cuma judul — prompt itu berjudul nominal,
        // bukan "Catatan Finansial". Jangan pernah samakan.
        return BuildConfig.DEBUG && packageName == this.packageName
    }

    private fun String?.ringkas(): String =
        this?.take(60) ?: "(kosong)"

    companion object {
        const val TAG = "CatetListener"
        const val PAKET_MYBCA = "com.bca.mybca.omni.android"
        const val JUDUL_FINANSIAL = "Catatan Finansial"
    }
}
