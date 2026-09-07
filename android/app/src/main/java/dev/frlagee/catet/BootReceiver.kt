package dev.frlagee.catet

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.util.Log

/**
 * Menghidupkan kembali app sesudah HP menyala.
 *
 * Bagian job berkala sebagian besar redundan — WorkManager menjadwalkan ulang
 * sendiri. Yang tidak redundan adalah urusan listener, dan itu ternyata rumit.
 *
 * Diukur langsung di HyperOS: sesudah reboot, listener notifikasi TIDAK pernah
 * diikat lagi oleh sistem, ditunggu tiga menit pun tidak. `requestRebind`
 * menyembuhkannya kalau dipanggil dari Activity, tapi dari broadcast boot
 * seperti di sini panggilannya tidak berpengaruh sama sekali — tidak ada
 * exception, tidak ada pesan, cuma tidak terjadi apa-apa. MIUI membatasi
 * permintaan bind dari latar belakang, dan tidak ada yang bisa dilakukan app
 * dari dalam untuk melawannya.
 *
 * Jadi jalan keluarnya bukan menambah akal-akalan, melainkan membuat
 * kegagalannya kelihatan: pasang notifikasi yang mengajak buka app sekali.
 * Sekali dibuka, Activity memanggil `requestRebind` dan listener hidup lagi.
 * Di HP yang sistemnya mengikat sendiri, notifikasi itu langsung ditarik oleh
 * `onListenerConnected` sebelum sempat terbaca.
 *
 * Menukar kegagalan diam-diam dengan satu tap adalah harga yang murah. Yang
 * tidak boleh terjadi cuma satu: transaksi berhenti tercatat tanpa ada yang
 * memberi tahu.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        Log.d(KirimWorker.TAG, "HP menyala, memasang ulang jadwal")
        mintaIkatUlangListener(context)
        ingatkanBukaApp(context)
        KirimWorker.berkala(context)
        KirimWorker.sekarang(context)
        HealthWorker.berkala(context)
    }

    companion object {
        /**
         * Meminta sistem mengikat ulang listener. Hanya berlaku kalau izinnya
         * memang sudah diberikan user — ini bukan jalan pintas untuk melewati
         * setelan, cuma membangunkan yang sudah diizinkan.
         */
        fun mintaIkatUlangListener(context: Context) {
            NotificationListenerService.requestRebind(
                ComponentName(context, NotifikasiListener::class.java)
            )
        }

        const val ID_INGATKAN = 9200
        private const val CHANNEL_INGATKAN = "ingatkan"

        /** Ditarik oleh onListenerConnected begitu listener benar-benar hidup. */
        fun ingatkanBukaApp(context: Context) {
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_INGATKAN,
                    "Setelah HP menyala",
                    NotificationManager.IMPORTANCE_DEFAULT,
                )
            )
            val buka = PendingIntent.getActivity(
                context,
                ID_INGATKAN,
                Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val notif = Notification.Builder(context, CHANNEL_INGATKAN)
                .setSmallIcon(android.R.drawable.ic_popup_sync)
                .setContentTitle(context.getString(R.string.ingatkan_judul))
                .setContentText(context.getString(R.string.ingatkan_isi))
                .setContentIntent(buka)
                .setAutoCancel(true)
                .build()
            manager.notify(ID_INGATKAN, notif)
        }
    }
}
