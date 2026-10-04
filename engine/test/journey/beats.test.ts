// 3.3a-K1: the player beats (travelBeat -> checkBeat), the oracle question, R2 (Eye growth only
// from hero checks) and the Hope spend before the roll. stepJourney is the composition of the
// beats with no Hope spent; snapshot900.test.ts proves it byte-identical to the old step.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { makeMilestoneState } from "../../src/cli/scenario.js";
import { evaluateCheck } from "../../src/checks/evaluate.js";
import { checkConditions } from "../../src/conditions/index.js";
import { featDieResultOfFace } from "../../src/dice/featDie.js";
import { checkBeat, JourneyBeatError, travelBeat } from "../../src/journey/beats.js";
import { journeyConfigsFromPack } from "../../src/journey/config.js";
import { askOracle } from "../../src/journey/oracle.js";
import { stepJourney } from "../../src/journey/run.js";
import type { EyeSource, HeroState, JourneyState } from "../../src/journey/state.js";
import type { EyeRegion } from "../../src/eye/types.js";
import { pursuitThreshold } from "../../src/eye/pursuit.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { rollFeatDie } from "../../src/dice/featDie.js";

const here = dirname(fileURLToPath(import.meta.url));
const cfg = journeyConfigsFromPack(loadPack(nodePackSource(resolve(here, "../../..", "content-packs/kv"))));
const REGIONS = ["border_lands", "wild_lands", "dark_lands"] as const;
const SEEDS = Array.from({ length: 60 }, (_, i) => `beat-${i}`);

function start(seed: string, region: EyeRegion, hero?: Partial<HeroState>): JourneyState {
  const s = makeMilestoneState(cfg, seed);
  return { ...s, hero: { ...s.hero, ...hero }, journey: { ...s.journey, route: { ...s.journey.route, region } } };
}

/** Advance until a travel beat leaves a scene pending (or give up). */
function untilPending(s0: JourneyState): JourneyState | null {
  let s = s0;
  while (!s.journey.arrived) {
    const [next, rec] = travelBeat(s, { hopeSpend: 0 }, cfg);
    if (rec.kind === "pending") return next;
    s = next;
  }
  return null;
}

function firstPending(region: EyeRegion, hero?: Partial<HeroState>): JourneyState {
  for (const seed of SEEDS) {
    const p = untilPending(start(seed, region, hero));
    if (p) return p;
  }
  throw new Error("no pending scene found");
}

const sum = (xs: readonly EyeSource[]): number => xs.reduce((a, e) => a + e.delta, 0);

describe("beat preconditions (JourneyBeatError)", () => {
  it("travelBeat on an arrived journey -> journey_over; with a pending check -> check_pending", () => {
    const s = start("beat-0", "wild_lands");
    const arrived: JourneyState = { ...s, journey: { ...s.journey, arrived: true } };
    expect(() => travelBeat(arrived, { hopeSpend: 0 }, cfg)).toThrow(JourneyBeatError);
    try {
      travelBeat(arrived, { hopeSpend: 0 }, cfg);
    } catch (e) {
      expect((e as JourneyBeatError).code).toBe("journey_over");
      expect((e as JourneyBeatError).name).toBe("JourneyBeatError");
    }
    const pending = firstPending("wild_lands");
    expect(() => travelBeat(pending, { hopeSpend: 0 }, cfg)).toThrow(expect.objectContaining({ code: "check_pending" }));
    // stepJourney on a pending state throws too (via travelBeat)
    expect(() => stepJourney(pending, cfg)).toThrow(expect.objectContaining({ code: "check_pending" }));
  });

  it("checkBeat with no pending scene -> no_pending; askOracle after arrival -> journey_over", () => {
    const s = start("beat-0", "wild_lands");
    expect(() => checkBeat(s, { hopeSpend: 0 }, cfg)).toThrow(expect.objectContaining({ code: "no_pending" }));
    const arrived: JourneyState = { ...s, journey: { ...s.journey, arrived: true } };
    expect(() => askOracle(arrived, { likelihood: null }, cfg)).toThrow(expect.objectContaining({ code: "journey_over" }));
  });
});

