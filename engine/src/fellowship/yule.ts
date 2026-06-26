/**
 * Yule extras, applied only on a Yule Fellowship Phase. Beyond the full Hope
 * restore (handled in recovery), Yule grants bonus skill points equal to the
 * WITS rating -- credited to the experience pool BEFORE the improve-stats step
 * spends it -- and ages every hero by one year. The WITS rating is read off the
 * hero; aging years come from the verified pack. The hero carries no age field
 * yet (the creation/age economy is Stage 4), so aging is returned as a recorded
 * count rather than mutating state. Pure and RNG-free.
 */

import type { HeroState } from "../hero/state.js";
import type { FellowshipConfig, YuleResult } from "./types.js";

export function applyYule(hero: HeroState, cfg: FellowshipConfig): [YuleResult, HeroState] {
  const bonusSkillPoints = hero.attributes.wits; // bonus_skill_points = "wits_rating"
  const base = hero.experience ?? { adventurePoints: 0, skillPoints: 0 };
  const hero2: HeroState = {
    ...hero,
    experience: {
      adventurePoints: base.adventurePoints,
      skillPoints: base.skillPoints + bonusSkillPoints,
    },
  };
  return [{ bonusSkillPoints, agedYears: cfg.yule.agingYears }, hero2];
}
