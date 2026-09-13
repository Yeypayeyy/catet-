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
