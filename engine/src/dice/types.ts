/**
 * Result shapes produced by the dice subsystem.
 *
 * Boundary note: this subsystem rolls dice and reports faces only. It does NOT
 * compute target numbers, success/failure, degrees, or special successes — that
 * is the Checks subsystem. The DiceRoll carries enough provenance (both feat
 * candidates, final success-die set) for higher layers and for transcripts.
 */

/** Which modifier governs the Feat die roll. */
export type FeatModifier = "normal" | "favoured" | "ill_favoured";

/** The face shown by a single Feat die. */
export type FeatDieFace =
  | { readonly kind: "number"; readonly value: number } // 1..(sides-2)
  | { readonly kind: "eye" } // worst possible result; contributes eyeNumericValue
  | { readonly kind: "gandalf_rune" }; // best possible result; automatic success

export interface FeatDieResult {
  /** Physical face index in [1, sides]. */
  readonly physicalFace: number;
  /** Semantic face. */
  readonly face: FeatDieFace;
  /**
   * Additive contribution if this die is summed. Numbers contribute their
   * value; the eye contributes eyeNumericValue (0 in KV). For the Gandalf rune
   * the sum is never consulted — isAutoSuccess short-circuits the comparison —
   * so this is left at 0 and must not be read without checking isAutoSuccess.
   */
  readonly numericValue: number;
  readonly isEye: boolean;
  readonly isAutoSuccess: boolean; // Gandalf rune
}

export interface SuccessDieResult {
  /** Face in [1, sides]. */
  readonly face: number;
  /** True when the face carries the success icon (Elvish 1). */
  readonly isSuccessIcon: boolean;
}

export interface DiceRoll {
  /** The Feat die kept after applying the modifier. */
  readonly feat: FeatDieResult;
  /** Every Feat die rolled (1 for normal, modifiedDiceCount for fav/ill). */
  readonly featCandidates: readonly FeatDieResult[];
  readonly featModifier: FeatModifier;
  /** Final Success dice actually rolled, after bonuses and penalties. */
  readonly successDice: readonly SuccessDieResult[];
  readonly successDiceCount: number;
}
