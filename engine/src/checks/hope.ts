import type { CheckConfig } from "./config.js";

/**
 * Hope spend for bonus Success dice (checks.bonus_dice_hope).
 *
 * Spending 1 Hope yields +gainDice; an inspired hero yields +inspiredGainDice
 * (the Wanderer counts as inspired on journey skill checks). At most maxPerRoll
 * Hope may be spent per roll, and never more than the hero currently has.
 *
 * Hope resolution (KNOWN_ISSUES OPEN -> resolved): there is a single Hope pool.
 * The effect ops `hope_delta` (lifepaths) and `hope_points` (solo tables) are
 * two names for the same operation (adjust current Hope by an integer); the
 * effect interpreter aliases both to a single adjust. This function performs the
 * spend side of that single pool.
 */
export interface HopeSpendInput {
  readonly hopeCurrent: number;
  readonly spend: 0 | 1;
  readonly inspired: boolean;
}

export interface HopeSpendResult {
  readonly bonusSuccessDice: number;
  /** Patch for the hero Hope slice after the spend. */
  readonly hopePatch: { readonly current: number };
}

export function spendHopeForDice(input: HopeSpendInput, cfg: CheckConfig): HopeSpendResult {
  const { hopeCurrent, spend, inspired } = input;
  if (!Number.isInteger(hopeCurrent) || hopeCurrent < 0) {
    throw new RangeError(`spendHopeForDice: hopeCurrent must be a non-negative integer, got ${hopeCurrent}`);
  }
  if (spend !== 0 && spend !== 1) {
    throw new RangeError(`spendHopeForDice: spend must be 0 or 1, got ${spend}`);
  }
  if (spend > cfg.hopeSpend.maxPerRoll) {
    throw new RangeError(`spendHopeForDice: spend ${spend} exceeds maxPerRoll ${cfg.hopeSpend.maxPerRoll}`);
  }

  const actualSpend = Math.min(spend, hopeCurrent); // cannot spend Hope you do not have
  const bonusSuccessDice =
    actualSpend === 0 ? 0 : inspired ? cfg.hopeSpend.inspiredGainDice : cfg.hopeSpend.gainDice;

  return {
    bonusSuccessDice,
    hopePatch: { current: hopeCurrent - actualSpend },
  };
}
