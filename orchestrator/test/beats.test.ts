// 3.3a-K2: the journey beat producers (travelBeatTurn / checkBeatTurn / oracleAnswer) on the real
// engine + verified pack. States are hand-picked by a deterministic seed search inside the test
// (same seeds -> same states on any machine). Covers the package composition per beat kind, the
// context rules (previous_prose / questions / approach), Hope, the UI-only fields, the oracle label /
// note mapping and the guards.

import {
  JourneyBeatError,
  journeyConfigsFromPack,
  journeyDuration,
  loadPack,
  makeRng,
  newEyeState,
  nodePackSource,
  pursuitThreshold,
  type CheckResult,
  type CheckRoll,
  type HeroState,
  type JourneyConfigs,
  type JourneyEvent,
  type JourneyState,
  type Route,
} from '@brodyazhnik/engine';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DiceResult, NarrativePackage, OracleQuestion } from '../src/contract.js';
import * as api from '../src/index.js';
import { checkBeatTurn, oracleAnswer, travelBeatTurn, type BeatContext } from '../src/beats.js';
import { provisionalBeatLengthFor } from '../src/provider.js';
import { renderNarrativePackage } from '../src/render.js';
import { UnsupportedRouteError } from '../src/turn.js';

const packRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'content-packs/kv');
const cfg: JourneyConfigs = journeyConfigsFromPack(loadPack(nodePackSource(packRoot)));

// Test fixtures (same numbers as tp1.test.ts); fixture data, not rules.
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
const NO_CTX: BeatContext = {};

function start(seed: string, region: Route['region'], hero: HeroState = HERO, route: Route = ROUTE): JourneyState {
  const r: Route = { ...route, region };
  return {
    hero,
    journey: { route: r, remainingHexes: r.totalHexes, durationDays: journeyDuration(r, cfg.rules), arrived: false },
    rng: makeRng(seed),
    log: [],
  };
}

/** Hero one Awareness point under the region's pursuit threshold (pack-sourced). */
function nearThreshold(region: Route['region']): HeroState {
  return { ...HERO, eye: { ...HERO.eye, awareness: pursuitThreshold(region, [], cfg.eye) - 1 } };
}

/** First seed `<prefix>-<i>` whose travel beat (hopeSpend 0) satisfies `pred`. */
function findState(prefix: string, mk: (seed: string) => JourneyState, pred: (t: ReturnType<typeof travelBeatTurn>) => boolean): JourneyState {
  for (let i = 0; i < 400; i++) {
    const s = mk(`${prefix}-${i}`);
    if (pred(travelBeatTurn(s, { hopeSpend: 0 }, NO_CTX, cfg))) return s;
  }
  throw new Error(`findState: no seed for ${prefix}`);
}

// Test-side DiceResult mapping, written independently of provider.ts (as tp1.test.ts).
function expectedDice(c: CheckResult, r: CheckRoll): DiceResult {
  const outcome =
    c.outcome === 'failure' ? 'failure' : c.degree === 'success' ? 'weak' : c.degree === 'great_success' ? 'strong' : 'extraordinary';
  return {
    feat_symbol: c.isEyeOnFeat ? 'eye' : c.autoSuccess ? 'gandalf' : null,
    success_icons: c.successIcons,
    target_number: c.targetNumber,
    outcome,
    ...(c.total === null ? {} : { total: c.total }),
    feat_die: r.roll.feat.physicalFace,
    success_dice: r.roll.successDice.map((d) => d.face),
    success_counted: [...r.successCounted],
    ...(r.roll.featModifier === 'normal'
      ? {}
      : { feat_candidates: r.roll.featCandidates.map((f) => f.physicalFace), feat_modifier: r.roll.featModifier }),
  };
}

const headings = (pkg: NarrativePackage): string[] =>
  renderNarrativePackage(pkg)
    .split('\n')
    .filter((l) => l.startsWith('## '));

const PENDING = findState('k2p', (s) => start(s, 'wild_lands'), (t) => t.beat === 'setup');
const ENCOUNTER = findState('k2e', (s) => start(s, 'dark_lands'), (t) => t.beat === 'encounter');
const ARRIVAL: JourneyState = { ...start('k2a', 'border_lands'), journey: { ...start('k2a', 'border_lands').journey, remainingHexes: 1 } };

