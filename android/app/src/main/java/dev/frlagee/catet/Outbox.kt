package dev.frlagee.catet

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject
import java.util.UUID

/**
 * Antrian kirim. Satu-satunya penyimpanan data di HP, dan isinya bukan salinan
 * transaksi — cuma payload yang belum sempat sampai ke server.
 *
 * SQLite mentah, tanpa Room: satu tabel, empat query, tidak ada yang perlu
 * dihasilkan otomatis.
 */
class Outbox(context: Context) : SQLiteOpenHelper(context, NAMA, null, VERSI) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_uuid TEXT NOT NULL UNIQUE,
                dedupe_key TEXT NOT NULL UNIQUE,
                payload_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                sent_at INTEGER,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                last_error TEXT
            )
            """.trimIndent()
        )
        // Query yang paling sering jalan nanti: ambil yang belum terkirim.
        db.execSQL("CREATE INDEX outbox_belum_terkirim ON outbox (sent_at, id)")
    }

    override fun onUpgrade(db: SQLiteDatabase, dari: Int, ke: Int) {
        // Belum ada versi lama yang beredar.
    }

    /**
     * Simpan satu notifikasi. Kembalikan client_uuid yang dipakai, atau null
     * kalau notifikasi ini sudah pernah masuk.
     *
     * Ditulis serentak di thread pemanggil, bukan di latar: kalau prosesnya
     * mati sesaat setelah notifikasi datang, barisnya harus sudah ada di disk.
     * Kehilangan transaksi lebih mahal daripada callback yang tertahan 1 ms.
     */
    fun simpan(packageName: String, title: String?, body: String, postedAt: Long): String? {
        // client_uuid dibuat di device — itu yang jadi kunci idempotency di
        // server, jadi kirim ulang tidak pernah menggandakan transaksi.
        val clientUuid = UUID.randomUUID().toString()

        val payload = JSONObject()
            .put("client_uuid", clientUuid)
            .put("package_name", packageName)
            .put("title", title ?: JSONObject.NULL)
            .put("body", body)
            .put("posted_at", postedAt)
            .toString()

        val nilai = ContentValues().apply {
            put("client_uuid", clientUuid)
            // Penjaga terhadap notifikasi yang SAMA persis diantar dua kali —
            // terjadi saat listener terhubung ulang, atau callback terpanggil
            // dobel. client_uuid-nya akan beda tiap kali, jadi dedupe server
            // tidak bisa menolong; harus dicegat di sini.
            //
            // Dua transaksi berbeda dengan nominal sama tidak ikut terbuang,
            // karena postedAt-nya beda. ponytail: kalau bank memperbarui isi
            // notifikasi yang sama, postedAt berubah dan barisnya jadi dua.
            // Belum pernah kejadian dengan myBCA; kalau nanti muncul, ganti
            // kuncinya ke sbn.key + body.
            put("dedupe_key", "$packageName|$postedAt|$body")
            put("payload_json", payload)
            put("created_at", System.currentTimeMillis())
        }

        val id = writableDatabase.insertWithOnConflict(
            "outbox", null, nilai, SQLiteDatabase.CONFLICT_IGNORE
        )
        return if (id == -1L) null else clientUuid
    }

    /** Jumlah baris yang belum terkirim. Dipakai indikator status. */
    fun jumlahTertunda(): Int =
        readableDatabase.rawQuery("SELECT COUNT(*) FROM outbox WHERE sent_at IS NULL", null)
            .use { if (it.moveToFirst()) it.getInt(0) else 0 }

    /** Isi tabel dalam bentuk baris teks. Hanya untuk pemeriksaan di build debug. */
    fun ringkasan(batas: Int = 20): List<String> =
        readableDatabase.rawQuery(
            "SELECT id, client_uuid, sent_at, attempt_count, payload_json " +
                "FROM outbox ORDER BY id DESC LIMIT ?",
            arrayOf(batas.toString()),
        ).use { c ->
            buildList {
                while (c.moveToNext()) {
                    add(
                        "#${c.getInt(0)} uuid=${c.getString(1).take(8)} " +
                            "sent=${if (c.isNull(2)) "-" else c.getLong(2).toString()} " +
                            "attempt=${c.getInt(3)} payload=${c.getString(4)}"
                    )
                }
            }
        }

    companion object {
        private const val NAMA = "outbox.db"
        private const val VERSI = 1
    }
}
