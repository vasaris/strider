// 3.3a-K1 previewCheck: the exact odds the roll panel shows. Hand-computed fractions on stub dice
// configs (test data; one with non-KV dice proves the faces come from the config), a seeded Monte
// Carlo check through rollCheckDice + evaluateCheck, and agreement with what the beats roll.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { makeTestHero } from "../../src/cli/scenario.js";
import { evaluateCheck } from "../../src/checks/evaluate.js";
import type { DiceConfig } from "../../src/dice/config.js";
import { rollCheckDice } from "../../src/dice/roll.js";
import type { FeatModifier } from "../../src/dice/types.js";
import { checkBeat, travelBeat } from "../../src/journey/beats.js";
import { skillCheckSetup } from "../../src/journey/check.js";
import { journeyConfigsFromPack } from "../../src/journey/config.js";
import { checkSuccessOdds, previewCheck } from "../../src/journey/preview.js";
import type { HeroState, JourneyState } from "../../src/journey/state.js";
import { makeMilestoneState } from "../../src/cli/scenario.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { makeRng, type Rng } from "../../src/rng/rng.js";

const here = dirname(fileURLToPath(import.meta.url));
const cfg = journeyConfigsFromPack(loadPack(nodePackSource(resolve(here, "../../..", "content-packs/kv"))));

// Stub dice: a d12 Feat die (Eye 11, rune 12, Eye counts 0) and d6 Success dice; and a tiny
// d4 / d3 set (Eye 3, rune 4) for a case small enough to enumerate by hand in full.
const D12: DiceConfig = {
  feat: { sides: 12, eyeFace: 11, gandalfRuneFace: 12, eyeNumericValue: 0, normalDiceCount: 1, modifiedDiceCount: 2 },
  success: { sides: 6, successIconFace: 6 },
};
const D4: DiceConfig = {
  feat: { sides: 4, eyeFace: 3, gandalfRuneFace: 4, eyeNumericValue: 0, normalDiceCount: 1, modifiedDiceCount: 2 },
  success: { sides: 3, successIconFace: 3 },
};
const plain = { weary: false, miserable: false, wearyVoidedFaces: [1, 2, 3] } as const;

describe("checkSuccessOdds: exact fractions by hand", () => {
  it("0 Success dice: the Feat die alone", () => {
    // success iff 8, 9, 10 or the rune: 4 of 12
    expect(checkSuccessOdds(D12, "normal", 0, 8, plain)).toBe(4 / 12);
    // TN 0: every face succeeds ...
    expect(checkSuccessOdds(D12, "normal", 0, 0, plain)).toBe(1);
    // ... except the Eye when miserable
    expect(checkSuccessOdds(D12, "normal", 0, 0, { ...plain, miserable: true })).toBe(11 / 12);
  });

  it("1 Success die, TN 12: 15 numeric + 6 rune successes of 72", () => {
    // feat 6..10 needs a die >= 6..2: 1+2+3+4+5 = 15; feat <= 5 and the Eye cannot reach 12; rune 6
    expect(checkSuccessOdds(D12, "normal", 1, 12, plain)).toBe(21 / 72);
  });

  it("weary: voided faces count 0 (stub voided set 1, 2, 3)", () => {
    // feat 10 needs >= 2: faces 4,5,6 (2,3 voided) = 3; feat 9 (>= 3): 3; feat 8 (>= 4): 3;
    // feat 7 (>= 5): 2; feat 6 (>= 6): 1 -> 12; rune 6 -> 18 of 72
    expect(checkSuccessOdds(D12, "normal", 1, 12, { ...plain, weary: true })).toBe(18 / 72);
  });

  it("ill-favoured keeps the worst die, favoured the best", () => {
    // success set {8,9,10,rune}: worst in set iff both dice in it = 16 of 144
    expect(checkSuccessOdds(D12, "ill_favoured", 0, 8, plain)).toBe(16 / 144);
    // best in set unless both outside it: 144 - 64 = 80 of 144
    expect(checkSuccessOdds(D12, "favoured", 0, 8, plain)).toBe(80 / 144);
    // ill-favoured + miserable, TN 0: fails iff any die is the Eye: 144 - 121 = 23 failures
    expect(checkSuccessOdds(D12, "ill_favoured", 0, 0, { ...plain, miserable: true })).toBe(121 / 144);
  });

  it("a d4 Feat die with one d3 Success die, TN 3 (non-KV dice: the faces come from the config)", () => {
    // feat 1 needs >= 2: 2 faces; feat 2 needs >= 1: 3; rune: 3; Eye (0) needs 3: 1 -> 9 of 12
    expect(checkSuccessOdds(D4, "normal", 1, 3, plain)).toBe(9 / 12);
  });
});

describe("checkSuccessOdds agrees with the dice (seeded Monte Carlo)", () => {
  const cases: ReadonlyArray<{ name: string; modifier: FeatModifier; dice: number; tn: number; weary: boolean; miserable: boolean }> = [
    { name: "plain", modifier: "normal", dice: 2, tn: 13, weary: false, miserable: false },
    { name: "ill-favoured weary miserable", modifier: "ill_favoured", dice: 3, tn: 14, weary: true, miserable: true },
    { name: "favoured with bonus dice", modifier: "favoured", dice: 4, tn: 16, weary: false, miserable: false },
  ];
  for (const c of cases) {
    it(c.name, () => {
      const conditions = { weary: c.weary, miserable: c.miserable, wearyVoidedFaces: cfg.conditions.wearyVoidedFaces };
      const p = checkSuccessOdds(cfg.dice, c.modifier, c.dice, c.tn, conditions);
      const n = 100_000;
      let rng: Rng = makeRng(`mc-${c.name}`);
      let hits = 0;
      for (let i = 0; i < n; i++) {
        const [roll, next] = rollCheckDice(cfg.dice, { abilityRating: c.dice, featModifier: c.modifier, bonusSuccessDice: 0, penaltySuccessDice: 0 }, rng);
        rng = next;
        if (evaluateCheck(roll, c.tn, cfg.checks, conditions).outcome === "success") hits++;
      }
      const sigma = Math.sqrt((p * (1 - p)) / n);
      expect(Math.abs(hits / n - p)).toBeLessThan(4 * sigma);
    });
  }
});

