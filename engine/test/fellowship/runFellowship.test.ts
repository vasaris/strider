import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { makeFellowshipHero } from "../../src/cli/fellowshipScenario.js";
import { fellowshipConfigFromPack } from "../../src/fellowship/config.js";
import { runFellowship } from "../../src/fellowship/runFellowship.js";
import type { FellowshipConfig, FellowshipInput } from "../../src/fellowship/types.js";
import type { HeroState } from "../../src/hero/state.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { progressionConfigFromPack } from "../../src/progression/config.js";
import type { ProgressionConfig } from "../../src/progression/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

let fcfg: FellowshipConfig;
let pcfg: ProgressionConfig;
let hero: HeroState; // warrior, heart 5, wits 3, hope 1/3, shadow 3/1, exp 8/4

beforeAll(() => {
  const pack = loadPack(nodePackSource(packRoot));
  fcfg = fellowshipConfigFromPack(pack);
  pcfg = progressionConfigFromPack(pack);
  hero = makeFellowshipHero(pack);
});

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

describe("runFellowship — full Yule pass", () => {
  it("recovers, applies Yule, improves stats and records undertakings", () => {
    const [r, h] = runFellowship(
      hero,
      input({
        isYule: true,
        duration: "yule",
        place: "rivendell",
        shadowReductionTier: "active",
        undertakings: ["write_song", "change_useful_items"],
        progression: {
          milestoneIndices: [],
          spendPlan: { items: [{ kind: "valour", toLevel: 2, grantRewardKey: "fell" }] },
          boutsOfMadness: 0,
        },
      }),
      fcfg,
      pcfg,
    );
    expect(r.recovery).toEqual({ hopeRestored: 2, yuleFullHope: true, shadowRemoved: 2 });
    expect(r.yule).toEqual({ bonusSkillPoints: 3, agedYears: 1 });
    expect(r.progression.spend.grants).toEqual([{ kind: "reward", key: "fell" }]);
    expect(r.undertakingsChosen).toEqual(["write_song", "change_useful_items"]);
    expect(h.hope.current).toBe(3);
    expect(h.shadow.points).toBe(1);
    expect(h.valour).toBe(2);
    expect(h.experience).toEqual({ adventurePoints: 0, skillPoints: 7 }); // 4 +3 yule, valour paid in adv
  });
});

describe("runFellowship — ordering", () => {
  it("credits the Yule bonus skill points BEFORE the improve-stats spend", () => {
    // skillPoints 1 alone cannot afford Lore 0->1 (cost 4); the Yule bonus (wits 3)
    // makes exactly 4. A successful spend proves the bonus landed before the spend.
    const tight = { ...hero, experience: { adventurePoints: 0, skillPoints: 1 } };
    const [r, h] = runFellowship(
      tight,
      input({
        isYule: true,
        duration: "yule",
        progression: {
          milestoneIndices: [],
          spendPlan: { items: [{ kind: "skill", id: "lore", toRating: 1 }] },
          boutsOfMadness: 0,
        },
      }),
      fcfg,
      pcfg,
    );
    expect(r.progression.spend.skillPointsSpent).toBe(4);
    expect(h.skills["lore"]).toBe(1);
    expect(h.experience).toEqual({ adventurePoints: 0, skillPoints: 0 });
  });
});

describe("runFellowship — normal phase and guards", () => {
  it("a normal phase has no Yule result and restores Hope by HEART", () => {
    const [r, h] = runFellowship(hero, input({ duration: "a_season", undertakings: ["change_useful_items"] }), fcfg, pcfg);
    expect(r.yule).toBeNull();
    expect(r.recovery.yuleFullHope).toBe(false);
    expect(r.recovery.hopeRestored).toBe(2); // hope 1 -> clamp 3 (+2)
    expect(h.hope.current).toBe(3);
  });

  it("rejects a Yule phase that does not use the longest duration", () => {
    expect(() => runFellowship(hero, input({ isYule: true, duration: "one_week" }), fcfg, pcfg)).toThrow(/longest/);
  });

  it("rejects an empty place", () => {
    expect(() => runFellowship(hero, input({ place: "" }), fcfg, pcfg)).toThrow(/place/);
  });

  it("fails fast on a bad undertaking before mutating the hero", () => {
    expect(() => runFellowship(hero, input({ undertakings: ["heal_scars"] }), fcfg, pcfg)).toThrow(/Yule-only/);
  });
});
