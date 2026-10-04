// DD-DICE-FACES: the raw dice behind journey checks (CheckRoll) for the UI dice panel.
// Proves (a) the *WithRoll siblings are the same code path as runSkillCheck / resolveScene
// (identical results and RNG), (b) StepRecord.travelRoll / sceneRoll are null exactly when the
// matching check is null, and (c) the counted flags reproduce the engine's own total.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { makeMilestoneState, makeTestHero } from "../../src/cli/scenario.js";
import { evaluateCheck, successDiceCounted } from "../../src/checks/evaluate.js";
import type { CheckResult } from "../../src/checks/types.js";
import type { DiceRoll, FeatDieResult } from "../../src/dice/types.js";
import { runSkillCheck, runSkillCheckWithRoll } from "../../src/journey/check.js";
import { journeyConfigsFromPack } from "../../src/journey/config.js";
import { stepJourney } from "../../src/journey/run.js";
import { resolveScene, resolveSceneWithRoll } from "../../src/journey/scene.js";
import type { CheckRoll, JourneyState } from "../../src/journey/state.js";
import type { HeroState } from "../../src/hero/state.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { makeRng } from "../../src/rng/rng.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const cfg = journeyConfigsFromPack(loadPack(nodePackSource(packRoot)));

const SEEDS = Array.from({ length: 24 }, (_, i) => `faces-${i}`);
const REGIONS = ["border_lands", "wild_lands", "dark_lands"] as const;

const base = makeTestHero(cfg);
// Fixture heroes covering every condition that touches the dice (fixture data, not rules):
// weary (Endurance <= Load), miserable (Shadow >= Hope), overwhelmed (Shadow >= max Hope ->
// ill-favoured Feat die).
const HEROES: Record<string, HeroState> = {
  plain: base,
  weary: { ...base, fatigue: base.endurance.current },
  miserable: { ...base, shadow: { points: base.hope.current, scars: 0 }, hope: { current: base.hope.current, max: base.hope.current + 1 } },
  overwhelmed: { ...base, shadow: { points: base.hope.max, scars: 0 } },
  wearyOverwhelmed: { ...base, fatigue: base.endurance.current, shadow: { points: base.hope.max, scars: 0 } },
};

/** The invariant the UI relies on, written test-side from the CheckRoll alone. */
function expectFacesExplainTotal(check: CheckResult, cr: CheckRoll, label: string): void {
  const { roll, successCounted } = cr;
  expect(successCounted.length, label).toBe(roll.successDice.length);
  expect(roll.featCandidates, label).toContain(roll.feat);
  expect(roll.successDice.filter((d) => d.isSuccessIcon).length, label).toBe(check.successIcons);
  expect(roll.feat.isEye, label).toBe(check.isEyeOnFeat);
  expect(roll.feat.isAutoSuccess, label).toBe(check.autoSuccess);
  if (check.total === null) {
    expect(check.autoSuccess, label).toBe(true); // total is null only on the Gandalf rune
    return;
  }
  const counted = roll.successDice.reduce((acc, d, i) => acc + (successCounted[i] ? d.face : 0), 0);
  expect(roll.feat.numericValue + counted, label).toBe(check.total);
}

describe("successDiceCounted (the shared counted-in-total rule)", () => {
  const num = (v: number): FeatDieResult => ({ physicalFace: v, face: { kind: "number", value: v }, numericValue: v, isEye: false, isAutoSuccess: false });
  const roll = (faces: number[]): DiceRoll => {
    const f = num(5);
    return {
      feat: f,
      featCandidates: [f],
      featModifier: "normal",
      successDice: faces.map((face) => ({ face, isSuccessIcon: false })),
      successDiceCount: faces.length,
    };
  };
  const voided = cfg.conditions.wearyVoidedFaces; // pack-sourced

  it("not weary: every die counts; weary: exactly the pack-voided faces drop out", () => {
    const faces = [1, 2, 3, 4, 5, 6];
    expect(successDiceCounted(roll(faces))).toEqual(faces.map(() => true));
    expect(successDiceCounted(roll(faces), { weary: false, wearyVoidedFaces: voided })).toEqual(faces.map(() => true));
    expect(successDiceCounted(roll(faces), { weary: true, wearyVoidedFaces: voided })).toEqual(faces.map((f) => !voided.includes(f)));
    // a stub voided set proves the faces come from the input, not a literal
    expect(successDiceCounted(roll(faces), { weary: true, wearyVoidedFaces: [6] })).toEqual([true, true, true, true, true, false]);
  });

  it("weary without voided faces throws (same guard evaluateCheck had)", () => {
    expect(() => successDiceCounted(roll([2]), { weary: true })).toThrow(/wearyVoidedFaces/);
  });

  it("evaluateCheck's total is feat + the faces successDiceCounted marks", () => {
    for (const conditions of [undefined, { weary: true, wearyVoidedFaces: voided }, { weary: true, wearyVoidedFaces: [4, 6] }]) {
      const r = roll([1, 3, 4, 6]);
      const flags = successDiceCounted(r, conditions);
      const want = 5 + r.successDice.reduce((a, d, i) => a + (flags[i] ? d.face : 0), 0);
      expect(evaluateCheck(r, 10, cfg.checks, conditions).total).toBe(want);
    }
  });
});

