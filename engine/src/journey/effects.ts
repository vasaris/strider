import { applyEyeAwarenessDelta, growthFromShadowGain } from "../eye/growth.js";
import { gainShadow } from "../conditions/shadow.js";
import type { Effect } from "../oracles/types.js";
import type { JourneyConfigs } from "./config.js";
import type { JourneyState } from "./state.js";

function intValue(effect: Effect, op: string): number {
  const v = (effect as { value?: unknown }).value;
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new Error(`applyEffect: op "${op}" requires an integer value`);
  }
  return v;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Eye growth from a shadow_points effect of value v (out of combat: +N for N gained). */
function shadowEyeGain(v: number, cfg: JourneyConfigs): number {
  return growthFromShadowGain(Math.max(0, v), false, cfg.eye);
}

/**
 * Total Eye growth the shadow_points effects in `effects` cause when applied (the same
 * per-effect amount applyEffect adds). Reported as the "shadow" Eye source of a beat.
 */
export function shadowEyeGrowth(effects: readonly Effect[], cfg: JourneyConfigs): number {
  return effects.reduce((acc, e) => (e.op === "shadow_points" ? acc + shadowEyeGain(intValue(e, "shadow_points"), cfg) : acc), 0);
}

/**
 * Apply a single effect, routing its op to the right state slice. The journey is
 * out of combat throughout (milestone), so a Shadow gain also raises Eye
 * Awareness (kv.solo.eye_of_mordor: shadow points gained out of combat -> +N).
 * `fatigue_waived` is a scene-level signal and is a no-op here.
 */
export function applyEffect(state: JourneyState, effect: Effect, cfg: JourneyConfigs): JourneyState {
  const { hero, journey } = state;
  switch (effect.op) {
    case "hope_points":
    case "hope_delta": {
      const v = intValue(effect, effect.op);
      return { ...state, hero: { ...hero, hope: { ...hero.hope, current: clamp(hero.hope.current + v, 0, hero.hope.max) } } };
    }
    case "shadow_points": {
      const v = intValue(effect, "shadow_points");
      const withShadow = gainShadow(hero, v); // caps at max Hope, preserves scars
      const eye = applyEyeAwarenessDelta(withShadow.eye, shadowEyeGain(v, cfg));
      return { ...state, hero: { ...withShadow, eye } };
    }
    case "fatigue_points": {
      const v = intValue(effect, "fatigue_points");
      return { ...state, hero: { ...hero, fatigue: Math.max(0, hero.fatigue + v) } };
    }
    case "journey_days_delta": {
      const v = intValue(effect, "journey_days_delta");
      return { ...state, journey: { ...journey, durationDays: Math.max(0, journey.durationDays + v) } };
    }
    case "wound":
      return { ...state, hero: { ...hero, wounded: true } };
    case "eye_awareness_delta": {
      const v = intValue(effect, "eye_awareness_delta");
      return { ...state, hero: { ...hero, eye: applyEyeAwarenessDelta(hero.eye, v) } };
    }
    case "fatigue_waived":
      return state; // handled where scene fatigue is applied
    default:
      // Ops belonging to subsystems not yet wired (e.g. wondrous items) are ignored.
      return state;
  }
}

export function applyEffects(state: JourneyState, effects: readonly Effect[], cfg: JourneyConfigs): JourneyState {
  return effects.reduce((s, e) => applyEffect(s, e, cfg), state);
}

/** Whether a fatigue_waived effect is present (scene fatigue is then skipped). */
export function fatigueWaived(effects: readonly Effect[]): boolean {
  return effects.some((e) => e.op === "fatigue_waived");
}
