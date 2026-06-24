import type { CheckConfig } from "./config.js";

/**
 * Target Number = tnBase - attribute rating (checks.target_numbers, solo
 * variant). tnBase comes from the pack (kv.solo.hero_adjustments), so this
 * function holds no book number.
 */
export function targetNumber(attributeRating: number, cfg: CheckConfig): number {
  if (!Number.isInteger(attributeRating) || attributeRating < 0) {
    throw new RangeError(`targetNumber: attributeRating must be a non-negative integer, got ${attributeRating}`);
  }
  return cfg.tnBase - attributeRating;
}
