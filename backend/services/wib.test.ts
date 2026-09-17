import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { batasBulan, batasTahun } from "./wib.ts";

describe("batas WIB", () => {
  it("tahun mulai 00:00 WIB 1 Januari, akhir eksklusif", () => {
    const { awal, akhir } = batasTahun(2026);
    assert.equal(awal.toISOString(), "2025-12-31T17:00:00.000Z");
    assert.equal(akhir.toISOString(), "2026-12-31T17:00:00.000Z");
  });

  it("batasBulan tidak berubah setelah dipindah", () => {
    const b = batasBulan("2026-09", new Date("2026-09-10T02:00:00Z"));
    assert.equal(b.awal.toISOString(), "2026-08-31T17:00:00.000Z");
    assert.equal(b.akhir.toISOString(), "2026-09-30T17:00:00.000Z");
    assert.equal(b.key, "2026-09");
  });
});

describe("batas WIB dengan awal bulan", () => {
  it("tanpa key, 17 Sep dengan mulai 28 masih periode Agustus", () => {
    const b = batasBulan(undefined, new Date("2026-09-17T05:00:00Z"), 28);
    assert.equal(b.key, "2026-08");
    assert.equal(b.awal.toISOString(), "2026-08-27T17:00:00.000Z");
    assert.equal(b.akhir.toISOString(), "2026-09-27T17:00:00.000Z");
    assert.equal(b.label, "28 Agu – 27 Sep");
    assert.equal(b.hari, 21);
  });

  it("periode lampau dihitung penuh", () => {
    assert.equal(batasBulan("2026-01", new Date("2026-09-17T05:00:00Z"), 28).hari, 31);
    assert.equal(batasBulan("2026-02", new Date("2026-09-17T05:00:00Z")).hari, 28);
  });

  it("tahun dengan mulai 28", () => {
    assert.equal(batasTahun(2026, 28).awal.toISOString(), "2026-01-27T17:00:00.000Z");
  });
});
