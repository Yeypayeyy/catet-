"use client";

// Antrian review — layar yang paling sering dibuka.
//
// Alurnya: satu tombol "Kategori" per kartu, lalu popup berisi pilihan
// kategori dan kolom catatan. Catatan yang diketik jadi judul kartunya
// ("Indomaret"), karena myBCA tidak pernah mengirim nama merchant.

import { useCallback, useEffect, useState } from "react";
import { TransactionCard, type SaranKategori } from "@/components/TransactionCard";
import {
  Amount,
  BottomNav,
  Button,
  CategoryChip,
  EmptyState,
  Input,
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
  const [galat, setGalat] = useState<string | null>(null);
  const [belumLogin, setBelumLogin] = useState(false);

  // Isi popup: transaksi yang sedang dikerjakan, pilihan, dan catatannya.
  const [dibuka, setDibuka] = useState<Transaksi | null>(null);
  const [dipilih, setDipilih] = useState<string | null>(null);
  const [catatan, setCatatan] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async () => {
    const r = await fetch("/api/transactions?is_reviewed=false&with_suggestions=true&limit=50");
    if (r.status === 401) {
      setBelumLogin(true);
      setAntrian([]);
      return;
    }
    const data = await r.json();
    setAntrian(data.items ?? []);

    const rc = await fetch("/api/categories");
    if (rc.ok) setKategori((await rc.json()).items ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void muat();
  }, [muat]);

  function buka(t: Transaksi) {
    setDibuka(t);
    setDipilih(null);
    setCatatan(t.note ?? t.merchant ?? "");
    setGalat(null);
  }

  async function simpan() {
    if (!dibuka || !dipilih || menyimpan) return;
    const t = dibuka;
    setMenyimpan(true);

    const r = await fetch(`/api/transactions/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: dipilih,
        // Kosong berarti tidak diisi, bukan "hapus catatan yang sudah ada".
        ...(catatan.trim() ? { note: catatan.trim() } : null),
      }),
    });

    setMenyimpan(false);

    if (!r.ok) {
      const data = await r.json().catch(() => null);
      setGalat(data?.error?.message ?? "Gagal menyimpan. Coba lagi.");
      return;
    }

    // Baru ditutup dan dihilangkan sesudah server benar-benar menerima.
    setDibuka(null);
    setMemudar((m) => ({ ...m, [t.id]: true }));
    setTimeout(() => setAntrian((xs) => (xs ?? []).filter((x) => x.id !== t.id)), 320);
  }

  const sisa = (antrian ?? []).filter((t) => !memudar[t.id]);
  const total = sisa.reduce((a, t) => a + BigInt(t.amount), 0n);

  // Saran ditaruh paling atas, sisanya menyusul tanpa diulang.
  const saran = dibuka?.suggested_categories ?? [];
  const lainnya = kategori.filter((c) => !saran.some((s) => s.id === c.id));

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
          // Di layar lebar tetap satu kolom sempit: app ini dirancang untuk HP.
          width: "100%",
          maxWidth: 480,
          marginInline: "auto",
        }}
      >
        {galat && !dibuka ? <WarningBanner tone="danger" title={galat} /> : null}

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
              title={t.note ?? t.merchant}
              meta={[formatWaktu(t.occurred_at), t.bank_category].filter(Boolean).join(" · ")}
              onOpen={() => buka(t)}
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

      <BottomNav active="review" />

      <Sheet open={dibuka !== null} title="Pilih kategori" onClose={() => setDibuka(null)}>
        {dibuka ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            {/* Nominal ikut ditampilkan supaya jelas transaksi mana yang
                sedang dikerjakan — popupnya menutupi kartunya. */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
              <Amount value={dibuka.amount} direction={dibuka.direction} size="lg" />
              <span
                style={{
                  fontSize: "var(--text-caption-size)",
                  color: "var(--ink-3)",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {formatWaktu(dibuka.occurred_at)}
                {dibuka.bank_category ? ` · ${dibuka.bank_category}` : ""}
              </span>
            </div>

            {galat ? <WarningBanner tone="danger" title={galat} /> : null}

            {saran.length ? (
              <Seksi judul="Saran">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                  {saran.map((c) => (
                    <CategoryChip
                      key={c.id}
                      label={c.name}
                      suggested
                      selected={dipilih === c.id}
                      onSelect={() => setDipilih(c.id)}
                    />
                  ))}
                </div>
              </Seksi>
            ) : null}

            <Seksi judul="Semua kategori">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {lainnya.map((c) => (
                  <CategoryChip
                    key={c.id}
                    label={c.name}
                    selected={dipilih === c.id}
                    onSelect={() => setDipilih(c.id)}
                  />
                ))}
              </div>
            </Seksi>

            <Input
              label="Catatan"
              placeholder="Indomaret"
              hint="Muncul sebagai judul transaksi."
              value={catatan}
              onChange={setCatatan}
            />

            <Button full onClick={simpan} disabled={!dipilih || menyimpan}>
              {menyimpan ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function Seksi({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <h3
        style={{
          margin: 0,
          fontSize: "var(--text-overline-size)",
          lineHeight: "var(--text-overline-line)",
          letterSpacing: "var(--text-overline-tracking)",
          textTransform: "uppercase",
          color: "var(--ink-3)",
          fontWeight: 500,
        }}
      >
        {judul}
      </h3>
      {children}
    </section>
  );
}
