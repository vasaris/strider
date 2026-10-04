// The 11 suite journeys, copied from evals/src/harness/suiteSeeds.ts (SUITE_JOURNEYS), in order;
// app does not depend on evals. test/suite-seeds.test.ts drift-pins these tuples against that
// file's text. Used by the C6 round-trip gate and the C7 keeper-request gate.
import { pursuitThreshold, type JourneyState } from '@brodyazhnik/engine';
import { startJourney, type JourneyEnv, type JourneyRegion } from '@brodyazhnik/orchestrator';

export interface SuiteSeed {
  readonly id: string;
  readonly rngSeed: string;
  readonly region: JourneyRegion;
  readonly eyeGap?: number;
  readonly stepsBefore?: number;
}

export const SEEDS: readonly SuiteSeed[] = [
  { id: 'j.border.shortcut', rngSeed: 'a3-12', region: 'border_lands' },
  { id: 'j.border.inspiring', rngSeed: 'a3-14', region: 'border_lands' },
  { id: 'j.wild.mishap', rngSeed: 'a3-0', region: 'wild_lands' },
  { id: 'j.wild.meeting', rngSeed: 'a3-22', region: 'wild_lands' },
  { id: 'j.dark.badchoice', rngSeed: 'a3-7', region: 'dark_lands' },
  { id: 'j.dark.despair', rngSeed: 'a3-10', region: 'dark_lands' },
  { id: 'j.dark.misfortune', rngSeed: 'a3-1', region: 'dark_lands' },
  { id: 'j.dark.significant', rngSeed: 'a3-4', region: 'dark_lands' },
  { id: 'j.dark.midjourney', rngSeed: 'a3-3', region: 'dark_lands', stepsBefore: 2 },
  { id: 'j.border.arrival', rngSeed: 'a3-1', region: 'border_lands', stepsBefore: 1 },
  { id: 'j.dark.detection', rngSeed: 'a3-5', region: 'dark_lands', eyeGap: 1 },
];

/** As evals' initialJourneyState: eyeGap puts the Eye that far below the pursuit threshold. */
export function seedInitialState(env: JourneyEnv, seed: SuiteSeed): JourneyState {
  const start = startJourney(env.cfg, { rngSeed: seed.rngSeed, region: seed.region });
  if (seed.eyeGap === undefined) return start;
  const hero = start.hero;
  return {
    ...start,
    hero: { ...hero, eye: { ...hero.eye, awareness: pursuitThreshold(seed.region, [], env.cfg.eye) - seed.eyeGap } },
  };
}
