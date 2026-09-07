package dev.frlagee.catet

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context

/**
 * Penembak notifikasi uji, meniru bentuk notifikasi myBCA. Ada supaya mencoba
 * listener tidak perlu transaksi sungguhan — investasi sekali, hemat puluhan
 * kali belanja.
 *
 * Hanya dipanggil dari build debug.
 */
object NotifikasiUji {
    private const val CHANNEL = "uji"
    private const val ID = 9001

    /**
     * Ditembakkan bergantian supaya format yang berbeda ikut terlewati:
     * pengeluaran, nominal jutaan, pemasukan, dan satu yang memang tidak
     * dikenali parser.
     */
    private val CONTOH = listOf(
        "Pengeluaran sebesar IDR 10,000.00 di kategori Belanja.",
        "Pengeluaran sebesar IDR 1,250,000.00 di kategori Belanja.",
        "Pemasukan sebesar IDR 5,000,000.00 di kategori Gaji.",
        "Nikmati diskon 50% di merchant pilihan!",
    )

    private var berikutnya = 0

    /** Kembalikan isi notifikasi yang baru ditembakkan, untuk ditampilkan di layar. */
    fun tembak(context: Context): String {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "Notifikasi uji", NotificationManager.IMPORTANCE_DEFAULT)
        )

        val body = CONTOH[berikutnya % CONTOH.size]
        berikutnya++

        val notif = Notification.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            // Judulnya harus persis sama dengan milik myBCA, karena justru itu
            // yang sedang diuji.
            .setContentTitle(NotifikasiListener.JUDUL_FINANSIAL)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .build()

        manager.notify(ID, notif)
        return body
    }
}
