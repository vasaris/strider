// One live turn of the journey loop (arch sec 5): engine step -> turn projection -> package.
//
// This is the live wiring of the turn-producer noted in HANDOFF_STAGE3 sec 5: the engine advances
// the journey by one step (stepJourney), the turn-producer projects it (extractJourneyTurn: dice,
// patch, SD1 detail, and -- TP1 -- journey days / arrival / travel check and the detection scene),
// and the provider assembles the NarrativePackage the Keeper consumes (buildNarrativePackage). The
// eval harness drives it offline; the Stage 3.1.b server route reuses it.
//
// Pure: the RNG lives in JourneyState.rng and advances ONLY inside stepJourney -- nothing here
// rolls or re-rolls. Same state + cfg -> same JourneyTurn.
//
// PRECONDITIONS THROW instead of returning a union "no turn" result. Both are knowable from the
// state before the call (callers check isJourneyOver first; the route is fixed at journey start),
// so a union would force every consumer (the eval harness, the server route) to handle a branch
// that a correct caller can never reach -- and the alternative of returning the engine's
// degenerate already-arrived no-op as a package must never happen: that package would reach the
// Keeper with nothing to narrate.
//   - JourneyOverError: the journey has arrived; there is no next step.
//   - UnsupportedRouteError: the route has entry danger zones. runJourney plays them before the
//     travel loop; the turn loop does not yet (DEFERRED DZ1), so a turn on such a route would
//     silently skip them.

import { stepJourney, type JourneyConfigs, type JourneyState, type StepRecord } from '@brodyazhnik/engine';
import type { NarrativePackage } from './contract.js';
import { buildNarrativePackage, extractJourneyTurn, type EngineTurnResult } from './provider.js';

export interface JourneyTurn {
  readonly next: JourneyState; // the engine state after this step (carry it into the next turn)
  readonly record: StepRecord; // the step's side record (channel B: the checks it rolled)
  readonly turn: EngineTurnResult; // the orchestrator projection (extractJourneyTurn)
  readonly pkg: NarrativePackage; // what the Keeper receives
}

/** journeyTurn on a journey that has already arrived (check isJourneyOver first). */
export class JourneyOverError extends Error {
  readonly code = 'journey_over' as const;
  constructor(message = 'journeyTurn: the journey has already arrived') {
    super(message);
    this.name = 'JourneyOverError';
  }
}

/** journeyTurn on a route the turn loop cannot play yet (entry danger zones; DEFERRED DZ1). */
export class UnsupportedRouteError extends Error {
  readonly code = 'unsupported_route' as const;
  constructor(message = 'journeyTurn: routes with entry danger zones are not played by the turn loop (DZ1)') {
    super(message);
    this.name = 'UnsupportedRouteError';
  }
}

/** True when the journey has arrived: there is no next turn. */
export function isJourneyOver(state: JourneyState): boolean {
  return state.journey.arrived;
}

/**
 * Advance the journey by one engine step and assemble that turn's NarrativePackage.
 * @throws JourneyOverError when isJourneyOver(state) (no engine step is taken)
 * @throws UnsupportedRouteError when the route has entry danger zones (DZ1)
 */
export function journeyTurn(state: JourneyState, cfg: JourneyConfigs): JourneyTurn {
  if (isJourneyOver(state)) throw new JourneyOverError();
  if (state.journey.route.dangerZones.length > 0) throw new UnsupportedRouteError();
  const [next, record] = stepJourney(state, cfg);
  const turn = extractJourneyTurn(state, next, record);
  return { next, record, turn, pkg: buildNarrativePackage(turn) };
}
