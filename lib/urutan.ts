// Memindah satu elemen daftar — dipakai saat kategori diseret lewat ☰.

/** Salinan `xs` dengan elemen di `dari` dipindah ke `ke`. Indeks di luar batas dijepit. */
export function pindahkan<T>(xs: readonly T[], dari: number, ke: number): T[] {
  const hasil = [...xs];
  const tujuan = Math.max(0, Math.min(hasil.length - 1, ke));
  const [x] = hasil.splice(dari, 1);
  hasil.splice(tujuan, 0, x);
  return hasil;
}
