"use client";

// Chip catatan yang pernah dipakai, di bawah kolom Catatan. Tekan satu untuk
// mengisinya — "Sop Pak Samson" cukup diketik sekali seumur hidup.

import { useEffect, useState } from "react";
import { CategoryChip } from "@/components/ui";

export function NoteSuggestions({
  categoryId,
  teks,
  onPilih,
}: {
  categoryId: string | null;
  teks: string;
  onPilih: (catatan: string) => void;
}) {
  const [saran, setSaran] = useState<string[]>([]);

  useEffect(() => {
    let aktif = true;
    // Jeda supaya server tidak dipanggil tiap huruf.
    const jeda = setTimeout(async () => {
      const q = new URLSearchParams();
      if (categoryId) q.set("category_id", categoryId);
      if (teks.trim()) q.set("q", teks.trim());
      try {
        const r = await fetch(`/api/notes?${q}`);
        // Permintaan lama yang selesai belakangan diabaikan.
        if (aktif) setSaran(r.ok ? (await r.json()).items : []);
      } catch {
        if (aktif) setSaran([]);
      }
    }, 250);
    return () => {
      aktif = false;
      clearTimeout(jeda);
    };
  }, [categoryId, teks]);

  const tampil = saran.filter((s) => s !== teks.trim());
  if (tampil.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "calc(var(--space-2) * -1)" }}>
      {tampil.map((s) => (
        <CategoryChip key={s} label={s} onSelect={() => onPilih(s)} />
      ))}
    </div>
  );
}
