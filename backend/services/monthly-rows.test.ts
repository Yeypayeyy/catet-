import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isiDuaBelasBulan } from "./monthly-rows.ts";

describe("isiDuaBelasBulan", () => {
  it("selalu 12 bulan urut, yang kosong jadi nol", () => {
    const hasil = isiDuaBelasBulan(2026, [
      { month: 9, income: "0", spending: "913000" },
      { month: 1, income: "5000000", spending: "12000" },
    ]);

    assert.equal(hasil.length, 12);
    assert.deepEqual(hasil[0], { month: "2026-01", income: "5000000", spending: "12000" });
    assert.deepEqual(hasil[1], { month: "2026-02", income: "0", spending: "0" });
    assert.deepEqual(hasil[8], { month: "2026-09", income: "0", spending: "913000" });
    assert.equal(hasil[11].month, "2026-12");
  });
});
