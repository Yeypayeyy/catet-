import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  batasBulanWib,
  bulanValid,
  bulanWib,
  geserBulan,
  jumlahkan,
  kelompokkanPerHari,
  labelBulan,
} from "./periode.ts";

describe("batasBulanWib", () => {
  it("mulai 00:00 WIB tanggal 1, berakhir 1 ms sebelum bulan berikutnya", () => {
    assert.deepEqual(batasBulanWib("2026-09"), {
      from: "2026-08-31T17:00:00.000Z",
      to: "2026-09-30T16:59:59.999Z",
    });
  });
});

describe("bulan", () => {
  it("bergeser melewati pergantian tahun", () => {
    assert.equal(geserBulan("2026-12", 1), "2027-01");
    assert.equal(geserBulan("2026-01", -1), "2025-12");
  });

  it("bulan berjalan menurut WIB, bukan UTC", () => {
    // 31 Agustus 17:30 UTC sudah 1 September 00:30 di Jakarta.
    assert.equal(bulanWib(new Date("2026-08-31T17:30:00Z")), "2026-09");
  });

  it("menolak kunci yang bukan YYYY-MM", () => {
    assert.equal(bulanValid("2026-09"), true);
    assert.equal(bulanValid("2026-13"), false);
    assert.equal(bulanValid("abc"), false);
  });

  it("label pendek", () => {
    assert.equal(labelBulan("2026-09"), "Sep 2026");
  });
});

describe("kelompokkanPerHari", () => {
  const tx = (occurred_at: string, amount: string, direction: "debit" | "credit") => ({
    occurred_at,
    amount,
    direction,
  });

  it("memakai tanggal WIB, subtotal terpisah, hari terbaru dulu", () => {
    const hari = kelompokkanPerHari([
      tx("2026-09-02T03:00:00Z", "20000", "debit"),
      tx("2026-09-02T01:00:00Z", "5000", "credit"),
      // 00:30 WIB tanggal 1 — di UTC masih 31 Agustus.
      tx("2026-08-31T17:30:00Z", "8000", "debit"),
    ]);

    assert.equal(hari.length, 2);
    assert.equal(hari[0].tanggal, "2026-09-02");
    assert.equal(hari[0].keluar, 20000n);
    assert.equal(hari[0].masuk, 5000n);
    assert.equal(hari[0].items.length, 2);

    assert.equal(hari[1].tanggal, "2026-09-01");
    assert.equal(hari[1].angka, "01");
    assert.equal(hari[1].namaHari, "Sel");
    assert.equal(hari[1].keluar, 8000n);
  });

  it("jumlahkan memisahkan pemasukan dan pengeluaran", () => {
    assert.deepEqual(
      jumlahkan([tx("2026-09-02T03:00:00Z", "20000", "debit"), tx("2026-09-02T01:00:00Z", "5000", "credit")]),
      { masuk: 5000n, keluar: 20000n },
    );
  });
});
