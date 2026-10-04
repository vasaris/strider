import type { DiceRoll } from "../dice/types.js";
import type { CheckConfig } from "./config.js";
import type { CheckConditions, CheckResult, SuccessDegree } from "./types.js";

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
 * Per-Success-die "counted in the total" flags, index-aligned with `roll.successDice`:
 * false when the hero is weary and the face is listed in `wearyVoidedFaces`
 * (conditions.weariness), true otherwise. This is the ONE place that decides which
 * Success die faces enter the sum -- evaluateCheck forms its total from it, and the
 * journey side record (CheckRoll.successCounted) exposes the same flags to the UI, so a
 * consumer never re-derives the weariness rule. The success icon is unaffected.
 *
 * Throws when `weary` is set without `wearyVoidedFaces` (the caller supplies them from
 * ConditionsConfig; no book numbers baked here). Pure: no RNG.
 */
export function successDiceCounted(roll: DiceRoll, conditions?: CheckConditions): readonly boolean[] {
  const weary = conditions?.weary === true;
  if (weary && conditions?.wearyVoidedFaces === undefined) {
    throw new Error("evaluateCheck: weary requires wearyVoidedFaces (from ConditionsConfig)");
  }
  const voided = conditions?.wearyVoidedFaces ?? [];
  return roll.successDice.map((d) => !(weary && voided.includes(d.face)));
}

/**
 * Evaluate an already-rolled DiceRoll against a target number.
 *
 * - Gandalf rune (feat.isAutoSuccess) -> success regardless of the sum
 *   (checks.feat_die_values); the sum is not consulted.
 * - Miserable + Eye on the Feat die -> failure regardless of the sum
 *   (conditions.miserable); the rune still wins over this.
 * - Otherwise total = feat.numericValue (Eye contributes 0) + sum of Success
 *   die faces; success iff total >= TN (checks.procedure). When weary, Success
 *   die faces listed in `wearyVoidedFaces` contribute 0 (conditions.weariness;
 *   decided by successDiceCounted, the shared source of the per-die flags);
 *   the success icon (and thus degree) is unaffected.
 *
 * Pure: no RNG, deterministic in its inputs.
 */
export function evaluateCheck(
  roll: DiceRoll,
  tn: number,
  cfg: CheckConfig,
  conditions?: CheckConditions,
): CheckResult {
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

  const counted = successDiceCounted(roll, conditions);
  const successSum = roll.successDice.reduce((acc, d, i) => acc + (counted[i] === true ? d.face : 0), 0);
  const total = roll.feat.numericValue + successSum;

  const miserableFailure = conditions?.miserable === true && isEyeOnFeat;
  const outcome = miserableFailure ? "failure" : total >= tn ? "success" : "failure";

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
