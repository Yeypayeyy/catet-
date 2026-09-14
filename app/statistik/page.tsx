"use client";

// Statistik — ke mana uangnya pergi, dan bagaimana dibanding bulan lain.
//
// Urutannya: empat angka periode, donat per kategori, lalu tren setahun.
// Periodenya di URL dengan aturan yang sama persis dengan layar Transaksi.

import { Fragment, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { NavPeriode } from "@/components/Periode";
import { Amount, BottomNav, Button, CategoryChip, EmptyState, ScreenHeader } from "@/components/ui";
import { formatRupiah, labelKategori } from "@/lib/format";
import { bacaPeriode, bulanWib, geserBulan, labelBulan } from "@/lib/periode";
import { potongIrisan, rasioNabung, type BarisKategori, type Irisan } from "@/lib/statistik";

type Statistik = {
  income: string;
  spending: string;
  by_category: { debit: BarisKategori[]; credit: BarisKategori[] };
};
type Bulan = { month: string; income: string; spending: string };

const BULAN_HURUF = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default function Halaman() {
  // useSearchParams butuh Suspense supaya halaman tetap bisa dirender statis.
  return (
    <Suspense>
      <StatistikPage />
    </Suspense>
  );
}

function StatistikPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // Dihitung sekali saat mount: jam dinding tidak boleh ikut menentukan render.
  const [bulanIni] = useState(() => bulanWib());
  const { bulan, tahun, perTahun } = bacaPeriode(sp, bulanIni, "tahunan");

  const [jenis, setJenis] = useState<"debit" | "credit">("debit");
  const [data, setData] = useState<Statistik | null>(null);
  const [tren, setTren] = useState<Bulan[] | null>(null);
  const [belumLogin, setBelumLogin] = useState(false);
  const [bukaLainnya, setBukaLainnya] = useState(false);

  useEffect(() => {
    let aktif = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    void (async () => {
      const r = await fetch(`/api/statistics?${perTahun ? `year=${tahun}` : `month=${bulan}`}`);
      if (!aktif) return;
      if (r.status === 401) {
        setBelumLogin(true);
        return;
      }
      if (r.ok) setData(await r.json());
    })();
    return () => {
      aktif = false;
    };
  }, [perTahun, tahun, bulan]);

  useEffect(() => {
    let aktif = true;
    void (async () => {
      const r = await fetch(`/api/transactions/monthly?year=${tahun}`);
      if (aktif && r.ok) setTren((await r.json()).months);
    })();
    return () => {
      aktif = false;
    };
  }, [tahun]);

  const buka = (q: string) => router.push(`/statistik?${q}`);
  const label = perTahun ? String(tahun) : labelBulan(bulan);

  const masuk = BigInt(data?.income ?? "0");
  const keluar = BigInt(data?.spending ?? "0");
  const baris = data?.by_category[jenis] ?? [];
  const irisan = potongIrisan(baris);
  // Persennya tetap terhadap total seluruh kategori, bukan terhadap Lainnya.
  const isiLainnya = potongIrisan(baris, baris.length).slice(irisan.length - 1);
  const totalJenis = jenis === "debit" ? keluar : masuk;

  // "Belum dikategorikan" bukan kategori sungguhan, jadi tidak punya detail.
  const keDetail = (x: Irisan) =>
    x.id === "belum"
      ? undefined
      : () =>
          router.push(
            `/statistik/kategori?id=${x.id}&jenis=${jenis}&${
              perTahun ? `tampilan=tahunan&tahun=${tahun}` : `bulan=${bulan}`
            }`,
          );

  if (belumLogin) {
    return (
      <main style={{ padding: "var(--space-12) var(--page-x)" }}>
        <EmptyState
          icon="dompet"
          title="Belum login."
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

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 480,
          marginInline: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
          padding: "0 var(--page-x) var(--space-8)",
        }}
      >
        <div style={{ margin: "0 calc(var(--page-x) * -1)" }}>
          <ScreenHeader title="Statistik" />
        </div>

        <NavPeriode
          label={label}
          onMundur={() =>
            buka(perTahun ? `tampilan=tahunan&tahun=${tahun - 1}` : `bulan=${geserBulan(bulan, -1)}`)
          }
          onMaju={() =>
            buka(perTahun ? `tampilan=tahunan&tahun=${tahun + 1}` : `bulan=${geserBulan(bulan, 1)}`)
          }
        />

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <CategoryChip
            label="Bulanan"
            selected={!perTahun}
            onSelect={() => buka(`bulan=${tahun === Number(bulan.slice(0, 4)) ? bulan : `${tahun}-01`}`)}
          />
          <CategoryChip
            label="Tahunan"
            selected={perTahun}
            onSelect={() => buka(`tampilan=tahunan&tahun=${tahun}`)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--card-gap)" }}>
          <KartuAngka judul="Pemasukan" teks={`+${formatRupiah(masuk)}`} warna="var(--income)" />
          <KartuAngka judul="Pengeluaran" teks={formatRupiah(keluar)} warna="var(--danger)" />
          <KartuAngka judul="Arus kas bersih" teks={formatRupiah(masuk - keluar)} warna="var(--ink)" />
          <KartuAngka judul="Rasio nabung" teks={rasioNabung(masuk, keluar)} warna="var(--ink)" />
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <CategoryChip label="Pengeluaran" selected={jenis === "debit"} onSelect={() => setJenis("debit")} />
          <CategoryChip label="Pemasukan" selected={jenis === "credit"} onSelect={() => setJenis("credit")} />
        </div>

        <section style={kartu}>
          {data === null ? (
            <Memuat />
          ) : irisan.length === 0 ? (
            <EmptyState
              compact
              icon="statistik"
              title={`Belum ada ${jenis === "debit" ? "pengeluaran" : "pemasukan"} di ${label}.`}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
              <Donat irisan={irisan} total={totalJenis} jenis={jenis} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                {irisan.map((x, i) =>
                  x.id === "lainnya" ? (
                    <Fragment key={x.id}>
                      {/* Lainnya dibuka di tempat: isinya kategori di luar tujuh teratas. */}
                      <BarisIrisan
                        x={x}
                        warna={warnaIrisan(x, i)}
                        jenis={jenis}
                        terbuka={bukaLainnya}
                        onClick={() => setBukaLainnya((b) => !b)}
                      />
                      {bukaLainnya
                        ? isiLainnya.map((y) => (
                            <BarisIrisan
                              key={y.id}
                              x={y}
                              warna="var(--chart-8)"
                              jenis={jenis}
                              menjorok
                              onClick={keDetail(y)}
                            />
                          ))
                        : null}
                    </Fragment>
                  ) : (
                    <BarisIrisan key={x.id} x={x} warna={warnaIrisan(x, i)} jenis={jenis} onClick={keDetail(x)} />
                  ),
                )}
              </div>
            </div>
          )}
        </section>

        <section style={kartu}>
          <div
            style={{
              fontSize: "var(--text-label-size)",
              fontWeight: 500,
              color: "var(--ink-2)",
              marginBottom: "var(--space-4)",
            }}
          >
            Tren {tahun}
          </div>
          {tren === null ? (
            <Memuat />
          ) : (
            <Tren
              bulan={tren}
              terpilih={perTahun ? null : bulan}
              onPilih={(key) => buka(`bulan=${key}`)}
            />
          )}
        </section>
      </div>

      <BottomNav active="statistik" />
    </div>
  );
}

