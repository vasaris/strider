import type { CheckConfig } from "../../src/checks/config.js";
import type { DiceRoll, FeatDieResult, SuccessDieResult } from "../../src/dice/types.js";

/**
 * Canonical KV CheckConfig with ASCII placeholder labels. Engine math depends on
 * numbers and ASCII keys only; the real (Cyrillic) labels live in the pack and
 * are checked structurally by the deriveCheckConfig integration test.
 */
export const KV_CHECKS: CheckConfig = {
  tnBase: 18,
  degreeTiers: [
    { minIcons: 0, degree: "success", label: "success" },
    { minIcons: 1, degree: "great_success", label: "great success" },
    { minIcons: 2, degree: "extraordinary_success", label: "extraordinary success" },
  ],
  specialSuccesses: [
    { key: "learn_something", label: "learn something" },
    { key: "be_silent", label: "be silent" },
    { key: "be_swift", label: "be swift" },
    { key: "widen_influence", label: "widen influence" },
    { key: "gain_advantage", label: "gain advantage" },
    { key: "cancel_failure", label: "cancel failure" },
  ],
  riskDegrees: [
    { key: "normal", label: "ordinary", failureResult: "simple failure or success with complication" },
    { key: "dangerous", label: "dangerous", failureResult: "failure with complication" },
    { key: "reckless", label: "reckless", failureResult: "catastrophe" },
  ],
  defaultRisk: "normal",
  hopeSpend: { cost: 1, gainDice: 1, inspiredGainDice: 2, maxPerRoll: 1 },
  assistance: { cost: 1, gainDice: 1 },
};

/** Different tnBase to prove the formula is not hardcoded. */
export const ALT_CHECKS: CheckConfig = { ...KV_CHECKS, tnBase: 20 };

// --- DiceRoll builders (deterministic, no RNG) ---

export function featNumber(value: number): FeatDieResult {
  return { physicalFace: value, face: { kind: "number", value }, numericValue: value, isEye: false, isAutoSuccess: false };
}
export const FEAT_EYE: FeatDieResult = {
  physicalFace: 11,
  face: { kind: "eye" },
  numericValue: 0,
  isEye: true,
  isAutoSuccess: false,
};
export const FEAT_GANDALF: FeatDieResult = {
  physicalFace: 12,
  face: { kind: "gandalf_rune" },
  numericValue: 0,
  isEye: false,
  isAutoSuccess: true,
};

export function successDie(face: number): SuccessDieResult {
  return { face, isSuccessIcon: face === 6 };
}

export function makeRoll(feat: FeatDieResult, successFaces: number[]): DiceRoll {
  return {
    feat,
    featCandidates: [feat],
    featModifier: "normal",
    successDice: successFaces.map(successDie),
    successDiceCount: successFaces.length,
  };
}
