package dev.frlagee.catet

import android.app.RemoteInput
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONObject

/**
 * Menerima tap tombol kategori (atau merchant yang diketik) dari notifikasi.
 *
 * Tidak memanggil HTTP langsung: pilihannya diantrekan ke outbox, sama seperti
 * notifikasi masuk. Jadi kalau sedang offline, pilihannya tidak hilang —
 * terkirim sendiri begitu jaringan kembali.
 */
class KategoriReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val transactionId = intent.getStringExtra(EXTRA_TRANSACTION_ID) ?: return
        val notifId = intent.getIntExtra(EXTRA_NOTIF_ID, 0)
        val categoryId = intent.getStringExtra(EXTRA_CATEGORY_ID)
        val merchant = RemoteInput.getResultsFromIntent(intent)
            ?.getCharSequence(PromptKategori.KUNCI_MERCHANT)
            ?.toString()
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

        if (categoryId == null && merchant == null) return

        val payload = JSONObject().apply {
            if (categoryId != null) put("category_id", categoryId)
            if (merchant != null) put("merchant", merchant)
        }.toString()

        val outbox = Outbox(context)
        outbox.antre(
            metode = "PATCH",
            path = "/api/transactions/$transactionId",
            payloadJson = payload,
            // Tap ganda pada tombol yang sama tidak mengantre dua kali. Ganti
            // pilihan tetap masuk, karena kuncinya ikut berubah.
            dedupeKey = "PATCH|$transactionId|${categoryId ?: "merchant:$merchant"}",
        )
        KirimWorker.sekarang(context)

        Log.d(KirimWorker.TAG, "kategori dipilih tx=${transactionId.take(8)} kategori=$categoryId")

        // Notifikasi ditutup sekarang juga, tanpa menunggu server. Kalau
        // pengirimannya gagal, barisnya tetap di outbox dan dicoba lagi —
        // menahan notifikasi di layar cuma bikin ragu tanpa menambah jaminan.
        if (categoryId != null) PromptKategori.sembunyikan(context, notifId)
    }

    companion object {
        const val EXTRA_TRANSACTION_ID = "transaction_id"
        const val EXTRA_NOTIF_ID = "notif_id"
        const val EXTRA_CATEGORY_ID = "category_id"
    }
}
