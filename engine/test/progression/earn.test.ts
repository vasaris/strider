import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { journeyConfigsFromPack } from "../../src/journey/config.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { earnExperience, progressionConfigFromPack, type ProgressionConfig } from "../../src/progression/index.js";
import { makeTestHero } from "../../src/cli/scenario.js";
import type { HeroState } from "../../src/hero/state.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

let cfg: ProgressionConfig;
let hero: HeroState;

beforeAll(() => {
  const pack = loadPack(nodePackSource(packRoot));
  cfg = progressionConfigFromPack(pack);
  hero = { ...makeTestHero(journeyConfigsFromPack(pack)), experience: { adventurePoints: 0, skillPoints: 0 } };
});

describe("earnExperience — solo milestone awards", () => {
  it("credits the points of a single milestone (an important journey: 0 adv, 2 skill)", () => {
    const [res, h] = earnExperience(hero, [3], cfg);
    expect(res).toEqual({ adventurePointsGained: 0, skillPointsGained: 2, milestones: [cfg.milestones[3]!.milestone] });
    expect(h.experience).toEqual({ adventurePoints: 0, skillPoints: 2 });
  });

  it("sums several milestones into both pools", () => {
    const [res, h] = earnExperience(hero, [3, 1, 2, 8, 5], cfg);
    expect(res.adventurePointsGained).toBe(4);
    expect(res.skillPointsGained).toBe(4);
    expect(h.experience).toEqual({ adventurePoints: 4, skillPoints: 4 });
    expect(h.milestonesReached).toHaveLength(5);
  });

  it("accumulates on top of existing pools and journal", () => {
    const seeded: HeroState = { ...hero, experience: { adventurePoints: 10, skillPoints: 10 }, milestonesReached: ["prior"] };
    const [, h] = earnExperience(seeded, [8], cfg);
    expect(h.experience).toEqual({ adventurePoints: 11, skillPoints: 10 });
    expect(h.milestonesReached).toHaveLength(2);
  });

  it("fails fast on an out-of-range milestone index", () => {
    expect(() => earnExperience(hero, [99], cfg)).toThrow(/out of range/);
  });

  it("an empty milestone list is a no-op on the pools", () => {
    const [res, h] = earnExperience(hero, [], cfg);
    expect(res).toEqual({ adventurePointsGained: 0, skillPointsGained: 0, milestones: [] });
    expect(h.experience).toEqual({ adventurePoints: 0, skillPoints: 0 });
  });
});
