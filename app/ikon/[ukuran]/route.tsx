// Ikon aplikasi, dibuat saat build lewat ImageResponse yang sudah dibawa Next.
// Tidak perlu berkas PNG di repo dan tidak perlu alat gambar.
//
// Path-nya sengaja bukan di bawah /api — proxy.ts menolak /api tanpa session,
// dan ikon harus bisa diambil browser sebelum siapa pun login.

import { ImageResponse } from "next/og";
import { dataUriStruk } from "../struk";

const UKURAN = {
  "192": { sisi: 192, penuh: false, skala: 1 },
  "512": { sisi: 512, penuh: false, skala: 1 },
  // Maskable dipotong launcher (bulat, squircle, dll.): latarnya sampai tepi
  // dan struknya dikecilkan supaya tetap utuh di dalam zona aman.
  maskable: { sisi: 512, penuh: true, skala: 0.72 },
} as const;

export function generateStaticParams() {
  return Object.keys(UKURAN).map((ukuran) => ({ ukuran }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ ukuran: string }> }) {
  const { ukuran } = await params;
  const pilihan = UKURAN[ukuran as keyof typeof UKURAN];
  if (!pilihan) return new Response("Tidak ditemukan", { status: 404 });

  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={dataUriStruk({ penuh: pilihan.penuh, skala: pilihan.skala })}
        width={pilihan.sisi}
        height={pilihan.sisi}
        alt=""
      />
    ),
    { width: pilihan.sisi, height: pilihan.sisi },
  );
}
