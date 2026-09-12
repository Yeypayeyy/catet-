"use client";

// Ringkasan — layar pertama yang dibuka kalau bukan dari notifikasi.
//
// Urutannya menjawab tiga pertanyaan, dari yang paling sering ditanya:
// berapa sisa uangku, ada yang perlu dirapikan tidak, ke mana perginya.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { TransactionCard } from "@/components/TransactionCard";
import { Amount, Bar, BottomNav, Button, EmptyState } from "@/components/ui";
import { formatWaktu } from "@/lib/format";

type Ringkasan = {
  balance: string;
  accounts: { id: string; name: string; balance: string }[];
  month: { key: string; label: string; spending: string; income: string; days: number };
  by_category: { id: string | null; name: string; total: string }[];
  pending_count: number;
};

type Transaksi = {
  id: string;
  amount: string;
  direction: "debit" | "credit";
  occurred_at: string;
  note: string | null;
  merchant: string | null;
  bank_category: string | null;
  category_id: string | null;
};

export default function RingkasanPage() {
  const router = useRouter();
  const [data, setData] = useState<Ringkasan | null>(null);
  const [terakhir, setTerakhir] = useState<Transaksi[]>([]);
  const [kategoriNama, setKategoriNama] = useState<Record<string, string>>({});
  const [belumLogin, setBelumLogin] = useState(false);

  const muat = useCallback(async () => {
    const r = await fetch("/api/summary");
    if (r.status === 401) {
      setBelumLogin(true);
      return;
    }
    setData(await r.json());

    const rt = await fetch("/api/transactions?limit=3");
    if (rt.ok) setTerakhir((await rt.json()).items ?? []);

    const rc = await fetch("/api/categories");
    if (rc.ok) {
      const items: { id: string; name: string }[] = (await rc.json()).items ?? [];
      setKategoriNama(Object.fromEntries(items.map((c) => [c.id, c.name])));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void muat();
  }, [muat]);

  if (belumLogin) {
    return (
      <main style={{ padding: "var(--space-12) var(--page-x)" }}>
        <EmptyState
          icon="dompet"
          title="Belum login."
          description="Masuk dengan Google untuk melihat catatanmu."
          action={
            <a href="/api/auth/signin" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="sm">
                Login dengan Google
              </Button>
            </a>
          }
        />
      </main>
    );
  }

  const maks = (data?.by_category ?? []).reduce(
    (a, k) => (BigInt(k.total) > a ? BigInt(k.total) : a),
    0n,
  );

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, width: "100%", maxWidth: 480, marginInline: "auto" }}>
        <header style={{ padding: "var(--space-6) var(--page-x) var(--space-3)" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -8 }}>
            {/* Pengaturan masuk lewat sini, bukan lewat nav bawah: dibuka
                sekali seminggu, bukan tiap hari. */}
            <a href="/pengaturan" aria-label="Pengaturan" style={{ color: "var(--ink-3)", padding: 4 }}>
              <Icon name="pengaturan" size={22} />
            </a>
          </div>
          <div
            style={{
              fontSize: "var(--text-overline-size)",
              lineHeight: "var(--text-overline-line)",
              letterSpacing: "var(--text-overline-tracking)",
              textTransform: "uppercase",
              color: "var(--ink-3)",
              fontWeight: 500,
            }}
          >
            Sisa uang
          </div>
          <div style={{ marginTop: 6 }}>
            <Amount value={data?.balance ?? "0"} size="xl" />
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-4) var(--space-6)",
              marginTop: "var(--space-4)",
            }}
          >
            {(data?.accounts ?? []).map((a) => (
              <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: "var(--text-caption-size)", color: "var(--ink-3)" }}>
                  {a.name}
                </span>
                <Amount value={a.balance} size="sm" />
              </div>
            ))}
          </div>
        </header>

        <div
          style={{
            padding: "var(--space-4) var(--page-x) var(--space-8)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--card-gap)",
          }}
        >
          {data && data.pending_count > 0 ? (
            <a
              href="/review"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                background: "var(--accent-soft)",
                border: "1px solid transparent",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-4) var(--card-x)",
                color: "var(--ink)",
                textDecoration: "none",
              }}
            >
              <Icon name="kotak-masuk" size={22} color="var(--accent)" />
              <span style={{ flex: 1, fontWeight: 500 }}>
                {data.pending_count} transaksi menunggu kategori
              </span>
              <Icon name="panah-kanan" size={20} color="var(--ink-3)" />
            </a>
          ) : null}

          <section
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--card-y) var(--card-x)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-5)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "var(--space-3)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--text-overline-size)",
                    letterSpacing: "var(--text-overline-tracking)",
                    textTransform: "uppercase",
                    color: "var(--ink-3)",
                    fontWeight: 500,
                  }}
                >
                  Pengeluaran {data?.month.label ?? ""}
                </div>
                <div style={{ marginTop: 2 }}>
                  <Amount value={data?.month.spending ?? "0"} size="lg" />
                </div>
              </div>
              <span
                style={{
                  fontSize: "var(--text-caption-size)",
                  color: "var(--ink-3)",
                  whiteSpace: "nowrap",
                }}
              >
                {data?.month.days ?? 0} hari
              </span>
            </div>

            {(data?.by_category ?? []).length === 0 ? (
              <p style={{ margin: 0, color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>
                Belum ada pengeluaran bulan ini.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {(data?.by_category ?? []).slice(0, 6).map((k) => (
                  <div
                    key={k.id ?? "kosong"}
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "var(--space-3)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "var(--text-label-size)",
                          fontWeight: 500,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          // Yang belum dikategorikan diredupkan: ini bukan
                          // kategori, cuma tumpukan yang belum dikerjakan.
                          color: k.id ? "var(--ink)" : "var(--ink-3)",
                        }}
                      >
                        {k.name}
                      </span>
                      <Amount value={k.total} size="sm" />
                    </div>
                    <Bar value={BigInt(k.total)} max={maks} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {terakhir.length ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "var(--space-2)",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-label-size)",
                    fontWeight: 500,
                    color: "var(--ink-2)",
                  }}
                >
                  Terakhir
                </span>
                <Link
                  href="/transaksi"
                  style={{
                    fontSize: "var(--text-label-size)",
                    color: "var(--accent)",
                    textDecoration: "none",
                  }}
                >
                  Semua
                </Link>
              </div>
              {terakhir.map((t) => (
                <TransactionCard
                  key={t.id}
                  amount={t.amount}
                  direction={t.direction}
                  title={t.note ?? t.merchant}
                  meta={[formatWaktu(t.occurred_at), t.bank_category].filter(Boolean).join(" · ")}
                  category={
                    t.category_id ? (kategoriNama[t.category_id] ?? "—") : "Belum dikategorikan"
                  }
                  onClick={() => router.push(`/transaksi/${t.id}`)}
                />
              ))}
            </>
          ) : null}
        </div>
      </div>

      <BottomNav active="ringkasan" />
    </div>
  );
}
