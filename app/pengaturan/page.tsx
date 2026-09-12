"use client";

// Pengaturan — device, tampilan, dan yang gagal diproses.
//
// Dibuka dari Ringkasan, bukan dari nav bawah: yang di nav dipakai tiap hari,
// yang di sini dipakai saat ada yang aneh.

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  Button,
  CategoryChip,
  Input,
  Row,
  ScreenHeader,
  WarningBanner,
} from "@/components/ui";
import { formatWaktu } from "@/lib/format";

// Android menyapa /api/health tiap enam jam. Lewat sehari tanpa kabar berarti
// ada yang perlu dicek — biasanya izin notifikasi yang dicabut Android.
const BATAS_SEPI = 24 * 60 * 60 * 1000;

type Device = { id: string; name: string; lastSeenAt: string | null; createdAt: string };
type DeadLetter = {
  id: string;
  reason: string;
  attempt_count: number;
  created_at: string;
  title: string | null;
  body: string;
};

export default function PengaturanPage() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [dlq, setDlq] = useState<DeadLetter[]>([]);
  const [server, setServer] = useState<"ok" | "mati" | null>(null);
  // Dihitung saat memuat, bukan saat render: jam dinding tidak boleh ikut
  // menentukan hasil render.
  const [sepi, setSepi] = useState<Device[]>([]);
  const [gelap, setGelap] = useState(true);

  const [nama, setNama] = useState("");
  const [tokenBaru, setTokenBaru] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [belumLogin, setBelumLogin] = useState(false);

  const muat = useCallback(async () => {
    const rd = await fetch("/api/devices");
    if (rd.status === 401) {
      setBelumLogin(true);
      setDevices([]);
      return;
    }
    const daftar: Device[] = (await rd.json()).devices ?? [];
    setDevices(daftar);
    setSepi(
      daftar.filter(
        (d) => !d.lastSeenAt || Date.now() - new Date(d.lastSeenAt).getTime() > BATAS_SEPI,
      ),
    );

    const rq = await fetch("/api/dead-letters");
    if (rq.ok) setDlq((await rq.json()).items ?? []);

    const rh = await fetch("/api/health");
    setServer(rh.ok ? "ok" : "mati");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void muat();
    setGelap(document.documentElement.classList.contains("dark"));
  }, [muat]);

  function pilihTema(mode: "gelap" | "terang") {
    setGelap(mode === "gelap");
    document.documentElement.classList.toggle("dark", mode === "gelap");
    try {
      localStorage.setItem("tema", mode);
    } catch {
      // Mode penyamaran atau storage dimatikan: temanya cuma tidak diingat.
    }
  }

  async function buatDevice() {
    if (!nama.trim() || sibuk) return;
    setSibuk(true);
    setGalat(null);

    const r = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nama.trim() }),
    });
    const data = await r.json();
    setSibuk(false);

    if (!r.ok) {
      setGalat(data?.error?.message ?? "Gagal membuat device.");
      return;
    }
    // Token cuma ada di respons ini, sekali seumur hidup device.
    setTokenBaru(data.token);
    setNama("");
    void muat();
  }

  async function cabut(d: Device) {
    if (!confirm(`Cabut token "${d.name}"? Device itu langsung ditolak.`)) return;
    await fetch(`/api/devices/${d.id}`, { method: "DELETE" });
    void muat();
  }

  async function cobaLagi(id: string) {
    if (sibuk) return;
    setSibuk(true);
    const r = await fetch(`/api/dead-letters/${id}/reparse`, { method: "POST" });
    setSibuk(false);
    if (!r.ok) {
      setGalat("Gagal memproses ulang.");
      return;
    }
    const hasil = await r.json();
    if (hasil.parse_status === "failed") setGalat(`Masih gagal: ${hasil.reason}`);
    void muat();
  }

  return (
    <main style={{ width: "100%", maxWidth: 480, marginInline: "auto" }}>
      <ScreenHeader meta="Catet!" title="Pengaturan" back="/" />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--section-gap)",
          padding: "0 var(--page-x) var(--space-12)",
        }}
      >
        {galat ? <WarningBanner tone="danger" title={galat} onDismiss={() => setGalat(null)} /> : null}

        {belumLogin ? (
          <a href="/api/auth/signin" style={{ textDecoration: "none" }}>
            <Button variant="secondary" full>
              Login dengan Google
            </Button>
          </a>
        ) : null}

        {sepi.length ? (
          <WarningBanner
            title={
              sepi.length === 1
                ? `${sepi[0].name} sudah lebih dari sehari tidak terdengar`
                : `${sepi.length} device sudah lebih dari sehari tidak terdengar`
            }
            description="Cek izin notifikasi dan penghemat baterai di HP."
          />
        ) : null}

        <Seksi judul="Data">
          <a href="/kategori" style={{ textDecoration: "none", color: "inherit" }}>
            <Row
              title="Kategori & Akun"
              description="Daftar kategori dan akun"
              right={<Icon name="panah-kanan" size={18} color="var(--ink-3)" />}
            />
          </a>
          <Row
            title="Server"
            description={
              server === null ? "Mengecek…" : server === "ok" ? "Database terhubung" : "Tidak bisa dihubungi"
            }
            right={
              <Icon
                name={server === "mati" ? "peringatan" : "centang"}
                size={18}
                color={server === "mati" ? "var(--danger)" : "var(--income)"}
              />
            }
          />
        </Seksi>

        <Seksi judul="Tampilan">
          <div style={{ display: "flex", gap: "var(--space-2)", paddingTop: "var(--space-2)" }}>
            <CategoryChip label="Gelap" selected={gelap} onSelect={() => pilihTema("gelap")} />
            <CategoryChip label="Terang" selected={!gelap} onSelect={() => pilihTema("terang")} />
          </div>
        </Seksi>

        <Seksi judul="Device">
          {devices === null ? (
            <p style={{ color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>Memuat…</p>
          ) : null}

          {(devices ?? []).map((d) => (
            <Row
              key={d.id}
              title={d.name}
              description={
                d.lastSeenAt ? `Terakhir terdengar ${formatWaktu(d.lastSeenAt)}` : "Belum pernah terdengar"
              }
              right={
                <Button size="sm" variant="danger" onClick={() => cabut(d)}>
                  Cabut
                </Button>
              }
            />
          ))}

          {devices?.length === 0 ? (
            <p style={{ color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>
              Belum ada device.
            </p>
          ) : null}

          {tokenBaru ? (
            <div
              style={{
                marginTop: "var(--space-4)",
                padding: "var(--space-4)",
                borderRadius: "var(--radius-lg)",
                background: "var(--warning-bg)",
                border: "1px solid var(--warning-border)",
                color: "var(--warning-fg)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
              }}
            >
              <span style={{ fontSize: "var(--text-label-size)", fontWeight: 600 }}>
                Salin sekarang. Token ini tidak bisa dilihat lagi.
              </span>
              <code
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-caption-size)",
                  wordBreak: "break-all",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  borderRadius: "var(--radius-sm)",
                  padding: "var(--space-2)",
                }}
              >
                {tokenBaru}
              </code>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void navigator.clipboard?.writeText(tokenBaru)}
                >
                  Salin
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTokenBaru(null)}>
                  Selesai
                </Button>
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
              alignItems: "flex-end",
              marginTop: "var(--space-4)",
            }}
          >
            <div style={{ flex: 1 }}>
              <Input
                label="Device baru"
                placeholder="HP Farrel"
                value={nama}
                onChange={setNama}
              />
            </div>
            <Button onClick={buatDevice} disabled={sibuk || !nama.trim()}>
              Buat token
            </Button>
          </div>
        </Seksi>

        <Seksi judul="Gagal diproses">
          {dlq.length === 0 ? (
            <p style={{ color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>
              Tidak ada notifikasi yang gagal dibaca.
            </p>
          ) : null}

          {dlq.map((d) => (
            <Row
              key={d.id}
              title={d.title ?? d.body.slice(0, 60)}
              description={`${d.reason} · ${formatWaktu(d.created_at)} · percobaan ${d.attempt_count}`}
              right={
                <Button size="sm" variant="secondary" onClick={() => cobaLagi(d.id)} disabled={sibuk}>
                  Coba lagi
                </Button>
              }
            />
          ))}
        </Seksi>

        {/* signout menerima POST, jadi form — bukan tautan. */}
        {!belumLogin ? (
          <form action="/api/auth/signout" method="post">
            <Button variant="ghost" full type="submit">
              Keluar
            </Button>
          </form>
        ) : null}
      </div>
    </main>
  );
}

function Seksi({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column" }}>
      <h2
        style={{
          margin: "0 0 var(--space-2)",
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
      {children}
    </section>
  );
}
