// The pregenerated test Wanderer and route (3.1-C4): the ONE runtime definition shared by the
// eval harness and the future app (moved here from evals/src/harness/engineProvider.ts). They
// mirror the Stage-1 milestone fixtures (engine/src/cli/scenario.ts makeTestHero /
// MILESTONE_ROUTE), which are not part of the engine's public API; evals/test/engineProvider.test.ts
// drift-pins this mirror against them.
//
// Fixture data, not rules: every rule number (Eye awareness, journey duration, ...) comes from
// the verified pack via JourneyConfigs.

import {
  journeyDuration,
  makeRng,
  newEyeState,
  type HeroState,
  type JourneyConfigs,
  type JourneyState,
  type Route,
} from '@brodyazhnik/engine';

export type JourneyRegion = Route['region'];

/** Stable reference to this hero definition (bump on any change to pregenWanderer). */
export const PREGEN_HERO_REF = 'pregen:wanderer@1';

/** The Stage-1 test Wanderer (mirror of makeTestHero). */
export function pregenWanderer(cfg: JourneyConfigs): HeroState {
  return {
    attributes: { strength: 4, heart: 5, wits: 3 },
    skills: { travel: 2, exploration: 2, awareness: 1, hunting: 1 },
    endurance: { current: 18, max: 18 },
    loadGear: 0,
    fatigue: 0,
    hope: { current: 3, max: 3 },
    shadow: { points: 0, scars: 0 },
    eye: newEyeState({ valourAtLeast4: false, culture: 'other', famousItemCount: 0 }, cfg.eye),
    inspired: true, // Wanderer is inspired on journey skill checks
    wounded: false,
    wound: null,
    dying: false,
    dead: false,
    permanentInjuryMarks: 0,
  };
}

/** The Stage-1 milestone route (mirror of MILESTONE_ROUTE) with the region varied. No danger
 *  zones (journeyTurn refuses them -- DEFERRED DZ1) and no forced march. */
export function pregenRoute(region: JourneyRegion): Route {
  return {
    totalHexes: 7,
    difficultHexes: 0,
    mounted: false,
    forcedMarch: false,
    mountCarry: 0,
    dangerZones: [],
    region,
    season: 'winter_autumn',
  };
}

/** The journey start: pregen hero + route, pack-derived duration, seeded RNG, empty log.
 *  `route` (3.1-C7) defaults to pregenRoute(region); a given route must be in `region` (throws
 *  otherwise), so a caller that checks the route (the server's DZ1 422) plays that same object. */
export function startJourney(
  cfg: JourneyConfigs,
  opts: { readonly rngSeed: string; readonly region: JourneyRegion; readonly route?: Route },
): JourneyState {
  const route = opts.route ?? pregenRoute(opts.region);
  if (route.region !== opts.region) {
    throw new Error(`startJourney: route region ${route.region} does not match region ${opts.region}`);
  }
  return {
    hero: pregenWanderer(cfg),
    journey: {
      route,
      remainingHexes: route.totalHexes,
      durationDays: journeyDuration(route, cfg.rules),
      arrived: false,
    },
    rng: makeRng(opts.rngSeed),
    log: [],
  };
}
