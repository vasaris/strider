// TP1 (docs/DEFERRED.md#TP1): journey days, arrival and detection reach the NarrativePackage.
// Reviewer-verified defects, each pinned on the real engine + verified pack:
//   F1 the arrival step produced an EMPTY package (only `## turn`);
//   F2 journeyTurn on an arrived state produced a degenerate no-op package;
//   F3 a detection step reported eye_delta growth+reset folded into one negative diff, and the
//      detection scene text never reached the package;
//   F4 journey_days_delta effects (short cut -1 day, mishap +1 day) never reached the package.
// Plus the A4.1 lock (dice = the SCENE check only; the travel roll only under `## journey`), the
// DZ1 guard and the public surface (reviewer P4).

import {
  journeyConfigsFromPack,
  journeyDuration,
  loadPack,
  makeRng,
  newEyeState,
  nodePackSource,
  pursuitThreshold,
  stepJourney,
  type CheckResult,
  type HeroState,
  type JourneyConfigs,
  type JourneyState,
  type Route,
} from '@brodyazhnik/engine';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DiceResult, NarrativePackage } from '../src/contract.js';
import * as api from '../src/index.js';
import { buildNarrativePackage, extractJourneyTurn } from '../src/provider.js';
import { renderNarrativePackage } from '../src/render.js';
import { JourneyOverError, UnsupportedRouteError, isJourneyOver, journeyTurn } from '../src/turn.js';

const packRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'content-packs/kv');
const cfg: JourneyConfigs = journeyConfigsFromPack(loadPack(nodePackSource(packRoot)));

// Test fixtures (same numbers as turn.test.ts / the eval hero); fixture data, not rules.
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
const REGIONS = ['border_lands', 'wild_lands', 'dark_lands'] as const;

function start(seed: string, region: Route['region'], hero: HeroState = HERO, route: Route = ROUTE): JourneyState {
  const r: Route = { ...route, region };
  return {
    hero,
    journey: { route: r, remainingHexes: r.totalHexes, durationDays: journeyDuration(r, cfg.rules), arrived: false },
    rng: makeRng(seed),
    log: [],
  };
}

// Test-side mapping of an engine CheckResult to the contract DiceResult, written independently of
// provider.ts (feat symbol, icons, TN, 4-value outcome from the pack-derived degree, total if any).
function expectedDice(c: CheckResult): DiceResult {
  const outcome =
    c.outcome === 'failure'
      ? 'failure'
      : c.degree === 'success'
        ? 'weak'
        : c.degree === 'great_success'
          ? 'strong'
          : 'extraordinary';
  return {
    feat_symbol: c.isEyeOnFeat ? 'eye' : c.autoSuccess ? 'gandalf' : null,
    success_icons: c.successIcons,
    target_number: c.targetNumber,
    outcome,
    ...(c.total === null ? {} : { total: c.total }),
  };
}

