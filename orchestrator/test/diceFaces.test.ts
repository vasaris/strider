// DD-DICE-FACES invariant on the real engine + verified pack: the UI-only faces the producer puts
// in a DiceResult explain the engine's total -- sum(counted d6 faces) + kept Feat numericValue ==
// total whenever total is present (absent only on the Gandalf-rune auto-success, where the engine
// does not consult the sum). Checked on the 11 eval-suite captured turns AND on every step of a
// full journey from each suite seed (plus a weary-hero variant so success_counted has false
// entries). The faces never reach the Keeper text.
//
// SUITE_SPECS is DATA copied from evals/src/harness/suiteSeeds.ts (SUITE_JOURNEYS: rngSeed /
// region / eyeGap / stepsBefore) -- orchestrator must not import evals. The capture mirrors
// evals captureTurn (startJourney, optional eyeGap from the pack pursuit threshold, replay
// stepsBefore turns, capture the next).

import { pursuitThreshold, type CheckRoll, type JourneyState } from '@brodyazhnik/engine';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DiceResult } from '../src/contract.js';
import { loadJourneyEnv } from '../src/journeyEnv.js';
import { startJourney, type JourneyRegion } from '../src/pregen.js';
import { renderNarrativePackage } from '../src/render.js';
import { isJourneyOver, journeyTurn, type JourneyTurn } from '../src/turn.js';

const env = loadJourneyEnv(resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'content-packs/kv'));

interface Spec {
  readonly id: string;
  readonly rngSeed: string;
  readonly region: JourneyRegion;
  readonly eyeGap?: number;
  readonly stepsBefore?: number;
}

const SUITE_SPECS: readonly Spec[] = [
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
  { id: 'j.dark.detection', rngSeed: 'a3-1', region: 'dark_lands', eyeGap: 1 },
];

function initial(spec: Spec): JourneyState {
  const s = startJourney(env.cfg, { rngSeed: spec.rngSeed, region: spec.region });
  if (spec.eyeGap === undefined) return s;
  return { ...s, hero: { ...s.hero, eye: { ...s.hero.eye, awareness: pursuitThreshold(spec.region, [], env.cfg.eye) - spec.eyeGap } } };
}

function capture(spec: Spec): JourneyTurn {
  let s = initial(spec);
  for (let i = 0; i < (spec.stepsBefore ?? 0); i++) s = journeyTurn(s, env.cfg).next;
  return journeyTurn(s, env.cfg);
}

const UI_ONLY_LINE = /^(travel_check\.)?(feat_die|success_dice|feat_candidates|feat_modifier|success_counted):/;

/** The invariant, read off the package's faces; the kept Feat die's numeric value comes from
 *  the engine roll it was copied from (feat_die is its physical face). Returns 1 when total was
 *  checked, 0 on auto-success. */
function checkFaces(d: DiceResult, roll: CheckRoll | null, label: string): number {
  expect(roll, label).not.toBeNull();
  const r = roll as CheckRoll;
  const faces = d.success_dice ?? [];
  const counted = d.success_counted ?? [];
  expect(d.feat_die, label).toBe(r.roll.feat.physicalFace);
  expect(faces.length, label).toBe(counted.length);
  expect(faces.length, label).toBe(r.roll.successDiceCount);
  if (d.feat_symbol === null) expect(r.roll.feat.numericValue, label).toBe(d.feat_die); // a number face shows its value
  // feat_modifier present iff feat_candidates; its value is the engine roll's featModifier.
  expect(d.feat_modifier === undefined, label).toBe(d.feat_candidates === undefined);
  expect(d.feat_modifier ?? 'normal', label).toBe(r.roll.featModifier);
  if (d.feat_candidates !== undefined) {
    expect(d.feat_candidates.length, label).toBeGreaterThan(1);
    expect(d.feat_candidates, label).toEqual(r.roll.featCandidates.map((f) => f.physicalFace));
    expect(d.feat_candidates, label).toContain(d.feat_die); // the kept face is one of the candidates
  }
  if (d.total === undefined) {
    expect(d.feat_symbol, label).toBe('gandalf'); // Gandalf rune: auto-success, the sum is not consulted
    return 0;
  }
  const sum = faces.reduce((acc, f, i) => acc + (counted[i] === true ? f : 0), 0);
  expect(sum + r.roll.feat.numericValue, label).toBe(d.total);
  return 1;
}

interface Tally {
  totals: number;
  voided: number;
  modified: number; // DiceResults carrying feat_candidates + feat_modifier
}

function checkTurn(t: JourneyTurn, label: string, tally: Tally): void {
  const { pkg, record } = t;
  expect(pkg.dice === null, label).toBe(record.sceneCheck === null);
  if (pkg.dice) {
    tally.totals += checkFaces(pkg.dice, record.sceneRoll, `${label}/scene`);
    tally.voided += (pkg.dice.success_counted ?? []).filter((c) => !c).length;
    if (pkg.dice.feat_modifier !== undefined) tally.modified++;
  }
  const travel = pkg.journey?.travel_check;
  expect(travel, label).toBeDefined();
  if (travel) {
    tally.totals += checkFaces(travel, record.travelRoll, `${label}/travel`);
    tally.voided += (travel.success_counted ?? []).filter((c) => !c).length;
    if (travel.feat_modifier !== undefined) tally.modified++;
  }
  const rendered = renderNarrativePackage(pkg).split('\n');
  expect(rendered.filter((l) => UI_ONLY_LINE.test(l)), label).toEqual([]);
}

describe('DD-DICE-FACES: faces explain the total (real engine, suite seeds)', () => {
  it('the 11 suite captured turns', () => {
    const tally: Tally = { totals: 0, voided: 0, modified: 0 };
    for (const spec of SUITE_SPECS) checkTurn(capture(spec), spec.id, tally);
    expect(tally.totals).toBeGreaterThan(11); // most turns carry two totals (scene + travel)
  });

  it('every step of a full journey from each suite seed: plain, weary and overwhelmed hero', () => {
    const tally: Tally = { totals: 0, voided: 0, modified: 0 };
    let steps = 0;
    for (const spec of SUITE_SPECS) {
      for (const variant of ['plain', 'weary', 'overwhelmed'] as const) {
        const s0 = initial(spec);
        const h = s0.hero;
        // fixtures: weary = Load >= Endurance; overwhelmed = Shadow >= max Hope (ill-favoured Feat die)
        const hero =
          variant === 'plain'
            ? h
            : variant === 'weary'
              ? { ...h, fatigue: h.endurance.current }
              : { ...h, shadow: { ...h.shadow, points: h.hope.max } };
        let s: JourneyState = { ...s0, hero };
        while (!isJourneyOver(s)) {
          const t = journeyTurn(s, env.cfg);
          checkTurn(t, `${spec.id}/${variant}/${steps}`, tally);
          s = t.next;
          steps++;
        }
      }
    }
    expect(steps).toBeGreaterThan(SUITE_SPECS.length * 3);
    expect(tally.voided).toBeGreaterThan(0); // the weary branch reached success_counted
    expect(tally.modified).toBeGreaterThan(0); // the ill-favoured branch reached feat_candidates / feat_modifier
  });
});
