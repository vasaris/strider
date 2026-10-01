// Pregenerated Wanderer / route / journey start (3.1-C4) on the real verified pack. The drift pin
// against the Stage-1 milestone fixtures lives in evals/test/engineProvider.test.ts.
import { journeyDuration, type JourneyConfigs } from '@brodyazhnik/engine';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadJourneyEnv } from '../src/journeyEnv.js';
import { PREGEN_HERO_REF, pregenRoute, pregenWanderer, startJourney, type JourneyRegion } from '../src/pregen.js';
import { journeyTurn } from '../src/turn.js';

const packDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'content-packs/kv');
const env = loadJourneyEnv(packDir);
const cfg: JourneyConfigs = env.cfg;
const REGIONS: readonly JourneyRegion[] = ['border_lands', 'wild_lands', 'dark_lands'];

describe('journey env', () => {
  it('names the pack it loaded', () => {
    expect(env.packId).toBe('kv');
    expect(env.packVersion.length).toBeGreaterThan(0);
  });
});

describe('pregen', () => {
  it('PREGEN_HERO_REF is a stable versioned id', () => {
    expect(PREGEN_HERO_REF).toBe('pregen:wanderer@1');
  });

  it('pregenRoute has no danger zones (journeyTurn refuses them, DZ1) for every region', () => {
    for (const region of REGIONS) {
      const r = pregenRoute(region);
      expect(r.region).toBe(region);
      expect(r.dangerZones).toEqual([]);
      expect(r.forcedMarch).toBe(false);
    }
  });

  it('startJourney: pregen hero + route, pack-derived duration, seeded rng, empty log, not arrived', () => {
    const s = startJourney(cfg, { rngSeed: 'seed-1', region: 'wild_lands' });
    expect(s.hero).toEqual(pregenWanderer(cfg));
    expect(s.journey.route).toEqual(pregenRoute('wild_lands'));
    expect(s.journey.remainingHexes).toBe(s.journey.route.totalHexes);
    expect(s.journey.durationDays).toBe(journeyDuration(s.journey.route, cfg.rules));
    expect(s.journey.arrived).toBe(false);
    expect(s.log).toEqual([]);
    // same seed -> same state; different seed -> different rng
    expect(startJourney(cfg, { rngSeed: 'seed-1', region: 'wild_lands' })).toEqual(s);
    expect(startJourney(cfg, { rngSeed: 'seed-2', region: 'wild_lands' }).rng).not.toEqual(s.rng);
  });

  it('every region start is playable by journeyTurn (no precondition throws)', () => {
    for (const region of REGIONS) {
      expect(() => journeyTurn(startJourney(cfg, { rngSeed: `r-${region}`, region }), cfg)).not.toThrow();
    }
  });
});
