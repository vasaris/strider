import {
  journeyConfigsFromPack,
  journeyDuration,
  loadPack,
  makeRng,
  newEyeState,
  nodePackSource,
  stepJourney,
  type HeroState,
  type JourneyConfigs,
  type JourneyState,
  type Route,
} from '@brodyazhnik/engine';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildNarrativePackage, extractJourneyTurn } from '../src/provider.js';
import { JourneyOverError, journeyTurn } from '../src/turn.js';

const packRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'content-packs/kv');
const cfg: JourneyConfigs = journeyConfigsFromPack(loadPack(nodePackSource(packRoot)));

// Test fixtures (hero/route literals); the numbers are fixture data, not rules.
const HERO: HeroState = {
  attributes: { strength: 4, heart: 5, wits: 3 },
  skills: { travel: 2, exploration: 2, awareness: 1, hunting: 1 },
  endurance: { current: 18, max: 18 },
  loadGear: 0,
  fatigue: 0,
  hope: { current: 3, max: 3 },
  shadow: { points: 0, scars: 0 },
  eye: newEyeState({ valourAtLeast4: false, culture: 'other', famousItemCount: 0 }, cfg.eye),
  inspired: true,
  wounded: false,
  wound: null,
  dying: false,
  dead: false,
  permanentInjuryMarks: 0,
};
const ROUTE: Route = {
  totalHexes: 7,
  difficultHexes: 0,
  mounted: false,
  forcedMarch: false,
  mountCarry: 0,
  dangerZones: [],
  region: 'wild_lands',
  season: 'winter_autumn',
};
const STATE: JourneyState = {
  hero: HERO,
  journey: { route: ROUTE, remainingHexes: ROUTE.totalHexes, durationDays: journeyDuration(ROUTE, cfg.rules), arrived: false },
  rng: makeRng('turn-1'),
  log: [],
};

describe('journeyTurn (one live journey step -> package)', () => {
  it('pkg is exactly buildNarrativePackage(extractJourneyTurn(...)) of the same step', () => {
    const t = journeyTurn(STATE, cfg);
    const [next, record] = stepJourney(STATE, cfg);
    expect(t.record).toEqual(record);
    expect(t.turn).toEqual(extractJourneyTurn(STATE, next, record));
    expect(t.pkg).toEqual(buildNarrativePackage(extractJourneyTurn(STATE, next, record)));
  });

  it('next is exactly the engine step (no extra RNG draw)', () => {
    expect(journeyTurn(STATE, cfg).next).toEqual(stepJourney(STATE, cfg)[0]);
  });

  it('is deterministic', () => {
    expect(journeyTurn(STATE, cfg)).toEqual(journeyTurn(STATE, cfg));
  });

  it('an already-arrived state throws JourneyOverError (the engine no-op never reaches the Keeper)', () => {
    const arrived: JourneyState = { ...STATE, journey: { ...STATE.journey, remainingHexes: 0, arrived: true } };
    expect(() => journeyTurn(arrived, cfg)).toThrow(JourneyOverError);
  });
});
