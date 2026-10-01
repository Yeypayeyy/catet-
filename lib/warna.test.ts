import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slotKategori } from "./warna.ts";

describe("slotKategori", () => {
  it("stabil dan selalu di 1–7 untuk kategori sungguhan", () => {
    const id = "3f1c9a2e-6b7d-4e0a-9c11-2d5e8f7a0b44";
    assert.equal(slotKategori(id), slotKategori(id));
    for (let i = 0; i < 200; i++) {
      const s = slotKategori(`kategori-${i}`);
      assert.ok(s >= 1 && s <= 7, `slot ${s}`);
    }
  });

  it("tanpa kategori dan Lainnya jatuh ke slot netral", () => {
    assert.equal(slotKategori(null), 8);
    assert.equal(slotKategori(undefined), 8);
    assert.equal(slotKategori(""), 8);
    assert.equal(slotKategori("lainnya"), 8);
    assert.equal(slotKategori("belum"), 8);
  });
});
