import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pindahkan } from "./urutan.ts";

describe("pindahkan", () => {
  const xs = ["a", "b", "c", "d"];

  it("ke bawah dan ke atas", () => {
    assert.deepEqual(pindahkan(xs, 0, 2), ["b", "c", "a", "d"]);
    assert.deepEqual(pindahkan(xs, 3, 0), ["d", "a", "b", "c"]);
  });

  it("posisi sama tidak mengubah apa-apa, batas dijepit", () => {
    assert.deepEqual(pindahkan(xs, 1, 1), xs);
    assert.deepEqual(pindahkan(xs, 1, 99), ["a", "c", "d", "b"]);
    assert.deepEqual(pindahkan(xs, 2, -5), ["c", "a", "b", "d"]);
  });

  it("masukan tidak dimutasi", () => {
    pindahkan(xs, 0, 3);
    assert.deepEqual(xs, ["a", "b", "c", "d"]);
  });
});
