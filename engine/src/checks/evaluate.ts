import type { DiceRoll } from "../dice/types.js";
import type { CheckConfig } from "./config.js";
import type { CheckResult, SuccessDegree } from "./types.js";

/** Map success-icon count to a degree using the pack-derived tiers. */
export function degreeFromIcons(icons: number, cfg: CheckConfig): SuccessDegree {
  let chosen: SuccessDegree | null = null;
  for (const tier of cfg.degreeTiers) {
    if (icons >= tier.minIcons) chosen = tier.degree;
  }
  if (chosen === null) {
    throw new Error(`degreeFromIcons: no tier matches ${icons} icons (tiers must start at 0)`);
  }
  return chosen;
}

/**
 * Evaluate an already-rolled DiceRoll against a target number.
 *
 * - Gandalf rune (feat.isAutoSuccess) -> success regardless of the sum
 *   (checks.feat_die_values); the sum is not consulted.
 * - Otherwise total = feat.numericValue (Eye contributes 0) + sum of Success
 *   die faces; success iff total >= TN (checks.procedure).
 * - Degree comes from the count of success icons (checks.degree_of_success);
 *   it is reported on a success, null on a failure.
 *
 * Pure: no RNG, deterministic in its inputs.
 */
export function evaluateCheck(roll: DiceRoll, tn: number, cfg: CheckConfig): CheckResult {
  const successIcons = roll.successDice.reduce((acc, d) => acc + (d.isSuccessIcon ? 1 : 0), 0);
  const isEyeOnFeat = roll.feat.isEye;

  if (roll.feat.isAutoSuccess) {
    return {
      outcome: "success",
      autoSuccess: true,
      targetNumber: tn,
      total: null,
      successIcons,
      degree: degreeFromIcons(successIcons, cfg),
      isEyeOnFeat,
    };
  }

  const successSum = roll.successDice.reduce((acc, d) => acc + d.face, 0);
  const total = roll.feat.numericValue + successSum;
  const outcome = total >= tn ? "success" : "failure";

  return {
    outcome,
    autoSuccess: false,
    targetNumber: tn,
    total,
    successIcons,
    degree: outcome === "success" ? degreeFromIcons(successIcons, cfg) : null,
    isEyeOnFeat,
  };
}
