"use client";

// Kategori & Akun — tiga tab: Pengeluaran, Pemasukan, Akun.
//
// Kategori diurutkan dengan menyeret ☰. Bawaan disembunyikan (bisa dipakai
// lagi dari bagian "Disembunyikan"), buatan sendiri dihapus. Satu popup
// dipakai untuk kategori dan akun — isinya cuma beda beberapa kolom.
//
// Induk kategori (parent_id) tidak ada di sini. Kolomnya ada di database,
// tapi selama kategorinya belum puluhan, daftar datar lebih cepat dibaca.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import {
  Amount,
  Button,
  CategoryChip,
  EmptyState,
  Input,
  Row,
  ScreenHeader,
  Select,
  Sheet,
  WarningBanner,
} from "@/components/ui";
import { labelKategori } from "@/lib/format";
import { pindahkan } from "@/lib/urutan";

type Jenis = "expense" | "income";
type Kategori = {
  id: string;
  name: string;
  icon: string | null;
  kind: Jenis;
  is_default: boolean;
  hidden: boolean;
};
type Akun = { id: string; name: string; kind: "bank" | "cash" | "ewallet"; init_balance: string };

const JENIS_AKUN = [
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Tunai" },
  { value: "ewallet", label: "E-wallet" },
];

const TAB = { pengeluaran: "expense", pemasukan: "income", akun: null } as const;
type Tab = keyof typeof TAB;

type Sunting =
  | { jenis: "kategori"; id: string | null; kind: Jenis; bawaan: boolean; nama: string; ikon: string }
  | { jenis: "akun"; id: string | null; nama: string; kindAkun: Akun["kind"]; saldoAwal: string };

export default function Halaman() {
  // useSearchParams butuh Suspense supaya halaman tetap bisa dirender statis.
  return (
    <Suspense>
      <KategoriPage />
    </Suspense>
  );
}

function KategoriPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const tab: Tab = (sp.get("jenis") as Tab) in TAB ? (sp.get("jenis") as Tab) : "pengeluaran";
  const kind = TAB[tab];

  const [kategori, setKategori] = useState<Kategori[] | null>(null);
  const [akun, setAkun] = useState<Akun[] | null>(null);
  const [sunting, setSunting] = useState<Sunting | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [belumLogin, setBelumLogin] = useState(false);

  const muat = useCallback(async () => {
    const [rk, ra] = await Promise.all([fetch("/api/categories"), fetch("/api/accounts")]);
    if (rk.status === 401) {
      setBelumLogin(true);
      setKategori([]);
      setAkun([]);
      return;
    }
    setKategori(rk.ok ? ((await rk.json()).items ?? []) : []);
    setAkun(ra.ok ? ((await ra.json()).items ?? []) : []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void muat();
  }, [muat]);

  // API sudah mengurutkan per sort_order; di sini tinggal dipilah.
  const aktif = (kategori ?? []).filter((c) => c.kind === kind && !c.hidden);
  const tersembunyi = (kategori ?? []).filter((c) => c.kind === kind && c.hidden);

  async function kirim(url: string, method: string, body?: unknown) {
    setSibuk(true);
    const r = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setSibuk(false);
    if (!r.ok) {
      const data = await r.json().catch(() => null);
      setGalat(data?.error?.message ?? "Gagal menyimpan. Coba lagi.");
    }
    return r.ok;
  }

  async function simpanUrutan(ids: string[]) {
    if (!kind || !kategori) return;
    const sebelum = kategori;
    // Langsung ditampilkan; kalau server menolak, dikembalikan.
    const posisi = new Map(ids.map((id, i) => [id, i]));
    setKategori(
      [...kategori].sort(
        // Yang tidak diseret (jenis lain) sama-sama 1e9: urutannya tidak berubah.
        (a, b) => (posisi.get(a.id) ?? 1e9) - (posisi.get(b.id) ?? 1e9),
      ),
    );
    setGalat(null);
    if (!(await kirim("/api/categories/order", "PUT", { kind, ids }))) {
      setKategori(sebelum);
      setGalat("Urutan gagal disimpan. Coba lagi.");
    }
  }

  async function simpan() {
    if (!sunting || sibuk) return;
    const nama = sunting.nama.trim();
    if (!nama) {
      setGalat("Namanya belum diisi.");
      return;
    }
    setGalat(null);

    const ok =
      sunting.jenis === "kategori"
        ? await kirim(
            sunting.id ? `/api/categories/${sunting.id}` : "/api/categories",
            sunting.id ? "PATCH" : "POST",
            {
              name: nama,
              icon: sunting.ikon.trim(),
              // kind cuma dikirim saat membuat: setelah itu tidak bisa diubah.
              ...(sunting.id ? null : { kind: sunting.kind }),
            },
          )
        : await kirim(sunting.id ? `/api/accounts/${sunting.id}` : "/api/accounts", sunting.id ? "PATCH" : "POST", {
            name: nama,
            kind: sunting.kindAkun,
            // String, bukan number. Uang tidak pernah lewat float, termasuk di JSON.
            init_balance: sunting.saldoAwal.replace(/[^\d-]/g, "") || "0",
          });

    if (ok) {
      setSunting(null);
      void muat();
    }
  }

  async function sembunyikan(id: string, hidden: boolean) {
    if (sibuk) return;
    setGalat(null);
    if (await kirim(`/api/categories/${id}`, "PATCH", { hidden })) {
      setSunting(null);
      void muat();
    }
  }

  async function hapus() {
    if (!sunting?.id || sibuk) return;
    if (!confirm(`Hapus "${sunting.nama}"?`)) return;
    setGalat(null);
    // Soft delete di server: transaksi lama tetap menunjuk ke baris ini.
    const url = sunting.jenis === "kategori" ? `/api/categories/${sunting.id}` : `/api/accounts/${sunting.id}`;
    if (await kirim(url, "DELETE")) {
      setSunting(null);
      void muat();
    }
  }

  function bukaKategori(c?: Kategori) {
    if (!kind) return;
    setGalat(null);
    setSunting({
      jenis: "kategori",
      id: c?.id ?? null,
      kind: c?.kind ?? kind,
      bawaan: c?.is_default ?? false,
      nama: c?.name ?? "",
      ikon: c?.icon ?? "",
    });
  }

  function bukaAkun(a?: Akun) {
    setGalat(null);
    setSunting({
      jenis: "akun",
      id: a?.id ?? null,
      nama: a?.name ?? "",
      kindAkun: a?.kind ?? "bank",
      saldoAwal: a?.init_balance ?? "0",
    });
  }

  return (
    <main style={{ width: "100%", maxWidth: 480, marginInline: "auto" }}>
      <ScreenHeader meta="Pengaturan" title="Kategori & Akun" back="/pengaturan" />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
          padding: "0 var(--page-x) var(--space-12)",
        }}
      >
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          {(["pengeluaran", "pemasukan", "akun"] as const).map((t) => (
            <CategoryChip
              key={t}
              label={t === "akun" ? "Akun" : t === "pengeluaran" ? "Pengeluaran" : "Pemasukan"}
              selected={tab === t}
              onSelect={() => router.replace(`/kategori?jenis=${t}`)}
            />
          ))}
        </div>

        {galat && !sunting ? (
          <WarningBanner tone="danger" title={galat} onDismiss={() => setGalat(null)} />
        ) : null}

        {belumLogin ? (
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
        ) : null}

        {kind ? (
          <>
            <Seksi
              judul={tab === "pengeluaran" ? "Kategori pengeluaran" : "Kategori pemasukan"}
              onTambah={() => bukaKategori()}
            >
              {kategori === null ? (
                <Memuat />
              ) : aktif.length === 0 ? (
                <Kosong teks="Belum ada kategori." />
              ) : (
                <DaftarSeret
                  items={aktif}
                  onSelesai={(ids) => void simpanUrutan(ids)}
                  onUbah={bukaKategori}
                />
              )}
            </Seksi>

            {tersembunyi.length ? (
              <section style={{ display: "flex", flexDirection: "column" }}>
                <JudulSeksi>Disembunyikan</JudulSeksi>
                {tersembunyi.map((c) => (
                  <Row
                    key={c.id}
                    title={<span style={{ color: "var(--ink-3)" }}>{labelKategori(c)}</span>}
                    description="Tekan untuk memakai lagi"
                    onClick={() => void sembunyikan(c.id, false)}
                    right={<Icon name="tambah" size={18} color="var(--ink-3)" />}
                  />
                ))}
              </section>
            ) : null}
          </>
        ) : (
          <Seksi judul="Akun" onTambah={() => bukaAkun()}>
            {akun === null ? (
              <Memuat />
            ) : akun.length === 0 ? (
              <Kosong teks="Belum ada akun." />
            ) : (
              akun.map((a) => (
                <Row
                  key={a.id}
                  title={a.name}
                  description={JENIS_AKUN.find((j) => j.value === a.kind)?.label}
                  onClick={() => bukaAkun(a)}
                  right={<Amount value={a.init_balance} size="sm" muted />}
                />
              ))
            )}
          </Seksi>
        )}
      </div>

      <Sheet
        open={sunting !== null}
        title={
          sunting
            ? `${sunting.id ? "Ubah" : "Tambah"} ${sunting.jenis === "kategori" ? "kategori" : "akun"}`
            : ""
        }
        onClose={() => setSunting(null)}
      >
        {sunting ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            {galat ? <WarningBanner tone="danger" title={galat} /> : null}

            {sunting.jenis === "kategori" ? (
              <Input
                label="Ikon"
                placeholder="🍜"
                hint="Satu emoji dari keyboard. Boleh dikosongkan."
                value={sunting.ikon}
                onChange={(v) => setSunting({ ...sunting, ikon: v })}
              />
            ) : null}

            <Input
              label="Nama"
              placeholder={sunting.jenis === "kategori" ? "Makan" : "BCA"}
              value={sunting.nama}
              onChange={(v) => setSunting({ ...sunting, nama: v })}
            />

            {sunting.jenis === "akun" ? (
              <>
                <Select
                  label="Jenis"
                  value={sunting.kindAkun}
                  onChange={(v) => setSunting({ ...sunting, kindAkun: v as Akun["kind"] })}
                  options={JENIS_AKUN}
                />
                <Input
                  label="Saldo awal"
                  amount
                  hint="Saldo sebelum transaksi pertama tercatat."
                  value={sunting.saldoAwal}
                  onChange={(v) => setSunting({ ...sunting, saldoAwal: v.replace(/[^\d-]/g, "") })}
                />
              </>
            ) : null}

            <Button full onClick={simpan} disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Simpan"}
            </Button>

            {sunting.id && sunting.jenis === "kategori" && sunting.bawaan ? (
              <Button variant="secondary" full onClick={() => void sembunyikan(sunting.id!, true)} disabled={sibuk}>
                Sembunyikan
              </Button>
            ) : sunting.id ? (
              <Button variant="danger" full onClick={hapus} disabled={sibuk}>
                Hapus
              </Button>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </main>
  );
}

/* ---------- Daftar yang bisa diseret ---------- */

type Seret = { dari: number; mulaiY: number; dy: number; tinggi: number };

/**
 * Seret pakai pointer events, tanpa library. Hanya ☰ yang memulai seret dan
 * mengunci guliran (`touch-action: none`); bagian lain baris tetap bisa
 * digulir dan ditekan. Baris lain bergeser setinggi satu baris begitu yang
 * diseret melewati setengahnya. Urutan dikirim sekali, saat jari dilepas.
 */
function DaftarSeret({
  items,
  onSelesai,
  onUbah,
}: {
  items: Kategori[];
  onSelesai: (ids: string[]) => void;
  onUbah: (c: Kategori) => void;
}) {
  const [seret, setSeret] = useState<Seret | null>(null);

  const ke = seret
    ? Math.max(0, Math.min(items.length - 1, seret.dari + Math.round(seret.dy / seret.tinggi)))
    : -1;

  function geserBaris(i: number): number {
    if (!seret) return 0;
    if (i === seret.dari) return seret.dy;
    if (seret.dari < ke && i > seret.dari && i <= ke) return -seret.tinggi;
    if (seret.dari > ke && i < seret.dari && i >= ke) return seret.tinggi;
    return 0;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((c, i) => {
        const diseret = seret?.dari === i;
        return (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              minHeight: 52,
              borderBottom: "1px solid var(--border)",
              background: "var(--bg)",
              position: "relative",
              zIndex: diseret ? 2 : 1,
              transform: `translateY(${geserBaris(i)}px)`,
              transition: diseret ? "none" : "transform var(--duration-base) var(--ease-out)",
              boxShadow: diseret ? "0 0 0 1px var(--border-strong)" : "none",
            }}
          >
            <span
              aria-label={`Geser ${c.name}`}
              role="button"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const baris = e.currentTarget.parentElement!.getBoundingClientRect();
                setSeret({ dari: i, mulaiY: e.clientY, dy: 0, tinggi: baris.height });
              }}
              onPointerMove={(e) => {
                if (seret) setSeret({ ...seret, dy: e.clientY - seret.mulaiY });
              }}
              onPointerUp={() => {
                if (!seret) return;
                const tujuan = ke;
                const dari = seret.dari;
                setSeret(null);
                if (tujuan !== dari) onSelesai(pindahkan(items, dari, tujuan).map((x) => x.id));
              }}
              onPointerCancel={() => setSeret(null)}
              style={{
                width: 44,
                height: 52,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink-3)",
                touchAction: "none",
                cursor: diseret ? "grabbing" : "grab",
                flex: "none",
              }}
            >
              <Icon name="pegangan" size={20} />
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "var(--text-body-size)",
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {labelKategori(c)}
            </span>
            <button
              type="button"
              aria-label={`Ubah ${c.name}`}
              onClick={() => onUbah(c)}
              style={{
                width: 44,
                height: 44,
                background: "transparent",
                border: 0,
                color: "var(--ink-3)",
                cursor: "pointer",
              }}
            >
              <Icon name="pensil" size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Potongan kecil ---------- */

function Memuat() {
  return <p style={{ color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>Memuat…</p>;
}

function Kosong({ teks }: { teks: string }) {
  return <p style={{ color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>{teks}</p>;
}

function JudulSeksi({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: 0,
        paddingBottom: "var(--space-2)",
        fontSize: "var(--text-overline-size)",
        lineHeight: "var(--text-overline-line)",
        letterSpacing: "var(--text-overline-tracking)",
        textTransform: "uppercase",
        color: "var(--ink-3)",
        fontWeight: 500,
      }}
    >
      {children}
    </h2>
  );
}

function Seksi({
  judul,
  onTambah,
  children,
}: {
  judul: string;
  onTambah: () => void;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <JudulSeksi>{judul}</JudulSeksi>
        <Button size="sm" variant="ghost" icon={<Icon name="tambah" size={18} />} onClick={onTambah}>
          Tambah
        </Button>
      </div>
      {children}
    </section>
  );
}
