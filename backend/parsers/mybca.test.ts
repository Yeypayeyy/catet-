import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMybca } from "./mybca.ts";

// Sampel notifikasi asli dari HP. Tambahkan satu baris per string yang benar-benar
// pernah muncul, lengkap dengan hasil yang diharapkan. Ini yang bikin parser tahan
// perubahan format BCA.
const REAL_SAMPLES: { body: string; amount: bigint; direction: "debit" | "credit" }[] = [
  // { body: "...", amount: 0n, direction: "debit" },
];

describe("parseMybca — format normal", () => {
  it("membaca pengeluaran dengan kategori", () => {
    const r = parseMybca("Pengeluaran sebesar IDR 10,000.00 di kategori Belanja.");
    assert.deepEqual(r, { amount: 10000n, direction: "debit", bankCategory: "Belanja" });
  });

  it("membaca nominal jutaan tanpa kehilangan digit", () => {
    const r = parseMybca("Pengeluaran sebesar IDR 1,250,000.00 di kategori Belanja.");
    assert.equal(r?.amount, 1250000n);
  });

  it("membaca pemasukan sebagai credit", () => {
    const r = parseMybca("Pemasukan sebesar IDR 5,000,000.00 di kategori Gaji.");
    assert.deepEqual(r, { amount: 5000000n, direction: "credit", bankCategory: "Gaji" });
  });

  it("menerima notifikasi tanpa bagian kategori", () => {
    const r = parseMybca("Pengeluaran sebesar IDR 25,000.00.");
    assert.deepEqual(r, { amount: 25000n, direction: "debit", bankCategory: null });
  });

  it("menerima nominal tanpa pemisah ribuan", () => {
    assert.equal(parseMybca("Pengeluaran sebesar IDR 5000.00.")?.amount, 5000n);
  });

  it("menerima nominal tanpa bagian desimal", () => {
    assert.equal(parseMybca("Pengeluaran sebesar IDR 10,000 di kategori Jajan.")?.amount, 10000n);
  });

  it("menerima kategori yang mengandung spasi", () => {
    const r = parseMybca("Pengeluaran sebesar IDR 30,000.00 di kategori Makan & Minum.");
    assert.equal(r?.bankCategory, "Makan & Minum");
  });

  it("tahan spasi berlebih dan beda kapitalisasi", () => {
    const r = parseMybca("  PENGELUARAN sebesar IDR 15,000.00 di kategori Transport.  ");
    assert.equal(r?.amount, 15000n);
    assert.equal(r?.direction, "debit");
  });
});

describe("parseMybca — presisi uang", () => {
  it("mengembalikan bigint, bukan number", () => {
    const r = parseMybca("Pengeluaran sebesar IDR 10,000.00 di kategori Belanja.");
    assert.equal(typeof r?.amount, "bigint");
  });

  it("tepat pada nominal di atas batas aman float", () => {
    // 999.999.999.999 rupiah. Number masih sanggup, tapi tes ini mengunci
    // bahwa jalurnya bigint dan tidak ada pembulatan di mana pun.
    const r = parseMybca("Pemasukan sebesar IDR 999,999,999,999.00 di kategori Transfer.");
    assert.equal(r?.amount, 999999999999n);
  });

  it("menolak format locale Indonesia alih-alih salah membacanya", () => {
    // Ini jebakan paling berbahaya: kalau lolos, 10.000,00 terbaca jadi Rp10.
    const r = parseMybca("Pengeluaran sebesar IDR 10.000,00 di kategori Belanja.");
    assert.equal(r, null);
  });

  it("menolak desimal bukan nol, bukan membulatkannya", () => {
    assert.equal(parseMybca("Pengeluaran sebesar IDR 10,000.50 di kategori Belanja."), null);
  });

  it("menolak pengelompokan ribuan yang tidak wajar", () => {
    assert.equal(parseMybca("Pengeluaran sebesar IDR 10,00.00 di kategori Belanja."), null);
  });

  it("menolak nominal nol", () => {
    assert.equal(parseMybca("Pengeluaran sebesar IDR 0.00 di kategori Belanja."), null);
  });
});

describe("parseMybca — tidak pernah throw", () => {
  it("mengembalikan null untuk format asing", () => {
    assert.equal(parseMybca("Anda menerima transfer dari Budi sebesar Rp10.000"), null);
    assert.equal(parseMybca("Kode OTP Anda adalah 123456"), null);
  });

  it("mengembalikan null untuk string kosong", () => {
    assert.equal(parseMybca(""), null);
    assert.equal(parseMybca("   "), null);
  });

  it("mengembalikan null untuk arah transaksi yang tidak dikenal", () => {
    assert.equal(parseMybca("Penarikan sebesar IDR 50,000.00 di kategori Tunai."), null);
  });

  it("mengembalikan null untuk input yang bukan string", () => {
    const aneh: unknown[] = [null, undefined, 123, {}, [], true, 10n, () => {}];
    for (const v of aneh) {
      assert.equal(parseMybca(v as string), null, `gagal untuk ${String(v)}`);
    }
  });

  it("tidak throw untuk string sangat panjang", () => {
    assert.equal(parseMybca("Pengeluaran ".repeat(10_000)), null);
  });
});

describe("parseMybca — sampel notifikasi asli", () => {
  it(`memproses ${REAL_SAMPLES.length} sampel asli dengan benar`, (t) => {
    if (REAL_SAMPLES.length === 0) {
      t.skip("belum ada sampel asli — lihat REAL_SAMPLES di atas");
      return;
    }
    for (const s of REAL_SAMPLES) {
      const r = parseMybca(s.body);
      assert.equal(r?.amount, s.amount, s.body);
      assert.equal(r?.direction, s.direction, s.body);
    }
  });
});
