// Ikon aplikasi, dibuat saat build lewat ImageResponse yang sudah dibawa Next.
// Tidak perlu berkas PNG di repo dan tidak perlu alat gambar.
//
// Path-nya sengaja bukan di bawah /api — proxy.ts menolak /api tanpa session,
// dan ikon harus bisa diambil browser sebelum siapa pun login.

import { ImageResponse } from "next/og";

// Sesuai token: latar --bg gelap, huruf memakai --accent versi dark.
const LATAR = "#0c0c0e";
const AKSEN = "#70b0f0";

const UKURAN = {
  "192": { sisi: 192, skala: 0.62 },
  "512": { sisi: 512, skala: 0.62 },
  // Maskable dipotong bulat oleh Android, jadi hurufnya dikecilkan supaya
  // tetap utuh di dalam zona aman.
  maskable: { sisi: 512, skala: 0.44 },
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
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: LATAR,
          color: AKSEN,
          fontSize: pilihan.sisi * pilihan.skala,
          fontWeight: 600,
          letterSpacing: "-0.04em",
        }}
      >
        C
      </div>
    ),
    { width: pilihan.sisi, height: pilihan.sisi },
  );
}
