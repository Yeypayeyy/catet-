"use client";

// Transaksi per periode — Harian (satu bulan, dikelompokkan per hari) dan
// Bulanan (satu tahun, total per bulan).
//
// Periodenya tinggal di URL (?bulan=2026-09, ?tampilan=bulanan&tahun=2026),
// bukan di state: tombol kembali dan refresh harus tetap di bulan yang sama.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import {
  Amount,
  BottomNav,
  Button,
  CategoryChip,
  ChipRow,
  EmptyState,
  ScreenHeader,
} from "@/components/ui";
import { formatRupiah, labelKategori } from "@/lib/format";
import { NavPeriode, RingkasanPeriode } from "@/components/Periode";
import {
  bacaPeriode,
  batasBulanWib,
  bulanWib,
  geserBulan,
  jumlahkan,
  kelompokkanPerHari,
  labelBulan,
} from "@/lib/periode";

type Transaksi = {
  id: string;
  account_id: string;
  category_id: string | null;
  amount: string;
  direction: "debit" | "credit";
  occurred_at: string;
  note: string | null;
  merchant: string | null;
};

type Kategori = { id: string; name: string; icon: string | null; hidden: boolean };
type Bulan = { month: string; income: string; spending: string };

export default function Halaman() {
  // useSearchParams butuh Suspense supaya halaman tetap bisa dirender statis.
  return (
    <Suspense>
      <TransaksiPage />
    </Suspense>
  );
}

function TransaksiPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // Dihitung sekali saat mount: jam dinding tidak boleh ikut menentukan render.
  const [bulanIni] = useState(() => bulanWib());

  const { bulan, tahun, perTahun: bulanan } = bacaPeriode(sp, bulanIni, "bulanan");

  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [namaAkun, setNamaAkun] = useState<Record<string, string>>({});
  const [saring, setSaring] = useState<string | null>(null);
  const [items, setItems] = useState<Transaksi[] | null>(null);
  const [bulanBulan, setBulanBulan] = useState<Bulan[] | null>(null);
  const [belumLogin, setBelumLogin] = useState(false);

  useEffect(() => {
    void (async () => {
      const [rk, ra] = await Promise.all([fetch("/api/categories"), fetch("/api/accounts")]);
      if (rk.ok) setKategori((await rk.json()).items ?? []);
      if (ra.ok) {
        const akun: { id: string; name: string }[] = (await ra.json()).items ?? [];
        setNamaAkun(Object.fromEntries(akun.map((a) => [a.id, a.name])));
      }
    })();
  }, []);

  // Harian: seluruh transaksi sebulan, halaman demi halaman sampai habis.
  useEffect(() => {
    if (bulanan) return;
    let aktif = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null);

    void (async () => {
      const { from, to } = batasBulanWib(bulan);
      const semua: Transaksi[] = [];
      let offset: number | null = 0;

      while (offset !== null) {
        const q: URLSearchParams = new URLSearchParams({ from, to, limit: "200", offset: String(offset) });
        if (saring) q.set("category_id", saring);
        const r: Response = await fetch(`/api/transactions?${q}`);
        if (r.status === 401) {
          if (aktif) setBelumLogin(true);
          break;
        }
        if (!r.ok) break;
        const data: { items: Transaksi[]; next_offset: number | null } = await r.json();
        semua.push(...data.items);
        offset = data.next_offset;
      }

      // Pindah bulan sebelum fetch selesai: hasil lama dibuang.
      if (aktif) setItems(semua);
    })();

    return () => {
      aktif = false;
    };
  }, [bulanan, bulan, saring]);

  // Bulanan: dua belas baris dari server.
  useEffect(() => {
    if (!bulanan) return;
    let aktif = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBulanBulan(null);

    void (async () => {
      const r = await fetch(`/api/transactions/monthly?year=${tahun}`);
      if (!aktif) return;
      if (r.status === 401) {
        setBelumLogin(true);
        return;
      }
      setBulanBulan(r.ok ? (await r.json()).months : []);
    })();

    return () => {
      aktif = false;
    };
  }, [bulanan, tahun]);

  const buka = (q: string) => router.push(`/transaksi?${q}`);

  const total = bulanan
    ? (bulanBulan ?? []).reduce(
        (a, m) => ({ masuk: a.masuk + BigInt(m.income), keluar: a.keluar + BigInt(m.spending) }),
        { masuk: 0n, keluar: 0n },
      )
    : jumlahkan(items ?? []);

  const labelKat = Object.fromEntries(kategori.map((c) => [c.id, labelKategori(c)]));

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, width: "100%", maxWidth: 480, marginInline: "auto" }}>
        <ScreenHeader title="Transaksi" />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
            padding: "0 var(--page-x) var(--space-4)",
          }}
        >
          <NavPeriode
            label={bulanan ? String(tahun) : labelBulan(bulan)}
            onMundur={() =>
              buka(bulanan ? `tampilan=bulanan&tahun=${tahun - 1}` : `bulan=${geserBulan(bulan, -1)}`)
            }
            onMaju={() =>
              buka(bulanan ? `tampilan=bulanan&tahun=${tahun + 1}` : `bulan=${geserBulan(bulan, 1)}`)
            }
          />

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <CategoryChip
              label="Harian"
              selected={!bulanan}
              onSelect={() => buka(`bulan=${tahun === Number(bulan.slice(0, 4)) ? bulan : `${tahun}-01`}`)}
            />
            <CategoryChip
              label="Bulanan"
              selected={bulanan}
              onSelect={() => buka(`tampilan=bulanan&tahun=${tahun}`)}
            />
          </div>

          <RingkasanPeriode masuk={total.masuk} keluar={total.keluar} />
        </div>

        {!bulanan && kategori.length ? (
          <ChipRow style={{ padding: "0 var(--page-x) var(--space-4)" }}>
            <CategoryChip label="Semua" selected={saring === null} onSelect={() => setSaring(null)} />
            {kategori.filter((c) => !c.hidden).map((c) => (
              <CategoryChip
                key={c.id}
                label={labelKategori(c)}
                selected={saring === c.id}
                onSelect={() => setSaring(c.id)}
              />
            ))}
          </ChipRow>
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--card-gap)",
            // Bawahnya dilebihkan supaya baris terakhir tidak tertutup tombol +.
            padding: "0 var(--page-x) 96px",
          }}
        >
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
          ) : bulanan ? (
            <DaftarBulanan
              bulan={bulanBulan}
              onPilih={(key) => buka(`bulan=${key}`)}
            />
          ) : items === null ? (
            <Memuat />
          ) : items.length === 0 ? (
            <EmptyState
              icon="daftar"
              title={`Belum ada transaksi di ${labelBulan(bulan)}.`}
            />
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
                  <span
                    style={{
                      fontSize: "var(--text-title-size)",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {h.angka}
                  </span>
                  <span style={{ flex: 1, fontSize: "var(--text-caption-size)", color: "var(--ink-3)" }}>
                    {h.namaHari}
                  </span>
                  {h.masuk > 0n ? <Amount value={h.masuk} direction="credit" size="sm" /> : null}
                  {h.keluar > 0n ? <Amount value={h.keluar} size="sm" muted /> : null}
                </div>

                {h.items.map((t) => (
                  <BarisTransaksi
                    key={t.id}
                    t={t}
                    kategori={t.category_id ? (labelKat[t.category_id] ?? "—") : "Belum"}
                    akun={namaAkun[t.account_id] ?? ""}
                    onClick={() => router.push(`/transaksi/${t.id}`)}
                  />
                ))}
              </section>
            ))
          )}
        </div>
      </div>

      <Link
        href="/transaksi/baru"
        aria-label="Tambah transaksi"
        style={{
          position: "fixed",
          bottom: 96,
          // Tetap di dalam kolom 480px, walau layarnya lebar.
          right: "max(var(--page-x), calc(50vw - 240px + var(--page-x)))",
          width: 56,
          height: 56,
          borderRadius: "var(--radius-full)",
          background: "var(--accent)",
          color: "var(--accent-fg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <Icon name="tambah" size={26} />
      </Link>

      <BottomNav active="transaksi" />
    </div>
  );
}

