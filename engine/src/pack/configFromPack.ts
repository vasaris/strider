import { type DiceConfig, deriveDiceConfig } from "../dice/config.js";
import { type CheckConfig, deriveCheckConfig } from "../checks/config.js";
import type { Pack } from "./pack.js";

/** Build the DiceConfig from a loaded, verified pack. */
export function diceConfigFromPack(pack: Pack): DiceConfig {
  return deriveDiceConfig({
    diceSet: pack.requireById("kv.mechanics.checks.dice_set").raw,
    featDieValues: pack.requireById("kv.mechanics.checks.feat_die_values").raw,
    successDieValues: pack.requireById("kv.mechanics.checks.success_die_values").raw,
    procedure: pack.requireById("kv.mechanics.checks.procedure").raw,
    favouredIllFavoured: pack.requireById("kv.mechanics.checks.favoured_ill_favoured").raw,
  });
}

/** Build the CheckConfig from a loaded, verified pack. */
export function checkConfigFromPack(pack: Pack): CheckConfig {
  return deriveCheckConfig({
    heroAdjustments: pack.requireById("kv.solo.hero_adjustments").raw,
    degreeOfSuccess: pack.requireById("kv.mechanics.checks.degree_of_success").raw,
    specialSuccesses: pack.requireById("kv.solo.special_successes").raw,
    riskDegrees: pack.requireById("kv.solo.risk_degrees").raw,
    bonusDiceHope: pack.requireById("kv.mechanics.checks.bonus_dice_hope").raw,
    assistance: pack.requireById("kv.mechanics.checks.assistance").raw,
  });
}
