package dev.frlagee.catet

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Memasang ulang job berkala setelah HP menyala.
 *
 * WorkManager sebenarnya sudah menjadwalkan ulang sendiri sesudah reboot, dan
 * listener notifikasi diikat lagi oleh sistem. Ini jaring pengaman untuk
 * keadaan yang tidak diurus keduanya — misalnya app pernah di-"force stop"
 * dan jadwalnya hilang. Enqueue-nya pakai KEEP, jadi kalau ternyata sudah ada,
 * tidak terjadi apa-apa.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        Log.d(KirimWorker.TAG, "HP menyala, memasang ulang jadwal")
        KirimWorker.berkala(context)
        KirimWorker.sekarang(context)
        HealthWorker.berkala(context)
    }
}
