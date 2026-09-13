import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // APK lama membuka /transactions/<id> saat badan notifikasi ditekan,
      // padahal halamannya /transaksi/<id>. Redirect di sini menolong APK yang
      // sudah terpasang tanpa perlu build ulang.
      { source: "/transactions/:id", destination: "/transaksi/:id", permanent: true },
    ];
  },
};

export default nextConfig;
