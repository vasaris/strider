import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { combatConfigsFromPack } from "../../src/combat/configs.js";
import { applySpecialDamage, deriveSpecialDamageConfig } from "../../src/combat/specialDamage.js";
import type { SpecialDamageContext } from "../../src/combat/specialDamage.js";
import type { AttackConfig } from "../../src/combat/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const pack = loadPack(nodePackSource(packRoot));
const cfgs = combatConfigsFromPack(pack);

const TRIGGER: AttackConfig["piercingTriggerFaces"] = cfgs.attack.piercingTriggerFaces; // { numbers: [10], eye: true }

function ctx(over: Partial<SpecialDamageContext> = {}): SpecialDamageContext {
  return {
    weaponGroup: "swords",
    twoHanded: false,
    strengthRating: 4,
    hasShield: false,
    baseFeatNumber: 5,
    targetAttributeLevel: 2,
    availableIcons: 3,
    piercingTriggerFaces: TRIGGER,
    ...over,
  };
}

// --- config derivation ---

describe("deriveSpecialDamageConfig — numbers read from sovershenie_atak", () => {
  it("reads the parry, feat-bonus, cap, two-handed and shield-thrust numbers", () => {
    const c = cfgs.specialDamage;
    expect(c.heavyBlow.twoHandedBonus).toBe(1);
    expect(c.fendOff.parryByGroup).toEqual({ axes: 1, brawling: 1, swords: 2, spears: 3 });
    expect(c.pierce.featBonusByGroup).toEqual({ swords: 1, bows: 2, spears: 3 });
    expect(c.pierce.cap).toBe(10);
    expect(c.shieldThrust.targetMinusDice).toBe(1);
  });

  it("anti-hardcode: an alternate stub yields alternate numbers (incl. -Nd key parse)", () => {
    const stub = {
      payload: {
        parameters: {
          special_damage: {
            effects: {
              heavy_blow: { effect: { two_handed_bonus: 5 } },
              fend_off: { effect: { parry_modifier_this_round: { axes: 9, swords: 8 } } },
              pierce: { effect: { feat_die_result_bonus: { swords: 4 }, cap: 7 } },
              shield_thrust: { effect: { target_minus_2d_until_round_end: true } },
            },
          },
        },
      },
    };
    const c = deriveSpecialDamageConfig(stub);
    expect(c.heavyBlow.twoHandedBonus).toBe(5);
    expect(c.fendOff.parryByGroup).toEqual({ axes: 9, swords: 8 });
    expect(c.pierce).toEqual({ featBonusByGroup: { swords: 4 }, cap: 7 });
    expect(c.shieldThrust.targetMinusDice).toBe(2);
  });
});

// --- Heavy Blow ---

describe("applySpecialDamage — Heavy Blow extra Endurance = STRENGTH (+1 two-handed)", () => {
  it("one-handed: extra loss equals STRENGTH", () => {
    const r = applySpecialDamage({ heavyBlow: 1 }, ctx({ strengthRating: 4 }), cfgs.specialDamage);
    expect(r.extraEnduranceLoss).toBe(4);
    expect(r.signsSpent).toBe(1);
  });

  it("two-handed adds the configured bonus", () => {
    const r = applySpecialDamage({ heavyBlow: 1 }, ctx({ strengthRating: 4, twoHanded: true }), cfgs.specialDamage);
    expect(r.extraEnduranceLoss).toBe(5); // 4 + 1
  });

  it("spent twice stacks; over budget is rejected", () => {
    const r = applySpecialDamage({ heavyBlow: 2 }, ctx({ strengthRating: 3, availableIcons: 1 }), cfgs.specialDamage);
    expect(r.extraEnduranceLoss).toBe(3); // only one applied
    expect(r.signsSpent).toBe(1);
    expect(r.rejected).toContain("heavy_blow: not enough success signs");
  });
});

// --- Fend Off ---

describe("applySpecialDamage — Fend Off parry by weapon group; bows ineligible", () => {
  it("swords get +2 parry", () => {
    const r = applySpecialDamage({ fendOff: true }, ctx({ weaponGroup: "swords" }), cfgs.specialDamage);
    expect(r.parryBonusThisRound).toBe(2);
  });

  it("spears get +3 parry", () => {
    const r = applySpecialDamage({ fendOff: true }, ctx({ weaponGroup: "spears" }), cfgs.specialDamage);
    expect(r.parryBonusThisRound).toBe(3);
  });

  it("bows are not eligible for Fend Off (ranged)", () => {
    const r = applySpecialDamage({ fendOff: true }, ctx({ weaponGroup: "bows" }), cfgs.specialDamage);
    expect(r.parryBonusThisRound).toBe(0);
    expect(r.rejected).toContain("fend_off: weapon group not eligible");
  });
});

