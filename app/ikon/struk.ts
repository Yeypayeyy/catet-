// Logo Catet!: struk bergerigi dengan centang kuning, di kotak biru.
// Satu-satunya sumber untuk ikon web (favicon dan ikon PWA). Versi Android
// digambar ulang sebagai vector drawable di android/app/src/main/res; kalau
// bentuknya berubah, ubah keduanya.
//
// Digambar di kotak 108x108, ukuran adaptive icon Android.

const BIRU = "#2F5BEA";
const BIRU_MUDA = "#C9D4FA";
const KUNING = "#FFC233";
const TINTA = "#111114";

const ISI = `
<path d="M34 24h40v58l-6.67-5-6.67 5-6.67-5-6.67 5-6.67-5-6.67 5Z" fill="#FFFFFF"/>
<rect x="41" y="35" width="26" height="5" rx="2.5" fill="${BIRU}"/>
<rect x="41" y="46" width="18" height="5" rx="2.5" fill="${BIRU_MUDA}"/>
<rect x="41" y="57" width="22" height="5" rx="2.5" fill="${BIRU_MUDA}"/>
<circle cx="73" cy="73" r="13" fill="${KUNING}" stroke="${BIRU}" stroke-width="4"/>
<path d="M67 73l4 4 7.5-8" fill="none" stroke="${TINTA}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;

/**
 * @param penuh  latar sampai tepi (untuk ikon maskable yang dipotong launcher);
 *               kalau tidak, kotak bersudut bulat.
 * @param skala  ukuran gambar struk relatif ke kotak; < 1 untuk zona aman.
 */
export function svgStruk({ penuh = false, skala = 1 }: { penuh?: boolean; skala?: number } = {}) {
  const latar = penuh
    ? `<rect width="108" height="108" fill="${BIRU}"/>`
    : `<rect width="108" height="108" rx="24" fill="${BIRU}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${latar}<g transform="translate(54 54) scale(${skala}) translate(-54 -54)">${ISI}</g></svg>`;
}

/** Data URI untuk <img> di ImageResponse. */
export function dataUriStruk(opsi?: Parameters<typeof svgStruk>[0]) {
  return `data:image/svg+xml;base64,${Buffer.from(svgStruk(opsi)).toString("base64")}`;
}
