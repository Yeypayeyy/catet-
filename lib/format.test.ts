import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRupiah, fromInputLocal, hanyaDigit, toInputLocal } from "./format.ts";

describe("formatRupiah", () => {
  it("mengelompokkan ribuan tanpa desimal", () => {
    assert.equal(formatRupiah("10000"), "Rp10.000");
    assert.equal(formatRupiah(0), "Rp0");
    assert.equal(formatRupiah(-1500000n), "−Rp1.500.000");
  });
});

describe("input tanggal", () => {
  it("bolak-balik tanpa menggeser waktu", () => {
    // Detik dibuang oleh input datetime-local, jadi sampelnya bulat ke menit.
    const iso = "2026-09-12T03:45:00.000Z";
    assert.equal(fromInputLocal(toInputLocal(iso)), iso);
  });
});

describe("hanyaDigit", () => {
  it("membuang pemisah dan nol di depan", () => {
    assert.equal(hanyaDigit("Rp10.000"), "10000");
    assert.equal(hanyaDigit("0100"), "100");
    assert.equal(hanyaDigit("abc"), "");
    assert.equal(hanyaDigit("0"), "0");
  });
});
