import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Pwa } from "@/components/Pwa";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Catet!",
  description: "Pencatatan keuangan yang tidak minta dicatat.",
};

export const viewport: Viewport = {
  // Dipakai sebagai PWA di home screen: tidak ada address bar, jadi warna
  // status bar diambil dari sini.
  themeColor: "#0c0c0e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      // Dark-first: app ini hampir selalu dibuka di HP yang gelap. Togglenya
      // ada di layar Pengaturan; pilihan "terang" dilepas oleh skrip di bawah
      // sebelum halaman digambar, supaya tidak ada kedipan gelap dulu.
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.tema==="terang")document.documentElement.classList.remove("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">
        {children}
        <Pwa />
      </body>
    </html>
  );
}
