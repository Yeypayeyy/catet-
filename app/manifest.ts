import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Catet!",
    short_name: "Catet!",
    description: "Pencatatan keuangan yang tidak minta dicatat.",
    // Dibuka langsung ke antrian review: itu yang paling sering dikerjakan,
    // dan satu-satunya alasan app ini dibuka sengaja.
    start_url: "/review",
    display: "standalone",
    orientation: "portrait",
    lang: "id",
    // Dark-first, sama seperti layout.
    background_color: "#0c0c0e",
    theme_color: "#0c0c0e",
    icons: [
      { src: "/ikon/192", sizes: "192x192", type: "image/png" },
      { src: "/ikon/512", sizes: "512x512", type: "image/png" },
      { src: "/ikon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