// --- Pierce (Укол) recompute ---

describe("applySpecialDamage — Pierce raises the Feat result (capped) and may trigger Piercing", () => {
  it("swords +1 from a 9 reaches 10 -> Piercing now triggers", () => {
    const r = applySpecialDamage({ pierce: true }, ctx({ weaponGroup: "swords", baseFeatNumber: 9 }), cfgs.specialDamage);
    expect(r.featResultAfterPierce).toBe(10);
    expect(r.piercingNowTriggered).toBe(true);
  });

  it("bows +2 from an 8 reaches 10 -> Piercing now triggers", () => {
    const r = applySpecialDamage({ pierce: true }, ctx({ weaponGroup: "bows", baseFeatNumber: 8 }), cfgs.specialDamage);
    expect(r.featResultAfterPierce).toBe(10);
    expect(r.piercingNowTriggered).toBe(true);
  });

  it("the result is capped (spears +3 from a 9 -> 10, not 12)", () => {
    const r = applySpecialDamage({ pierce: true }, ctx({ weaponGroup: "spears", baseFeatNumber: 9 }), cfgs.specialDamage);
    expect(r.featResultAfterPierce).toBe(10);
  });

  it("below the trigger face: no Piercing (swords +1 from a 5 -> 6)", () => {
    const r = applySpecialDamage({ pierce: true }, ctx({ weaponGroup: "swords", baseFeatNumber: 5 }), cfgs.specialDamage);
    expect(r.featResultAfterPierce).toBe(6);
    expect(r.piercingNowTriggered).toBe(false);
  });

  it("axes are not eligible for Pierce", () => {
    const r = applySpecialDamage({ pierce: true }, ctx({ weaponGroup: "axes", baseFeatNumber: 9 }), cfgs.specialDamage);
    expect(r.rejected).toContain("pierce: weapon group not eligible");
    expect(r.piercingNowTriggered).toBe(false);
  });

  it("on a rune (no numeric base) Pierce cannot create a Piercing blow", () => {
    const r = applySpecialDamage({ pierce: true }, ctx({ weaponGroup: "swords", baseFeatNumber: null }), cfgs.specialDamage);
    expect(r.featResultAfterPierce).toBeNull();
    expect(r.piercingNowTriggered).toBe(false);
    expect(r.signsSpent).toBe(1); // the spend still happens
  });
});

// --- Shield Thrust ---

describe("applySpecialDamage — Shield Thrust needs a shield and STRENGTH above target level", () => {
  it("applies when armed with a shield and stronger than the target", () => {
    const r = applySpecialDamage({ shieldThrust: true }, ctx({ hasShield: true, strengthRating: 4, targetAttributeLevel: 2 }), cfgs.specialDamage);
    expect(r.shieldThrustApplied).toBe(true);
    expect(r.signsSpent).toBe(1);
  });

  it("rejected without a shield", () => {
    const r = applySpecialDamage({ shieldThrust: true }, ctx({ hasShield: false }), cfgs.specialDamage);
    expect(r.shieldThrustApplied).toBe(false);
    expect(r.rejected).toContain("shield_thrust: no shield equipped");
  });

  it("rejected when not stronger than the target", () => {
    const r = applySpecialDamage({ shieldThrust: true }, ctx({ hasShield: true, strengthRating: 2, targetAttributeLevel: 3 }), cfgs.specialDamage);
    expect(r.shieldThrustApplied).toBe(false);
    expect(r.rejected).toContain("shield_thrust: STRENGTH not above target level");
  });
});

// --- multiple effects on multiple signs ---

describe("applySpecialDamage — several signs drive several effects", () => {
  it("heavy blow + fend off + pierce together spend three signs", () => {
    const r = applySpecialDamage(
      { heavyBlow: 1, fendOff: true, pierce: true },
      ctx({ weaponGroup: "swords", strengthRating: 4, baseFeatNumber: 9, availableIcons: 3 }),
      cfgs.specialDamage,
    );
    expect(r.signsSpent).toBe(3);
    expect(r.extraEnduranceLoss).toBe(4);
    expect(r.parryBonusThisRound).toBe(2);
    expect(r.featResultAfterPierce).toBe(10);
    expect(r.piercingNowTriggered).toBe(true);
    expect(r.rejected).toHaveLength(0);
  });
});
