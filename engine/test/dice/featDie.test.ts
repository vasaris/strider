import { describe, expect, it } from "vitest";
import { makeRng } from "../../src/rng/rng.js";
import {
  featRank,
  resolveFeatModifier,
  rollFeatDie,
  rollFeatWithModifier,
} from "../../src/dice/featDie.js";
import type { FeatDieResult } from "../../src/dice/types.js";
import { KV_DICE } from "./fixtures.js";

const FEAT = KV_DICE.feat;

function rollMany(seed: string, n: number): FeatDieResult[] {
  const out: FeatDieResult[] = [];
  let rng = makeRng(seed);
  for (let i = 0; i < n; i++) {
    const [r, next] = rollFeatDie(FEAT, rng);
    out.push(r);
    rng = next;
  }
  return out;
}

describe("feat die distribution", () => {
  it("covers faces 1..12 uniformly, never outside (chi-square, deterministic)", () => {
    const samples = 120_000;
    const counts = new Array<number>(FEAT.sides + 1).fill(0); // index by physicalFace
    for (const r of rollMany("feat-dist", samples)) {
      expect(r.physicalFace).toBeGreaterThanOrEqual(1);
      expect(r.physicalFace).toBeLessThanOrEqual(FEAT.sides);
      counts[r.physicalFace] = (counts[r.physicalFace] ?? 0) + 1;
    }
    expect(counts[0]).toBe(0); // face 0 never occurs
    const expected = samples / FEAT.sides;
    let chi = 0;
    for (let face = 1; face <= FEAT.sides; face++) {
      const o = counts[face] ?? 0;
      chi += (o - expected) ** 2 / expected;
    }
    expect(chi).toBeLessThan(35); // df=11, 0.999 ~= 31.26
  });

  it("eye and gandalf each appear ~1/12", () => {
    const samples = 120_000;
    const rolls = rollMany("feat-special", samples);
    const eyes = rolls.filter((r) => r.isEye).length;
    const gandalfs = rolls.filter((r) => r.isAutoSuccess).length;
    const expected = samples / FEAT.sides;
    expect(Math.abs(eyes - expected)).toBeLessThan(expected * 0.1);
    expect(Math.abs(gandalfs - expected)).toBeLessThan(expected * 0.1);
  });
});

describe("feat die semantics", () => {
  it("maps each physical face to correct semantics", () => {
    for (const r of rollMany("feat-sem", 20_000)) {
      if (r.physicalFace === FEAT.gandalfRuneFace) {
        expect(r.face.kind).toBe("gandalf_rune");
        expect(r.isAutoSuccess).toBe(true);
        expect(r.isEye).toBe(false);
      } else if (r.physicalFace === FEAT.eyeFace) {
        expect(r.face.kind).toBe("eye");
        expect(r.isEye).toBe(true);
        expect(r.isAutoSuccess).toBe(false);
        expect(r.numericValue).toBe(FEAT.eyeNumericValue);
      } else {
        expect(r.face.kind).toBe("number");
        expect(r.numericValue).toBe(r.physicalFace);
        expect(r.isEye).toBe(false);
        expect(r.isAutoSuccess).toBe(false);
      }
    }
  });
});

describe("featRank (book: gandalf best, eye worst)", () => {
  const eye: FeatDieResult = { physicalFace: 11, face: { kind: "eye" }, numericValue: 0, isEye: true, isAutoSuccess: false };
  const gandalf: FeatDieResult = { physicalFace: 12, face: { kind: "gandalf_rune" }, numericValue: 0, isEye: false, isAutoSuccess: true };
  const num = (v: number): FeatDieResult => ({ physicalFace: v, face: { kind: "number", value: v }, numericValue: v, isEye: false, isAutoSuccess: false });

  it("orders gandalf > 10 > 1 > eye", () => {
    expect(featRank(gandalf)).toBeGreaterThan(featRank(num(10)));
    expect(featRank(num(10))).toBeGreaterThan(featRank(num(1)));
    expect(featRank(num(1))).toBeGreaterThan(featRank(eye));
  });
});

describe("favoured / ill-favoured selection", () => {
  it("rolls modifiedDiceCount candidates and keeps best (favoured) / worst (ill)", () => {
    let rng = makeRng("fav");
    for (let i = 0; i < 5000; i++) {
      const [fav, n1] = rollFeatWithModifier(FEAT, "favoured", rng);
      expect(fav.candidates).toHaveLength(FEAT.modifiedDiceCount);
      const bestRank = Math.max(...fav.candidates.map(featRank));
      expect(featRank(fav.chosen)).toBe(bestRank);

      const [ill, n2] = rollFeatWithModifier(FEAT, "ill_favoured", n1);
      expect(ill.candidates).toHaveLength(FEAT.modifiedDiceCount);
      const worstRank = Math.min(...ill.candidates.map(featRank));
      expect(featRank(ill.chosen)).toBe(worstRank);
      rng = n2;
    }
  });

  it("normal rolls a single candidate", () => {
    const [res] = rollFeatWithModifier(FEAT, "normal", makeRng("norm"));
    expect(res.candidates).toHaveLength(FEAT.normalDiceCount);
    expect(res.chosen).toEqual(res.candidates[0]);
  });
});

describe("resolveFeatModifier (favoured_edge_cases)", () => {
  it("favoured+ill at once -> normal", () => {
    expect(resolveFeatModifier(1, 1)).toBe("normal");
    expect(resolveFeatModifier(3, 1)).toBe("normal"); // lopsided still normal
  });
  it("single side resolves to that side", () => {
    expect(resolveFeatModifier(2, 0)).toBe("favoured");
    expect(resolveFeatModifier(0, 2)).toBe("ill_favoured");
  });
  it("neither -> normal", () => {
    expect(resolveFeatModifier(0, 0)).toBe("normal");
  });
});
