"use client";

// Potongan yang dipakai bersama layar Transaksi dan Statistik: navigasi
// periode dan tiga angka ringkasannya.

import { Icon } from "@/components/Icon";
import { formatRupiah } from "@/lib/format";

export function NavPeriode({
  label,
  onMundur,
  onMaju,
}: {
  label: string;
  onMundur: () => void;
  onMaju: () => void;
}) {
  const tombol = {
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: 0,
    color: "var(--ink-2)",
    cursor: "pointer",
  } as const;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <button type="button" aria-label="Sebelumnya" onClick={onMundur} style={tombol}>
        <Icon name="panah-kiri" size={22} />
      </button>
      <span style={{ fontSize: "var(--text-body-size)", fontWeight: 600 }}>{label}</span>
      <button type="button" aria-label="Berikutnya" onClick={onMaju} style={tombol}>
        <Icon name="panah-kanan" size={22} />
      </button>
    </div>
  );
}

/**
 * Tiga angka periode. Satu-satunya tempat pengeluaran diberi warna — daftar di
 * bawahnya tetap netral, supaya layar tidak merah semua.
 */
export function RingkasanPeriode({ masuk, keluar }: { masuk: bigint; keluar: bigint }) {
  const kolom = [
    { label: "Pemasukan", teks: `+${formatRupiah(masuk)}`, warna: "var(--income)" },
    { label: "Pengeluaran", teks: formatRupiah(keluar), warna: "var(--danger)" },
    { label: "Selisih", teks: formatRupiah(masuk - keluar), warna: "var(--ink)" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-2)" }}>
      {kolom.map((k) => (
        <div key={k.label} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: "var(--text-caption-size)", color: "var(--ink-3)" }}>{k.label}</span>
          <span
            style={{
              fontSize: "var(--text-label-size)",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              color: k.warna,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {k.teks}
          </span>
        </div>
      ))}
    </div>
  );
}
