// 3.3a-K2: the 11 A3 suite journeys played as BEATS (travelBeatTurn, then checkBeatTurn when a
// scene awaits its check; hopeSpend 0, no context) reproduce the SAME mechanics as the one-step
// journeyTurn capture that keeper-requests.v0.3.json pins: the same final engine state, the same
// scene-check dice, the same oracle, travel roll and detection. Plus the beat kinds per suite design
// and the per-beat composition rules.
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkBeatTurn,
  journeyTurn,
  loadJourneyEnv,
  renderNarrativePackage,
  travelBeatTurn,
  type NarrativePackage,
} from '@brodyazhnik/orchestrator';
import { initialJourneyState } from '../src/harness/engineProvider.js';
import { SUITE_JOURNEYS } from '../src/harness/suiteSeeds.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = loadJourneyEnv(resolve(repoRoot, 'content-packs/kv'));

const EXPECTED_BEATS: Record<string, readonly string[]> = {
  'j.border.arrival': ['arrival'],
  'j.dark.significant': ['encounter'],
};

const headings = (pkg: NarrativePackage): string[] =>
  renderNarrativePackage(pkg)
    .split('\n')
    .filter((l) => l.startsWith('## '));

describe('3.3a beats over SUITE_JOURNEYS (same mechanics as the one-step capture)', () => {
  for (const j of SUITE_JOURNEYS) {
    it(j.id, () => {
      // Same start as captureTurn: initial state, replay stepsBefore whole steps.
      let state = initialJourneyState(env, j.journey);
      for (let i = 0; i < (j.journey.stepsBefore ?? 0); i++) state = journeyTurn(state, env.cfg).next;
      const step = journeyTurn(state, env.cfg);

      const travel = travelBeatTurn(state, { hopeSpend: 0 }, {}, env.cfg);
      const check = travel.beat === 'setup' ? checkBeatTurn(travel.next, { hopeSpend: 0 }, {}, env.cfg) : null;
      const beats = check === null ? [travel.beat] : [travel.beat, check.beat];
      expect(beats).toEqual(EXPECTED_BEATS[j.id] ?? ['setup', 'resolution']);

      // Same mechanics: final state, travel roll, oracle, dice, detection.
      expect((check ?? travel).next).toEqual(step.next);
      expect(travel.pkg.journey?.travel_check).toEqual(step.pkg.journey?.travel_check);
      expect(travel.pkg.oracle ?? null).toEqual(step.pkg.oracle ?? null);
      const last = check?.pkg ?? travel.pkg;
      expect(last.detection ?? null).toEqual(step.pkg.detection ?? null);
      expect(check?.pkg.dice ?? null).toEqual(step.pkg.dice ?? null);
      if (check !== null) expect(check.pkg.oracle).toEqual(step.pkg.oracle);
      // Days: the beats' days_delta sum to the step's.
      expect((travel.pkg.journey?.days_delta ?? 0) + (check?.pkg.journey?.days_delta ?? 0)).toBe(step.pkg.journey?.days_delta);
      if (travel.beat === 'arrival') {
        expect(travel.pkg.journey).toEqual(step.pkg.journey);
      }

      // Composition rules per beat.
      for (const b of [travel, ...(check === null ? [] : [check])]) {
        const pkg = b.pkg;
        expect(pkg.beat).toBe(b.beat);
        expect(pkg.player).toEqual({ hope_spent: 0 });
        expect('previous_prose' in pkg).toBe(false);
        expect('questions' in pkg).toBe(false);
        const out = renderNarrativePackage(pkg);
        expect(out.split('\n')).toContain(`beat: ${b.beat}`);
        expect(out).not.toMatch(/^(scene_table|scene_detail_die|bonus_dice|eye_sources|rolls)/m);
        switch (b.beat) {
          case 'setup':
            expect(pkg.dice).toBeNull();
            expect(pkg.detection).toBeNull();
            expect(pkg.oracle).not.toBeNull();
            expect(pkg.journey?.travel_check).toBeDefined();
            expect(pkg.rolls?.scene_table).toBeDefined();
            break;
          case 'resolution':
            expect(pkg.dice).not.toBeNull();
            expect(pkg.journey && 'travel_check' in pkg.journey).toBe(false);
            expect(out).not.toContain('travel_check.');
            expect(pkg.rolls).toEqual({ bonus_dice: 0 });
            break;
          case 'arrival':
            expect(pkg.oracle).toBeNull();
            expect(pkg.dice).toBeNull();
            expect(pkg.journey?.arrived).toBe(true);
            expect(pkg.journey?.days_total).toBeDefined();
            expect(headings(pkg)).not.toContain('## oracle');
            break;
          case 'encounter':
            expect(pkg.dice).toBeNull();
            expect(pkg.oracle?.detail?.row?.significantEncounter).toBe(true);
            break;
        }
      }
    });
  }
});
