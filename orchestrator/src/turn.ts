// One live turn of the journey loop (arch sec 5): engine step -> turn projection -> package.
//
// This is the live wiring of extractTurn noted in HANDOFF_STAGE3 sec 5: the engine advances the
// journey by one step (stepJourney), the turn-producer projects it (extractTurn), and the
// provider assembles the NarrativePackage the Keeper consumes (buildNarrativePackage). The eval
// harness drives it offline; the Stage 3.1.b server route reuses it.
//
// Pure: the RNG lives in JourneyState.rng and advances ONLY inside stepJourney -- nothing here
// rolls or re-rolls. Same state + cfg -> same JourneyTurn.

import { stepJourney, type JourneyConfigs, type JourneyState, type StepRecord } from '@brodyazhnik/engine';
import type { NarrativePackage } from './contract.js';
import { buildNarrativePackage, extractTurn, type EngineTurnResult } from './provider.js';

export interface JourneyTurn {
  readonly next: JourneyState; // the engine state after this step (carry it into the next turn)
  readonly record: StepRecord; // the step's side record (channel B: the checks it rolled)
  readonly turn: EngineTurnResult; // the orchestrator projection (extractTurn)
  readonly pkg: NarrativePackage; // what the Keeper receives
}

/** Advance the journey by one engine step and assemble that turn's NarrativePackage. */
export function journeyTurn(state: JourneyState, cfg: JourneyConfigs): JourneyTurn {
  const [next, record] = stepJourney(state, cfg);
  const turn = extractTurn(state.hero, next.hero, record);
  return { next, record, turn, pkg: buildNarrativePackage(turn) };
}
