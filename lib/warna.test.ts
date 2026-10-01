import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catatUrutanKategori, slotKategori } from "./warna.ts";

describe("slotKategori", () => {
  it("stabil dan selalu di 1–12 untuk kategori sungguhan", () => {
    const id = "3f1c9a2e-6b7d-4e0a-9c11-2d5e8f7a0b44";
    assert.equal(slotKategori(id), slotKategori(id));
    for (let i = 0; i < 200; i++) {
      const s = slotKategori(`kategori-${i}`);
      assert.ok(s >= 1 && s <= 12, `slot ${s}`);
    }
  });

  it("setelah urutan dicatat, slot dibagi berurutan tanpa kembar", () => {
    const ids = Array.from({ length: 13 }, (_, i) => `k${i}`);
    catatUrutanKategori(ids.map((id) => ({ id })));
    assert.deepEqual(
      ids.slice(0, 12).map(slotKategori),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    );
    // Kategori ketiga belas berputar ke slot pertama.
    assert.equal(slotKategori("k12"), 1);
  });

  it("dihitung per jenis, yang tersembunyi di belakang", () => {
    catatUrutanKategori([
      { id: "lama", kind: "expense", hidden: true },
      { id: "makan", kind: "expense" },
      { id: "gaji", kind: "income" },
      { id: "kopi", kind: "expense" },
    ]);
    assert.equal(slotKategori("makan"), 1);
    assert.equal(slotKategori("kopi"), 2);
    assert.equal(slotKategori("lama"), 3);
    assert.equal(slotKategori("gaji"), 1);
  });

  it("tanpa kategori dan Lainnya jatuh ke slot netral", () => {
    assert.equal(slotKategori(null), 0);
    assert.equal(slotKategori(undefined), 0);
    assert.equal(slotKategori(""), 0);
    assert.equal(slotKategori("lainnya"), 0);
    assert.equal(slotKategori("belum"), 0);
  });
});
