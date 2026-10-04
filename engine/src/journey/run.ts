import { checkBeat, travelBeat } from "./beats.js";
import type { JourneyConfigs } from "./config.js";
import { runDangerZone } from "./danger.js";
import type { JourneyState, StepRecord } from "./state.js";

/**
 * One journey step: the guide makes a Travel check. If the result covers the
 * remaining hexes the journey ends; otherwise the party advances (3 + success
 * signs on success; 2 or 1 by season on failure) and a scene occurs, followed by
 * a pursuit/detection check. Days come from the route duration (set at start)
 * and from scene effects, not from per-hex accrual here.
 *
 * Composed from the player beats with no Hope spent: travelBeat, then checkBeat when the
 * drawn scene awaits a check. Same RNG draws, state and record as before the beat split.
 * A state with a pending check throws JourneyBeatError check_pending (via travelBeat).
 */
export function stepJourney(state: JourneyState, cfg: JourneyConfigs): readonly [JourneyState, StepRecord] {
  if (state.journey.arrived) {
    return [state, { events: [], travelCheck: null, sceneCheck: null, travelRoll: null, sceneRoll: null }] as const; // degenerate no-op
  }
  const beforeLen = state.log.length;

  const [afterTravel, travel] = travelBeat(state, { hopeSpend: 0 }, cfg);
  if (travel.kind !== "pending") {
    const record: StepRecord = {
      events: afterTravel.log.slice(beforeLen),
      travelCheck: travel.travelCheck,
      sceneCheck: null,
      travelRoll: travel.travelRoll,
      sceneRoll: null,
    };
    return [afterTravel, record] as const;
  }
  const [s, check] = checkBeat(afterTravel, { hopeSpend: 0 }, cfg);
  // events: the exact slice appended this step (single source of truth -- sliced from the log,
  // not recomputed), so a consumer reading sceneDetail from record.events matches the log.
  const record: StepRecord = {
    events: s.log.slice(beforeLen),
    travelCheck: travel.travelCheck,
    sceneCheck: check.sceneCheck,
    travelRoll: travel.travelRoll,
    sceneRoll: check.sceneRoll,
  };
  return [s, record] as const;
}

/**
 * Run the journey to arrival. Entry danger zones are played first (the party
 * stops and clears peril-rating scenes), then the travel loop. The safety cap
 * guards against a non-terminating bug.
 */
export function runJourney(state0: JourneyState, cfg: JourneyConfigs): JourneyState {
  let s = state0;
  for (const degree of s.journey.route.dangerZones) {
    s = runDangerZone(s, degree, cfg);
  }
  const cap = state0.journey.route.totalHexes + 50;
  for (let i = 0; i < cap; i++) {
    if (s.journey.arrived) return s;
    [s] = stepJourney(s, cfg); // runJourney threads state only; the per-step record is for the turn loop
  }
  throw new Error("runJourney: exceeded step cap without arriving (possible bug)");
}
