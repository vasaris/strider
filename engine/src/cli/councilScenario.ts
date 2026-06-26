/**
 * A fixed council scenario for the Stage-1 milestone: the test Wanderer asks a
 * reasonable favour of a neutral audience, leading the introduction with
 * Courtesy and pressing the negotiation with Inspire. Mirror of
 * combatScenario.ts (combat) / scenario.ts (journey). Deterministic: the same
 * seed and pack yield the same council. The hero is hand-built (the equipment
 * and advancement economy is Stage 4) on top of the journey Wanderer, given a
 * spread of social skills so the checks are meaningful.
 */

import { councilConfigsFromPack, type CouncilConfigs } from "../council/config.js";
import type {
  CouncilConfigsLike,
  CouncilIntroPlan,
  CouncilNegotiationPlan,
  CouncilPolicy,
  CouncilState,
} from "../council/index.js";
import type { CouncilSetup } from "../council/runCouncil.js";
import type { HeroState } from "../hero/state.js";
import { journeyConfigsFromPack } from "../journey/config.js";
import type { Pack } from "../pack/pack.js";
import { makeRng, type Rng } from "../rng/rng.js";
import { makeTestHero } from "./scenario.js";

/** The journey Wanderer, equipped for council with a spread of social skills. */
export function makeCouncilHero(pack: Pack): HeroState {
  const hero = makeTestHero(journeyConfigsFromPack(pack));
  return {
    ...hero,
    skills: {
      ...hero.skills,
      courtesy: 2,
      inspire: 2,
      persuade: 1,
      riddle: 1,
      song: 1,
      insight: 1,
      awe: 1,
    },
  };
}

/** The milestone council: a reasonable request before a neutral audience. */
export const COUNCIL_SETUP: CouncilSetup = { resistanceKey: "reasonable", attitude: "neutral" };

/**
 * The minimal deterministic policy: lead the introduction with Courtesy (the
 * hero's best Heart skill), press every negotiation with Inspire, claim no
 * roleplay bonus, and walk away with a refusal rather than a price if short.
 * No RNG -- pure tactics, as the seam requires.
 */
export const minimalPolicy: CouncilPolicy = {
  planIntroduction: (_state: CouncilState, _cfgs: CouncilConfigsLike): CouncilIntroPlan => ({ skill: "courtesy" }),
  planNegotiationRound: (_state: CouncilState, _cfgs: CouncilConfigsLike): CouncilNegotiationPlan => ({
    skill: "inspire",
    roleplayBonusDice: 0,
  }),
  acceptPriceOnShortfall: false,
};

export interface CouncilScenario {
  readonly hero: HeroState;
  readonly setup: CouncilSetup;
  readonly cfgs: CouncilConfigs;
  readonly rng: Rng;
}

/** Build the milestone council, seeded. */
export function makeCouncilScenario(pack: Pack, seed: number | string): CouncilScenario {
  return {
    hero: makeCouncilHero(pack),
    setup: COUNCIL_SETUP,
    cfgs: councilConfigsFromPack(pack),
    rng: makeRng(seed),
  };
}