describe('travelBeatTurn: setup (a scene awaits its check)', () => {
  const t = travelBeatTurn(PENDING, { hopeSpend: 0 }, NO_CTX, cfg);
  const scene = t.record.scene!;

  it('beat setup; oracle = the drawn scene + detail row; no dice, no detection; journey = travel roll, days 0', () => {
    expect(t.beat).toBe('setup');
    expect(t.record.kind).toBe('pending');
    expect(t.next.journey.pending).toEqual(scene);
    expect(t.pkg).toMatchObject({ intent: 'journey', scene: 'journey', beat: 'setup', dice: null, detection: null });
    expect(t.pkg.length_target).toEqual(provisionalBeatLengthFor('setup'));
    expect(t.pkg.oracle).toEqual({
      table: 'journey_scenes',
      result_ref: scene.sceneType,
      row: null,
      detail: {
        table: `scene_details.${scene.sceneType}`,
        result_ref: `scene_details.${scene.sceneType}#face=${scene.detail.face}`,
        detail: null,
        row: { ...scene.detail },
      },
    });
    expect(t.pkg.journey).toEqual({ days_delta: 0, travel_check: expectedDice(t.record.travelCheck, t.record.travelRoll) });
    expect(t.pkg.player).toEqual({ hope_spent: 0 });
    expect(t.pkg.lore_chunks).toEqual([]);
    expect(t.pkg.journal_facts).toEqual([]);
  });

  it('rolls (UI-only): the scene-table Feat die, the detail die, bonus dice 0; candidates only on a modified roll', () => {
    const tr = scene.tableRoll;
    expect(t.pkg.rolls).toEqual({
      scene_table:
        tr.modifier === 'normal' ? { feat_die: tr.feat } : { feat_die: tr.feat, feat_candidates: tr.candidates, feat_modifier: tr.modifier },
      scene_detail_die: scene.detailDie,
      bonus_dice: 0,
    });
    expect(t.pkg.eye_sources).toEqual(t.record.eyeSources.map((e) => ({ source: e.source, delta: e.delta })));
  });

  it('a modified (ill-favoured) scene-table roll carries candidates + modifier', () => {
    const s = findState('k2m', (x) => start(x, 'dark_lands'), (x) => x.beat === 'setup');
    const m = travelBeatTurn(s, { hopeSpend: 0 }, NO_CTX, cfg);
    const tr = m.record.scene!.tableRoll;
    expect(tr.modifier).not.toBe('normal');
    expect(m.pkg.rolls?.scene_table).toEqual({ feat_die: tr.feat, feat_candidates: tr.candidates, feat_modifier: tr.modifier });
  });

  it('renders beat: setup, ## player, no ## dice; rolls / eye_sources never rendered', () => {
    const out = renderNarrativePackage(t.pkg);
    expect(out.split('\n')).toContain('beat: setup');
    expect(headings(t.pkg)).toEqual(['## turn', '## player', '## oracle', '## journey']);
    const { rolls: _r, eye_sources: _e, ...rest } = t.pkg;
    expect(renderNarrativePackage(rest)).toBe(out);
  });
});