/** The body lines of one rendered `## <name>` section ([] when absent). */
function sectionBody(out: string, name: string): string[] {
  const ls = out.split('\n');
  const at = ls.indexOf(`## ${name}`);
  if (at === -1) return [];
  const rest = ls.slice(at + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return end === -1 ? rest : rest.slice(0, end);
}

describe('TP1: journey days / arrival / detection reach the package', () => {
  it('F1: the arrival step carries journey { days_delta, arrived, days_total, travel_check }', () => {
    const t0 = journeyTurn(start('a3-12', 'border_lands'), cfg);
    const t1 = journeyTurn(t0.next, cfg);
    expect(t1.record.events.map((e) => e.kind).join(',')).toBe('travel_check,arrival');
    const arrival = t1.record.events.find((e) => e.kind === 'arrival');
    const travel = t1.record.travelCheck;
    expect(travel).not.toBeNull();
    expect(t1.pkg.journey).toEqual({
      days_delta: 0,
      arrived: true,
      days_total: 6,
      travel_check: expectedDice(travel as CheckResult),
    });
    expect(arrival?.kind === 'arrival' ? arrival.durationDays : null).toBe(t1.pkg.journey?.days_total);
    expect(t1.next.journey.durationDays).toBe(t1.pkg.journey?.days_total);
    expect(t1.pkg.dice).toBeNull();
    expect(t1.pkg.oracle).toBeNull();

    const out = renderNarrativePackage(t1.pkg);
    expect(out.split('\n').filter((l) => l.startsWith('## '))).not.toEqual(['## turn']); // not turn-only
    expect(out).toContain('## journey');
    expect(out.split('\n')).toContain('arrived: true');
    expect(out.split('\n')).toContain('days_total: 6');
  });

  it('F2: journeyTurn on the arrived state throws JourneyOverError; isJourneyOver', () => {
    const s0 = start('a3-12', 'border_lands');
    const arrived = journeyTurn(journeyTurn(s0, cfg).next, cfg).next;
    expect(isJourneyOver(s0)).toBe(false);
    expect(isJourneyOver(arrived)).toBe(true);
    let err: unknown;
    try {
      journeyTurn(arrived, cfg);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(JourneyOverError);
    expect((err as JourneyOverError).code).toBe('journey_over');
    expect((err as JourneyOverError).name).toBe('JourneyOverError');
  });

  it('F3: a detection step surfaces the scene verbatim and eye_delta is the growth (+1), not the reset', () => {
    const threshold = pursuitThreshold('dark_lands', [], cfg.eye); // pack-sourced, not a literal
    const hero: HeroState = { ...HERO, eye: { ...HERO.eye, awareness: threshold - 1 } };
    const t = journeyTurn(start('q-2', 'dark_lands', hero), cfg);
    expect(t.record.events.map((e) => e.kind).join(',')).toBe('travel_check,scene,detection');
    const ev = t.record.events.find((e) => e.kind === 'detection');
    const sceneText = ev?.kind === 'detection' ? ev.sceneText : undefined;

    expect(t.pkg.detection?.table).toBe('detection_scenes');
    expect(t.pkg.detection?.scene).toBe(sceneText);
    const table = JSON.parse(readFileSync(resolve(packRoot, 'tables/solo/detection_scenes.json'), 'utf8')) as {
      payload: { rows: Array<{ face: number | string; text: string }> };
    };
    expect(table.payload.rows.map((r) => r.text)).toContain(t.pkg.detection?.scene);

    expect(t.next.hero.eye.awareness).toBe(HERO.eye.initial); // the engine did reset ...
    expect(t.pkg.patch?.eye_delta).toBe(1); // ... but the patch carries the growth, NOT -(threshold-1)
    expect(t.pkg.patch?.shadow_delta).toBe(1);

    const out = renderNarrativePackage(t.pkg).split('\n');
    const at = (h: string): number => out.indexOf(h);
    expect(at('## oracle')).toBeGreaterThan(-1);
    expect(at('## oracle')).toBeLessThan(at('## detection'));
    expect(at('## detection')).toBeLessThan(at('## patch'));
    expect(at('## patch')).toBeLessThan(at('## journey'));
  });

  it('F4: a short cut reaches the package as journey.days_delta -1', () => {
    const t = journeyTurn(start('a3-12', 'border_lands'), cfg);
    expect(t.pkg.oracle?.result_ref).toBe('short_cut');
    expect(t.pkg.journey?.days_delta).toBe(-1);
    expect(t.next.journey.durationDays - t.pkg.journey!.days_delta).toBe(journeyDuration({ ...ROUTE, region: 'border_lands' }, cfg.rules));
    expect(renderNarrativePackage(t.pkg).split('\n')).toContain('days_delta: -1');
  });

  it('A4.1 lock: dice = the scene check only; the travel roll only under ## journey (whole journeys)', () => {
    let steps = 0;
    for (const region of REGIONS) {
      for (const seed of ['lock-0', 'lock-1', 'lock-2', 'lock-3', 'a3-12', 'q-2']) {
        let s = start(seed, region);
        while (!isJourneyOver(s)) {
          const t = journeyTurn(s, cfg);
          const label = `${seed}/${region}/${steps}`;
          const pkg: NarrativePackage = t.pkg;
          expect(pkg.dice === null, label).toBe(t.record.sceneCheck === null);
          if (t.record.sceneCheck !== null) {
            const want = expectedDice(t.record.sceneCheck);
            expect(pkg.dice?.target_number, label).toBe(want.target_number);
            expect(pkg.dice?.outcome, label).toBe(want.outcome);
            expect(pkg.dice?.success_icons, label).toBe(want.success_icons);
            expect(pkg.dice?.feat_symbol, label).toBe(want.feat_symbol);
          }
          expect(pkg.journey?.travel_check, label).toEqual(expectedDice(t.record.travelCheck as CheckResult));

          const out = renderNarrativePackage(pkg);
          const dice = sectionBody(out, 'dice');
          expect(dice.some((l) => l.startsWith('travel_check.')), label).toBe(false);
          const want = t.record.sceneCheck === null ? [] : sectionBody(renderNarrativePackage({ ...pkg, journey: null }), 'dice');
          expect(dice, label).toEqual(want); // the travel check never alters ## dice
          const travelLines = out.split('\n').filter((l) => l.startsWith('travel_check.'));
          expect(travelLines.length, label).toBeGreaterThan(0);
          expect(sectionBody(out, 'journey').filter((l) => l.startsWith('travel_check.')), label).toEqual(travelLines);
          s = t.next;
          steps++;
        }
      }
    }
    expect(steps).toBeGreaterThan(REGIONS.length * 6); // every journey took more than one step overall
  });

  it('DZ1: a route with entry danger zones throws UnsupportedRouteError (no engine step)', () => {
    const s = start('a3-12', 'border_lands', HERO, { ...ROUTE, dangerZones: [1] });
    let err: unknown;
    try {
      journeyTurn(s, cfg);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(UnsupportedRouteError);
    expect((err as UnsupportedRouteError).code).toBe('unsupported_route');
  });

  it('extractJourneyTurn agrees with journeyTurn on the same step', () => {
    const s = start('a3-12', 'border_lands');
    const [next, record] = stepJourney(s, cfg);
    expect(buildNarrativePackage(extractJourneyTurn(s, next, record))).toEqual(journeyTurn(s, cfg).pkg);
  });

  it('surface: extractTurn is gone; the TP1 producers and guards are exported', () => {
    expect('extractTurn' in api).toBe(false);
    expect(typeof api.extractJourneyTurn).toBe('function');
    expect(typeof api.journeyTurn).toBe('function');
    expect(typeof api.isJourneyOver).toBe('function');
    expect(typeof api.JourneyOverError).toBe('function');
    expect(typeof api.UnsupportedRouteError).toBe('function');
  });
});
