package dev.frlagee.catet

/**
 * Nominal datang dari server sebagai string satuan minor ("10000"), bukan
 * angka — uang tidak pernah lewat float, termasuk di JSON. Jadi pemformatannya
 * pun cuma menyisipkan titik, tanpa pernah diubah jadi Double.
 */
object Uang {

    /** "10000" -> "Rp10.000". Masukan aneh dikembalikan apa adanya. */
    fun format(satuanMinor: String): String {
        val angka = satuanMinor.trimStart('-')
        if (angka.isEmpty() || !angka.all { it.isDigit() }) return satuanMinor

        val hasil = StringBuilder()
        for ((i, c) in angka.withIndex()) {
            // Titik tiap tiga digit, dihitung dari belakang.
            if (i > 0 && (angka.length - i) % 3 == 0) hasil.append('.')
            hasil.append(c)
        }
        val tanda = if (satuanMinor.startsWith('-')) "-" else ""
        return "${tanda}Rp$hasil"
    }
}
