import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { journeyConfigsFromPack } from "../../src/journey/config.js";
import { runJourney } from "../../src/journey/run.js";
import { makeMilestoneState } from "../../src/cli/scenario.js";
import { runMilestoneJourney } from "../../src/cli/journey.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

const GOLDEN_SEED = "dark-1";

describe("Stage 1 milestone: CLI journey playthrough", () => {
  const pack = loadPack(nodePackSource(packRoot));
  const cfg = journeyConfigsFromPack(pack);

  it("always arrives and reports a coherent final state", () => {
    const final = runJourney(makeMilestoneState(cfg, GOLDEN_SEED), cfg);
    expect(final.journey.arrived).toBe(true);
    expect(final.journey.remainingHexes).toBe(0);
    expect(final.hero.fatigue).toBeGreaterThanOrEqual(0);
    expect(final.hero.eye.awareness).toBeGreaterThanOrEqual(0);
    expect(final.log[final.log.length - 1]?.kind).toBe("arrival");
  });

  it("is reproducible: same seed -> identical final state and transcript", () => {
    const a = runJourney(makeMilestoneState(cfg, GOLDEN_SEED), cfg);
    const b = runJourney(makeMilestoneState(cfg, GOLDEN_SEED), cfg);
    expect({ hero: a.hero, journey: a.journey, log: a.log }).toEqual({ hero: b.hero, journey: b.journey, log: b.log });
  });

  it("a different seed yields a different but valid run", () => {
    const a = runJourney(makeMilestoneState(cfg, GOLDEN_SEED), cfg);
    const c = runJourney(makeMilestoneState(cfg, "other-seed"), cfg);
    expect(c.journey.arrived).toBe(true);
    expect(a.log).not.toEqual(c.log);
  });

  it("exercises the integrated subsystems (shadow -> eye, effects, fatigue)", () => {
    const r = runMilestoneJourney(packRoot, GOLDEN_SEED);
    expect(r.arrived).toBe(true);
    // shadow gained out of combat must have grown the Eye by at least as much
    expect(r.hero.eyeAwareness).toBeGreaterThanOrEqual(r.hero.shadow);
    expect(r.hero.fatigue).toBeGreaterThan(0);
  });

  it("golden: fixed seed -> fixed report", () => {
    const r = runMilestoneJourney(packRoot, GOLDEN_SEED);
    expect({
      arrived: r.arrived,
      daysElapsed: r.daysElapsed,
      hero: r.hero,
      sceneTypes: r.log.filter((e) => e.kind === "scene").map((e) => (e as { sceneType: string }).sceneType),
      eventKinds: r.log.map((e) => e.kind),
    }).toMatchInlineSnapshot(`
      {
        "arrived": true,
        "daysElapsed": 8,
        "eventKinds": [
          "travel_check",
          "scene",
          "travel_check",
          "scene",
          "travel_check",
          "scene",
          "travel_check",
          "arrival",
        ],
        "hero": {
          "eyeAwareness": 4,
          "fatigue": 7,
          "hope": 3,
          "shadow": 3,
          "wounded": false,
        },
        "sceneTypes": [
          "despair",
          "bad_choice",
          "mishap",
        ],
      }
    `);
  });
});
