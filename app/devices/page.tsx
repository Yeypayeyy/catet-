"use client";

// Halaman device sementara: seadanya, tanpa gaya yang dipikirkan.
// Ada sekarang karena token webhook tidak bisa dibuat tanpa session, dan
// Android tidak bisa jalan tanpa token. Akan didandani di Fase 2.3 bersama
// layar pengaturan lainnya.
//
// Akses data lewat HTTP ke /api/devices, tidak pernah mengimpor backend/.

import { useCallback, useEffect, useState } from "react";

type Device = {
  id: string;
  name: string;
  lastSeenAt: string | null;
  createdAt: string;
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [nama, setNama] = useState("");
  const [tokenBaru, setTokenBaru] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    const r = await fetch("/api/devices");
    if (r.status === 401) {
      setPesan("Belum login.");
      setDevices([]);
      return;
    }
    const data = await r.json();
    setDevices(data.devices ?? []);
  }, []);

  useEffect(() => {
    // Memuat daftar saat mount. Cara yang disarankan — ambil datanya di server
    // component lalu diturunkan sebagai props — menunggu Fase 2.3, sekalian
    // waktu halaman ini didandani.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void muat();
  }, [muat]);

  async function buat() {
    if (!nama.trim() || sibuk) return;
    setSibuk(true);
    setPesan(null);
    const r = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nama.trim() }),
    });
    const data = await r.json();
    setSibuk(false);
    if (!r.ok) {
      setPesan(data?.error?.message ?? "Gagal membuat device");
      return;
    }
    // Token cuma ada di respons ini, sekali seumur hidup device.
    setTokenBaru(data.token);
    setNama("");
    void muat();
  }

  async function cabut(id: string, namaDevice: string) {
    if (!confirm(`Cabut token "${namaDevice}"? Device itu langsung ditolak.`)) return;
    await fetch(`/api/devices/${id}`, { method: "DELETE" });
    void muat();
  }

  return (
    <main className="mx-auto max-w-2xl p-6 font-sans">
      <h1 className="text-xl font-semibold">Device</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Token dipakai Android untuk mengirim notifikasi ke server.
      </p>

      {pesan === "Belum login." ? (
        <p className="mt-6">
          <a className="underline" href="/api/auth/signin">
            Login dengan Google
          </a>
        </p>
      ) : null}

      {tokenBaru ? (
        <div className="mt-6 rounded border border-amber-400 bg-amber-50 p-4">
          <p className="text-sm font-medium">
            Salin sekarang — token ini tidak bisa dilihat lagi.
          </p>
          <code className="mt-2 block break-all rounded bg-white p-2 text-sm">{tokenBaru}</code>
          <button
            className="mt-2 rounded border px-3 py-1 text-sm"
            onClick={() => navigator.clipboard?.writeText(tokenBaru)}
          >
            Salin
          </button>
        </div>
      ) : null}

      <div className="mt-6 flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="Nama device, misal: HP Farrel"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buat()}
        />
        <button className="rounded border px-4 py-2" onClick={buat} disabled={sibuk}>
          Buat token
        </button>
      </div>

      {pesan && pesan !== "Belum login." ? (
        <p className="mt-2 text-sm text-red-600">{pesan}</p>
      ) : null}

      <ul className="mt-6 divide-y">
        {devices === null ? <li className="py-3 text-sm">Memuat…</li> : null}
        {devices?.length === 0 ? <li className="py-3 text-sm">Belum ada device.</li> : null}
        {devices?.map((d) => (
          <li key={d.id} className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium">{d.name}</div>
              <div className="text-sm text-zinc-600">
                {d.lastSeenAt
                  ? `terakhir terdengar ${new Date(d.lastSeenAt).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}`
                  : "belum pernah terdengar"}
              </div>
            </div>
            <button
              className="rounded border px-3 py-1 text-sm text-red-600"
              onClick={() => cabut(d.id, d.name)}
            >
              Cabut
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
