import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { councilConfigFromPack, councilConfigsFromPack, deriveCouncilConfig } from "../../src/council/config.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

/** Minimal raw card stub: only payload.parameters is read by the deriver. */
function card(parameters: unknown): unknown {
  return { payload: { parameters } };
}

describe("councilConfigFromPack — derives the verified council vocabulary", () => {
  const pack = loadPack(nodePackSource(packRoot));
  const cfg = councilConfigFromPack(pack);

  it("derives the three resistance ratings from the pack", () => {
    expect(cfg.resistance).toEqual({ reasonable: 3, bold: 6, audacious: 9 });
  });

  it("derives the introduction durations, parsing the success formula", () => {
    expect(cfg.introduction.durationOnFail).toBe(3);
    expect(cfg.introduction.durationSuccessBase).toBe(4);
    expect(cfg.introduction.durationSuccessPerSign).toBe(1);
    expect(cfg.introduction.usefulSkills).toEqual(["awe", "riddle", "courtesy"]);
  });

  it("derives the negotiations attitude, roleplay and useful skills", () => {
    expect(cfg.negotiations.attitudeModifierDice).toEqual({ cold: -1, neutral: 0, friendly: 1 });
    expect(cfg.negotiations.goodRoleplayBonusDice).toEqual([1, 2]);
    expect(cfg.negotiations.usefulSkills).toEqual(["inspire", "song", "riddle", "insight", "persuade"]);
  });
});

describe("councilConfigsFromPack — bolts on shared check/dice/conditions/skills", () => {
  const pack = loadPack(nodePackSource(packRoot));
  const cfgs = councilConfigsFromPack(pack);

  it("maps every council skill to its governing attribute", () => {
    // Introduction + negotiation skills from the pack, with their categories.
    expect(cfgs.skillAttribute["awe"]).toBe("strength");
    expect(cfgs.skillAttribute["courtesy"]).toBe("heart");
    expect(cfgs.skillAttribute["riddle"]).toBe("wits");
    expect(cfgs.skillAttribute["inspire"]).toBe("heart");
    expect(cfgs.skillAttribute["song"]).toBe("strength");
    expect(cfgs.skillAttribute["insight"]).toBe("heart");
    expect(cfgs.skillAttribute["persuade"]).toBe("wits");
  });

  it("carries the shared check/dice/conditions configs", () => {
    expect(typeof cfgs.check.tnBase).toBe("number");
    expect(cfgs.dice.feat).toBeDefined();
    expect(cfgs.conditions.wearyVoidedFaces.length).toBeGreaterThan(0);
  });
});

describe("anti-hardcode: deriveCouncilConfig reflects card numbers, bakes none", () => {
  // A stub card with deliberately different numbers from the real book.
  const stub = card({
    resistance: { reasonable: 5, bold: 10, audacious: 15 },
    introduction: {
      representative_check: true,
      duration_on_fail: 2,
      duration_on_success: "6 + 2 per success sign",
      useful_skills: ["song", "lore"],
    },
    negotiations: {
      accumulate_successes_to: "resistance",
      attitude_modifier_dice: { cold: -2, neutral: 0, friendly: 2 },
      good_roleplay_bonus_dice: [1, 2, 3],
      useful_skills: ["persuade", "battle"],
    },
  });

  const cfg = deriveCouncilConfig(stub);

  it("uses the stub's resistance ratings, not the book's", () => {
    expect(cfg.resistance).toEqual({ reasonable: 5, bold: 10, audacious: 15 });
  });

  it("uses the stub's introduction numbers and parses its formula", () => {
    expect(cfg.introduction.durationOnFail).toBe(2);
    expect(cfg.introduction.durationSuccessBase).toBe(6);
    expect(cfg.introduction.durationSuccessPerSign).toBe(2);
    expect(cfg.introduction.usefulSkills).toEqual(["song", "lore"]);
  });

  it("uses the stub's attitude modifiers and roleplay set", () => {
    expect(cfg.negotiations.attitudeModifierDice).toEqual({ cold: -2, neutral: 0, friendly: 2 });
    expect(cfg.negotiations.goodRoleplayBonusDice).toEqual([1, 2, 3]);
    expect(cfg.negotiations.usefulSkills).toEqual(["persuade", "battle"]);
  });

  it("fail-fasts on an unparseable duration formula", () => {
    const bad = card({
      resistance: { reasonable: 1, bold: 2, audacious: 3 },
      introduction: { duration_on_fail: 1, duration_on_success: "four plus one", useful_skills: ["awe"] },
      negotiations: {
        attitude_modifier_dice: { cold: -1, neutral: 0, friendly: 1 },
        good_roleplay_bonus_dice: [1],
        useful_skills: ["inspire"],
      },
    });
    expect(() => deriveCouncilConfig(bad)).toThrow(/duration formula/);
  });
});
