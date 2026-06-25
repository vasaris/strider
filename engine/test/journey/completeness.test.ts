import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { journeyConfigsFromPack } from "../../src/journey/config.js";
import { forcedMarchFatigue, journeyDuration, type Route } from "../../src/journey/route.js";
import { removeFatigueAtJourneyEnd } from "../../src/journey/fatigue.js";
import { runDangerZone } from "../../src/journey/danger.js";
import { makeMilestoneState, makeTestHero } from "../../src/cli/scenario.js";
import type { CheckResult } from "../../src/checks/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const pack = loadPack(nodePackSource(packRoot));
const cfg = journeyConfigsFromPack(pack);

function route(overrides: Partial<Route> = {}): Route {
  return {
    totalHexes: 7,
    difficultHexes: 0,
    mounted: false,
    forcedMarch: false,
    mountCarry: 0,
    dangerZones: [],
    region: "wild_lands",
    season: "summer_spring",
    ...overrides,
  };
}

function check(outcome: "success" | "failure", icons: number): CheckResult {
  return { outcome, autoSuccess: false, targetNumber: 14, total: 14, successIcons: icons, degree: null, isEyeOnFeat: false };
}

describe("journey rules config from pack", () => {
  it("reads duration, forced march, and fatigue-removal numbers", () => {
    expect(cfg.rules).toEqual({
      difficultTerrainDayPerHex: 1,
      mountedHalveRoundUp: true,
      forcedMarchHexesPerDay: 2,
      forcedMarchExtraFatiguePerDay: 1,
      endFatigueTravelCheckBase: 1,
      perSafeLongRest: 1,
    });
  });
});

describe("journey duration", () => {
  it("base = hexes + difficult; mounted halves round up; forced march is a fixed pace", () => {
    expect(journeyDuration(route({ totalHexes: 7 }), cfg.rules)).toBe(7);
    expect(journeyDuration(route({ totalHexes: 8, difficultHexes: 2 }), cfg.rules)).toBe(10);
    expect(journeyDuration(route({ totalHexes: 8, mounted: true }), cfg.rules)).toBe(4);
    expect(journeyDuration(route({ totalHexes: 10, difficultHexes: 2, mounted: true }), cfg.rules)).toBe(6); // ceil(12/2)
    expect(journeyDuration(route({ totalHexes: 7, forcedMarch: true }), cfg.rules)).toBe(4); // ceil(7/2)
  });

  it("forced march adds one Fatigue per day", () => {
    expect(forcedMarchFatigue(4, cfg.rules)).toBe(4);
    expect(forcedMarchFatigue(0, cfg.rules)).toBe(0);
  });
});

describe("end-of-journey fatigue removal", () => {
  it("removes mount carry, then travel check (base + per sign), then per safe rest; floored at 0", () => {
    const hero = { ...makeTestHero(cfg), fatigue: 7 };
    const out = removeFatigueAtJourneyEnd(hero, { mountCarry: 2, travelCheck: check("success", 1), safeLongRests: 1 }, cfg.rules);
    expect(out.fatigue).toBe(2); // 7 - (2 + (1+1) + 1)
  });

  it("never goes below 0", () => {
    const hero = { ...makeTestHero(cfg), fatigue: 1 };
    const out = removeFatigueAtJourneyEnd(hero, { mountCarry: 5, travelCheck: check("failure", 0), safeLongRests: 0 }, cfg.rules);
    expect(out.fatigue).toBe(0);
  });
});

describe("danger zone", () => {
  it("plays exactly peril-rating scenes back to back", () => {
    const s0 = makeMilestoneState(cfg, "danger-seed");
    const s1 = runDangerZone(s0, 2, cfg);
    const scenes = s1.log.filter((e) => e.kind === "scene");
    expect(scenes).toHaveLength(2);
    expect(s1.journey.arrived).toBe(false); // a danger zone does not end the journey
  });

  it("a zero-peril zone is a no-op", () => {
    const s0 = makeMilestoneState(cfg, "danger-seed");
    expect(runDangerZone(s0, 0, cfg).log).toHaveLength(0);
  });
});
