import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateCheck } from "../../src/checks/evaluate.js";
import {
  boutOfMadness,
  braceSpirit,
  checkConditions,
  deriveConditionsConfig,
  gainShadow,
  heroFeatModifier,
  isMiserable,
  isOverwhelmed,
  isUnconscious,
  isWeary,
  loseEndurance,
  recoverLongRest,
  recoverShortRest,
  resolveShadowReduction,
  totalLoad,
} from "../../src/conditions/index.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { newEyeState } from "../../src/eye/initial.js";
import { eyeConfigFromPack } from "../../src/eye/fromPack.js";
import { checkConfigFromPack } from "../../src/pack/configFromPack.js";
import type { HeroState } from "../../src/hero/state.js";
import type { DiceRoll, FeatDieResult, SuccessDieResult } from "../../src/dice/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const pack = loadPack(nodePackSource(packRoot));
const condCfg = deriveConditionsConfig(pack);
const checkCfg = checkConfigFromPack(pack);
const eyeCfg = eyeConfigFromPack(pack);

function hero(overrides: Partial<HeroState> = {}): HeroState {
  return {
    attributes: { strength: 3, heart: 4, wits: 2 },
    skills: {},
    endurance: { current: 20, max: 20 },
    loadGear: 0,
    fatigue: 0,
    hope: { current: 3, max: 5 },
    shadow: { points: 0, scars: 0 },
    eye: newEyeState({ valourAtLeast4: false, culture: "other", famousItemCount: 0 }, eyeCfg),
    inspired: false,
    wounded: false,
    ...overrides,
  };
}

function feat(featFace: "eye" | "gandalf_rune" | number): FeatDieResult {
  if (featFace === "eye") return { physicalFace: 11, face: { kind: "eye" }, numericValue: 0, isEye: true, isAutoSuccess: false };
  if (featFace === "gandalf_rune") return { physicalFace: 12, face: { kind: "gandalf_rune" }, numericValue: 0, isEye: false, isAutoSuccess: true };
  return { physicalFace: featFace, face: { kind: "number", value: featFace }, numericValue: featFace, isEye: false, isAutoSuccess: false };
}

// Build a DiceRoll directly so evaluation is tested without RNG.
function rollWith(featFace: "eye" | "gandalf_rune" | number, successFaces: number[]): DiceRoll {
  const f = feat(featFace);
  const successDice: SuccessDieResult[] = successFaces.map((s) => ({ face: s, isSuccessIcon: s === 6 }));
  return { feat: f, featCandidates: [f], featModifier: "normal", successDice, successDiceCount: successDice.length };
}

describe("conditions config from pack", () => {
  it("reads weary voided faces, shadow cap, recover magnitude", () => {
    expect(condCfg.wearyVoidedFaces).toEqual([1, 2, 3]);
    expect(condCfg.shadowCapsAtMaxHope).toBe(true);
    expect(condCfg.zeroEnduranceRecover).toBe(1);
  });
});

describe("derived conditions", () => {
  it("weary at the boundary: endurance <= total load", () => {
    expect(isWeary(hero({ endurance: { current: 5, max: 20 }, loadGear: 3, fatigue: 2 }))).toBe(true); // 5 <= 5
    expect(isWeary(hero({ endurance: { current: 6, max: 20 }, loadGear: 3, fatigue: 2 }))).toBe(false); // 6 > 5
    expect(totalLoad(hero({ loadGear: 4, fatigue: 3 }))).toBe(7);
  });

  it("miserable at shadow >= current hope; overwhelmed at shadow >= max hope", () => {
    expect(isMiserable(hero({ shadow: { points: 3, scars: 0 }, hope: { current: 3, max: 5 } }))).toBe(true);
    expect(isMiserable(hero({ shadow: { points: 2, scars: 0 }, hope: { current: 3, max: 5 } }))).toBe(false);
    expect(isOverwhelmed(hero({ shadow: { points: 5, scars: 0 }, hope: { current: 3, max: 5 } }))).toBe(true);
    expect(isOverwhelmed(hero({ shadow: { points: 4, scars: 0 }, hope: { current: 3, max: 5 } }))).toBe(false);
  });

  it("overwhelmed forces an ill-favoured Feat die", () => {
    expect(heroFeatModifier(hero({ shadow: { points: 5, scars: 0 }, hope: { current: 3, max: 5 } }))).toBe("ill_favoured");
    expect(heroFeatModifier(hero())).toBe("normal");
  });
});

