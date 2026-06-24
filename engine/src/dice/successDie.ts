import { type Rng, rollDie } from "../rng/rng.js";
import type { SuccessDieConfig } from "./config.js";
import type { SuccessDieResult } from "./types.js";

/** Roll one Success die. */
export function rollSuccessDie(cfg: SuccessDieConfig, rng: Rng): readonly [SuccessDieResult, Rng] {
  const [face, next] = rollDie(cfg.sides, rng);
  return [{ face, isSuccessIcon: face === cfg.successIconFace }, next] as const;
}

export interface SuccessDiceCountInput {
  /** Base Success dice = ability rating (checks.procedure); 0 -> feat die only. */
  readonly abilityRating: number;
  /** Sum of all bonus Success dice already resolved by the caller (Hope, etc.). */
  readonly bonus: number;
  /** Sum of all penalty Success dice already resolved by the caller. */
  readonly penalty: number;
}

/**
 * Final Success-dice count.
 *
 * checks.bonus_penalty_stacking: add all bonuses, then subtract all penalties.
 * checks.penalty_dice: the floor is zero Success dice.
 * checks.procedure: base equals the ability rating (rating 0 -> 0 Success dice).
 *
 * Note on the open Hope question (KNOWN_ISSUES hope_delta vs hope_points): it
 * does NOT surface here. This subsystem receives `bonus`/`penalty` as already
 * resolved integers; spending Hope and decrementing it belong to Checks/state.
 */
export function resolveSuccessDiceCount(input: SuccessDiceCountInput): number {
  const { abilityRating, bonus, penalty } = input;
  if (!Number.isInteger(abilityRating) || abilityRating < 0) {
    throw new RangeError(`resolveSuccessDiceCount: abilityRating must be a non-negative integer, got ${abilityRating}`);
  }
  if (!Number.isInteger(bonus) || bonus < 0) {
    throw new RangeError(`resolveSuccessDiceCount: bonus must be a non-negative integer, got ${bonus}`);
  }
  if (!Number.isInteger(penalty) || penalty < 0) {
    throw new RangeError(`resolveSuccessDiceCount: penalty must be a non-negative integer, got ${penalty}`);
  }
  const withBonuses = abilityRating + bonus;
  const afterPenalties = withBonuses - penalty;
  return Math.max(0, afterPenalties);
}

/** Roll `count` Success dice, threading the RNG. */
export function rollSuccessDice(
  cfg: SuccessDieConfig,
  count: number,
  rng: Rng,
): readonly [SuccessDieResult[], Rng] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`rollSuccessDice: count must be a non-negative integer, got ${count}`);
  }
  const out: SuccessDieResult[] = [];
  let cur = rng;
  for (let i = 0; i < count; i++) {
    const [r, next] = rollSuccessDie(cfg, cur);
    out.push(r);
    cur = next;
  }
  return [out, cur] as const;
}
