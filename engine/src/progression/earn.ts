/**
 * Experience earning: the solo model awards points per milestone reached, from
 * the verified solo table (kv.solo.milestones), not the group "3 per session"
 * rule. The structured result of an adventure is the list of milestone indices
 * reached across its scenes (the "one milestone per scene" constraint is the
 * caller's: the scene picks which single milestone applies). Pure and RNG-free.
 */

import type { HeroState } from "../hero/state.js";
import type { EarnResult, ProgressionConfig } from "./types.js";

function pools(h: HeroState): { adventurePoints: number; skillPoints: number } {
  return h.experience ?? { adventurePoints: 0, skillPoints: 0 };
}

/**
 * Apply the reached milestones to the hero's experience pools. Each index points
 * into `cfg.milestones`; an out-of-range index is a programming error and
 * fails fast. Returns the points gained and the updated hero (pools credited,
 * milestone labels appended to the journal as opaque display values).
 */
export function earnExperience(
  hero: HeroState,
  milestoneIndices: readonly number[],
  cfg: ProgressionConfig,
): [EarnResult, HeroState] {
  let adventurePointsGained = 0;
  let skillPointsGained = 0;
  const labels: string[] = [];

  for (const idx of milestoneIndices) {
    const award = cfg.milestones[idx];
    if (award === undefined) {
      throw new Error(`progression earn: milestone index ${idx} out of range (0..${cfg.milestones.length - 1})`);
    }
    adventurePointsGained += award.adventurePoints;
    skillPointsGained += award.skillPoints;
    labels.push(award.milestone);
  }

  const base = pools(hero);
  const hero2: HeroState = {
    ...hero,
    experience: {
      adventurePoints: base.adventurePoints + adventurePointsGained,
      skillPoints: base.skillPoints + skillPointsGained,
    },
    milestonesReached: [...(hero.milestonesReached ?? []), ...labels],
  };

  return [{ adventurePointsGained, skillPointsGained, milestones: labels }, hero2];
}
