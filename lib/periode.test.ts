import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bacaPeriode,
  waktuAwal,
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

describe("bacaPeriode", () => {
  const sp = (q: string) => new URLSearchParams(q);

  it("membaca bulan dan tampilan per tahun", () => {
    assert.deepEqual(bacaPeriode(sp("bulan=2026-03"), "2026-09", "tahunan"), {
      bulan: "2026-03",
      tahun: 2026,
      perTahun: false,
    });
    assert.deepEqual(bacaPeriode(sp("tampilan=tahunan&tahun=2025"), "2026-09", "tahunan"), {
      bulan: "2026-09",
      tahun: 2025,
      perTahun: true,
    });
  });

  it("nilai rusak jatuh ke bulan berjalan", () => {
    assert.deepEqual(bacaPeriode(sp("bulan=2026-99&tahun=abc"), "2026-09", "tahunan"), {
      bulan: "2026-09",
      tahun: 2026,
      perTahun: false,
    });
  });
});

describe("waktuAwal", () => {
  // Jam yang diharapkan dihitung dari waktu lokal mesin, supaya tes tidak
  // bergantung zona waktu laptop atau CI.
  const sekarang = new Date("2026-09-14T08:05:00Z");
  const jam = `${String(sekarang.getHours()).padStart(2, "0")}:${String(sekarang.getMinutes()).padStart(2, "0")}`;

  it("tanggal yang ditekan dengan jam sekarang", () => {
    assert.equal(waktuAwal("2026-08-30", sekarang), `2026-08-30T${jam}`);
  });

  it("tanggal rusak atau kosong jatuh ke waktu sekarang", () => {
    const kini = waktuAwal(null, sekarang);
    assert.match(kini, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    assert.equal(waktuAwal("2026-02-30", sekarang), kini);
    assert.equal(waktuAwal("besok", sekarang), kini);
  });
});