describe("travelBeat + checkBeat compose to stepJourney (no Hope spent)", () => {
  it("same state (byte-identical JSON) and the same StepRecord pieces, every step of 180 journeys", () => {
    let kinds = new Set<string>();
    for (const seed of SEEDS) {
      for (const region of REGIONS) {
        let s = start(seed, region);
        while (!s.journey.arrived) {
          const [stepped, step] = stepJourney(s, cfg);
          const [t, travel] = travelBeat(s, { hopeSpend: 0 }, cfg);
          kinds = kinds.add(travel.kind);
          expect(travel.events).toEqual(t.log.slice(s.log.length));
          expect(travel.hope).toEqual({ spent: 0, bonusDice: 0 });
          let beats = t;
          if (travel.kind === "pending") {
            expect(t.journey.pending).toBe(travel.scene); // the record's scene IS the pending draw
            expect(travel.events.map((e) => e.kind)).toEqual(["travel_check"]); // no scene event yet
            const [c, check] = checkBeat(t, { hopeSpend: 0 }, cfg);
            expect(check.scene).toBe(travel.scene);
            expect(check.events).toEqual(c.log.slice(t.log.length));
            expect(check.sceneCheck).toEqual(step.sceneCheck);
            expect(check.sceneRoll).toEqual(step.sceneRoll);
            expect("pending" in c.journey).toBe(false); // key dropped, not nulled
            beats = c;
          } else {
            expect("pending" in t.journey).toBe(false);
            expect(step.sceneCheck).toBeNull();
            expect(travel.scene === null).toBe(travel.kind === "arrival");
          }
          expect(JSON.stringify(beats)).toBe(JSON.stringify(stepped));
          expect(travel.travelCheck).toEqual(step.travelCheck);
          expect(travel.travelRoll).toEqual(step.travelRoll);
          s = stepped;
        }
      }
    }
    expect([...kinds].sort()).toEqual(["arrival", "encounter", "pending"]);
  });

  it("the pending draw is plain JSON: kept face, every candidate, the regional modifier, the d6", () => {
    for (const region of REGIONS) {
      const p = firstPending(region);
      const draw = p.journey.pending!;
      expect(JSON.parse(JSON.stringify(draw))).toEqual(draw);
      const modifier = { favoured: "favoured", plain: "normal", ill_favoured: "ill_favoured" }[cfg.scenes.bias[region]];
      expect(draw.tableRoll.modifier).toBe(modifier);
      expect(draw.tableRoll.candidates).toHaveLength(modifier === "normal" ? cfg.dice.feat.normalDiceCount : cfg.dice.feat.modifiedDiceCount);
      expect(draw.tableRoll.candidates).toContain(draw.tableRoll.feat);
      expect(draw.detail.face).toBe(draw.detailDie);
      expect(cfg.detailTables.get(draw.sceneType)?.rows).toContainEqual(draw.detail);
    }
  });
});

