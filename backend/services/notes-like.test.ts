import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeLike } from "./notes-like.ts";

describe("escapeLike", () => {
  it("wildcard dari ketikan jadi karakter biasa", () => {
    assert.equal(escapeLike("100%"), "100\\%");
    assert.equal(escapeLike("a_b"), "a\\_b");
    assert.equal(escapeLike("c:\\x"), "c:\\\\x");
  });

  it("teks biasa tidak berubah", () => {
    assert.equal(escapeLike("Sop Pak Samson"), "Sop Pak Samson");
  });
});
