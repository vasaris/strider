import type { Effect } from "../oracles/types.js";
import type { EyeConfig } from "./config.js";
import type { EyeState } from "./types.js";

const EYE_AWARENESS_DELTA = "eye_awareness_delta";

/** +1 (config) when the Feat die showed the Eye out of combat; 0 in combat. */
export function growthFromFeatDie(isEyeOnFeat: boolean, inCombat: boolean, cfg: EyeConfig): number {
  return isEyeOnFeat && !inCombat ? cfg.growth.eyeOnFeatOutOfCombat : 0;
}

/** +N when N Shadow points are gained out of combat; 0 in combat. */
export function growthFromShadowGain(points: number, inCombat: boolean, cfg: EyeConfig): number {
  if (!Number.isInteger(points) || points < 0) {
    throw new RangeError(`growthFromShadowGain: points must be a non-negative integer, got ${points}`);
  }
  if (!cfg.growth.shadowPerPoint) return 0;
  return inCombat ? 0 : points;
}

/** Apply an awareness change, clamped at a floor of zero. */
export function applyEyeAwarenessDelta(eye: EyeState, value: number): EyeState {
  if (!Number.isInteger(value)) throw new RangeError(`applyEyeAwarenessDelta: value must be an integer, got ${value}`);
  return { ...eye, awareness: Math.max(0, eye.awareness + value) };
}

/**
 * Apply only the eye_awareness_delta effects from a list; other ops belong to
 * other subsystems and are ignored here (the Journey integrator routes effects).
 */
export function applyEyeEffects(eye: EyeState, effects: readonly Effect[]): EyeState {
  let next = eye;
  for (const effect of effects) {
    if (effect.op !== EYE_AWARENESS_DELTA) continue;
    const value = (effect as { value?: unknown }).value;
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new Error(`applyEyeEffects: ${EYE_AWARENESS_DELTA} requires an integer value`);
    }
    next = applyEyeAwarenessDelta(next, value);
  }
  return next;
}
