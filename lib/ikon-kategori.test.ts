import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ikonKategori } from "./ikon-kategori.ts";

describe("ikonKategori", () => {
  it("emoji bawaan jadi ikon garis", () => {
    assert.equal(ikonKategori("🍜", "Makan & Minum"), "makan");
    assert.equal(ikonKategori("🚌", "Transport"), "bus");
    assert.equal(ikonKategori("💰", "Gaji"), "dompet");
  });

  it("variation selector tidak mengganggu", () => {
    assert.equal(ikonKategori("☕️", "Kopi"), "kopi");
  });

  it("emoji pilihan user yang tidak dikenal dikembalikan sebagai null", () => {
    assert.equal(ikonKategori("🐱", "Kucing"), null);
  });

  it("tanpa emoji ditebak dari nama, lalu jatuh ke label", () => {
    assert.equal(ikonKategori(null, "Kopi"), "kopi");
    assert.equal(ikonKategori(null, "Ngopi di kafe"), "kopi");
    assert.equal(ikonKategori(null, "Belum dikategorikan"), "label");
  });
});
