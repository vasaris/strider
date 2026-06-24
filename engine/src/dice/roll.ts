import type { Rng } from "../rng/rng.js";
import type { DiceConfig } from "./config.js";
import { rollFeatWithModifier } from "./featDie.js";
import { resolveSuccessDiceCount, rollSuccessDice } from "./successDie.js";
import type { DiceRoll, FeatModifier } from "./types.js";

export interface CheckDiceSpec {
  /** Base Success dice = ability rating (0..6 in KV; 0 -> feat die only). */
  readonly abilityRating: number;
  readonly featModifier: FeatModifier;
  /** Pre-summed bonus Success dice (Hope, assistance, ...). */
  readonly bonusSuccessDice: number;
  /** Pre-summed penalty Success dice. */
  readonly penaltySuccessDice: number;
}

/**
 * Full check-level dice roll: pick the Feat die under its modifier, resolve the
 * Success-dice count, roll them, and report faces. No target number, no degree,
 * no success/failure — those belong to the Checks subsystem.
 */
export function rollCheckDice(
  cfg: DiceConfig,
  spec: CheckDiceSpec,
  rng: Rng,
): readonly [DiceRoll, Rng] {
  const [{ chosen, candidates }, rng1] = rollFeatWithModifier(cfg.feat, spec.featModifier, rng);
  const successDiceCount = resolveSuccessDiceCount({
    abilityRating: spec.abilityRating,
    bonus: spec.bonusSuccessDice,
    penalty: spec.penaltySuccessDice,
  });
  const [successDice, rng2] = rollSuccessDice(cfg.success, successDiceCount, rng1);
  const roll: DiceRoll = {
    feat: chosen,
    featCandidates: candidates,
    featModifier: spec.featModifier,
    successDice,
    successDiceCount,
  };
  return [roll, rng2] as const;
}
