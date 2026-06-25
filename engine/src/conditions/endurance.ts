import type { HeroState } from "../hero/state.js";
import type { ConditionsConfig } from "./config.js";

/** Lose Endurance, floored at 0 (vynoslivost). */
export function loseEndurance(h: HeroState, n: number): HeroState {
  const current = Math.max(0, h.endurance.current - Math.max(0, n));
  return { ...h, endurance: { ...h.endurance, current } };
}

/** At 0 Endurance the hero is unconscious (vynoslivost). */
export function isUnconscious(h: HeroState): boolean {
  return h.endurance.current === 0;
}

function strengthRating(h: HeroState): number {
  return h.attributes.strength;
}

function raise(h: HeroState, by: number): HeroState {
  const current = Math.min(h.endurance.max, h.endurance.current + Math.max(0, by));
  return { ...h, endurance: { ...h.endurance, current } };
}

/** Short rest (>=1h): recover STRENGTH rating; a wounded hero recovers 0. */
export function recoverShortRest(h: HeroState): HeroState {
  return raise(h, h.wounded ? 0 : strengthRating(h));
}

/** Long rest: recover all Endurance; a wounded hero recovers STRENGTH rating. */
export function recoverLongRest(h: HeroState): HeroState {
  return h.wounded ? raise(h, strengthRating(h)) : { ...h, endurance: { ...h.endurance, current: h.endurance.max } };
}

/** Wake from unconsciousness after the rest interval: regain the configured amount if not wounded. */
export function wakeFromUnconscious(h: HeroState, cfg: ConditionsConfig): HeroState {
  if (h.endurance.current > 0 || h.wounded) return h;
  return raise(h, cfg.zeroEnduranceRecover);
}
