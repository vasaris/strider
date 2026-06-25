import type { EyeConfig } from "./config.js";
import type { EyeSetup, EyeState } from "./types.js";

/**
 * Initial Eye Awareness rating (kv.solo.eye_of_mordor.initial_rating): base, plus
 * Valour>=4, plus the single culture modifier (high_elf does not stack with the
 * elf/dunedain entry — the caller picks the most specific culture), plus one per
 * famous weapon/armour.
 */
export function initialEyeRating(setup: EyeSetup, cfg: EyeConfig): number {
  if (!Number.isInteger(setup.famousItemCount) || setup.famousItemCount < 0) {
    throw new RangeError(`initialEyeRating: famousItemCount must be a non-negative integer, got ${setup.famousItemCount}`);
  }
  let rating = cfg.initialBase;
  if (setup.valourAtLeast4) rating += cfg.valourModifier;
  if (setup.culture !== "other") rating += cfg.cultureModifier[setup.culture];
  rating += setup.famousItemCount * cfg.famousItemModifier;
  return rating;
}

/** Fresh Eye state with awareness set to the initial rating. */
export function newEyeState(setup: EyeSetup, cfg: EyeConfig): EyeState {
  const rating = initialEyeRating(setup, cfg);
  return { awareness: rating, initial: rating };
}
