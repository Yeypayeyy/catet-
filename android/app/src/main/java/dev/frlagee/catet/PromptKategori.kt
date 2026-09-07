package dev.frlagee.catet

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.app.RemoteInput
import android.net.Uri

/**
 * Inti dari seluruh proyek ini: notifikasi yang muncul setelah transaksi
 * tercatat, dengan tiga tombol kategori. Satu tap, selesai — tanpa membuka
 * aplikasi apa pun.
 *
 * Judulnya nominal, BUKAN "Catatan Finansial". Itu yang mencegah listener
 * menangkap notifikasinya sendiri dan berputar tanpa henti.
 */
object PromptKategori {

    const val CHANNEL = "kategori"
    const val KUNCI_MERCHANT = "merchant"

    fun tampilkan(
        context: Context,
        transactionId: String,
        amount: String,
        direction: String,
        kategori: List<Pair<String, String>>,
    ) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL,
                "Pilih kategori",
                // HIGH supaya muncul sebagai heads-up, bukan cuma di laci.
                NotificationManager.IMPORTANCE_HIGH,
            )
        )

        val id = transactionId.hashCode()
        val builder = Notification.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_edit)
            .setContentTitle(Uang.format(amount))
            .setContentText(
                if (direction == "credit") context.getString(R.string.prompt_masuk)
                else context.getString(R.string.prompt_keluar)
            )
            .setAutoCancel(true)
            .setContentIntent(bukaWeb(context, transactionId, id))

        // Tiga saran teratas dari server. Kalau kurang dari tiga, tampil apa adanya.
        for ((categoryId, nama) in kategori.take(3)) {
            builder.addAction(
                Notification.Action.Builder(
                    null,
                    nama,
                    aksi(context, transactionId, id, categoryId, null),
                ).build()
            )
        }

        // Satu kolom ketik untuk nama merchant — myBCA tidak pernah mengirimnya.
        val ketik = RemoteInput.Builder(KUNCI_MERCHANT)
            .setLabel(context.getString(R.string.prompt_merchant))
            .build()
        builder.addAction(
            Notification.Action.Builder(
                null,
                context.getString(R.string.prompt_merchant),
                aksi(context, transactionId, id, null, "ketik"),
            ).addRemoteInput(ketik).build()
        )

        manager.notify(id, builder.build())
    }

    fun sembunyikan(context: Context, notifId: Int) {
        context.getSystemService(NotificationManager::class.java).cancel(notifId)
    }

    private fun aksi(
        context: Context,
        transactionId: String,
        notifId: Int,
        categoryId: String?,
        penanda: String?,
    ): PendingIntent {
        val intent = Intent(context, KategoriReceiver::class.java).apply {
            // Action dibuat unik supaya PendingIntent tiap tombol tidak saling
            // menimpa — extras saja tidak cukup untuk membedakannya.
            action = "pilih:$transactionId:${categoryId ?: penanda}"
            putExtra(KategoriReceiver.EXTRA_TRANSACTION_ID, transactionId)
            putExtra(KategoriReceiver.EXTRA_NOTIF_ID, notifId)
            if (categoryId != null) putExtra(KategoriReceiver.EXTRA_CATEGORY_ID, categoryId)
        }
        return PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
        )
    }

    /** Tap badan notifikasi membuka halaman detail di web. */
    private fun bukaWeb(context: Context, transactionId: String, notifId: Int): PendingIntent {
        val url = "${Prefs.serverUrl(context)}/transactions/$transactionId"
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        return PendingIntent.getActivity(
            context,
            notifId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
