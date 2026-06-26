/**
 * A fixed progression scenario for the Stage-1 milestone: a warrior Wanderer
 * finishes an adventure having reached a set of solo milestones, spends the
 * earned experience on one skill and one weapon-skill, and suffers a single bout
 * of madness that advances their calling's Shadow Path. Mirror of
 * councilScenario.ts / combatScenario.ts. Deterministic: the same pack yields
 * the same growth (progression rolls no dice). The hero is hand-built on top of
 * the journey Wanderer (the lifepath-driven creation economy is Stage 4).
 */

import type { HeroState } from "../hero/state.js";
import { journeyConfigsFromPack } from "../journey/config.js";
import type { Pack } from "../pack/pack.js";
import { progressionConfigFromPack } from "../progression/config.js";
import type { ProgressionConfig, ProgressionInput } from "../progression/types.js";
import { makeTestHero } from "./scenario.js";

/** The journey Wanderer, given a calling and culture and empty experience pools. */
export function makeProgressionHero(pack: Pack): HeroState {
  const hero = makeTestHero(journeyConfigsFromPack(pack));
  return {
    ...hero,
    calling: "warrior",
    culture: "bardings",
    valour: 1,
    wisdom: 1,
    weaponSkills: {},
    experience: { adventurePoints: 0, skillPoints: 0 },
  };
}

/**
 * The milestone progression: the adventure reached "complete an important
 * journey" (2 skill points), two patron-task milestones (1 of each), a
 * dangerous battle and an important find (1 adventure point each) -- 4 adventure
 * and 4 skill points, exactly what the plan spends. The plan raises Lore from 0
 * to 1 (4 skill points) and the Bows weapon-skill from 0 to 1 (4 adventure
 * points). One bout of madness then advances the warrior's Shadow Path.
 */
export const PROGRESSION_INPUT: ProgressionInput = {
  milestoneIndices: [3, 1, 2, 8, 5],
  spendPlan: {
    items: [
      { kind: "skill", id: "lore", toRating: 1 },
      { kind: "weaponSkill", id: "bows", toRating: 1 },
    ],
  },
  boutsOfMadness: 1,
};

export interface ProgressionScenario {
  readonly hero: HeroState;
  readonly input: ProgressionInput;
  readonly cfg: ProgressionConfig;
}

/** Build the milestone progression scenario from the pack. */
export function makeProgressionScenario(pack: Pack): ProgressionScenario {
  return {
    hero: makeProgressionHero(pack),
    input: PROGRESSION_INPUT,
    cfg: progressionConfigFromPack(pack),
  };
}
