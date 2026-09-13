import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { persen, potongIrisan, rasioNabung } from "./statistik.ts";

const baris = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `k${i}`,
    name: `Kategori ${i}`,
    icon: null,
    total: String((n - i) * 1000),
  }));

const jumlah = (xs: { total: string }[]) => xs.reduce((a, x) => a + BigInt(x.total), 0n);

describe("potongIrisan", () => {
  it("9 kategori jadi 7 + Lainnya, totalnya tetap", () => {
    const rows = baris(9);
    const irisan = potongIrisan(rows);
    assert.equal(irisan.length, 8);
    assert.equal(irisan[7].id, "lainnya");
    assert.equal(irisan[7].total, "3000"); // 2000 + 1000
    assert.equal(jumlah(irisan), jumlah(rows));
  });

  it("tujuh atau kurang tidak punya Lainnya", () => {
    assert.equal(potongIrisan(baris(7)).some((x) => x.id === "lainnya"), false);
    assert.equal(potongIrisan([]).length, 0);
  });

  it("persen dan pecahan ikut dibawa", () => {
    const [a, b] = potongIrisan([
      { id: "a", name: "A", icon: null, total: "3000" },
      { id: "b", name: "B", icon: null, total: "1000" },
    ]);
    assert.equal(a.persen, "75,0");
    assert.equal(b.pecahan, 0.25);
  });
});

describe("persen", () => {
  it("satu desimal, dibulatkan setengah ke atas", () => {
    assert.equal(persen(1n, 3n), "33,3");
    assert.equal(persen(2n, 3n), "66,7");
    assert.equal(persen(5n, 5n), "100,0");
  });

  it("total nol tidak membagi dengan nol", () => {
    assert.equal(persen(0n, 0n), "0,0");
  });
});

describe("rasioNabung", () => {
  it("strip kalau tidak ada pemasukan", () => {
    assert.equal(rasioNabung(0n, 5000n), "—");
  });

  it("positif dan negatif", () => {
    assert.equal(rasioNabung(20000000n, 5535000n), "72,3%");
    assert.equal(rasioNabung(1000n, 1500n), "−50,0%");
  });
});