describe("Hope spend before the roll (checks.bonus_dice_hope)", () => {
  it("spends 1 point first and rolls rating + bonus dice (inspired -> inspiredGainDice, else gainDice)", () => {
    for (const inspired of [true, false]) {
      const s = start("beat-1", "wild_lands", { inspired });
      const [t, rec] = travelBeat(s, { hopeSpend: 1 }, cfg);
      const bonus = inspired ? cfg.checks.hopeSpend.inspiredGainDice : cfg.checks.hopeSpend.gainDice;
      expect(rec.hope).toEqual({ spent: 1, bonusDice: bonus });
      expect(t.hero.hope.current).toBe(s.hero.hope.current - 1);
      expect(rec.travelRoll.roll.successDiceCount).toBe((s.hero.skills["travel"] ?? 0) + bonus);
    }
  });

  it("a spend with no Hope left yields nothing (clamped): spent 0, no bonus dice, same roll as no spend", () => {
    const s = start("beat-2", "dark_lands", { hope: { current: 0, max: 3 } });
    const [t1, r1] = travelBeat(s, { hopeSpend: 1 }, cfg);
    const [t0, r0] = travelBeat(s, { hopeSpend: 0 }, cfg);
    expect(r1.hope).toEqual({ spent: 0, bonusDice: 0 });
    expect(JSON.stringify(t1)).toBe(JSON.stringify(t0));
    expect(r1.travelRoll).toEqual(r0.travelRoll);
  });

  it("conditions are evaluated on the POST-spend hero (the spend can make the hero miserable)", () => {
    // Shadow = Hope - 1: not miserable before the spend, miserable after it.
    const hero: Partial<HeroState> = { hope: { current: 2, max: 3 }, shadow: { points: 1, scars: 0 } };
    let decisive = 0;
    for (const seed of Array.from({ length: 400 }, (_, i) => `hope-${i}`)) {
      const s = start(seed, "wild_lands", hero);
      const [t, rec] = travelBeat(s, { hopeSpend: 1 }, cfg);
      const post = { ...s.hero, hope: { ...s.hero.hope, current: t.hero.hope.current } };
      const tn = rec.travelCheck.targetNumber;
      expect(rec.travelCheck).toEqual(evaluateCheck(rec.travelRoll.roll, tn, cfg.checks, checkConditions(post, cfg.conditions)));
      const pre = evaluateCheck(rec.travelRoll.roll, tn, cfg.checks, checkConditions(s.hero, cfg.conditions));
      if (pre.outcome !== rec.travelCheck.outcome) {
        decisive++;
        expect(rec.travelCheck.outcome).toBe("failure"); // Eye + miserable after the spend
        expect(rec.travelCheck.isEyeOnFeat).toBe(true);
      }
    }
    expect(decisive).toBeGreaterThan(0);
  });

  it("checkBeat spends on the scene check the same way", () => {
    const p = firstPending("wild_lands");
    const [c, rec] = checkBeat(p, { hopeSpend: 1 }, cfg);
    expect(rec.hope).toEqual({ spent: 1, bonusDice: cfg.checks.hopeSpend.inspiredGainDice });
    expect(rec.sceneRoll.roll.successDiceCount).toBe((p.hero.skills[p.journey.pending!.detail.skill!] ?? 0) + rec.hope.bonusDice);
    // Hope can also come back through the scene consequence (inspiring_sight); without one the
    // point stays spent.
    if (!rec.events.some((e) => e.kind === "scene" && e.appliedOps.includes("hope_points"))) {
      expect(c.hero.hope.current).toBe(p.hero.hope.current - 1);
    }
  });
});

describe("R2: Eye Awareness grows only for an Eye on a hero check", () => {
  it("a scene-table Eye (terrible_misfortune) adds nothing; the scene eyeDelta is the scene check's Eye", () => {
    let tableEyes = 0;
    for (const seed of SEEDS) {
      let s = start(seed, "dark_lands");
      while (!s.journey.arrived) {
        const [t, travel] = travelBeat(s, { hopeSpend: 0 }, cfg);
        let next = t;
        if (travel.scene && featDieResultOfFace(travel.scene.tableRoll.feat, cfg.dice.feat).isEye) {
          tableEyes++;
          if (travel.kind === "pending") {
            const [c, check] = checkBeat(t, { hopeSpend: 0 }, cfg);
            const scene = check.events.find((e) => e.kind === "scene");
            expect(scene?.kind === "scene" && scene.eyeDelta).toBe(check.sceneCheck.isEyeOnFeat ? cfg.eye.growth.eyeOnFeatOutOfCombat : 0);
            next = c;
          } else {
            const scene = travel.events.find((e) => e.kind === "scene");
            expect(scene?.kind === "scene" && scene.eyeDelta).toBe(0); // significant: no hero check
          }
        } else if (travel.kind === "pending") {
          [next] = checkBeat(t, { hopeSpend: 0 }, cfg);
        }
        s = next;
      }
    }
    expect(tableEyes).toBeGreaterThan(0);
  });

  it("eyeSources: deltas > 0 only, and their sum over a step's beats == the step's Awareness growth up to detection", () => {
    const awarenessStarts = [undefined, 1, 2]; // undefined = the initial rating; else threshold - n
    let detections = 0;
    let sources = new Set<string>();
    for (const seed of SEEDS) {
      for (const region of REGIONS) {
        for (const gap of awarenessStarts) {
          const base = start(seed, region, { hope: { current: 3, max: 3 } });
          let s =
            gap === undefined
              ? base
              : { ...base, hero: { ...base.hero, eye: { ...base.hero.eye, awareness: pursuitThreshold(region, [], cfg.eye) - gap } } };
          let i = 0;
          while (!s.journey.arrived) {
            const before = s.hero.eye.awareness;
            const spend = (i++ % 2) as 0 | 1; // alternate spends to vary the rolls
            const [t, travel] = travelBeat(s, { hopeSpend: spend }, cfg);
            let all = [...travel.eyeSources];
            let events = [...travel.events];
            let after = t;
            if (travel.kind === "pending") {
              const [c, check] = checkBeat(t, { hopeSpend: spend }, cfg);
              all = [...all, ...check.eyeSources];
              events = [...events, ...check.events];
              after = c;
            }
            for (const e of all) {
              expect(e.delta).toBeGreaterThan(0);
              sources = sources.add(e.source);
            }
            const detection = events.find((e) => e.kind === "detection");
            if (detection?.kind === "detection") detections++;
            const reached = detection?.kind === "detection" ? detection.awareness : after.hero.eye.awareness;
            expect(sum(all)).toBe(reached - before);
            s = after;
          }
        }
      }
    }
    expect(detections).toBeGreaterThan(0);
    expect([...sources].sort()).toEqual(["scene_check", "shadow", "travel_check"]);
  });
});

