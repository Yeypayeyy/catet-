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
import { Amount, Bar, BottomNav, Button, CategoryIcon, EmptyState } from "@/components/ui";
import { formatWaktu } from "@/lib/format";
import { catatUrutanKategori, warnaKategori } from "@/lib/warna";
import { bacaAwalBulan } from "@/lib/periode";

type Ringkasan = {
  balance: string;
  accounts: { id: string; name: string; balance: string }[];
  month: { key: string; label: string; spending: string; income: string; days: number };
  by_category: { id: string | null; name: string; icon: string | null; total: string }[];
  pending_count: number;
};

type Kategori = { id: string; name: string; icon: string | null };

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
  const [petaKategori, setPetaKategori] = useState<Record<string, Kategori>>({});
  const [belumLogin, setBelumLogin] = useState(false);

  const muat = useCallback(async () => {
    // Dikirim bersamaan: tiap request menunggu server sendiri-sendiri.
    const [r, rt, rc] = await Promise.all([
      fetch(`/api/summary?start_day=${bacaAwalBulan()}`),
      fetch("/api/transactions?limit=3"),
      fetch("/api/categories"),
    ]);
    if (r.status === 401) {
      setBelumLogin(true);
      return;
    }
    // Kategori dulu: urutannya menentukan warna, jadi harus tercatat sebelum
    // ringkasan pertama kali digambar.
    if (rc.ok) {
      const items: Kategori[] = (await rc.json()).items ?? [];
      catatUrutanKategori(items);
      setPetaKategori(Object.fromEntries(items.map((c) => [c.id, c])));
    }

    setData(await r.json());

    if (rt.ok) setTerakhir((await rt.json()).items ?? []);
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
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, width: "100%", maxWidth: 480, marginInline: "auto" }}>
        <header style={{ padding: "var(--space-6) var(--page-x) var(--space-3)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "var(--space-4)",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                lineHeight: "32px",
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              Ringkasan
            </h1>
            {/* Pengaturan masuk lewat sini, bukan lewat nav bawah: dibuka
                sekali seminggu, bukan tiap hari. */}
            <a
              href="/pengaturan"
              aria-label="Pengaturan"
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--ink-2)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="pengaturan" size={20} />
            </a>
          </div>

          <div
            style={{
              // Amount membaca --ink dan --ink-2; di atas biru keduanya harus
              // ikut putih, jadi ditimpa untuk kartu ini saja.
              ["--ink" as string]: "var(--hero-ink)",
              ["--ink-2" as string]: "var(--hero-ink-2)",
              background: "var(--hero-bg)",
              color: "var(--hero-ink)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-5)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: "var(--text-label-size)",
                  fontWeight: 500,
                  color: "var(--hero-ink-2)",
                }}
              >
                Sisa uang
              </span>
              <span style={{ color: "var(--hero-ink)" }}>
                <Amount value={data?.balance ?? "0"} size="xl" />
              </span>
            </div>
            {(data?.accounts ?? []).length ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: "var(--space-2)",
                }}
              >
                {(data?.accounts ?? []).map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--hero-chip)",
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-caption-size)",
                        color: "var(--hero-ink-2)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.name}
                    </span>
                    <Amount value={a.balance} size="sm" />
                  </div>
                ))}
              </div>
            ) : null}
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
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-3)",
                color: "var(--ink)",
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--tertiary-soft)",
                  color: "var(--tertiary-ink)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="kotak-masuk" size={20} />
              </span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 500 }}>
                {data.pending_count} transaksi menunggu kategori
              </span>
              {/* Seluruh kartu tetap satu tautan; ini cuma penanda aksinya. */}
              <span
                style={{
                  height: "var(--control-h-sm)",
                  padding: "0 var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--tertiary)",
                  color: "var(--tertiary-fg)",
                  fontSize: "var(--text-label-size)",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                Rapikan
              </span>
            </a>
          ) : null}

          {/* Seluruh kartu jadi pintu ke Statistik bulan yang sama. */}
          <Link
            href={`/statistik${data ? `?bulan=${data.month.key}` : ""}`}
            style={{
              textDecoration: "none",
              color: "inherit",
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
                  <Amount value={data?.month.spending ?? "0"} direction="debit" size="lg" />
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
                    style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}
                  >
                    <CategoryIcon id={k.id} icon={k.icon} name={k.name} />
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
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
                      <Bar value={BigInt(k.total)} max={maks} color={warnaKategori(k.id).bar} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Link>

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
                    t.category_id ? (petaKategori[t.category_id]?.name ?? "—") : "Belum dikategorikan"
                  }
                  kategori={t.category_id ? (petaKategori[t.category_id] ?? null) : null}
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
