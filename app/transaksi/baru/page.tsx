"use client";

// Input manual: tarik tunai, bayar cash, apa pun yang tidak lewat notifikasi.

import { TransactionForm } from "@/components/TransactionForm";
import { ScreenHeader } from "@/components/ui";

export default function TransaksiBaruPage() {
  return (
    <main style={{ width: "100%", maxWidth: 480, marginInline: "auto" }}>
      <ScreenHeader meta="Manual" title="Transaksi baru" back="/transaksi" />
      <div style={{ padding: "0 var(--page-x) var(--space-12)" }}>
        <TransactionForm />
      </div>
    </main>
  );
}
