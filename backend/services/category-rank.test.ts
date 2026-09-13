import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { minuteOfDayWib, rankRules, susunSaran, type Rule } from "./category-rank.ts";

const rule = (r: Partial<Rule> & { categoryId: string }): Rule => ({
  amountMin: null,
  amountMax: null,
  minuteStart: null,
  minuteEnd: null,
  priority: 0,
  hitCount: 0,
  ...r,
});

const NOON = 12 * 60;

describe("rankRules", () => {
  it("nominal persis menang atas rentang dan window waktu", () => {
    const rules = [
      rule({ categoryId: "window", minuteStart: 0, minuteEnd: 1439, hitCount: 99 }),
      rule({ categoryId: "rentang", amountMin: 5000n, amountMax: 50000n, hitCount: 50 }),
      rule({ categoryId: "persis", amountMin: 10000n, amountMax: 10000n, hitCount: 1 }),
    ];
    assert.deepEqual(rankRules(rules, 10000n, NOON), ["persis", "rentang", "window"]);
  });

  it("hit_count menaikkan kategori ke posisi pertama", () => {
    // Verifikasi F4.2/F4.3: dipilih 3x untuk nominal yang sama, naik ke atas.
    const jajan = rule({ categoryId: "jajan", amountMin: 10000n, amountMax: 10000n, hitCount: 3 });
    const kopi = rule({ categoryId: "kopi", amountMin: 10000n, amountMax: 10000n, hitCount: 1 });
    assert.deepEqual(rankRules([kopi, jajan], 10000n, NOON), ["jajan", "kopi"]);
  });

  it("priority jadi penentu saat hit_count sama", () => {
    const a = rule({ categoryId: "a", amountMin: 10000n, amountMax: 10000n, priority: 1 });
    const b = rule({ categoryId: "b", amountMin: 10000n, amountMax: 10000n, priority: 5 });
    assert.deepEqual(rankRules([a, b], 10000n, NOON), ["b", "a"]);
  });

  it("membuang aturan yang nominalnya di luar rentang", () => {
    const rules = [rule({ categoryId: "kecil", amountMin: 1000n, amountMax: 20000n })];
    assert.deepEqual(rankRules(rules, 500000n, NOON), []);
  });

  it("window waktu yang melewati tengah malam tetap cocok", () => {
    const malam = [rule({ categoryId: "malam", minuteStart: 22 * 60, minuteEnd: 2 * 60 })];
    assert.deepEqual(rankRules(malam, 10000n, 23 * 60), ["malam"]);
    assert.deepEqual(rankRules(malam, 10000n, 1 * 60), ["malam"]);
    assert.deepEqual(rankRules(malam, 10000n, NOON), []);
  });

  it("kategori yang sama dari dua aturan hanya muncul sekali", () => {
    const rules = [
      rule({ categoryId: "jajan", amountMin: 10000n, amountMax: 10000n }),
      rule({ categoryId: "jajan", amountMin: 1000n, amountMax: 50000n }),
    ];
    assert.deepEqual(rankRules(rules, 10000n, NOON), ["jajan"]);
  });

  it("nominal besar tidak kehilangan presisi", () => {
    const rules = [
      rule({ categoryId: "sewa", amountMin: 9007199254740993n, amountMax: 9007199254740993n }),
    ];
    assert.deepEqual(rankRules(rules, 9007199254740993n, NOON), ["sewa"]);
    assert.deepEqual(rankRules(rules, 9007199254740992n, NOON), []);
  });
});

describe("minuteOfDayWib", () => {
  it("menggeser UTC ke WIB", () => {
    assert.equal(minuteOfDayWib(new Date("2026-09-04T05:00:00Z")), 12 * 60);
  });

  it("membungkus melewati tengah malam", () => {
    assert.equal(minuteOfDayWib(new Date("2026-09-04T18:30:00Z")), 1 * 60 + 30);
  });
});

describe("susunSaran", () => {
  const k = (id: string, kind: "expense" | "income" = "expense", hidden = false) => ({
    id,
    name: id,
    icon: null,
    kind,
    hidden,
  });
  const peta = (...xs: ReturnType<typeof k>[]) => new Map(xs.map((x) => [x.id, x]));

  it("aturan dulu, lalu cadangan, maksimal tiga, tanpa duplikat", () => {
    const semua = peta(k("a"), k("b"), k("c"), k("d"));
    const hasil = susunSaran(["b", "a"], semua, [k("a"), k("c"), k("d")], "expense");
    assert.deepEqual(hasil.map((x) => x.id), ["b", "a", "c"]);
  });

  it("kategori beda jenis dan yang tersembunyi tidak pernah muncul", () => {
    const semua = peta(k("gaji", "income"), k("sembunyi", "expense", true), k("makan"));
    const cadangan = [k("gaji", "income"), k("sembunyi", "expense", true), k("makan")];

    assert.deepEqual(
      susunSaran(["gaji", "sembunyi", "makan"], semua, cadangan, "expense").map((x) => x.id),
      ["makan"],
    );
    assert.deepEqual(
      susunSaran(["makan"], semua, cadangan, "income").map((x) => x.id),
      ["gaji"],
    );
  });

  it("hanya membawa id, nama, dan ikon", () => {
    assert.deepEqual(susunSaran([], peta(), [k("a")], "expense"), [{ id: "a", name: "a", icon: null }]);
  });
});
