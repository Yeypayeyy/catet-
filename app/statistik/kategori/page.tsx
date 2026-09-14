"use client";

// Detail satu kategori dari layar Statistik: total periode, tren setahun
// kategori itu, lalu transaksinya per hari.
//
// URL: ?id=<kategori>&jenis=debit|credit ditambah periode yang sama dengan
// Statistik (?bulan=2026-09 atau ?tampilan=tahunan&tahun=2026).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NavPeriode } from "@/components/Periode";
import { Amount, EmptyState, ScreenHeader } from "@/components/ui";
import { labelKategori } from "@/lib/format";
import { bacaPeriode, batasBulanWib, bulanWib, geserBulan, kelompokkanPerHari, labelBulan } from "@/lib/periode";

type Transaksi = {
  id: string;
  account_id: string;
  amount: string;
  direction: "debit" | "credit";
  occurred_at: string;
  note: string | null;
  merchant: string | null;
};
type Bulan = { month: string; income: string; spending: string };

const BULAN_HURUF = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default function Halaman() {
  return (
    <Suspense>
      <DetailKategori />
    </Suspense>
  );
}

function DetailKategori() {
  const router = useRouter();
  const sp = useSearchParams();
  const [bulanIni] = useState(() => bulanWib());
  const { bulan, tahun, perTahun } = bacaPeriode(sp, bulanIni, "tahunan");
  const id = sp.get("id") ?? "";
  const jenis = sp.get("jenis") === "credit" ? "credit" : "debit";

  const [judul, setJudul] = useState("Kategori");
  const [namaAkun, setNamaAkun] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Transaksi[] | null>(null);
  const [tren, setTren] = useState<Bulan[] | null>(null);

  useEffect(() => {
    void (async () => {
      const [rk, ra] = await Promise.all([fetch("/api/categories"), fetch("/api/accounts")]);
      if (rk.ok) {
        const k = ((await rk.json()).items ?? []).find((c: { id: string }) => c.id === id);
        if (k) setJudul(labelKategori(k));
      }
      if (ra.ok) {
        const akun: { id: string; name: string }[] = (await ra.json()).items ?? [];
        setNamaAkun(Object.fromEntries(akun.map((a) => [a.id, a.name])));
      }
    })();
  }, [id]);

  useEffect(() => {
    let aktif = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null);
    void (async () => {
      const from = batasBulanWib(perTahun ? `${tahun}-01` : bulan).from;
      const to = batasBulanWib(perTahun ? `${tahun}-12` : bulan).to;
      const semua: Transaksi[] = [];
      let offset: number | null = 0;
      while (offset !== null) {
        const q: URLSearchParams = new URLSearchParams({
          from,
          to,
          category_id: id,
          direction: jenis,
          limit: "200",
          offset: String(offset),
        });
        const r: Response = await fetch(`/api/transactions?${q}`);
        if (!r.ok) break;
        const data: { items: Transaksi[]; next_offset: number | null } = await r.json();
        semua.push(...data.items);
        offset = data.next_offset;
      }
      if (aktif) setItems(semua);
    })();
    return () => {
      aktif = false;
    };
  }, [id, jenis, perTahun, tahun, bulan]);

  useEffect(() => {
    let aktif = true;
    void (async () => {
      const r = await fetch(`/api/transactions/monthly?year=${tahun}&category_id=${id}`);
      if (aktif && r.ok) setTren((await r.json()).months);
    })();
    return () => {
      aktif = false;
    };
  }, [id, tahun]);

  const periode = (q: string) => `id=${id}&jenis=${jenis}&${q}`;
  const buka = (q: string) => router.push(`/statistik/kategori?${periode(q)}`);
  const qPeriode = perTahun ? `tampilan=tahunan&tahun=${tahun}` : `bulan=${bulan}`;
  const label = perTahun ? String(tahun) : labelBulan(bulan);
  const total = (items ?? []).reduce((a, t) => a + BigInt(t.amount), 0n);

  return (
    <div style={{ width: "100%", maxWidth: 480, marginInline: "auto", paddingBottom: "var(--space-8)" }}>
      <ScreenHeader title={judul} back={`/statistik?${qPeriode}`} />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "0 var(--page-x)" }}>
        <NavPeriode
          label={label}
          onMundur={() =>
            buka(perTahun ? `tampilan=tahunan&tahun=${tahun - 1}` : `bulan=${geserBulan(bulan, -1)}`)
          }
          onMaju={() => buka(perTahun ? `tampilan=tahunan&tahun=${tahun + 1}` : `bulan=${geserBulan(bulan, 1)}`)}
        />

        <section style={kartu}>
          <div style={{ padding: "var(--card-y) var(--card-x)" }}>
            <div style={{ fontSize: "var(--text-caption-size)", color: "var(--ink-3)" }}>
              Total {jenis === "debit" ? "pengeluaran" : "pemasukan"}
            </div>
            {items === null ? <Memuat /> : <Amount value={total} direction={jenis} size="md" />}
          </div>
          <div style={{ padding: "0 var(--card-x) var(--card-y)" }}>
            {tren === null ? (
              <Memuat />
            ) : (
              <Tren
                bulan={tren}
                jenis={jenis}
                terpilih={perTahun ? null : bulan}
                onPilih={(key) => buka(`bulan=${key}`)}
              />
            )}
          </div>
        </section>

        {items === null ? null : items.length === 0 ? (
          <EmptyState compact icon="statistik" title={`Belum ada transaksi di ${label}.`} />
        ) : (
          kelompokkanPerHari(items).map((h) => (
            <section key={h.tanggal} style={kartu}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "var(--space-3) var(--card-x)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: "var(--text-title-size)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {h.angka}
                </span>
                <span style={{ flex: 1, fontSize: "var(--text-caption-size)", color: "var(--ink-3)" }}>
                  {h.namaHari}
                  {perTahun ? ` · ${labelBulan(h.tanggal.slice(0, 7))}` : ""}
                </span>
                <Amount value={jenis === "debit" ? h.keluar : h.masuk} direction={jenis} size="sm" muted={jenis === "debit"} />
              </div>
              {h.items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => router.push(`/transaksi/${t.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    width: "100%",
                    minHeight: 60,
                    padding: "var(--space-2) var(--card-x)",
                    background: "transparent",
                    border: 0,
                    borderTop: "1px solid var(--border)",
                    marginTop: -1,
                    color: "var(--ink)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: "var(--text-body-size)", fontWeight: 500, ...satuBaris }}>
                      {t.note ?? t.merchant ?? "—"}
                    </span>
                    <span style={{ fontSize: "var(--text-caption-size)", color: "var(--ink-3)", ...satuBaris }}>
                      {namaAkun[t.account_id] ?? ""}
                    </span>
                  </span>
                  <Amount value={t.amount} direction={t.direction} size="sm" />
                </button>
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

const kartu = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  overflow: "hidden",
} as const;

const satuBaris = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

function Memuat() {
  return <p style={{ margin: 0, color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>Memuat…</p>;
}

/** Dua belas batang untuk satu kategori, tinggi relatif ke bulan terbesar. */
function Tren({
  bulan,
  jenis,
  terpilih,
  onPilih,
}: {
  bulan: Bulan[];
  jenis: "debit" | "credit";
  terpilih: string | null;
  onPilih: (key: string) => void;
}) {
  const nilai = bulan.map((m) => BigInt(jenis === "debit" ? m.spending : m.income));
  const maks = nilai.reduce((a, v) => (v > a ? v : a), 0n);
  // Float hanya untuk tinggi batang, bukan nominal.
  const tinggi = (v: bigint) => (maks === 0n ? 0 : (Number(v) / Number(maks)) * 100);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4, marginTop: "var(--space-4)" }}>
      {bulan.map((m, i) => (
        <button
          key={m.month}
          type="button"
          aria-label={labelBulan(m.month)}
          onClick={() => onPilih(m.month)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: 0,
            padding: 0,
            cursor: "pointer",
            opacity: terpilih && terpilih !== m.month ? 0.45 : 1,
          }}
        >
          <span style={{ height: 80, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <span
              style={{
                width: "60%",
                height: `${tinggi(nilai[i])}%`,
                background: jenis === "debit" ? "var(--danger)" : "var(--income)",
                borderRadius: 2,
              }}
            />
          </span>
          <span
            style={{
              fontSize: "var(--text-caption-size)",
              color: terpilih === m.month ? "var(--ink)" : "var(--ink-3)",
              fontWeight: terpilih === m.month ? 600 : 400,
            }}
          >
            {BULAN_HURUF[i]}
          </span>
        </button>
      ))}
    </div>
  );
}
