import { describe, expect, it } from "vitest";
import { makeRng } from "../../src/rng/rng.js";
import {
  resolveSuccessDiceCount,
  rollSuccessDice,
  rollSuccessDie,
} from "../../src/dice/successDie.js";
import { KV_DICE } from "./fixtures.js";

const SUCCESS = KV_DICE.success;

describe("success die distribution + icon", () => {
  it("d6 uniform; icon only on face 6 (chi-square, deterministic)", () => {
    const samples = 60_000;
    const counts = new Array<number>(SUCCESS.sides + 1).fill(0);
    let rng = makeRng("succ-dist");
    for (let i = 0; i < samples; i++) {
      const [r, next] = rollSuccessDie(SUCCESS, rng);
      expect(r.face).toBeGreaterThanOrEqual(1);
      expect(r.face).toBeLessThanOrEqual(SUCCESS.sides);
      expect(r.isSuccessIcon).toBe(r.face === SUCCESS.successIconFace);
      counts[r.face] = (counts[r.face] ?? 0) + 1;
      rng = next;
    }
    const expected = samples / SUCCESS.sides;
    let chi = 0;
    for (let face = 1; face <= SUCCESS.sides; face++) {
      const o = counts[face] ?? 0;
      chi += (o - expected) ** 2 / expected;
    }
    expect(chi).toBeLessThan(25); // df=5, 0.999 ~= 20.5
  });
});

describe("resolveSuccessDiceCount", () => {
  it("base equals ability rating; rating 0 -> 0 dice", () => {
    expect(resolveSuccessDiceCount({ abilityRating: 0, bonus: 0, penalty: 0 })).toBe(0);
    expect(resolveSuccessDiceCount({ abilityRating: 3, bonus: 0, penalty: 0 })).toBe(3);
  });

  it("adds bonuses then subtracts penalties (worked example +1 +2 -1 over base)", () => {
    // base 2, +1 (assistance) +2 (inspiration) -1 (penalty) = 4
    expect(resolveSuccessDiceCount({ abilityRating: 2, bonus: 3, penalty: 1 })).toBe(4);
  });

  it("floors at zero (penalty cannot push below 0)", () => {
    expect(resolveSuccessDiceCount({ abilityRating: 1, bonus: 0, penalty: 5 })).toBe(0);
    expect(resolveSuccessDiceCount({ abilityRating: 0, bonus: 0, penalty: 2 })).toBe(0);
  });

  it("rejects malformed input", () => {
    expect(() => resolveSuccessDiceCount({ abilityRating: -1, bonus: 0, penalty: 0 })).toThrow();
    expect(() => resolveSuccessDiceCount({ abilityRating: 1, bonus: -1, penalty: 0 })).toThrow();
    expect(() => resolveSuccessDiceCount({ abilityRating: 1.5, bonus: 0, penalty: 0 })).toThrow();
  });
});

describe("rollSuccessDice", () => {
  it("rolls exactly count dice, reproducibly", () => {
    const [a] = rollSuccessDice(SUCCESS, 4, makeRng("sd"));
    const [b] = rollSuccessDice(SUCCESS, 4, makeRng("sd"));
    expect(a).toHaveLength(4);
    expect(a).toEqual(b);
  });

  it("count 0 yields empty set", () => {
    const [arr] = rollSuccessDice(SUCCESS, 0, makeRng("sd0"));
    expect(arr).toEqual([]);
  });
});
