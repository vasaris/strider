import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import {
  deriveMilestones,
  deriveShadowPaths,
  deriveTrainingCost,
  progressionConfigFromPack,
} from "../../src/progression/config.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

/** Minimal raw rule_card stub: only payload.parameters is read by most derivers. */
function card(parameters: unknown): unknown {
  return { payload: { parameters } };
}
/** Minimal raw lookup_table stub: payload.rows is read directly. */
function table(rows: unknown): unknown {
  return { payload: { rows } };
}

describe("progressionConfigFromPack — derives the verified growth numbers", () => {
  const pack = loadPack(nodePackSource(packRoot));
  const cfg = progressionConfigFromPack(pack);

  it("reads the folio-119 training cost table for skills and valour/wisdom", () => {
    expect(cfg.trainingCost.skillByNewLevel).toEqual({ 1: 4, 2: 8, 3: 12, 4: 20, 5: 26, 6: 30 });
    // Valour/Wisdom have no level-1 row (they start at 1); levels 2..6 only.
    expect(cfg.trainingCost.valourWisdomByNewLevel).toEqual({ 2: 8, 3: 12, 4: 20, 5: 26, 6: 30 });
  });

  it("reads the per-phase caps, parsing 'one_only' for valour-or-wisdom", () => {
    expect(cfg.caps).toEqual({ maxLevelsPerSkill: 1, maxLevelsPerWeaponSkill: 1, valourOrWisdomPerPhase: 1 });
  });

  it("reads which pool buys what", () => {
    expect(cfg.experience.skillPointsBuy).toEqual(["skills"]);
    expect(cfg.experience.adventurePointsBuy).toEqual(["weapon_skills", "valour", "wisdom"]);
  });

  it("loads the solo milestone table (one award per milestone)", () => {
    expect(cfg.milestones).toHaveLength(10);
    expect(cfg.milestones[3]).toMatchObject({ adventurePoints: 0, skillPoints: 2 });
  });

  it("maps every calling to its Shadow Path key", () => {
    expect(cfg.shadowPath.callingToPath["warrior"]).toBe("vengeance");
    expect(cfg.shadowPath.callingToPath["captain"]).toBe("power");
    expect(cfg.shadowPath.callingToPath["scholar"]).toBe("secrets");
    expect(cfg.shadowPath.callingToPath["treasure_hunter"]).toBe("dragon_sickness");
    expect(cfg.shadowPath.callingToPath["warden"]).toBe("despair");
  });

  it("loads four flaws per path and the succumb threshold", () => {
    expect(cfg.shadowPath.pathFlaws["vengeance"]).toHaveLength(4);
    expect(cfg.shadowPath.succumbAfterFlaws).toBe(4);
  });

  it("loads the Reward and Virtue taxonomies and the cultural gate", () => {
    expect(cfg.grants.rewardKeys).toEqual(
      expect.arrayContaining(["fell", "keen", "close_fitting", "grievous", "reinforced", "well_fitted"]),
    );
    expect(cfg.grants.virtueKeys).toEqual(
      expect.arrayContaining(["mastery", "nimbleness", "hardiness", "strong_grip", "confidence", "prowess"]),
    );
    expect(cfg.grants.rewardGainPer).toBe("valour_level");
    expect(cfg.grants.virtueGainPer).toBe("wisdom_level");
    expect(cfg.grants.culturalMinWisdomLevel).toBe(2);
    expect(cfg.grants.culturalVirtueKeysByCulture["hobbits_of_the_shire"]).toEqual(
      expect.arrayContaining(["true_aim"]),
    );
  });

  it("loads the skill and weapon-skill taxonomies", () => {
    expect(cfg.validSkills).toEqual(expect.arrayContaining(["lore", "battle", "awareness"]));
    expect(cfg.validWeaponSkills).toEqual(["spears", "bows", "swords", "axes"]);
  });
});

describe("anti-hardcode: derivers reflect card numbers, bake none", () => {
  it("training cost follows a stub with different numbers", () => {
    const stub = card({
      improve_stats: {
        skills: { spend: "skill_points", max_per_skill_per_phase: 2 },
        growth: { spend: "adventure_points", max_per_weapon_skill_per_phase: 3, valour_or_wisdom_per_phase: 2 },
        training_cost: {
          rows: [
            { new_skill_or_weapon_skill_level: 1, new_valour_or_wisdom_level: null, cost: 5 },
            { new_skill_or_weapon_skill_level: 2, new_valour_or_wisdom_level: 2, cost: 9 },
          ],
        },
      },
    });
    const { trainingCost, caps } = deriveTrainingCost(stub);
    expect(trainingCost.skillByNewLevel).toEqual({ 1: 5, 2: 9 });
    expect(trainingCost.valourWisdomByNewLevel).toEqual({ 2: 9 });
    expect(caps).toEqual({ maxLevelsPerSkill: 2, maxLevelsPerWeaponSkill: 3, valourOrWisdomPerPhase: 2 });
  });

  it("milestones follow a stub table", () => {
    const stub = table([{ milestone: "Stub deed", adventure_points: 7, skill_points: 2 }]);
    const ms = deriveMilestones(stub);
    expect(ms).toEqual([{ milestone: "Stub deed", adventurePoints: 7, skillPoints: 2 }]);
  });

  it("shadow paths follow a stub card", () => {
    const stub = card({
      shadow_paths: { test_path: { flaws: ["A", "B", "C"] } },
      succumbing: { condition: "all_four_flaws_gained" },
    });
    const { pathFlaws, succumbAfterFlaws } = deriveShadowPaths(stub);
    expect(pathFlaws["test_path"]).toEqual(["A", "B", "C"]);
    expect(succumbAfterFlaws).toBe(3);
  });

  it("fail-fasts when valour-or-wisdom cap is an unknown form", () => {
    const stub = card({
      improve_stats: {
        skills: { max_per_skill_per_phase: 1 },
        growth: { max_per_weapon_skill_per_phase: 1, valour_or_wisdom_per_phase: "two_maybe" },
        training_cost: {
          rows: [
            { new_skill_or_weapon_skill_level: 1, new_valour_or_wisdom_level: null, cost: 4 },
            { new_skill_or_weapon_skill_level: 2, new_valour_or_wisdom_level: 2, cost: 8 },
          ],
        },
      },
    });
    expect(() => deriveTrainingCost(stub)).toThrow(/valour-or-wisdom cap/);
  });
});
