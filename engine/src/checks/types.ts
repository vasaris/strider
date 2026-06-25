/**
 * Checks subsystem result types.
 *
 * Boundary: this subsystem turns an already-rolled DiceRoll (from the Dice
 * subsystem) into a check outcome against a target number. It does NOT roll
 * dice (no RNG here) and does NOT determine the risk degree when uncertain —
 * that escalation uses the answers oracle (Oracles subsystem) and is wired in
 * later; until then the risk degree is an input.
 */

export type SuccessDegree = "success" | "great_success" | "extraordinary_success";
export type RiskDegree = "normal" | "dangerous" | "reckless";
export type CheckOutcome = "success" | "failure";

/** Icon-count threshold -> degree. Built from checks.degree_of_success. */
export interface DegreeTier {
  readonly minIcons: number;
  readonly degree: SuccessDegree;
  /** Display label, verbatim from the pack (opaque content; not branched on). */
  readonly label: string;
}

/** One risk degree and the shape of its failure, from kv.solo.risk_degrees. */
export interface RiskDegreeSpec {
  readonly key: RiskDegree;
  /** Display label, opaque pack content. */
  readonly label: string;
  /** Failure-result text, opaque pack content for the narrative layer. */
  readonly failureResult: string;
}

/** A spendable special success. Key is engine vocabulary; label is pack content. */
export interface SpecialSuccessOption {
  readonly key: string;
  readonly label: string;
}

export interface CheckResult {
  readonly outcome: CheckOutcome;
  /** True when success came from the Gandalf rune; then `total` is not consulted. */
  readonly autoSuccess: boolean;
  readonly targetNumber: number;
  /** Sum of Feat numeric value + Success die faces; null on auto-success. */
  readonly total: number | null;
  /** Count of success icons among the rolled Success dice. */
  readonly successIcons: number;
  /** Degree on a success; null on a failure. */
  readonly degree: SuccessDegree | null;
  /** Feat die showed the Eye — hook for out-of-combat Eye growth (Eye subsystem). */
  readonly isEyeOnFeat: boolean;
}

/**
 * Optional condition modifiers applied during evaluation (Conditions subsystem).
 * Omitted -> no condition affects the check (backward compatible).
 *  - weary: Success die faces in `wearyVoidedFaces` contribute 0 to the sum.
 *  - miserable: an Eye on the Feat die forces failure regardless of the sum.
 * `wearyVoidedFaces` is supplied by the caller from ConditionsConfig so this
 * subsystem never bakes book numbers; it is required when `weary` is true.
 */
export interface CheckConditions {
  readonly weary?: boolean;
  readonly miserable?: boolean;
  readonly wearyVoidedFaces?: readonly number[];
}
