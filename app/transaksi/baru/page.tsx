"use client";

// Input manual: tarik tunai, bayar cash, apa pun yang tidak lewat notifikasi.
// ?tanggal=2026-09-13 datang dari kepala hari di layar Transaksi.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TransactionForm } from "@/components/TransactionForm";
import { ScreenHeader } from "@/components/ui";

export default function TransaksiBaruPage() {
  return (
    <main style={{ width: "100%", maxWidth: 480, marginInline: "auto" }}>
      <ScreenHeader meta="Manual" title="Transaksi baru" back="/transaksi" />
      <div style={{ padding: "0 var(--page-x) var(--space-12)" }}>
        {/* useSearchParams butuh Suspense supaya halaman tetap bisa dirender statis. */}
        <Suspense>
          <Formulir />
        </Suspense>
      </div>
    </main>
  );
}

function Formulir() {
  return <TransactionForm tanggal={useSearchParams().get("tanggal")} />;
}
