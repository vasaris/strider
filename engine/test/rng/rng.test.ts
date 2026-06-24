import { describe, expect, it } from "vitest";
import { type Rng, makeRng, nextU32, randIntBelow, rollDie } from "../../src/rng/rng.js";

function takeU32(seed: number | string, n: number): number[] {
  const out: number[] = [];
  let rng = makeRng(seed);
  for (let i = 0; i < n; i++) {
    const [u, next] = nextU32(rng);
    out.push(u);
    rng = next;
  }
  return out;
}

describe("rng reproducibility", () => {
  it("same seed yields identical sequences", () => {
    expect(takeU32("brodyazhnik", 50)).toEqual(takeU32("brodyazhnik", 50));
    expect(takeU32(12345, 50)).toEqual(takeU32(12345, 50));
  });

  it("different seeds diverge", () => {
    expect(takeU32("a", 20)).not.toEqual(takeU32("b", 20));
  });

  it("nextU32 is pure: same state value twice gives the same pair", () => {
    const rng: Rng = makeRng("pure");
    const first = nextU32(rng);
    const second = nextU32(rng);
    expect(first[0]).toBe(second[0]);
    expect(first[1]).toEqual(second[1]);
  });

  it("outputs are uint32", () => {
    for (const u of takeU32("range", 1000)) {
      expect(Number.isInteger(u)).toBe(true);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(0x1_0000_0000);
    }
  });
});

describe("randIntBelow", () => {
  it("stays in [0, n) and is reproducible", () => {
    let rng = makeRng("below");
    const a: number[] = [];
    for (let i = 0; i < 500; i++) {
      const [v, next] = randIntBelow(12, rng);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(12);
      a.push(v);
      rng = next;
    }
    // reproduce
    rng = makeRng("below");
    const b: number[] = [];
    for (let i = 0; i < 500; i++) {
      const [v, next] = randIntBelow(12, rng);
      b.push(v);
      rng = next;
    }
    expect(a).toEqual(b);
  });

  it("rejects non-positive / non-integer n", () => {
    const rng = makeRng("x");
    expect(() => randIntBelow(0, rng)).toThrow();
    expect(() => randIntBelow(-3, rng)).toThrow();
    expect(() => randIntBelow(2.5, rng)).toThrow();
  });

  it("is uniform across faces (chi-square, deterministic)", () => {
    const n = 12;
    const samples = 120_000;
    const counts = new Array<number>(n).fill(0);
    let rng = makeRng("uniform-12");
    for (let i = 0; i < samples; i++) {
      const [v, next] = randIntBelow(n, rng);
      counts[v] = (counts[v] ?? 0) + 1;
      rng = next;
    }
    const expected = samples / n;
    const chi = counts.reduce((s, o) => s + (o - expected) ** 2 / expected, 0);
    // df = 11; 0.999 critical ~= 31.26. Deterministic seed; comfortably below.
    expect(chi).toBeLessThan(35);
  });
});

describe("rollDie", () => {
  it("returns faces in [1, sides]", () => {
    let rng = makeRng("die");
    for (let i = 0; i < 500; i++) {
      const [face, next] = rollDie(6, rng);
      expect(face).toBeGreaterThanOrEqual(1);
      expect(face).toBeLessThanOrEqual(6);
      rng = next;
    }
  });
});
