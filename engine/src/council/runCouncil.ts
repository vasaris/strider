/**
 * Drive a whole council end to end: open it, run the introduction, then run
 * negotiation attempts until either the resistance is met (no reason to keep
 * talking) or the attempts run out, and classify the result. Returns the
 * threaded RNG so a caller can continue the seeded stream afterwards (mirror of
 * runCombat). Pure: the tactics come from the injected CouncilPolicy, all
 * randomness from the engine.
 *
 * There is no oracle roll here -- a council is decided entirely on skill checks,
 * so unlike a fight this driver needs no answers table.
 */

import type { HeroState } from "../hero/state.js";
import type { Rng } from "../rng/rng.js";
import type { CouncilConfigs } from "./config.js";
import { runNegotiationRound } from "./negotiation.js";
import { fail } from "./parse.js";
import { resolveCouncil } from "./resolve.js";
import { runIntroduction, startCouncil } from "./start.js";
import type { CouncilEvent, CouncilPolicy, CouncilResistanceKey, CouncilResult, CouncilState, CouncilAttitude } from "./types.js";

export interface CouncilSetup {
  readonly resistanceKey: CouncilResistanceKey;
  readonly attitude: CouncilAttitude;
}

/** Engineering guard against a non-terminating loop. NOT a rule literal. */
export const MAX_COUNCIL_ATTEMPTS = 100;

export function runCouncil(
  hero: HeroState,
  setup: CouncilSetup,
  policy: CouncilPolicy,
  cfgs: CouncilConfigs,
  rng: Rng,
): readonly [CouncilResult, Rng] {
  const events: CouncilEvent[] = [];
  let state: CouncilState = startCouncil(hero, setup.resistanceKey, setup.attitude, cfgs.council);
  let rngCur = rng;

  // --- introduction: sets the duration ---
  const [afterIntro, introEvent, rngIntro] = runIntroduction(state, policy.planIntroduction(state, cfgs), cfgs, rngCur);
  events.push(introEvent);
  state = afterIntro;
  rngCur = rngIntro;

  const duration = state.duration;
  if (duration === null) fail("runCouncil: introduction left duration unset");

  // --- negotiations: up to `duration` attempts, stop early on reaching resistance ---
  let guard = 0;
  while (state.attemptsUsed < duration && state.accumulated < state.resistance) {
    if (guard >= MAX_COUNCIL_ATTEMPTS) fail("runCouncil: attempt guard exceeded");
    guard += 1;
    const [afterRound, roundEvent, rngRound] = runNegotiationRound(
      state,
      policy.planNegotiationRound(state, cfgs),
      cfgs,
      rngCur,
    );
    events.push(roundEvent);
    state = afterRound;
    rngCur = rngRound;
  }

  return [resolveCouncil(state, events, policy), rngCur] as const;
}
