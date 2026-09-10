"use client";

// Halaman pemeriksa komponen. Bukan bagian app — ada supaya setiap komponen
// bisa dilihat dalam dua tema tanpa perlu menyiapkan data sungguhan.
//
// Verifikasi langkah 2.2: buka /showcase, tekan tombol tema, pastikan tidak
// ada yang hilang atau tabrakan di light maupun dark.

import { useEffect, useState } from "react";
import { TransactionCard } from "@/components/TransactionCard";
import { Amount, Button, CategoryChip, ChipRow, EmptyState, Input, WarningBanner } from "@/components/ui";

const SARAN = [
  { id: "1", name: "Makan & Minum" },
  { id: "2", name: "Belanja Harian" },
  { id: "3", name: "Transport" },
];

export default function ShowcasePage() {
  const [gelap, setGelap] = useState(true);
  const [dipilih, setDipilih] = useState<string | null>(null);
  const [teks, setTeks] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", gelap);
  }, [gelap]);

  return (
    <main
      style={{
        maxWidth: 420,
        margin: "0 auto",
        padding: "var(--space-5) var(--page-x) var(--space-12)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--section-gap)",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "var(--text-title-size)", fontWeight: 600, margin: 0 }}>Showcase</h1>
        <Button variant="secondary" size="sm" onClick={() => setGelap((g) => !g)}>
          {gelap ? "Ke light" : "Ke dark"}
        </Button>
      </header>

      <Bagian judul="Nominal">
        {/* Yang diuji di sini: Rp2.000 dan Rp5.000.000 harus sejajar dan
            terbaca tanpa ganti ukuran. */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <Amount value="5000000" size="xl" />
          <Amount value="2000" size="xl" />
          <Amount value="1250000" direction="credit" size="lg" />
          <Amount value="63177" size="md" />
          <Amount value="7200" size="sm" muted />
        </div>
      </Bagian>

      <Bagian judul="Tombol">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <Button>Simpan</Button>
          <Button variant="secondary">Lewati</Button>
          <Button variant="ghost">Batal</Button>
          <Button variant="danger">Hapus</Button>
          <Button size="sm">Kecil</Button>
          <Button disabled>Nonaktif</Button>
        </div>
      </Bagian>

      <Bagian judul="Chip kategori">
        <ChipRow>
          {SARAN.map((s) => (
            <CategoryChip
              key={s.id}
              label={s.name}
              suggested
              selected={dipilih === s.id}
              onSelect={() => setDipilih(s.id)}
            />
          ))}
          <CategoryChip label="Lainnya" />
        </ChipRow>
      </Bagian>

      <Bagian judul="Input">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input label="Catatan" placeholder="Indomaret" value={teks} onChange={setTeks} />
          <Input label="Nominal" amount placeholder="0" hint="Tanpa titik, tanpa desimal" />
          <Input label="Token" error="Token diawali wh_" value="salah" onChange={() => {}} />
        </div>
      </Bagian>

      <Bagian judul="Kartu transaksi">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--card-gap)" }}>
          <TransactionCard
            amount="63177"
            account="myBCA"
            time="23.38"
            suggestions={SARAN}
            selected={dipilih}
            onPick={(k) => setDipilih(k.id)}
          />
          <TransactionCard
            amount="35000"
            account="myBCA"
            time="09.12"
            category="Makan & Minum"
            note="Indomaret"
          />
          <TransactionCard
            amount="5000000"
            direction="credit"
            account="myBCA"
            time="Kemarin"
            category="Gaji"
          />
          <TransactionCard amount="14000" account="myBCA" time="08.02" category="Pendidikan" pending />
        </div>
      </Bagian>

      <Bagian judul="Banner">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <WarningBanner
            title="HP belum mengirim data 26 jam"
            description="Cek izin notifikasi di HP."
            action={<Button size="sm" variant="secondary">Cek device</Button>}
            onDismiss={() => {}}
          />
          <WarningBanner
            tone="danger"
            title="3 notifikasi gagal diproses"
            description="Formatnya belum dikenali parser."
          />
        </div>
      </Bagian>

      <Bagian judul="Kondisi kosong">
        <EmptyState
          icon="centang"
          title="Semua sudah rapi."
          description="Tidak ada transaksi yang menunggu kategori."
          compact
        />
      </Bagian>
    </main>
  );
}

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <h2
        style={{
          fontSize: "var(--text-overline-size)",
          lineHeight: "var(--text-overline-line)",
          letterSpacing: "var(--text-overline-tracking)",
          textTransform: "uppercase",
          color: "var(--ink-3)",
          fontWeight: 500,
          margin: 0,
        }}
      >
        {judul}
      </h2>
      {children}
    </section>
  );
}