describe("evaluateCheck with conditions", () => {
  it("weary voids Success faces 1/2/3 in the sum; icon and degree unaffected", () => {
    // feat 5 + success [2,6,3] = base sum 11; weary voids 2 and 3 -> 5 + 6 = 11? no: 5 + (0+6+0)=11
    const roll = rollWith(5, [2, 6, 3]);
    const plain = evaluateCheck(roll, 12, checkCfg);
    expect(plain.total).toBe(5 + 2 + 6 + 3); // 16
    const weary = evaluateCheck(roll, 12, checkCfg, { weary: true, wearyVoidedFaces: condCfg.wearyVoidedFaces });
    expect(weary.total).toBe(5 + 6); // 11; faces 2 and 3 voided
    expect(weary.successIcons).toBe(plain.successIcons); // icon on 6 unaffected
  });

  it("weary requires voided faces to be supplied", () => {
    expect(() => evaluateCheck(rollWith(5, [2]), 6, checkCfg, { weary: true })).toThrow(/wearyVoidedFaces/);
  });

  it("miserable: Eye on the Feat die forces failure regardless of sum", () => {
    const roll = rollWith("eye", [6, 6, 6]); // big sum but Eye
    const plain = evaluateCheck(roll, 5, checkCfg);
    expect(plain.outcome).toBe("success"); // 0 + 18 >= 5
    const miserable = evaluateCheck(roll, 5, checkCfg, { miserable: true });
    expect(miserable.outcome).toBe("failure");
  });

  it("the Gandalf rune still auto-succeeds even when miserable", () => {
    const r = evaluateCheck(rollWith("gandalf_rune", [1]), 99, checkCfg, { miserable: true });
    expect(r.outcome).toBe("success");
    expect(r.autoSuccess).toBe(true);
  });

  it("checkConditions reflects hero state", () => {
    const c = checkConditions(hero({ shadow: { points: 3, scars: 0 }, hope: { current: 3, max: 5 } }), condCfg);
    expect(c).toEqual({ weary: false, miserable: true, wearyVoidedFaces: [1, 2, 3] });
  });
});

describe("shadow mechanics", () => {
  it("gainShadow caps at max Hope and keeps scars", () => {
    const h = gainShadow(hero({ hope: { current: 3, max: 5 }, shadow: { points: 4, scars: 1 } }), 10);
    expect(h.shadow.points).toBe(5);
    expect(h.shadow.scars).toBe(1);
  });

  it("resolveShadowReduction: -1 and -1 per sign on success only", () => {
    const success2 = { outcome: "success", successIcons: 2 } as never;
    expect(resolveShadowReduction(4, success2)).toBe(1); // 4 - (1+2)
    const fail = { outcome: "failure", successIcons: 0 } as never;
    expect(resolveShadowReduction(4, fail)).toBe(4);
    expect(resolveShadowReduction(1, success2)).toBe(0); // floored
  });

  it("braceSpirit trades all points for one scar only while shadow < max", () => {
    const ok = braceSpirit(hero({ hope: { current: 3, max: 5 }, shadow: { points: 4, scars: 0 } }));
    expect(ok.shadow).toEqual({ points: 0, scars: 1 });
    const blocked = hero({ hope: { current: 3, max: 5 }, shadow: { points: 5, scars: 0 } });
    expect(braceSpirit(blocked)).toBe(blocked); // unavailable at max
  });

  it("boutOfMadness clears points and flags Shadow Path advance", () => {
    const r = boutOfMadness(hero({ shadow: { points: 5, scars: 2 }, hope: { current: 3, max: 5 } }));
    expect(r.hero.shadow).toEqual({ points: 0, scars: 2 });
    expect(r.advancesShadowPath).toBe(true);
  });
});

describe("endurance", () => {
  it("loseEndurance floors at 0; unconscious at 0", () => {
    const h = loseEndurance(hero({ endurance: { current: 3, max: 20 } }), 10);
    expect(h.endurance.current).toBe(0);
    expect(isUnconscious(h)).toBe(true);
  });

  it("short rest recovers STRENGTH (0 if wounded); long rest recovers all (STRENGTH if wounded)", () => {
    const low = { endurance: { current: 2, max: 20 } } as const;
    expect(recoverShortRest(hero({ ...low, attributes: { strength: 3, heart: 4, wits: 2 } })).endurance.current).toBe(5);
    expect(recoverShortRest(hero({ ...low, wounded: true })).endurance.current).toBe(2); // wounded -> 0 recovered
    expect(recoverLongRest(hero({ ...low })).endurance.current).toBe(20); // all
    expect(recoverLongRest(hero({ ...low, wounded: true })).endurance.current).toBe(5); // strength
  });
});