describe("previewCheck", () => {
  const base = makeTestHero(cfg);

  it("reports the setup the check derives (rating, attribute, TN, modifier, Hope, weary, miserable)", () => {
    const p = previewCheck(base, "travel", cfg);
    const setup = skillCheckSetup(base, "travel", cfg);
    expect(p).toMatchObject({
      skill: "travel",
      rating: base.skills["travel"],
      attribute: cfg.skillAttribute["travel"],
      attributeRating: base.attributes[cfg.skillAttribute["travel"]!],
      tn: setup.tn,
      featModifier: "normal",
      reasons: [],
      inspired: true,
      hope: { current: base.hope.current, max: base.hope.max, canSpend: true, bonusDice: cfg.checks.hopeSpend.inspiredGainDice },
      weary: { active: false, voidedFaces: cfg.conditions.wearyVoidedFaces, endurance: base.endurance.current, load: base.loadGear + base.fatigue },
      miserable: { now: false, afterSpend: false },
    });
    expect(p.odds.base).toBe(checkSuccessOdds(cfg.dice, "normal", setup.rating, setup.tn, setup.conditions));
    expect(p.odds.withHope).toBe(checkSuccessOdds(cfg.dice, "normal", setup.rating + cfg.checks.hopeSpend.inspiredGainDice, setup.tn, setup.conditions));
    expect(p.odds.withHope!).toBeGreaterThan(p.odds.base);
  });

  it("not inspired -> gainDice; no Hope -> canSpend false, bonusDice 0, withHope null", () => {
    expect(previewCheck({ ...base, inspired: false }, "travel", cfg).hope.bonusDice).toBe(cfg.checks.hopeSpend.gainDice);
    const broke = previewCheck({ ...base, hope: { current: 0, max: 3 } }, "travel", cfg);
    expect(broke.hope).toEqual({ current: 0, max: 3, canSpend: false, bonusDice: 0 });
    expect(broke.odds.withHope).toBeNull();
  });

  it("overwhelmed -> ill-favoured with its reason; weary and miserable (now / after the spend)", () => {
    const over = previewCheck({ ...base, shadow: { points: base.hope.max, scars: 0 } }, "travel", cfg);
    expect(over.featModifier).toBe("ill_favoured");
    expect(over.reasons).toEqual(["overwhelmed"]);
    const weary = previewCheck({ ...base, fatigue: base.endurance.current }, "travel", cfg);
    expect(weary.weary.active).toBe(true);
    const edge = previewCheck({ ...base, hope: { current: 2, max: 3 }, shadow: { points: 1, scars: 0 } }, "travel", cfg);
    expect(edge.miserable).toEqual({ now: false, afterSpend: true });
    // the spend's extra dice are rolled under the miserable rule
    const s = skillCheckSetup({ ...base, hope: { current: 1, max: 3 }, shadow: { points: 1, scars: 0 } }, "travel", cfg);
    expect(edge.odds.withHope).toBe(checkSuccessOdds(cfg.dice, s.featModifier, s.rating + edge.hope.bonusDice, s.tn, s.conditions));
  });

  it("agrees with what the beats roll: TN, Feat modifier, dice count (Travel and scene checks)", () => {
    const heroes: Record<string, Partial<HeroState>> = {
      plain: {},
      weary: { fatigue: base.endurance.current },
      overwhelmed: { shadow: { points: base.hope.max, scars: 0 } },
      edge: { hope: { current: 2, max: 3 }, shadow: { points: 1, scars: 0 } },
      broke: { hope: { current: 0, max: 3 } },
      uninspired: { inspired: false },
    };
    let sceneChecks = 0;
    for (const [name, patch] of Object.entries(heroes)) {
      for (const spend of [0, 1] as const) {
        for (let i = 0; i < 20; i++) {
          const s0 = makeMilestoneState(cfg, `pv-${name}-${i}`);
          const s: JourneyState = { ...s0, hero: { ...s0.hero, ...patch } };
          const pv = previewCheck(s.hero, "travel", cfg);
          const [t, rec] = travelBeat(s, { hopeSpend: spend }, cfg);
          const bonus = spend === 1 ? pv.hope.bonusDice : 0;
          expect(rec.hope.bonusDice, name).toBe(bonus);
          expect(rec.travelCheck.targetNumber, name).toBe(pv.tn);
          expect(rec.travelRoll.roll.featModifier, name).toBe(pv.featModifier);
          expect(rec.travelRoll.roll.successDiceCount, name).toBe(pv.rating + bonus);
          if (rec.kind === "pending") {
            const skill = t.journey.pending!.detail.skill!;
            const sp = previewCheck(t.hero, skill, cfg);
            const [, check] = checkBeat(t, { hopeSpend: spend }, cfg);
            const b = spend === 1 ? sp.hope.bonusDice : 0;
            expect(check.hope.bonusDice).toBe(b);
            expect(check.sceneCheck.targetNumber).toBe(sp.tn);
            expect(check.sceneRoll.roll.featModifier).toBe(sp.featModifier);
            expect(check.sceneRoll.roll.successDiceCount).toBe(sp.rating + b);
            sceneChecks++;
          }
        }
      }
    }
    expect(sceneChecks).toBeGreaterThan(0);
  });
});
