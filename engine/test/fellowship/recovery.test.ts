import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { makeFellowshipHero } from "../../src/cli/fellowshipScenario.js";
import { fellowshipConfigFromPack } from "../../src/fellowship/config.js";
import { applySpiritualRecovery } from "../../src/fellowship/recovery.js";
import type { FellowshipConfig, FellowshipInput } from "../../src/fellowship/types.js";
import type { HeroState } from "../../src/hero/state.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

let cfg: FellowshipConfig;
let hero: HeroState; // heart 5, wits 3, hope 1/3, shadow points 3 scars 1

beforeAll(() => {
  const pack = loadPack(nodePackSource(packRoot));
  cfg = fellowshipConfigFromPack(pack);
  hero = makeFellowshipHero(pack);
});

/** A Fellowship input with only the recovery-relevant fields meaningfully set. */
function input(over: Partial<FellowshipInput>): FellowshipInput {
  return {
    isYule: false,
    duration: "one_week",
    place: "bree",
    shadowReductionTier: null,
    undertakings: [],
    progression: { milestoneIndices: [], spendPlan: { items: [] }, boutsOfMadness: 0 },
    ...over,
  };
}

describe("applySpiritualRecovery — Hope", () => {
  it("restores Hope by the HEART rating in a normal phase, clamped to max", () => {
    const low = { ...hero, hope: { current: 0, max: 5 } }; // heart 5 -> +5 = 5
    const [r, h] = applySpiritualRecovery(low, input({}), cfg);
    expect(r.hopeRestored).toBe(5);
    expect(r.yuleFullHope).toBe(false);
    expect(h.hope.current).toBe(5);
  });

  it("clamps the HEART restore at the maximum", () => {
    const near = { ...hero, hope: { current: 2, max: 3 } }; // heart 5 -> clamp to 3 (+1)
    const [r, h] = applySpiritualRecovery(near, input({}), cfg);
    expect(r.hopeRestored).toBe(1);
    expect(h.hope.current).toBe(3);
  });

  it("restores Hope fully during Yule", () => {
    const low = { ...hero, hope: { current: 1, max: 3 } };
    const [r, h] = applySpiritualRecovery(low, input({ isYule: true, duration: "yule" }), cfg);
    expect(r.yuleFullHope).toBe(true);
    expect(r.hopeRestored).toBe(2);
    expect(h.hope.current).toBe(3);
  });
});

describe("applySpiritualRecovery — Shadow", () => {
  it("removes nothing when no success tier is claimed", () => {
    const [r, h] = applySpiritualRecovery(hero, input({ shadowReductionTier: null }), cfg);
    expect(r.shadowRemoved).toBe(0);
    expect(h.shadow.points).toBe(hero.shadow.points);
  });

  it("removes the 'active' tier amount (2) from the verified pack", () => {
    const [r, h] = applySpiritualRecovery(hero, input({ shadowReductionTier: "active" }), cfg);
    expect(r.shadowRemoved).toBe(2);
    expect(h.shadow.points).toBe(1); // 3 -> 1
    expect(h.shadow.scars).toBe(1); // scars untouched
  });

  it("never drives Shadow points below zero", () => {
    const lowShadow = { ...hero, shadow: { points: 1, scars: 0 } };
    const [r, h] = applySpiritualRecovery(lowShadow, input({ shadowReductionTier: "great_deeds" }), cfg); // would remove 3
    expect(r.shadowRemoved).toBe(1);
    expect(h.shadow.points).toBe(0);
  });

  it("throws on an unknown deed tier", () => {
    expect(() => applySpiritualRecovery(hero, input({ shadowReductionTier: "legendary" }), cfg)).toThrow(/tier/);
  });
});

describe("applySpiritualRecovery — anti-hardcode", () => {
  it("removes the amount the config gives, not a baked 1/2/3", () => {
    // A config where 'active' maps to 4 (and the solo amounts allow it).
    const stub: FellowshipConfig = {
      ...cfg,
      recovery: {
        ...cfg.recovery,
        shadowReductionTiers: { active: 4 },
        soloShadowAmounts: [4],
      },
    };
    const big = { ...hero, shadow: { points: 9, scars: 0 } };
    const [r, h] = applySpiritualRecovery(big, input({ shadowReductionTier: "active" }), stub);
    expect(r.shadowRemoved).toBe(4);
    expect(h.shadow.points).toBe(5);
  });

  it("rejects a tier amount missing from the solo table (cross-check)", () => {
    const stub: FellowshipConfig = {
      ...cfg,
      recovery: { ...cfg.recovery, shadowReductionTiers: { active: 7 }, soloShadowAmounts: [1, 2, 3] },
    };
    expect(() => applySpiritualRecovery(hero, input({ shadowReductionTier: "active" }), stub)).toThrow(/solo/);
  });
});