describe('travelBeatTurn: Hope and context', () => {
  it('Hope spent: player.hope_spent 1, patch hope_delta -1, rolls.bonus_dice = the engine bonus dice', () => {
    const t = travelBeatTurn(PENDING, { hopeSpend: 1 }, NO_CTX, cfg);
    expect(t.record.hope.spent).toBe(1);
    expect(t.pkg.player).toEqual({ hope_spent: 1 });
    expect(t.pkg.patch?.hope_delta).toBe(-1);
    expect(t.pkg.rolls?.bonus_dice).toBe(t.record.hope.bonusDice);
    expect(t.record.hope.bonusDice).toBeGreaterThan(0);
  });

  it('a spend the hero cannot afford: hope_spent is what the engine spent (0)', () => {
    const broke = { ...PENDING, hero: { ...PENDING.hero, hope: { current: 0, max: 3 } } };
    const t = travelBeatTurn(broke, { hopeSpend: 1 }, NO_CTX, cfg);
    expect(t.pkg.player).toEqual({ hope_spent: 0 });
    expect(t.pkg.patch?.hope_delta).toBeUndefined();
    expect(t.pkg.rolls?.bonus_dice).toBe(0);
  });

  it('previous_prose / questions / approach included verbatim when present, rendered in their sections', () => {
    const q: OracleQuestion = { question: 'Брод мелкий?', likelihood: 'Вероятно', answer: 'yes', extreme: false };
    const ctx: BeatContext = { previousProse: '  Ветер стих.  ', questions: [q], approach: 'осторожно, по камням' };
    const t = travelBeatTurn(PENDING, { hopeSpend: 0 }, ctx, cfg);
    expect(t.pkg.previous_prose).toBe('  Ветер стих.  ');
    expect(t.pkg.questions).toEqual([q]);
    expect(t.pkg.player).toEqual({ hope_spent: 0, approach: 'осторожно, по камням' });
    expect(headings(t.pkg)).toEqual(['## turn', '## player', '## oracle', '## questions', '## journey', '## previous']);
    // Context never touches mechanics: the same state with and without context rolls the same.
    const bare = travelBeatTurn(PENDING, { hopeSpend: 0 }, NO_CTX, cfg);
    expect(t.next).toEqual(bare.next);
    expect(t.record).toEqual(bare.record);
  });

  it('absent / null / whitespace context: no previous_prose, no questions key, no approach', () => {
    for (const ctx of [{}, { previousProse: null, questions: [], approach: null }, { previousProse: ' \n\t', approach: '   ' }] as BeatContext[]) {
      const t = travelBeatTurn(PENDING, { hopeSpend: 0 }, ctx, cfg);
      expect('previous_prose' in t.pkg).toBe(false);
      expect('questions' in t.pkg).toBe(false);
      expect(t.pkg.player).toEqual({ hope_spent: 0 });
    }
  });
});

describe('travelBeatTurn: encounter and arrival', () => {
  it('encounter: beat encounter, the significant scene, no dice, scene fatigue in patch, one prose beat', () => {
    const t = travelBeatTurn(ENCOUNTER, { hopeSpend: 0 }, NO_CTX, cfg);
    expect(t.beat).toBe('encounter');
    expect(t.next.journey.pending ?? null).toBeNull();
    expect(t.pkg.length_target).toEqual(provisionalBeatLengthFor('encounter'));
    expect(t.pkg.dice).toBeNull();
    expect(t.pkg.oracle?.detail?.row?.significantEncounter || t.pkg.oracle?.detail?.row?.skill === null).toBe(true);
    const sceneEvent = t.record.events.find((e) => e.kind === 'scene');
    expect(sceneEvent?.kind === 'scene' ? sceneEvent.fatigueGained : -1).toBe(t.pkg.patch?.fatigue_delta ?? 0);
    expect(t.pkg.journey?.travel_check).toEqual(expectedDice(t.record.travelCheck, t.record.travelRoll));
    expect(t.pkg.rolls?.scene_detail_die).toBe(t.record.scene?.detailDie);
    expect(() => checkBeatTurn(t.next, { hopeSpend: 0 }, NO_CTX, cfg)).toThrow(JourneyBeatError);
  });

  it('arrival: beat arrival; no oracle, no dice; journey arrived / days_total / travel_check; rolls = bonus dice only', () => {
    const t = travelBeatTurn(ARRIVAL, { hopeSpend: 0 }, NO_CTX, cfg);
    expect(t.beat).toBe('arrival');
    expect(t.pkg.oracle).toBeNull();
    expect(t.pkg.dice).toBeNull();
    expect(t.pkg.detection).toBeNull();
    expect(t.pkg.length_target).toEqual(provisionalBeatLengthFor('arrival'));
    expect(t.pkg.journey).toEqual({
      days_delta: 0,
      arrived: true,
      days_total: ARRIVAL.journey.durationDays,
      travel_check: expectedDice(t.record.travelCheck, t.record.travelRoll),
    });
    expect(t.pkg.rolls).toEqual({ bonus_dice: 0 });
    expect(renderNarrativePackage(t.pkg).split('\n')).toContain('beat: arrival');
  });
});

