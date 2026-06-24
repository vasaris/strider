import type { DiceConfig } from "../../src/dice/config.js";

/** Canonical KV dice config. Literals live in the test, never in engine math. */
export const KV_DICE: DiceConfig = {
  feat: {
    sides: 12,
    eyeFace: 11,
    gandalfRuneFace: 12,
    eyeNumericValue: 0,
    normalDiceCount: 1,
    modifiedDiceCount: 2,
  },
  success: {
    sides: 6,
    successIconFace: 6,
  },
};

/**
 * A deliberately different, non-KV config. If any engine math hardcodes 12/11/6
 * it will misbehave under this config; tests assert it respects these instead.
 */
export const ALT_DICE: DiceConfig = {
  feat: {
    sides: 10,
    eyeFace: 9,
    gandalfRuneFace: 10,
    eyeNumericValue: 0,
    normalDiceCount: 1,
    modifiedDiceCount: 2,
  },
  success: {
    sides: 8,
    successIconFace: 8,
  },
};
