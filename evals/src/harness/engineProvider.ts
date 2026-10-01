// Live engine provider for the eval harness (A3.3): engine journey step -> journeyTurn
// (extractJourneyTurn, TP1: days / arrival / travel check / detection) -> package.
//
// The scenes are engine-produced from the verified pack (content-packs/kv) -- never invented
// here. A JourneySpec (RNG seed string + region + optional Eye gap + how many steps to replay)
// fully determines the captured turn: same seed -> byte-identical package, on any machine. The hero and route are
// orchestrator's pregenerated Wanderer/route (startJourney; 3.1-C4 moved them there from here),
// which mirror the Stage-1 milestone fixtures; engineProvider.test.ts drift-pins the mirror.

import { pursuitThreshold, type JourneyState } from '@brodyazhnik/engine';
import {
  journeyTurn,
  startJourney,
  type JourneyEnv,
  type JourneyRegion,
  type JourneyTurn,
  type NarrativePackage,
} from '@brodyazhnik/orchestrator';
import type { Seed } from './types.js';

/** One captured journey turn, pinned. `expect` records what the engine produces for this seed
 *  (checked by engineProvider.test.ts), so a pack or engine change that alters the scene is caught.
 *  sceneType/detailFace are null on a step without a scene (the arrival); `arrived`/`detection`
 *  are present only when the captured step is the arrival / has a detection event. */
export interface JourneySpec {
  readonly rngSeed: string;
  readonly region: JourneyRegion;
  // When set, the start hero's Eye awareness = the region's pursuit threshold (pack-sourced) minus
  // eyeGap, so a detection can be reached within the captured step. Default: the initial rating.
  readonly eyeGap?: number;
  readonly stepsBefore?: number; // default 0 = capture the first step
  readonly expect: {
    readonly sceneType: string | null;
    readonly detailFace: number | null;
    readonly sceneCheck: 'success' | 'failure' | null;
    readonly arrived?: true;
    readonly detection?: true;
  };
}

export interface EngineSeed extends Seed {
  readonly journey: JourneySpec;
}

/** The journey start: orchestrator startJourney (pregen hero + route, pack-derived duration,
 *  seeded RNG, empty log). With `eyeGap`, the hero's Eye awareness starts at
 *  pursuitThreshold(region) - eyeGap (pack-sourced) -- an eval-only lever, so it stays here. */
export function initialJourneyState(
  env: JourneyEnv,
  spec: Pick<JourneySpec, 'rngSeed' | 'region' | 'eyeGap'>,
): JourneyState {
  const start = startJourney(env.cfg, { rngSeed: spec.rngSeed, region: spec.region });
  if (spec.eyeGap === undefined) return start;
  const hero = start.hero;
  return {
    ...start,
    hero: { ...hero, eye: { ...hero.eye, awareness: pursuitThreshold(spec.region, [], env.cfg.eye) - spec.eyeGap } },
  };
}

/** Replay `stepsBefore` engine steps, then capture the next turn. Never re-rolls: each step's
 *  RNG is the previous step's output state. */
export function captureTurn(env: JourneyEnv, spec: JourneySpec): JourneyTurn {
  let state = initialJourneyState(env, spec);
  for (let i = 0; i < (spec.stepsBefore ?? 0); i++) {
    state = journeyTurn(state, env.cfg).next;
  }
  return journeyTurn(state, env.cfg);
}

/** PackageProvider for EngineSeeds: the live engine -> journeyTurn -> package path. */
export function engineProvider(env: JourneyEnv): (seed: EngineSeed) => NarrativePackage {
  return (seed) => captureTurn(env, seed.journey).pkg;
}
