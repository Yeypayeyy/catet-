"use client";

// Kategori & Akun — dua daftar yang jarang disentuh, jadi satu layar.
//
// Keduanya pakai satu popup yang sama: isinya cuma beda tiga kolom, dan dua
// popup yang mirip lebih mudah salah dirawat daripada satu yang bercabang.
//
// Induk kategori (parent_id) tidak ada di sini. Kolomnya ada di database,
// tapi selama kategorinya belum puluhan, daftar datar lebih cepat dibaca.

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  Amount,
  Button,
  EmptyState,
  Input,
  Row,
  ScreenHeader,
  Select,
  Sheet,
  WarningBanner,
} from "@/components/ui";

type Kategori = { id: string; name: string };
type Akun = { id: string; name: string; kind: "bank" | "cash" | "ewallet"; init_balance: string };

const JENIS_AKUN = [
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Tunai" },
  { value: "ewallet", label: "E-wallet" },
];

type Sunting = {
  jenis: "kategori" | "akun";
  id: string | null;
  nama: string;
  kind: "bank" | "cash" | "ewallet";
  saldoAwal: string;
};

export default function KategoriPage() {
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

  function buka(jenis: "kategori" | "akun", data?: Kategori | Akun) {
    const akunData = data && "kind" in data ? data : null;
    setSunting({
      jenis,
      id: data?.id ?? null,
      nama: data?.name ?? "",
      kind: akunData?.kind ?? "bank",
      saldoAwal: akunData?.init_balance ?? "0",
    });
    setGalat(null);
  }

  async function simpan() {
    if (!sunting || sibuk) return;
    const nama = sunting.nama.trim();
    if (!nama) {
      setGalat("Namanya belum diisi.");
      return;
    }

    const resource = sunting.jenis === "kategori" ? "categories" : "accounts";
    const body =
      sunting.jenis === "kategori"
        ? { name: nama }
        : {
            name: nama,
            kind: sunting.kind,
            // String, bukan number. Uang tidak pernah lewat float, termasuk di JSON.
            init_balance: sunting.saldoAwal.replace(/[^\d-]/g, "") || "0",
          };

    setSibuk(true);
    const r = await fetch(sunting.id ? `/api/${resource}/${sunting.id}` : `/api/${resource}`, {
      method: sunting.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSibuk(false);

    if (!r.ok) {
      const data = await r.json().catch(() => null);
      setGalat(data?.error?.message ?? "Gagal menyimpan. Coba lagi.");
      return;
    }
    setSunting(null);
    void muat();
  }

  async function hapus() {
    if (!sunting?.id || sibuk) return;
    if (!confirm(`Hapus "${sunting.nama}"?`)) return;

    const resource = sunting.jenis === "kategori" ? "categories" : "accounts";
    setSibuk(true);
    // Soft delete di server: transaksi lama tetap menunjuk ke baris ini.
    const r = await fetch(`/api/${resource}/${sunting.id}`, { method: "DELETE" });
    setSibuk(false);

    if (!r.ok) {
      setGalat("Gagal menghapus. Coba lagi.");
      return;
    }
    setSunting(null);
    void muat();
  }

  return (
    <main style={{ width: "100%", maxWidth: 480, marginInline: "auto" }}>
      <ScreenHeader meta="Pengaturan" title="Kategori & Akun" back="/pengaturan" />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--section-gap)",
          padding: "0 var(--page-x) var(--space-12)",
        }}
      >
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

        <Seksi
          judul="Kategori"
          onTambah={() => buka("kategori")}
          kosong={kategori?.length === 0 ? "Belum ada kategori." : null}
        >
          {(kategori ?? []).map((c) => (
            <Row
              key={c.id}
              title={c.name}
              onClick={() => buka("kategori", c)}
              right={<Icon name="pensil" size={16} color="var(--ink-3)" />}
            />
          ))}
        </Seksi>

        <Seksi
          judul="Akun"
          onTambah={() => buka("akun")}
          kosong={akun?.length === 0 ? "Belum ada akun." : null}
        >
          {(akun ?? []).map((a) => (
            <Row
              key={a.id}
              title={a.name}
              description={JENIS_AKUN.find((j) => j.value === a.kind)?.label}
              onClick={() => buka("akun", a)}
              right={<Amount value={a.init_balance} size="sm" muted />}
            />
          ))}
        </Seksi>
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
                  value={sunting.kind}
                  onChange={(v) => setSunting({ ...sunting, kind: v as Sunting["kind"] })}
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

            {sunting.id ? (
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

function Seksi({
  judul,
  onTambah,
  kosong,
  children,
}: {
  judul: string;
  onTambah: () => void;
  kosong: string | null;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: "var(--space-2)",
        }}
      >
        <h2
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
        </h2>
        <Button size="sm" variant="ghost" icon={<Icon name="tambah" size={18} />} onClick={onTambah}>
          Tambah
        </Button>
      </div>
      {children}
      {kosong ? (
        <p style={{ color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>{kosong}</p>
      ) : null}
    </section>
  );
}
