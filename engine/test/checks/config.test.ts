import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { deriveCheckConfig } from "../../src/checks/config.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const mech = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(root, "content-packs/kv/mechanics", name), "utf8"));
const solo = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(root, "content-packs/kv/tables/solo", name), "utf8"));

function deriveFromPack() {
  return deriveCheckConfig({
    heroAdjustments: solo("hero_adjustments.json"),
    degreeOfSuccess: mech("checks.degree_of_success.json"),
    specialSuccesses: solo("special_successes.json"),
    riskDegrees: solo("risk_degrees.json"),
    bonusDiceHope: mech("checks.bonus_dice_hope.json"),
    assistance: mech("checks.assistance.json"),
  });
}

describe("deriveCheckConfig from the verified pack", () => {
  it("derives numbers and structure from the pack (no hardcoding in engine)", () => {
    const cfg = deriveFromPack();

    // TN base is the solo 18, sourced from kv.solo.hero_adjustments
    expect(cfg.tnBase).toBe(18);

    // degree tiers: three, minIcons 0/1/2 -> success/great/extraordinary
    expect(cfg.degreeTiers.map((t) => t.minIcons)).toEqual([0, 1, 2]);
    expect(cfg.degreeTiers.map((t) => t.degree)).toEqual([
      "success",
      "great_success",
      "extraordinary_success",
    ]);

    // solo special-success keys (includes gain_advantage, not extra_success)
    expect(cfg.specialSuccesses.map((s) => s.key)).toEqual([
      "learn_something",
      "be_silent",
      "be_swift",
      "widen_influence",
      "gain_advantage",
      "cancel_failure",
    ]);

    // risk degrees + default
    expect(cfg.riskDegrees.map((r) => r.key)).toEqual(["normal", "dangerous", "reckless"]);
    expect(cfg.defaultRisk).toBe("normal");

    // hope / assistance dice economy
    expect(cfg.hopeSpend).toEqual({ cost: 1, gainDice: 1, inspiredGainDice: 2, maxPerRoll: 1 });
    expect(cfg.assistance).toEqual({ cost: 1, gainDice: 1 });

    // labels/failureResult are non-empty pack content (values not asserted here to
    // keep engine/ ASCII; the content layer gate-verifies their exact text)
    for (const r of cfg.riskDegrees) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.failureResult.length).toBeGreaterThan(0);
    }
  });

  it("fails loudly when a required pack number is missing", () => {
    const brokenHA = JSON.parse(
      JSON.stringify(solo("hero_adjustments.json")),
    ) as { payload: Record<string, unknown> };
    delete brokenHA.payload["target_number_base"];
    expect(() =>
      deriveCheckConfig({
        heroAdjustments: brokenHA,
        degreeOfSuccess: mech("checks.degree_of_success.json"),
        specialSuccesses: solo("special_successes.json"),
        riskDegrees: solo("risk_degrees.json"),
        bonusDiceHope: mech("checks.bonus_dice_hope.json"),
        assistance: mech("checks.assistance.json"),
      }),
    ).toThrow();
  });
});
