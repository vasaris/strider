import type { EyeConfig } from "./config.js";
import type { EyeRegion, EyeState } from "./types.js";

/**
 * Effective pursuit threshold: the region base plus the situational modifiers the
 * caller decides apply (kv.solo.eye_of_mordor.pursuit_thresholds/modifiers).
 */
export function pursuitThreshold(region: EyeRegion, appliedModifiers: readonly number[], cfg: EyeConfig): number {
  const base = cfg.pursuitThresholds[region];
  if (base === undefined) throw new Error(`pursuitThreshold: unknown region "${region}"`);
  return appliedModifiers.reduce((acc, m) => acc + m, base);
}

/**
 * Detection fires by direct comparison (kv.mechanics.solo.sceny_obnaruzheniya:
 * "the rating reaches the pursuit threshold") — no roll. The detection scene
 * itself is rolled on kv.solo.detection_scenes via the Oracles feat-event handler.
 */
export function isDetected(awareness: number, threshold: number): boolean {
  return awareness >= threshold;
}

/** Reset awareness to the initial rating (after a detection scene / new phase). */
export function resetEye(eye: EyeState): EyeState {
  return { ...eye, awareness: eye.initial };
}
