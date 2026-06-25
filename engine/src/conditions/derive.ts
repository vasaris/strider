import type { CheckConditions } from "../checks/types.js";
import type { FeatModifier } from "../dice/types.js";
import type { HeroState } from "../hero/state.js";
import type { ConditionsConfig } from "./config.js";

/** Total Load = gear weight + journey Iznurenie (vynoslivost: fatigue raises Load). */
export function totalLoad(h: HeroState): number {
  return h.loadGear + h.fatigue;
}

/** Weary when current Endurance <= total Load (conditions.weariness). */
export function isWeary(h: HeroState): boolean {
  return h.endurance.current <= totalLoad(h);
}

/** Miserable when Shadow >= current Hope (conditions.miserable). */
export function isMiserable(h: HeroState): boolean {
  return h.shadow.points >= h.hope.current;
}

/** Overwhelmed when Shadow >= max Hope: all rolls ill-fated (bally_teni). */
export function isOverwhelmed(h: HeroState): boolean {
  return h.shadow.points >= h.hope.max;
}

export function isWounded(h: HeroState): boolean {
  return h.wounded;
}

/** Hero-level Feat modifier: overwhelmed forces ill-favoured on every roll. */
export function heroFeatModifier(h: HeroState): FeatModifier {
  return isOverwhelmed(h) ? "ill_favoured" : "normal";
}

/** Condition modifiers to pass to evaluateCheck (weary voiding + miserable). */
export function checkConditions(h: HeroState, cfg: ConditionsConfig): CheckConditions {
  return { weary: isWeary(h), miserable: isMiserable(h), wearyVoidedFaces: cfg.wearyVoidedFaces };
}
