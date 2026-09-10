"use client";

import { useState } from "react";
import { Amount, CategoryChip, ChipRow } from "@/components/ui";

export type SaranKategori = { id: string; name: string };

/**
 * Kartu transaksi, dua wajah:
 *
 * - **review** (kategori masih kosong) — nominal besar di atas, tiga chip saran
 *   di bawah. Ini bentuk yang paling sering dilihat, karena antrian review
 *   adalah layar yang paling sering dibuka.
 * - **selesai** (sudah berkategori) — satu baris ringkas, nominal di kanan.
 */
export function TransactionCard({
  amount,
  direction = "debit",
  note,
  account,
  time,
  category,
  suggestions = [],
  onPick,
  onMore,
  selected,
  pending = false,
  onClick,
}: {
  amount: bigint | number | string;
  direction?: "debit" | "credit";
  note?: string | null;
  account?: string | null;
  time?: string | null;
  category?: string | null;
  suggestions?: SaranKategori[];
  onPick?: (kategori: SaranKategori) => void;
  onMore?: () => void;
  selected?: string | null;
  pending?: boolean;
  onClick?: () => void;
}) {
  const [ditekan, setDitekan] = useState(false);
  const meta = [account, time].filter(Boolean).join(" · ");

  const kartu = {
    background: ditekan && onClick ? "var(--surface-2)" : "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--card-y) var(--card-x)",
    color: "var(--ink)",
    // Sedang dikirim ke server: diredupkan, bukan dihilangkan. Kalau gagal,
    // kartunya harus masih ada di tempatnya.
    opacity: pending ? 0.6 : 1,
    transition: "background var(--duration-fast) var(--ease-out), opacity var(--duration-base)",
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
          <div
            style={{
              fontSize: "var(--text-body-size)",
              lineHeight: "var(--text-body-line)",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {note || category}
          </div>
          <div
            style={{
              fontSize: "var(--text-caption-size)",
              lineHeight: "var(--text-caption-line)",
              color: "var(--ink-3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {note ? category : null}
            {note && meta ? " · " : ""}
            {meta}
          </div>
        </div>
        <Amount value={amount} direction={direction} size="md" />
      </div>
    );
  }

  return (
    <div style={{ ...kartu, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "var(--space-3)",
        }}
      >
        <Amount value={amount} direction={direction} size="lg" />
        <span
          style={{
            fontSize: "var(--text-caption-size)",
            lineHeight: "var(--text-caption-line)",
            color: "var(--ink-3)",
            whiteSpace: "nowrap",
          }}
        >
          {meta}
        </span>
      </div>
      {note ? (
        <div
          style={{
            fontSize: "var(--text-body-size)",
            lineHeight: "var(--text-body-line)",
            color: "var(--ink-2)",
            marginTop: -8,
          }}
        >
          {note}
        </div>
      ) : null}
      {/* Chip menggulir sampai tepi kartu, bukan berhenti di padding-nya. */}
      <ChipRow style={{ margin: "0 calc(-1 * var(--card-x))", padding: "0 var(--card-x)" }}>
        {suggestions.map((s) => (
          <CategoryChip
            key={s.id}
            label={s.name}
            suggested
            selected={selected === s.id}
            onSelect={() => onPick?.(s)}
          />
        ))}
        <CategoryChip label="Lainnya" onSelect={onMore} />
      </ChipRow>
    </div>
  );
}
