// Round-trip gate (HANDOFF 3.1 part 2): the 11 suite journeys, from start to arrival, through
// REAL jsonb (PostgresSessionStore on PGlite). Each turn is played twice -- from the original
// state and from the state read back from the database (the app's real chain) -- and must agree:
// next state deep-equal, the package rendered and framed for the Keeper byte for byte. The STORED
// package must render identically too (the C7 regeneration path). jsonb normalizes key order, and
// the test asserts that it did, so a pass-through store cannot pass it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pursuitThreshold, type JourneyState } from '@brodyazhnik/engine';
import {
  buildKeeperUser,
  isJourneyOver,
  journeyTurn,
  loadJourneyEnv,
  loadPromptAssembly,
  PREGEN_HERO_REF,
  renderNarrativePackage,
  startJourney,
  type JourneyRegion,
} from '@brodyazhnik/orchestrator';
import { beforeAll, describe, expect, it } from 'vitest';

import { PostgresSessionStore } from '../../src/server/store/postgres';
import { migratedDb } from '../support/pglite';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const env = loadJourneyEnv(join(REPO, 'content-packs', 'kv'));
const asm = loadPromptAssembly(REPO);

// Copied from evals/src/harness/suiteSeeds.ts (SUITE_JOURNEYS), in order; app does not depend on
// evals. The drift pin below compares these tuples with that file's text.
const SEEDS: readonly { id: string; rngSeed: string; region: JourneyRegion; eyeGap?: number }[] = [
  { id: 'j.border.shortcut', rngSeed: 'a3-12', region: 'border_lands' },
  { id: 'j.border.inspiring', rngSeed: 'a3-14', region: 'border_lands' },
  { id: 'j.wild.mishap', rngSeed: 'a3-0', region: 'wild_lands' },
  { id: 'j.wild.meeting', rngSeed: 'a3-22', region: 'wild_lands' },
  { id: 'j.dark.badchoice', rngSeed: 'a3-7', region: 'dark_lands' },
  { id: 'j.dark.despair', rngSeed: 'a3-10', region: 'dark_lands' },
  { id: 'j.dark.misfortune', rngSeed: 'a3-1', region: 'dark_lands' },
  { id: 'j.dark.significant', rngSeed: 'a3-4', region: 'dark_lands' },
  { id: 'j.dark.midjourney', rngSeed: 'a3-3', region: 'dark_lands' },
  { id: 'j.border.arrival', rngSeed: 'a3-1', region: 'border_lands' },
  { id: 'j.dark.detection', rngSeed: 'a3-1', region: 'dark_lands', eyeGap: 1 },
];

/** As evals' initialJourneyState: eyeGap puts the Eye that far below the pursuit threshold. */
function initialState(seed: (typeof SEEDS)[number]): JourneyState {
  const start = startJourney(env.cfg, { rngSeed: seed.rngSeed, region: seed.region });
  if (seed.eyeGap === undefined) return start;
  const hero = start.hero;
  return {
    ...start,
    hero: { ...hero, eye: { ...hero.eye, awareness: pursuitThreshold(seed.region, [], env.cfg.eye) - seed.eyeGap } },
  };
}

/** Deep-equal, but the top-level key order differs (jsonb sorted it). */
function expectReordered(back: object, orig: object): void {
  expect(back).toStrictEqual(orig);
  expect(Object.keys(back)).not.toEqual(Object.keys(orig));
}

describe('suite seed drift pin', () => {
  it('matches the (id, rngSeed, region, eyeGap) tuples of evals/src/harness/suiteSeeds.ts, in order', () => {
    const text = readFileSync(join(REPO, 'evals', 'src', 'harness', 'suiteSeeds.ts'), 'utf8');
    const body = text.slice(text.indexOf('export const SUITE_JOURNEYS'));
    const blocks = body.split(/\n\s*\{\s*\n\s*id: /).slice(1);
    const parsed = blocks.map((b) => {
      const id = /^'([^']+)'/.exec(b)?.[1];
      const rngSeed = /rngSeed: '([^']+)'/.exec(b)?.[1];
      const region = /region: '([^']+)'/.exec(b)?.[1];
      const eyeGap = /eyeGap: (\d+)/.exec(b)?.[1];
      return { id, rngSeed, region, ...(eyeGap === undefined ? {} : { eyeGap: Number(eyeGap) }) };
    });
    expect(parsed).toEqual(SEEDS);
  });
});

describe('round-trip through jsonb: 11 suite journeys to arrival', () => {
  const turnsPerSeed: Record<string, number> = {};
  let arrivals = 0;
  let detections = 0;
  let store: PostgresSessionStore;
  beforeAll(async () => {
    store = new PostgresSessionStore((await migratedDb()).sql);
  });

  it.each(SEEDS)('$id ($rngSeed, $region) arrives with every turn intact', async (seed) => {
    const start = initialState(seed);
    const session = await store.createSession({
      rngSeed: seed.rngSeed,
      heroRef: PREGEN_HERO_REF,
      packId: env.packId,
      packVersion: env.packVersion,
      initialState: start,
    });
    const read = await store.getSession(session.id);
    if (read === null) throw new Error('session not read back');
    expectReordered(read.initialState, start);

    let orig = start;
    let back: JourneyState = read.initialState;
    let n = 0;
    while (!isJourneyOver(orig)) {
      expect(isJourneyOver(back)).toBe(false);
      const tOrig = journeyTurn(orig, env.cfg);
      const tBack = journeyTurn(back, env.cfg);
      expect(tBack.next).toStrictEqual(tOrig.next);
      const rendered = renderNarrativePackage(tOrig.pkg);
      const framed = buildKeeperUser(asm, tOrig.pkg);
      expect(renderNarrativePackage(tBack.pkg)).toBe(rendered);
      expect(buildKeeperUser(asm, tBack.pkg)).toBe(framed);

      await store.appendTurn({ sessionId: session.id, turnIndex: n, state: tOrig.next, pkg: tOrig.pkg, packVersion: env.packVersion });
      const stored = await store.getTurn(session.id, n);
      if (stored === null) throw new Error(`turn ${n} not read back`);
      expectReordered(stored.state, tOrig.next);
      expectReordered(stored.pkg, tOrig.pkg);
      expect(renderNarrativePackage(stored.pkg)).toBe(rendered);
      expect(buildKeeperUser(asm, stored.pkg)).toBe(framed);
      if (stored.pkg.journey?.arrived === true) arrivals++;
      if (stored.pkg.detection) detections++;

      orig = tOrig.next;
      back = stored.state;
      n++;
      expect(n).toBeLessThan(100); // a journey that never arrives
    }
    expect(isJourneyOver(back)).toBe(true);
    expect(n).toBeGreaterThan(0);
    expect((await store.listTurns(session.id)).map((t) => t.turnIndex)).toEqual([...Array(n).keys()]);
    turnsPerSeed[seed.id] = n;
  });

  it('every journey arrived; totals', () => {
    expect(Object.keys(turnsPerSeed)).toEqual(SEEDS.map((x) => x.id));
    expect(arrivals).toBe(SEEDS.length); // every arrival package went through jsonb
    expect(detections).toBeGreaterThan(0); // the eyeGap seed reached the detection path
    const total = Object.values(turnsPerSeed).reduce((a, b) => a + b, 0);
    console.log(
      `round-trip: ${SEEDS.length} journeys, ${total} turns, ${arrivals} arrivals, ${detections} detections ${JSON.stringify(turnsPerSeed)}`,
    );
  });
});