describe("runSkillCheckWithRoll / resolveSceneWithRoll (one code path with the originals)", () => {
  it("runSkillCheck === runSkillCheckWithRoll minus the roll (result and RNG), every hero/skill/seed", () => {
    for (const [name, hero] of Object.entries(HEROES)) {
      for (const skill of ["travel", "exploration", "awareness", "hunting"]) {
        for (const seed of SEEDS) {
          const label = `${name}/${skill}/${seed}`;
          const [r1, n1] = runSkillCheck(hero, skill, cfg, makeRng(seed));
          const [r2, cr, n2] = runSkillCheckWithRoll(hero, skill, cfg, makeRng(seed));
          expect(r2, label).toEqual(r1);
          expect(n2, label).toEqual(n1);
          expectFacesExplainTotal(r2, cr, label);
          expect(cr.roll.featModifier, label).toBe(name.toLowerCase().includes("overwhelmed") ? "ill_favoured" : "normal");
        }
      }
    }
  });

  it("weary voiding shows up in the flags exactly for the pack-voided faces", () => {
    let voidedSeen = 0;
    for (const seed of SEEDS) {
      const [, cr] = runSkillCheckWithRoll(HEROES.weary as HeroState, "travel", cfg, makeRng(seed));
      cr.roll.successDice.forEach((d, i) => {
        expect(cr.successCounted[i]).toBe(!cfg.conditions.wearyVoidedFaces.includes(d.face));
        if (cr.successCounted[i] === false) voidedSeen++;
      });
    }
    expect(voidedSeen).toBeGreaterThan(0); // the weary branch was actually exercised
  });

  it("resolveScene === resolveSceneWithRoll minus the roll; sceneRoll null iff the check is null", () => {
    for (const region of REGIONS) {
      for (const seed of SEEDS) {
        const s0 = makeMilestoneState(cfg, seed);
        const s: JourneyState = { ...s0, journey: { ...s0.journey, route: { ...s0.journey.route, region } } };
        const [a, ca] = resolveScene(s, cfg);
        const [b, cb, rb] = resolveSceneWithRoll(s, cfg);
        expect(b).toEqual(a);
        expect(cb).toEqual(ca);
        expect(rb === null).toBe(cb === null);
      }
    }
  });
});

describe("StepRecord.travelRoll / sceneRoll (whole journeys)", () => {
  it("null exactly when the matching check is null; faces explain every total", () => {
    let steps = 0;
    let illFavoured = 0;
    for (const [name, hero] of Object.entries(HEROES)) {
      for (const region of REGIONS) {
        for (const seed of SEEDS.slice(0, 8)) {
          const s0 = makeMilestoneState(cfg, seed);
          let s: JourneyState = { ...s0, hero, journey: { ...s0.journey, route: { ...s0.journey.route, region } } };
          while (!s.journey.arrived) {
            const [next, rec] = stepJourney(s, cfg);
            const label = `${name}/${region}/${seed}/${steps}`;
            expect(rec.travelRoll === null, label).toBe(rec.travelCheck === null);
            expect(rec.sceneRoll === null, label).toBe(rec.sceneCheck === null);
            if (rec.travelCheck !== null && rec.travelRoll !== null) expectFacesExplainTotal(rec.travelCheck, rec.travelRoll, label);
            if (rec.sceneCheck !== null && rec.sceneRoll !== null) expectFacesExplainTotal(rec.sceneCheck, rec.sceneRoll, label);
            if (rec.travelRoll?.roll.featModifier === "ill_favoured") {
              illFavoured++;
              expect(rec.travelRoll.roll.featCandidates.length, label).toBeGreaterThan(1);
            }
            s = next;
            steps++;
          }
        }
      }
    }
    expect(steps).toBeGreaterThan(100);
    expect(illFavoured).toBeGreaterThan(0);
  });

  it("the degenerate already-arrived no-op carries null rolls", () => {
    const s0 = makeMilestoneState(cfg, "dark-1");
    const [, rec] = stepJourney({ ...s0, journey: { ...s0.journey, arrived: true } }, cfg);
    expect(rec.travelRoll).toBeNull();
    expect(rec.sceneRoll).toBeNull();
  });
});
