"use client";

import { useState } from "react";
import { Amount, Button } from "@/components/ui";

export type SaranKategori = { id: string; name: string };

/**
 * Kartu transaksi, dua wajah:
 *
 * - **review** (kategori masih kosong) — nominal besar, waktu dan asalnya di
 *   bawahnya, lalu satu tombol "Kategori" yang membuka pilihan.
 * - **selesai** (sudah berkategori) — satu baris ringkas, nominal di kanan.
 *
 * Mode review dulu memasang tiga chip saran langsung di kartu. Diganti karena
 * di layar HP chip ketiga selalu terpotong, dan karena mengetik catatan
 * ("Indomaret") tidak mungkin dilakukan dari sebuah chip. Sarannya tidak
 * hilang — pindah ke urutan teratas di dalam popup.
 */
export function TransactionCard({
  amount,
  direction = "debit",
  title,
  meta,
  category,
  onOpen,
  pending = false,
  onClick,
}: {
  amount: bigint | number | string;
  direction?: "debit" | "credit";
  /** Catatan yang diketik user, mis. "Indomaret". Jadi judul kartu. */
  title?: string | null;
  /** Baris kecil: waktu, lalu asal transaksinya. */
  meta?: string | null;
  category?: string | null;
  onOpen?: () => void;
  pending?: boolean;
  onClick?: () => void;
}) {
  const [ditekan, setDitekan] = useState(false);

  const kartu = {
    background: ditekan && onClick ? "var(--surface-2)" : "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--card-y) var(--card-x)",
    color: "var(--ink)",
    // Sedang dikirim: diredupkan, bukan dihilangkan. Kalau gagal, kartunya
    // harus masih ada di tempatnya.
    opacity: pending ? 0.6 : 1,
    transition: "background var(--duration-fast) var(--ease-out), opacity var(--duration-base)",
  };

  const barisJudul = {
    fontSize: "var(--text-body-size)",
    lineHeight: "var(--text-body-line)",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  };

  const barisMeta = {
    fontSize: "var(--text-caption-size)",
    lineHeight: "var(--text-caption-line)",
    color: "var(--ink-3)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  };

  if (category) {
    return (
      <div
        onClick={onClick}
        onPointerDown={() => setDitekan(true)}
        onPointerUp={() => setDitekan(false)}
        onPointerLeave={() => setDitekan(false)}
        style={{
          ...kartu,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          minHeight: 72,
          cursor: onClick ? "pointer" : "default",
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={barisJudul}>{title || category}</div>
          <div style={barisMeta}>
            {title ? category : null}
            {title && meta ? " · " : ""}
            {meta}
          </div>
        </div>
        <Amount value={amount} direction={direction} size="md" />
      </div>
    );
  }

  return (
    <div style={{ ...kartu, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Nominal dan meta ditumpuk, bukan disandingkan. Di layar 360px
          keduanya berebut baris yang sama dan metanya kepotong. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        {title ? <div style={barisJudul}>{title}</div> : null}
        <Amount value={amount} direction={direction} size="lg" />
        {meta ? <div style={barisMeta}>{meta}</div> : null}
      </div>
      <Button variant="secondary" full onClick={onOpen} disabled={pending}>
        Kategori
      </Button>
    </div>
  );
}
