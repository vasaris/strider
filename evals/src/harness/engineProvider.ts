// Live engine provider for the eval harness (A3.3): engine journey step -> journeyTurn
// (extractJourneyTurn, TP1: days / arrival / travel check / detection) -> package.
//
// The scenes are engine-produced from the verified pack (content-packs/kv) -- never invented
// here. A JourneySpec (RNG seed string + region + optional Eye gap + how many steps to replay)
// fully determines the captured turn: same seed -> byte-identical package, on any machine. The hero and route are
// the Stage-1 milestone fixtures (engine/src/cli/scenario.ts), mirrored here because that module
// is not part of the engine's public API; engineProvider.test.ts drift-pins the mirror against it.

import {
  journeyConfigsFromPack,
  journeyDuration,
  loadPack,
  makeRng,
  newEyeState,
  nodePackSource,
  pursuitThreshold,
  type HeroState,
  type JourneyConfigs,
  type JourneyState,
  type Route,
} from '@brodyazhnik/engine';
import { journeyTurn, type JourneyTurn, type NarrativePackage } from '@brodyazhnik/orchestrator';
import type { Seed } from './types.js';

export type JourneyRegion = Route['region'];

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

export interface EngineEnv {
  readonly cfg: JourneyConfigs;
  readonly packVersion: string;
}

/** Load the verified pack once and derive the journey configs. */
export function loadEngineEnv(packDir: string): EngineEnv {
  const pack = loadPack(nodePackSource(packDir));
  return { cfg: journeyConfigsFromPack(pack), packVersion: pack.manifest.pack_version };
}

/** The Stage-1 test Wanderer (mirror of engine/src/cli/scenario.ts makeTestHero; drift-pinned by
 *  test). Fixture data, not rules: every rule number comes from the pack via cfg. */
export function evalHero(cfg: JourneyConfigs): HeroState {
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

/** The Stage-1 milestone route (mirror of MILESTONE_ROUTE) with the region varied. */
export function evalRoute(region: JourneyRegion): Route {
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

/** The journey start: fixture hero + route, pack-derived duration, seeded RNG, empty log. With
 *  `eyeGap`, the hero's Eye awareness starts at pursuitThreshold(region) - eyeGap (pack-sourced). */
export function initialJourneyState(
  env: EngineEnv,
  spec: Pick<JourneySpec, 'rngSeed' | 'region' | 'eyeGap'>,
): JourneyState {
  const route = evalRoute(spec.region);
  const hero = evalHero(env.cfg);
  return {
    hero:
      spec.eyeGap === undefined
        ? hero
        : { ...hero, eye: { ...hero.eye, awareness: pursuitThreshold(spec.region, [], env.cfg.eye) - spec.eyeGap } },
    journey: {
      route,
      remainingHexes: route.totalHexes,
      durationDays: journeyDuration(route, env.cfg.rules),
      arrived: false,
    },
    rng: makeRng(spec.rngSeed),
    log: [],
  };
}

/** Replay `stepsBefore` engine steps, then capture the next turn. Never re-rolls: each step's
 *  RNG is the previous step's output state. */
export function captureTurn(env: EngineEnv, spec: JourneySpec): JourneyTurn {
  let state = initialJourneyState(env, spec);
  for (let i = 0; i < (spec.stepsBefore ?? 0); i++) {
    state = journeyTurn(state, env.cfg).next;
  }
  return journeyTurn(state, env.cfg);
}

/** PackageProvider for EngineSeeds: the live engine -> journeyTurn -> package path. */
export function engineProvider(env: EngineEnv): (seed: EngineSeed) => NarrativePackage {
  return (seed) => captureTurn(env, seed.journey).pkg;
}