describe("askOracle (kv.solo.answers)", () => {
  const def = cfg.oracles.answers.likelihoods.find((l) => l.isDefault);

  it("null likelihood -> the pack default; one Feat die; Eye/rune extreme; Eye NEVER grows", () => {
    expect(def?.key).toBe("even");
    const faces = new Set<string>();
    for (const seed of Array.from({ length: 200 }, (_, i) => `oracle-${i}`)) {
      const s = start(seed, "dark_lands");
      const [next, rec] = askOracle(s, { likelihood: null }, cfg);
      const [feat, rngAfter] = rollFeatDie(cfg.dice.feat, s.rng);
      expect(next.rng).toEqual(rngAfter); // exactly one Feat die drawn
      expect(rec.answer.likelihoodKey).toBe(def?.key);
      expect(rec.events).toEqual([
        { kind: "oracle", likelihoodKey: rec.answer.likelihoodKey, featFace: rec.answer.featFace, answer: rec.answer.answer, extreme: rec.answer.extreme },
      ]);
      expect(next.log).toEqual([...s.log, ...rec.events]);
      expect(next.hero).toBe(s.hero); // Eye (and the whole hero) untouched
      expect(next.journey).toBe(s.journey);
      if (feat.isEye) expect([rec.answer.answer, rec.answer.extreme]).toEqual(["no", true]);
      if (feat.isAutoSuccess) expect([rec.answer.answer, rec.answer.extreme]).toEqual(["yes", true]);
      faces.add(String(rec.answer.featFace));
    }
    expect(faces.has("eye")).toBe(true);
    expect(faces.has("gandalf_rune")).toBe(true);
  });

  it("each likelihood key is honoured; allowed while a check is pending (the pending draw is kept)", () => {
    for (const l of cfg.oracles.answers.likelihoods) {
      const [, rec] = askOracle(start("oracle-x", "wild_lands"), { likelihood: l.key }, cfg);
      expect(rec.answer.likelihoodKey).toBe(l.key);
    }
    const p = firstPending("wild_lands");
    const [next] = askOracle(p, { likelihood: "likely" }, cfg);
    expect(next.journey.pending).toBe(p.journey.pending);
    const [, check] = checkBeat(next, { hopeSpend: 0 }, cfg); // the check can still be rolled
    expect(check.scene).toBe(p.journey.pending);
  });

  it("an oracle event in the log does not disturb the next beats (events slice starts after it)", () => {
    const s = start("oracle-y", "wild_lands");
    const [withQ] = askOracle(s, { likelihood: null }, cfg);
    const [t, travel] = travelBeat(withQ, { hopeSpend: 0 }, cfg);
    expect(travel.events).toEqual(t.log.slice(withQ.log.length));
    expect(t.log.slice(0, withQ.log.length)).toEqual(withQ.log);
  });
});
