"use client";

// Dua urusan PWA yang butuh browser: mendaftarkan service worker, dan
// menawarkan pemasangan ke home screen.
//
// Tawaran pasang hanya muncul kalau browser memang menawarkannya
// (`beforeinstallprompt`). Tidak ada tombol yang menganggur di layar kalau
// app-nya sudah terpasang, dan tidak ada ajakan yang tidak bisa dipenuhi.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

type PeristiwaPasang = Event & { prompt: () => Promise<void> };

export function Pwa() {
  const [tawaran, setTawaran] = useState<PeristiwaPasang | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Gagal mendaftar bukan hal fatal: app tetap jalan, cuma tidak punya
      // salinan app shell saat offline.
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const tangkap = (e: Event) => {
      e.preventDefault();
      setTawaran(e as PeristiwaPasang);
    };
    window.addEventListener("beforeinstallprompt", tangkap);
    window.addEventListener("appinstalled", () => setTawaran(null));
    return () => window.removeEventListener("beforeinstallprompt", tangkap);
  }, []);

  if (!tawaran) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "var(--page-x)",
        right: "var(--page-x)",
        bottom: "var(--space-5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        zIndex: 40,
      }}
    >
      <span style={{ fontSize: "var(--text-label-size)", color: "var(--ink-2)" }}>
        Pasang di home screen supaya sekali buka.
      </span>
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <Button variant="ghost" size="sm" onClick={() => setTawaran(null)}>
          Nanti
        </Button>
        <Button
          size="sm"
          onClick={() => {
            void tawaran.prompt();
            setTawaran(null);
          }}
        >
          Pasang
        </Button>
      </div>
    </div>
  );
}
