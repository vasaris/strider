import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { journeyConfigsFromPack } from "../../src/journey/config.js";
import { applyEffect, applyEffects, fatigueWaived } from "../../src/journey/effects.js";
import type { JourneyState } from "../../src/journey/state.js";
import { makeRng } from "../../src/rng/rng.js";
import { newEyeState } from "../../src/eye/initial.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const pack = loadPack(nodePackSource(packRoot));
const cfg = journeyConfigsFromPack(pack);

function baseState(): JourneyState {
  return {
    hero: {
      attributes: { strength: 4, heart: 5, wits: 3 },
      skills: { travel: 2, exploration: 2, awareness: 1, hunting: 1 },
      hope: { current: 2, max: 3 },
      shadow: { points: 0 },
      fatigue: 0,
      eye: newEyeState({ valourAtLeast4: false, culture: "other", famousItemCount: 0 }, cfg.eye),
      inspired: true,
      wounded: false,
    },
    journey: { totalHexes: 5, remainingHexes: 5, region: "wild_lands", season: "summer_spring", daysElapsed: 0, arrived: false },
    rng: makeRng("u"),
    log: [],
  };
}

describe("journey config from pack", () => {
  it("parses 7 scene rows, biases, detail tables, skill->attribute", () => {
    expect(cfg.scenes.rows).toHaveLength(7);
    expect(cfg.scenes.bias).toEqual({ border_lands: "favoured", wild_lands: "plain", dark_lands: "ill_favoured" });
    expect(cfg.detailTables.size).toBe(7);
    expect(cfg.skillAttribute["travel"]).toBe("heart");
    expect(cfg.skillAttribute["exploration"]).toBe("wits");
    expect(cfg.skillAttribute["awareness"]).toBe("strength");
    expect(cfg.skillAttribute["hunting"]).toBe("strength");
  });
});

describe("effect interpreter", () => {
  it("hope clamps to [0, max]", () => {
    const s = applyEffect(baseState(), { op: "hope_points", value: 5 }, cfg);
    expect(s.hero.hope.current).toBe(3); // clamped at max
    const t = applyEffect(baseState(), { op: "hope_delta", value: -5 }, cfg);
    expect(t.hero.hope.current).toBe(0);
  });

  it("shadow_points raises Shadow AND Eye (out of combat cross-trigger)", () => {
    const s = applyEffect(baseState(), { op: "shadow_points", value: 2, kind: "fear" }, cfg);
    expect(s.hero.shadow.points).toBe(2);
    expect(s.hero.eye.awareness).toBe(2); // shadow gained out of combat -> +2 Eye
  });

  it("fatigue, journey days, wound, eye delta route correctly", () => {
    let s = applyEffects(
      baseState(),
      [
        { op: "fatigue_points", value: 2 },
        { op: "journey_days_delta", value: 1 },
        { op: "wound" },
        { op: "eye_awareness_delta", value: 3 },
      ],
      cfg,
    );
    expect(s.hero.fatigue).toBe(2);
    expect(s.journey.daysElapsed).toBe(1);
    expect(s.hero.wounded).toBe(true);
    expect(s.hero.eye.awareness).toBe(3);
  });

  it("fatigue_waived is detected and is a state no-op", () => {
    expect(fatigueWaived([{ op: "fatigue_waived" }])).toBe(true);
    expect(fatigueWaived([{ op: "hope_points", value: 1 }])).toBe(false);
    const s = applyEffect(baseState(), { op: "fatigue_waived" }, cfg);
    expect(s).toEqual(baseState());
  });

  it("unknown ops are ignored (subsystems not yet wired)", () => {
    const s = applyEffect(baseState(), { op: "parry_delta", value: 1 }, cfg);
    expect(s).toEqual(baseState());
  });
});
