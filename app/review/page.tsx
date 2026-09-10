"use client";

// Antrian review — layar yang paling sering dibuka.
//
// Satu tap pada chip = PATCH ke server, kartu memudar, selesai. Semua yang
// lain di halaman ini tunduk pada itu: tidak ada konfirmasi, tidak ada dialog,
// tidak ada langkah kedua.

import { useCallback, useEffect, useState } from "react";
import { TransactionCard, type SaranKategori } from "@/components/TransactionCard";
import {
  Amount,
  Button,
  CategoryChip,
  EmptyState,
  ScreenHeader,
  Sheet,
  WarningBanner,
} from "@/components/ui";
import { formatWaktu } from "@/lib/format";

type Transaksi = {
  id: string;
  amount: string;
  direction: "debit" | "credit";
  occurred_at: string;
  note: string | null;
  merchant: string | null;
  bank_category: string | null;
  suggested_categories?: SaranKategori[];
};

type Kategori = { id: string; name: string };

export default function ReviewPage() {
  const [antrian, setAntrian] = useState<Transaksi[] | null>(null);
  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [memudar, setMemudar] = useState<Record<string, true>>({});
  const [sheetUntuk, setSheetUntuk] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [belumLogin, setBelumLogin] = useState(false);

  const muat = useCallback(async () => {
    const r = await fetch("/api/transactions?is_reviewed=false&with_suggestions=true&limit=50");
    if (r.status === 401) {
      setBelumLogin(true);
      setAntrian([]);
      return;
    }
    const data = await r.json();
    setAntrian(data.items ?? []);

    // Dipakai isi sheet "Lainnya". Diambil sekali, tidak per kartu.
    const rc = await fetch("/api/categories");
    if (rc.ok) setKategori((await rc.json()).items ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void muat();
  }, [muat]);

  async function pilih(transaksi: Transaksi, kategoriId: string) {
    setGalat(null);
    // Kartu memudar duluan supaya terasa langsung. Kalau servernya menolak,
    // kartunya dikembalikan — lebih baik terlihat gagal daripada terlihat
    // selesai padahal tidak tercatat.
    setMemudar((m) => ({ ...m, [transaksi.id]: true }));

    const r = await fetch(`/api/transactions/${transaksi.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: kategoriId }),
    });

    if (!r.ok) {
      setMemudar((m) => {
        const sisa = { ...m };
        delete sisa[transaksi.id];
        return sisa;
      });
      const data = await r.json().catch(() => null);
      setGalat(data?.error?.message ?? "Gagal menyimpan kategori. Coba lagi.");
      return;
    }

    setTimeout(() => {
      setAntrian((xs) => (xs ?? []).filter((x) => x.id !== transaksi.id));
    }, 320);
  }

  const sisa = (antrian ?? []).filter((t) => !memudar[t.id]);
  const total = sisa.reduce((a, t) => a + BigInt(t.amount), 0n);

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <ScreenHeader
        meta="Belum dikategorikan"
        title={sisa.length ? `${sisa.length} transaksi` : "Review"}
        right={sisa.length ? <Amount value={total} size="sm" muted /> : null}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "var(--card-gap)",
          padding: "var(--space-2) var(--page-x) var(--space-12)",
        }}
      >
        {galat ? <WarningBanner tone="danger" title={galat} /> : null}

        {belumLogin ? (
          <EmptyState
            icon="dompet"
            title="Belum login."
            description="Masuk dengan Google untuk melihat transaksimu."
            action={
              <a href="/api/auth/signin" style={{ textDecoration: "none" }}>
                <Button variant="secondary" size="sm">
                  Login dengan Google
                </Button>
              </a>
            }
          />
        ) : null}

        {antrian === null ? (
          <p style={{ color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>Memuat…</p>
        ) : null}

        {(antrian ?? []).map((t) => (
          <div
            key={t.id}
            style={{
              transition: "opacity 300ms var(--ease-out), transform 300ms var(--ease-out)",
              opacity: memudar[t.id] ? 0 : 1,
              transform: memudar[t.id] ? "translateY(-6px)" : "none",
            }}
          >
            <TransactionCard
              amount={t.amount}
              direction={t.direction}
              note={t.merchant ?? t.note}
              account={t.bank_category}
              time={formatWaktu(t.occurred_at)}
              suggestions={t.suggested_categories ?? []}
              onPick={(k) => pilih(t, k.id)}
              onMore={() => setSheetUntuk(t.id)}
              pending={Boolean(memudar[t.id])}
            />
          </div>
        ))}

        {antrian !== null && !belumLogin && sisa.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <EmptyState
              icon="centang"
              title="Semua sudah rapi."
              description="Tidak ada transaksi yang menunggu kategori."
            />
          </div>
        ) : null}
      </div>

      <Sheet open={sheetUntuk !== null} title="Pilih kategori" onClose={() => setSheetUntuk(null)}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {kategori.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.name}
              onSelect={() => {
                const t = (antrian ?? []).find((x) => x.id === sheetUntuk);
                setSheetUntuk(null);
                if (t) void pilih(t, c.id);
              }}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