const kartu = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  overflow: "hidden",
} as const;

function Memuat() {
  return <p style={{ color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>Memuat…</p>;
}

function BarisTransaksi({
  t,
  kategori,
  akun,
  onClick,
}: {
  t: Transaksi;
  kategori: string;
  akun: string;
  onClick: () => void;
}) {
  const satuBaris = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

  return (
    <button
      type="button"
      onClick={onClick}
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
      <span
        style={{
          width: 104,
          flex: "none",
          fontSize: "var(--text-caption-size)",
          color: "var(--ink-3)",
          ...satuBaris,
        }}
      >
        {kategori}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: "var(--text-body-size)", fontWeight: 500, ...satuBaris }}>
          {t.note ?? t.merchant ?? "—"}
        </span>
        {akun ? (
          <span style={{ fontSize: "var(--text-caption-size)", color: "var(--ink-3)", ...satuBaris }}>
            {akun}
          </span>
        ) : null}
      </span>
      <Amount value={t.amount} direction={t.direction} size="sm" />
    </button>
  );
}

function DaftarBulanan({
  bulan,
  onPilih,
}: {
  bulan: Bulan[] | null;
  onPilih: (key: string) => void;
}) {
  if (bulan === null) return <Memuat />;

  return (
    <section style={kartu}>
      {bulan.map((m, i) => {
        const masuk = BigInt(m.income);
        const keluar = BigInt(m.spending);
        const kosong = masuk === 0n && keluar === 0n;

        return (
          <button
            key={m.month}
            type="button"
            onClick={() => onPilih(m.month)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              width: "100%",
              minHeight: 60,
              padding: "var(--space-2) var(--card-x)",
              background: "transparent",
              border: 0,
              borderTop: i ? "1px solid var(--border)" : 0,
              color: kosong ? "var(--ink-3)" : "var(--ink)",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span style={{ flex: 1, fontSize: "var(--text-body-size)", fontWeight: 500 }}>
              {labelBulan(m.month).split(" ")[0]}
            </span>
            {kosong ? (
              <span style={{ fontSize: "var(--text-caption-size)" }}>—</span>
            ) : (
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                <Amount value={keluar} size="sm" />
                <span style={{ display: "flex", gap: "var(--space-2)", fontSize: "var(--text-caption-size)" }}>
                  {masuk > 0n ? <Amount value={masuk} direction="credit" size="sm" /> : null}
                  <span style={{ color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
                    {formatRupiah(masuk - keluar)}
                  </span>
                </span>
              </span>
            )}
          </button>
        );
      })}
    </section>
  );
}