const kartu = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--card-y) var(--card-x)",
} as const;

function Memuat() {
  return <p style={{ margin: 0, color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>Memuat…</p>;
}

/** Tujuh warna untuk tujuh irisan teratas; "Lainnya" selalu netral. */
function warnaIrisan(x: Irisan, i: number) {
  return x.id === "lainnya" ? "var(--chart-8)" : `var(--chart-${i + 1})`;
}

function KartuAngka({ judul, teks, warna }: { judul: string; teks: string; warna: string }) {
  return (
    <div style={{ ...kartu, padding: "var(--space-4)", minWidth: 0 }}>
      <div style={{ fontSize: "var(--text-caption-size)", color: "var(--ink-3)" }}>{judul}</div>
      <div
        style={{
          marginTop: 4,
          fontSize: "var(--text-body-size)",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: warna,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {teks}
      </div>
    </div>
  );
}

/**
 * Donat dari lingkaran bertumpuk: tiap irisan satu <circle> yang cuma
 * menggambar sepanjang pecahannya (stroke-dasharray), digeser sejauh irisan
 * sebelumnya. Tanpa library, tanpa hitung busur.
 */
function Donat({ irisan, total, jenis }: { irisan: Irisan[]; total: bigint; jenis: "debit" | "credit" }) {
  const r = 80;
  const keliling = 2 * Math.PI * r;
  // Awal tiap irisan = jumlah pecahan irisan sebelumnya.
  const awal = irisan.map((_, i) => irisan.slice(0, i).reduce((a, x) => a + x.pecahan, 0) * keliling);

  return (
    <div style={{ position: "relative", width: 200, height: 200, marginInline: "auto" }}>
      <svg width={200} height={200} viewBox="0 0 200 200" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={100} cy={100} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={28} />
        {irisan.map((x, i) => {
          const panjang = x.pecahan * keliling;
          return (
            <circle
              key={x.id}
              cx={100}
              cy={100}
              r={r}
              fill="none"
              stroke={warnaIrisan(x, i)}
              strokeWidth={28}
              strokeDasharray={`${panjang} ${keliling - panjang}`}
              strokeDashoffset={-awal[i]}
            />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <span style={{ fontSize: "var(--text-caption-size)", color: "var(--ink-3)" }}>Total</span>
        <Amount value={total} direction={jenis} size="md" />
      </div>
    </div>
  );
}

function BarisIrisan({
  x,
  warna,
  jenis,
  onClick,
  terbuka,
  menjorok,
}: {
  x: Irisan;
  warna: string;
  jenis: "debit" | "credit";
  onClick?: () => void;
  /** Hanya untuk baris Lainnya: ada isinya yang bisa dibuka. */
  terbuka?: boolean;
  /** Anak Lainnya. */
  menjorok?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-expanded={terbuka}
      style={{
        paddingLeft: menjorok ? "var(--space-5)" : 0,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        minHeight: 44,
        paddingBlock: 0,
        paddingRight: 0,
        background: "transparent",
        border: 0,
        borderTop: "1px solid var(--border)",
        color: "inherit",
        font: "inherit",
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 3, background: warna, flex: "none" }} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: "var(--text-body-size)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: x.id === "belum" || x.id === "lainnya" ? "var(--ink-2)" : "var(--ink)",
        }}
      >
        {x.id === "lainnya" ? x.name : labelKategori(x)}
      </span>
      {terbuka !== undefined ? (
        <span
          style={{
            display: "inline-flex",
            color: "var(--ink-3)",
            transform: terbuka ? "rotate(90deg)" : undefined,
          }}
        >
          <Icon name="panah-kanan" size={16} />
        </span>
      ) : null}
      <span
        style={{
          fontSize: "var(--text-caption-size)",
          color: "var(--ink-3)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {x.persen}%
      </span>
      <Amount value={x.total} direction={jenis} size="sm" />
    </button>
  );
}

/** Dua belas pasang batang. Tingginya relatif ke nilai terbesar setahun. */
function Tren({
  bulan,
  terpilih,
  onPilih,
}: {
  bulan: Bulan[];
  terpilih: string | null;
  onPilih: (key: string) => void;
}) {
  let maks = 0n;
  for (const m of bulan) {
    for (const v of [BigInt(m.income), BigInt(m.spending)]) if (v > maks) maks = v;
  }
  // Float hanya untuk tinggi batang, bukan nominal.
  const tinggi = (v: string) => (maks === 0n ? 0 : (Number(v) / Number(maks)) * 100);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
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
          <span style={{ height: 100, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2 }}>
            <span style={{ width: "40%", height: `${tinggi(m.income)}%`, background: "var(--income)", borderRadius: 2 }} />
            <span style={{ width: "40%", height: `${tinggi(m.spending)}%`, background: "var(--danger)", borderRadius: 2 }} />
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