describe('checkBeatTurn: resolution', () => {
  const travel = travelBeatTurn(PENDING, { hopeSpend: 0 }, NO_CTX, cfg);
  const t = checkBeatTurn(travel.next, { hopeSpend: 0 }, NO_CTX, cfg);

  it('beat resolution; dice = the scene check (UI faces included); oracle = the same scene; journey days only', () => {
    expect(t.beat).toBe('resolution');
    expect(t.next.journey.pending ?? null).toBeNull();
    expect(t.pkg.length_target).toEqual(provisionalBeatLengthFor('resolution'));
    expect(t.pkg.dice).toEqual(expectedDice(t.record.sceneCheck, t.record.sceneRoll));
    expect(t.pkg.oracle).toEqual(travel.pkg.oracle);
    expect(t.pkg.journey).toEqual({ days_delta: t.next.journey.durationDays - travel.next.journey.durationDays });
    expect(t.pkg.journey && 'travel_check' in t.pkg.journey).toBe(false);
    expect(t.pkg.rolls).toEqual({ bonus_dice: 0 });
    const out = renderNarrativePackage(t.pkg);
    expect(out.split('\n')).toContain('beat: resolution');
    expect(out).not.toContain('travel_check.');
    expect(headings(t.pkg).slice(0, 4)).toEqual(['## turn', '## player', '## dice', '## oracle']);
  });

  it('setup + resolution patches sum to the whole-step hero change', () => {
    const sum = (k: 'fatigue_delta' | 'hope_delta' | 'eye_delta' | 'shadow_delta' | 'endurance_delta') =>
      (travel.pkg.patch?.[k] ?? 0) + (t.pkg.patch?.[k] ?? 0);
    const step = api.journeyTurn(PENDING, cfg);
    expect(t.next).toEqual(step.next);
    for (const k of ['fatigue_delta', 'hope_delta', 'eye_delta', 'shadow_delta', 'endurance_delta'] as const) {
      expect(sum(k), k).toBe(step.pkg.patch?.[k] ?? 0);
    }
  });

  it('Hope on the check and context: hope_spent 1, approach, previous_prose, questions', () => {
    const q: OracleQuestion = { question: 'Нас видят?', likelihood: 'Возможно', answer: 'no', extreme: true, note: 'текст пака' };
    const r = checkBeatTurn(travel.next, { hopeSpend: 1 }, { previousProse: 'Проза завязки.', questions: [q], approach: 'бегом' }, cfg);
    expect(r.pkg.player).toEqual({ hope_spent: 1, approach: 'бегом' });
    expect(r.pkg.patch?.hope_delta).toBe(-1);
    expect(r.pkg.rolls?.bonus_dice).toBe(r.record.hope.bonusDice);
    expect(r.pkg.questions).toEqual([q]);
    expect(r.pkg.previous_prose).toBe('Проза завязки.');
    expect(headings(r.pkg).at(-1)).toBe('## previous');
  });

  it('detection: present exactly when the beat rolled one; eye_delta is growth up to it', () => {
    let seen = 0;
    for (const region of REGIONS) {
      for (let i = 0; i < 60; i++) {
        const s0 = start(`k2d-${region}-${i}`, region, nearThreshold(region));
        const tr = travelBeatTurn(s0, { hopeSpend: 0 }, NO_CTX, cfg);
        // [package, the beat's log slice, the hero Awareness before the beat]
        const beats: [NarrativePackage, readonly JourneyEvent[], number][] = [[tr.pkg, tr.record.events, s0.hero.eye.awareness]];
        if (tr.beat === 'setup') {
          const cb = checkBeatTurn(tr.next, { hopeSpend: 0 }, NO_CTX, cfg);
          beats.push([cb.pkg, cb.record.events, tr.next.hero.eye.awareness]);
        }
        for (const [pkg, ev, before] of beats) {
          const det = ev.find((e) => e.kind === 'detection');
          if (det?.kind === 'detection') {
            seen++;
            expect(pkg.detection).toEqual({ table: 'detection_scenes', scene: det.sceneText });
            // growth within THIS beat up to the detection (may be 0: the Eye can have grown on the
            // setup's travel roll and the detection fire after the resolution's scene)
            expect(pkg.patch?.eye_delta ?? 0).toBe(det.awareness - before);
          } else {
            expect(pkg.detection).toBeNull();
          }
        }
        if (tr.beat === 'setup') expect(tr.pkg.detection).toBeNull(); // a setup never rolls detection
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('oracleAnswer (no Keeper call)', () => {
  const s0 = start('k2o', 'wild_lands');
  const likelihoods = cfg.oracles.answers.likelihoods;

  it('null likelihood -> the pack default label; a key -> its label; never grows the Eye; RNG advances', () => {
    const def = likelihoods.find((l) => l.isDefault)!;
    const a = oracleAnswer(s0, { question: 'Мост цел?', likelihood: null }, cfg);
    expect(a.question.question).toBe('Мост цел?');
    expect(a.question.likelihood).toBe(def.label);
    expect(a.record.answer.likelihoodKey).toBe(def.key);
    expect(a.next.hero).toEqual(s0.hero);
    expect(a.next.rng).not.toEqual(s0.rng);
    for (const l of likelihoods) {
      const r = oracleAnswer(s0, { question: 'q', likelihood: l.key }, cfg);
      expect(r.question.likelihood).toBe(l.label);
      expect(r.question.answer).toBe(r.record.answer.answer);
    }
  });

  it('extreme rune / Eye: note = the pack face text; a plain answer has no note; the Eye never grows', () => {
    const hits = new Map<string, OracleQuestion>();
    let s = s0;
    for (let i = 0; i < 400 && hits.size < 3; i++) {
      const before = s.hero.eye;
      const r = oracleAnswer(s, { question: `q${i}`, likelihood: null }, cfg);
      expect(r.next.hero.eye).toEqual(before);
      const f = r.record.answer.featFace;
      hits.set(f === 'gandalf_rune' || f === 'eye' ? f : 'plain', r.question);
      s = r.next;
    }
    expect(hits.get('gandalf_rune')).toMatchObject({ answer: 'yes', extreme: true, note: cfg.oracles.answers.gandalfRune.text });
    expect(hits.get('eye')).toMatchObject({ answer: 'no', extreme: true, note: cfg.oracles.answers.eye.text });
    const plain = hits.get('plain')!;
    expect(plain.extreme).toBe(false);
    expect('note' in plain).toBe(false);
  });

  it('allowed with a pending check; an unknown likelihood key throws from the engine (not translated)', () => {
    const pending = travelBeatTurn(PENDING, { hopeSpend: 0 }, NO_CTX, cfg).next;
    expect(() => oracleAnswer(pending, { question: 'q', likelihood: null }, cfg)).not.toThrow();
    expect(() => oracleAnswer(s0, { question: 'q', likelihood: 'no_such_key' }, cfg)).toThrow(/unknown likelihood/);
  });
});

describe('guards', () => {
  it('DZ1: a route with entry danger zones throws UnsupportedRouteError on every beat', () => {
    const dz = start('k2z', 'wild_lands', HERO, { ...ROUTE, dangerZones: [1] as Route['dangerZones'] });
    expect(() => travelBeatTurn(dz, { hopeSpend: 0 }, NO_CTX, cfg)).toThrow(UnsupportedRouteError);
    expect(() => checkBeatTurn(dz, { hopeSpend: 0 }, NO_CTX, cfg)).toThrow(UnsupportedRouteError);
    expect(() => oracleAnswer(dz, { question: 'q', likelihood: null }, cfg)).toThrow(UnsupportedRouteError);
  });

  it('engine JourneyBeatError codes propagate unchanged', () => {
    const code = (f: () => unknown): string | undefined => {
      try {
        f();
      } catch (e) {
        return e instanceof JourneyBeatError ? e.code : 'other';
      }
      return undefined;
    };
    const pending = travelBeatTurn(PENDING, { hopeSpend: 0 }, NO_CTX, cfg).next;
    const arrived = travelBeatTurn(ARRIVAL, { hopeSpend: 0 }, NO_CTX, cfg).next;
    expect(code(() => travelBeatTurn(pending, { hopeSpend: 0 }, NO_CTX, cfg))).toBe('check_pending');
    expect(code(() => checkBeatTurn(PENDING, { hopeSpend: 0 }, NO_CTX, cfg))).toBe('no_pending');
    expect(code(() => travelBeatTurn(arrived, { hopeSpend: 0 }, NO_CTX, cfg))).toBe('journey_over');
    expect(code(() => oracleAnswer(arrived, { question: 'q', likelihood: null }, cfg))).toBe('journey_over');
  });

  it('public surface: the beat turns are exported; the internal mapping is not', () => {
    expect(typeof api.travelBeatTurn).toBe('function');
    expect(typeof api.checkBeatTurn).toBe('function');
    expect(typeof api.oracleAnswer).toBe('function');
    expect('mapDice' in api).toBe(false);
    expect('diffHeroState' in api).toBe(false);
    expect('detectionOf' in api).toBe(false);
  });
});
