"use client";

// Daftar transaksi — semuanya, terbaru dulu, disaring per kategori.
//
// Filternya sengaja satu sumbu. Dua baris chip (kategori + akun + arah) muat
// di layar, tapi tidak pernah dipakai bersamaan: yang dicari orang biasanya
// "yang mana yang masuk kategori ini", sisanya cukup digulir.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { TransactionCard } from "@/components/TransactionCard";
import {
  Button,
  BottomNav,
  CategoryChip,
  ChipRow,
  EmptyState,
  ScreenHeader,
} from "@/components/ui";
import { formatWaktu } from "@/lib/format";

const PER_HALAMAN = 30;

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

type Kategori = { id: string; name: string };

export default function TransaksiPage() {
  const router = useRouter();
  const [items, setItems] = useState<Transaksi[] | null>(null);
  const [total, setTotal] = useState(0);
  const [lanjut, setLanjut] = useState<number | null>(null);
  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [saring, setSaring] = useState<string | null>(null);
  const [belumLogin, setBelumLogin] = useState(false);

  const muat = useCallback(
    async (kategoriId: string | null, offset: number) => {
      const q = new URLSearchParams({ limit: String(PER_HALAMAN), offset: String(offset) });
      if (kategoriId) q.set("category_id", kategoriId);

      const r = await fetch(`/api/transactions?${q}`);
      if (r.status === 401) {
        setBelumLogin(true);
        setItems([]);
        return;
      }
      const data = await r.json();
      // Halaman pertama mengganti, halaman berikutnya menyambung.
      setItems((lama) => (offset === 0 ? data.items : [...(lama ?? []), ...data.items]));
      setTotal(data.total ?? 0);
      setLanjut(data.next_offset);
    },
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void muat(saring, 0);
  }, [muat, saring]);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/categories");
      if (r.ok) setKategori((await r.json()).items ?? []);
    })();
  }, []);

  const namaKategori = Object.fromEntries(kategori.map((c) => [c.id, c.name]));

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, width: "100%", maxWidth: 480, marginInline: "auto" }}>
        <ScreenHeader
          meta={total ? `${total} tercatat` : undefined}
          title="Transaksi"
          right={
            <Link href="/transaksi/baru" style={{ textDecoration: "none" }}>
              <Button size="sm" variant="secondary" icon={<Icon name="tambah" size={18} />}>
                Tambah
              </Button>
            </Link>
          }
        />

        {kategori.length ? (
          <ChipRow style={{ padding: "0 var(--page-x) var(--space-4)" }}>
            <CategoryChip label="Semua" selected={saring === null} onSelect={() => setSaring(null)} />
            {kategori.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.name}
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
            padding: "0 var(--page-x) var(--space-12)",
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
          ) : null}

          {items === null ? (
            <p style={{ color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>Memuat…</p>
          ) : null}

          {(items ?? []).map((t) => (
            <TransactionCard
              key={t.id}
              amount={t.amount}
              direction={t.direction}
              title={t.note ?? t.merchant}
              meta={[formatWaktu(t.occurred_at), t.bank_category].filter(Boolean).join(" · ")}
              category={
                t.category_id ? (namaKategori[t.category_id] ?? "—") : "Belum dikategorikan"
              }
              onClick={() => router.push(`/transaksi/${t.id}`)}
            />
          ))}

          {items !== null && !belumLogin && items.length === 0 ? (
            <EmptyState
              icon="daftar"
              title={saring ? "Belum ada di kategori ini." : "Belum ada transaksi."}
              description={saring ? undefined : "Transaksi masuk sendiri dari notifikasi bank."}
            />
          ) : null}

          {lanjut !== null ? (
            <Button variant="secondary" full onClick={() => void muat(saring, lanjut)}>
              Muat lagi
            </Button>
          ) : null}
        </div>
      </div>

      <BottomNav active="transaksi" />
    </div>
  );
}
