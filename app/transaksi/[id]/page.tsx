"use client";

// Detail sekaligus ubah. Tidak ada mode "lihat" terpisah: yang dibuka dari
// daftar hampir selalu dibuka karena ada yang mau dibetulkan.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TransactionForm, type TransaksiAwal } from "@/components/TransactionForm";
import { EmptyState, ScreenHeader } from "@/components/ui";
import { formatWaktu } from "@/lib/format";

export default function TransaksiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tx, setTx] = useState<TransaksiAwal | null>(null);
  const [hilang, setHilang] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/transactions/${id}`);
      // 401 ikut ke sini: kalau session habis, transaksinya memang tidak ada
      // dari sudut pandang layar ini.
      if (!r.ok) {
        setHilang(true);
        return;
      }
      setTx(await r.json());
    })();
  }, [id]);

  return (
    <main style={{ width: "100%", maxWidth: 480, marginInline: "auto" }}>
      <ScreenHeader
        meta={tx ? formatWaktu(tx.occurred_at) : undefined}
        title="Ubah transaksi"
        back="/transaksi"
      />
      <div style={{ padding: "0 var(--page-x) var(--space-12)" }}>
        {hilang ? (
          <EmptyState icon="peringatan" title="Transaksi tidak ditemukan." />
        ) : tx ? (
          <TransactionForm awal={tx} />
        ) : (
          <p style={{ color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>Memuat…</p>
        )}
      </div>
    </main>
  );
}
