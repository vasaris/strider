import type { CheckResult } from "../checks/types.js";
import type { HeroState } from "../hero/state.js";

/**
 * Add Shadow points, capped at the maximum Hope rating (bally_teni). Negative
 * input is treated as 0 (use a resist check first to reduce the amount).
 */
export function gainShadow(h: HeroState, points: number): HeroState {
  const added = Math.max(0, points);
  const capped = Math.min(h.hope.max, h.shadow.points + added);
  return { ...h, shadow: { ...h.shadow, points: capped } };
}

/**
 * Net Shadow gained after a successful resist check (VALOUR or WISDOM): the
 * amount is reduced by 1, and by a further 1 per success icon (bally_teni). A
 * failed resist reduces nothing. Never below 0.
 */
export function resolveShadowReduction(gained: number, resist: CheckResult): number {
  if (resist.outcome !== "success") return Math.max(0, gained);
  const reduction = 1 + resist.successIcons;
  return Math.max(0, gained - reduction);
}

/**
 * Brace the spirit (bally_teni): available only while Shadow < max Hope. Removes
 * all current Shadow points at the cost of one permanent Shadow scar. Returns
 * the hero unchanged if not available.
 */
export function braceSpirit(h: HeroState): HeroState {
  if (h.shadow.points >= h.hope.max) return h;
  return { ...h, shadow: { points: 0, scars: h.shadow.scars + 1 } };
}

export interface MadnessResult {
  readonly hero: HeroState;
  /** The hero advances one step on their Shadow Path (resolved in Progression). */
  readonly advancesShadowPath: true;
}

/**
 * A bout of madness (bezumie): the only escape from being overwhelmed. Erases
 * current Shadow points (scars remain) and flags one step of Shadow Path
 * advancement, which the Progression subsystem applies.
 */
export function boutOfMadness(h: HeroState): MadnessResult {
  return { hero: { ...h, shadow: { ...h.shadow, points: 0 } }, advancesShadowPath: true };
}
