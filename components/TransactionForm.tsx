"use client";

// Satu formulir untuk dua layar: input manual (/transaksi/baru) dan ubah
// (/transaksi/[id]). Isinya sama persis, yang beda cuma ke mana dikirim dan
// apakah ada tombol Hapus — tidak cukup beda untuk ditulis dua kali.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import {
  Button,
  CategoryChip,
  CategoryGrid,
  EmptyState,
  Input,
  Select,
  WarningBanner,
} from "@/components/ui";
import { formatRupiah, fromInputLocal, hanyaDigit, toInputLocal } from "@/lib/format";
import { waktuAwal } from "@/lib/periode";

export type TransaksiAwal = {
  id: string;
  account_id: string;
  category_id: string | null;
  amount: string;
  direction: "debit" | "credit";
  occurred_at: string;
  note: string | null;
  merchant: string | null;
};

type Akun = { id: string; name: string };
type Kategori = {
  id: string;
  name: string;
  icon: string | null;
  kind: "expense" | "income";
  hidden: boolean;
};

export function TransactionForm({
  awal,
  tanggal,
}: {
  awal?: TransaksiAwal;
  /** "2026-09-13" dari kepala hari di layar Transaksi; hanya untuk transaksi baru. */
  tanggal?: string | null;
}) {
  const router = useRouter();

  const [akun, setAkun] = useState<Akun[] | null>(null);
  const [kategori, setKategori] = useState<Kategori[]>([]);

  const [akunId, setAkunId] = useState(awal?.account_id ?? "");
  const [kategoriId, setKategoriId] = useState<string | null>(awal?.category_id ?? null);
  const [nominal, setNominal] = useState(awal?.amount ?? "");
  const [arah, setArah] = useState<"debit" | "credit">(awal?.direction ?? "debit");
  const [waktu, setWaktu] = useState(() =>
    awal ? toInputLocal(awal.occurred_at) : waktuAwal(tanggal),
  );
  const [catatan, setCatatan] = useState(awal?.note ?? awal?.merchant ?? "");

  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const jenis = arah === "credit" ? "income" : "expense";

  function gantiArah(baru: "debit" | "credit") {
    setArah(baru);
    // Kategori pengeluaran tidak berlaku untuk pemasukan, dan sebaliknya.
    const k = kategori.find((c) => c.id === kategoriId);
    if (k && k.kind !== (baru === "credit" ? "income" : "expense")) setKategoriId(null);
  }

  useEffect(() => {
    void (async () => {
      const [ra, rk] = await Promise.all([fetch("/api/accounts"), fetch("/api/categories")]);
      const daftarAkun: Akun[] = ra.ok ? ((await ra.json()).items ?? []) : [];
      setAkun(daftarAkun);
      // Transaksi baru: akun pertama dipakai kalau user tidak memilih.
      setAkunId((sekarang) => sekarang || (daftarAkun[0]?.id ?? ""));
      if (rk.ok) setKategori((await rk.json()).items ?? []);
    })();
  }, []);

  async function simpan() {
    if (sibuk) return;
    const digit = hanyaDigit(nominal);
    if (!digit || digit === "0") {
      setGalat("Nominal harus lebih dari nol.");
      return;
    }
    if (!akunId) {
      setGalat("Pilih akun dulu.");
      return;
    }

    setSibuk(true);
    setGalat(null);

    const r = await fetch(awal ? `/api/transactions/${awal.id}` : "/api/transactions", {
      method: awal ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: akunId,
        category_id: kategoriId,
        // String, bukan number. Uang tidak pernah lewat float, termasuk di JSON.
        amount: digit,
        direction: arah,
        occurred_at: fromInputLocal(waktu),
        note: catatan.trim() || null,
      }),
    });

    setSibuk(false);
    if (!r.ok) {
      const data = await r.json().catch(() => null);
      setGalat(data?.error?.message ?? "Gagal menyimpan. Coba lagi.");
      return;
    }
    // Kembali ke bulan transaksinya, bukan bulan berjalan: yang baru ditambah
    // untuk tanggal lampau langsung kelihatan.
    router.push(`/transaksi?bulan=${waktu.slice(0, 7)}`);
  }

  async function hapus() {
    if (!awal || sibuk) return;
    if (!confirm("Hapus transaksi ini?")) return;

    setSibuk(true);
    const r = await fetch(`/api/transactions/${awal.id}`, { method: "DELETE" });
    setSibuk(false);
    if (!r.ok) {
      setGalat("Gagal menghapus. Coba lagi.");
      return;
    }
    router.push(`/transaksi?bulan=${waktu.slice(0, 7)}`);
  }

  if (akun === null) {
    return <p style={{ color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>Memuat…</p>;
  }

  if (akun.length === 0) {
    return (
      <EmptyState
        icon="dompet"
        title="Belum ada akun."
        description="Buat satu akun dulu supaya transaksi punya tempat."
        action={
          <a href="/kategori" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="sm">
              Buka Kategori & Akun
            </Button>
          </a>
        }
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {galat ? <WarningBanner tone="danger" title={galat} /> : null}

      {/* Arah dulu, karena menentukan arti nominal di bawahnya. */}
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <CategoryChip
          label="Pengeluaran"
          selected={arah === "debit"}
          onSelect={() => gantiArah("debit")}
        />
        <CategoryChip
          label="Pemasukan"
          selected={arah === "credit"}
          onSelect={() => gantiArah("credit")}
        />
      </div>

      <Input
        label="Nominal"
        amount
        placeholder="0"
        value={nominal ? formatRupiah(nominal).replace("Rp", "") : ""}
        onChange={(v) => setNominal(hanyaDigit(v))}
      />

      <Select
        label="Akun"
        value={akunId}
        onChange={setAkunId}
        options={akun.map((a) => ({ value: a.id, label: a.name }))}
      />

      <Input label="Waktu" type="datetime-local" value={waktu} onChange={setWaktu} />

      <CategoryGrid
        // Yang tersembunyi tetap tampil kalau sudah terpasang di transaksi ini,
        // supaya pilihannya kelihatan.
        kategori={kategori.filter(
          (c) => c.kind === jenis && (!c.hidden || c.id === kategoriId),
        )}
        terpilih={kategoriId}
        // Ditekan lagi berarti batal memilih, bukan terkunci selamanya.
        onPilih={(id) => setKategoriId((s) => (s === id ? null : id))}
        hrefKelola={`/kategori?jenis=${jenis === "income" ? "pemasukan" : "pengeluaran"}`}
      />

      <Input
        label="Catatan"
        placeholder="Indomaret"
        hint="Muncul sebagai judul transaksi."
        value={catatan}
        onChange={setCatatan}
      />

      <Button full onClick={simpan} disabled={sibuk}>
        {sibuk ? "Menyimpan…" : "Simpan"}
      </Button>

      {awal ? (
        <Button variant="danger" full onClick={hapus} icon={<Icon name="sampah" size={18} />}>
          Hapus transaksi
        </Button>
      ) : null}
    </div>
  );
}
