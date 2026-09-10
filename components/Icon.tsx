// Ikon. Sistem desainnya memakai Lucide lewat <script> dari CDN; di sini
// path-nya disalin apa adanya ke dalam kode.
//
// Dua alasan, dan keduanya aturan repo: tidak menambah library tanpa ditanya,
// dan tidak ada yang keluar ke pihak ketiga. Untuk app yang dipasang sebagai
// PWA, satu <script> CDN juga berarti satu hal lagi yang bisa gagal saat
// koneksi jelek.
//
// Tambahkan ikon baru dengan menyalin path-nya dari lucide.dev — bentuknya
// sudah pasti 24x24, stroke, tanpa fill.

export type NamaIkon =
  | "rumah"
  | "kotak-masuk"
  | "daftar"
  | "peringatan"
  | "silang"
  | "tambah"
  | "panah-kanan"
  | "dompet"
  | "centang";

const PATH: Record<NamaIkon, string[]> = {
  rumah: [
    "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
    "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  ],
  "kotak-masuk": [
    "M22 12h-6l-2 3h-4l-2-3H2",
    "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  ],
  daftar: ["M3 12h.01", "M3 18h.01", "M3 6h.01", "M8 12h13", "M8 18h13", "M8 6h13"],
  peringatan: [
    "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
    "M12 9v4",
    "M12 17h.01",
  ],
  silang: ["M18 6 6 18", "m6 6 12 12"],
  tambah: ["M5 12h14", "M12 5v14"],
  "panah-kanan": ["m9 18 6-6-6-6"],
  dompet: [
    "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
    "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
  ],
  centang: ["M20 6 9 17l-5-5"],
};

export function Icon({
  name,
  size = 20,
  color = "currentColor",
  style,
}: {
  name: NamaIkon;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "none", display: "inline-block", verticalAlign: "middle", ...style }}
    >
      {PATH[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
