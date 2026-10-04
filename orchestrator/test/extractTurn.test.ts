import { makeRng, type CheckResult, type CheckRoll, type FeatDieResult, type HeroState, type JourneyEvent, type JourneyState, type StepRecord } from '@brodyazhnik/engine';
import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';
import { buildNarrativePackage, extractJourneyTurn, type EngineTurnResult } from '../src/provider.js';
import { renderNarrativePackage } from '../src/render.js';

// Minimal hero fixture; only the fields diffHeroState reads matter for these tests.
function hero(overrides: Partial<HeroState> = {}): HeroState {
  return {
    attributes: { strength: 4, heart: 5, wits: 3 },
    skills: { travel: 2 },
    endurance: { current: 18, max: 18 },
    loadGear: 0,
    fatigue: 0,
    hope: { current: 3, max: 3 },
    shadow: { points: 0, scars: 0 },
    eye: { awareness: 0, initial: 0 },
    inspired: true,
    wounded: false,
    wound: null,
    dying: false,
    dead: false,
    permanentInjuryMarks: 0,
    ...overrides,
  };
}

function check(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    outcome: 'success',
    autoSuccess: false,
    targetNumber: 14,
    total: 17,
    successIcons: 1,
    degree: 'success',
    isEyeOnFeat: false,
    ...overrides,
  };
}

// A numeric Feat die (fixture faces, not rules).
function featDie(face: number): FeatDieResult {
  return { physicalFace: face, face: { kind: 'number', value: face }, numericValue: face, isEye: false, isAutoSuccess: false };
}

// The roll behind check(): feat 7 + d6 [4, 6] (both counted) = 17 = check().total.
function roll(overrides: Partial<CheckRoll['roll']> = {}, successCounted: readonly boolean[] = [true, true]): CheckRoll {
  const feat = featDie(7);
  return {
    roll: {
      feat,
      featCandidates: [feat],
      featModifier: 'normal',
      successDice: [
        { face: 4, isSuccessIcon: false },
        { face: 6, isSuccessIcon: true },
      ],
      successDiceCount: 2,
      ...overrides,
    },
    successCounted,
  };
}
const ROLL = roll();
// What mapDice copies off ROLL (UI-only faces).
const ROLL_FACES = { feat_die: 7, success_dice: [4, 6], success_counted: [true, true] } as const;

// Minimal JourneyState wrapper: only hero and journey.durationDays matter to the projection.
// The route/rng/log are fixture filler (never stepped here).
function jstate(h: HeroState, durationDays = 7, arrived = false): JourneyState {
  return {
    hero: h,
    journey: {
      route: {
        totalHexes: 7,
        difficultHexes: 0,
        mounted: false,
        forcedMarch: false,
        mountCarry: 0,
        dangerZones: [],
        region: 'wild_lands',
        season: 'winter_autumn',
      },
      remainingHexes: arrived ? 0 : 3,
      durationDays,
      arrived,
    },
    rng: makeRng('fixture'),
    log: [],
  };
}

/** The public producer over two heroes (the day count unchanged unless given). */
function extractTurn(prev: HeroState, next: HeroState, record: StepRecord, days: readonly [number, number] = [7, 7]): EngineTurnResult {
  return extractJourneyTurn(jstate(prev, days[0]), jstate(next, days[1]), record);
}

const sceneEvent: JourneyEvent = {
  kind: 'scene',
  sceneType: 'mishap',
  detailScene: 'a turned ankle',
  detail: { face: 3, scene: 'a turned ankle on scree', prompt: 'the descent goes wrong', skill: 'travel', significantEncounter: false },
  skill: 'travel',
  significantEncounter: false,
  checkOutcome: 'success',
  fatigueGained: 1,
  appliedOps: [],
  eyeDelta: 0,
};

describe('extractJourneyTurn (turn-producer: engine step -> EngineTurnResult)', () => {
  it('maps the scene oracle refs + surfaces the SD1 row verbatim (no re-roll)', () => {
    const record: StepRecord = { events: [sceneEvent], travelCheck: check(), sceneCheck: check(), travelRoll: ROLL, sceneRoll: ROLL };
    const turn = extractTurn(hero(), hero({ fatigue: 1 }), record);
    expect(turn.intent).toBe('journey');
    expect(turn.oracleTable).toBe('journey_scenes');
    expect(turn.oracleResultRef).toBe('mishap');
    expect(turn.detailTable).toBe('scene_details.mishap');
    expect(turn.sceneDetail).toBe(sceneEvent.kind === 'scene' ? sceneEvent.detail : null); // same row, not recomputed
  });

  it('ANTI-HARDCODE: outcome follows the pack-derived degree, NOT successIcons', () => {
    // great_success with a deliberately mismatched icon count: the mapper must read `degree`.
    const record: StepRecord = {
      events: [sceneEvent],
      travelCheck: check(),
      sceneCheck: check({ degree: 'great_success', successIcons: 99 }), travelRoll: ROLL, sceneRoll: ROLL,
    };
    const turn = extractTurn(hero(), hero(), record);
    expect(turn.dice?.outcome).toBe('strong'); // from degree, regardless of the 99 icons
    expect(turn.dice?.success_icons).toBe(99); // icons passed through verbatim, not reinterpreted
  });

  it('maps every degree tier and failure', () => {
    const mk = (c: Partial<CheckResult>) =>
      extractTurn(hero(), hero(), { events: [sceneEvent], travelCheck: check(), sceneCheck: check(c), travelRoll: ROLL, sceneRoll: ROLL }).dice?.outcome;
    expect(mk({ outcome: 'failure', degree: null })).toBe('failure');
    expect(mk({ degree: 'success' })).toBe('weak');
    expect(mk({ degree: 'great_success' })).toBe('strong');
    expect(mk({ degree: 'extraordinary_success' })).toBe('extraordinary');
  });

  it('maps feat symbol (eye / gandalf / none) and omits total when null', () => {
    const eye = extractTurn(hero(), hero(), { events: [sceneEvent], travelCheck: check(), sceneCheck: check({ isEyeOnFeat: true }), travelRoll: ROLL, sceneRoll: ROLL });
    expect(eye.dice?.feat_symbol).toBe('eye');
    const gandalf = extractTurn(hero(), hero(), {
      events: [sceneEvent],
      travelCheck: check(),
      sceneCheck: check({ autoSuccess: true, total: null }), travelRoll: ROLL, sceneRoll: ROLL,
    });
    expect(gandalf.dice?.feat_symbol).toBe('gandalf');
    expect('total' in (gandalf.dice ?? {})).toBe(false); // total omitted (contract is number-only)
  });

  it('derives the patch from a prev/next hero diff (only non-zero deltas + condition transitions)', () => {
    const prev = hero();
    const next = hero({ fatigue: 3, eye: { awareness: 1, initial: 0 }, wounded: true });
    const turn = extractTurn(prev, next, { events: [sceneEvent], travelCheck: check(), sceneCheck: check(), travelRoll: ROLL, sceneRoll: ROLL });
    expect(turn.patch).toEqual({ fatigue_delta: 3, eye_delta: 1, conditions_gained: ['wounded'] });
  });

  it('the travel check is never surfaced: dice are the scene check only (A4.1)', () => {
    const record: StepRecord = {
      events: [sceneEvent],
      travelCheck: check({ targetNumber: 99, outcome: 'failure', degree: null }), // travel roll
      sceneCheck: check({ targetNumber: 14 }), travelRoll: ROLL, sceneRoll: ROLL, // scene roll -> the only dice source
    };
    const dice = extractTurn(hero(), hero(), record).dice;
    expect(dice?.target_number).toBe(14);
    expect(dice?.outcome).toBe('weak');
  });

  it('a significant encounter (no scene check) carries no dice, even with a travel check (A4.1)', () => {
    const significant: JourneyEvent = {
      kind: 'scene',
      sceneType: 'despair',
      detailScene: 'servants of the Enemy',
      detail: { face: 1, scene: 'servants of the Enemy', prompt: 'a significant encounter', skill: null, significantEncounter: true },
      skill: null,
      significantEncounter: true,
      checkOutcome: null,
      fatigueGained: 2,
      appliedOps: [],
      eyeDelta: 0,
    };
    const record: StepRecord = { events: [significant], travelCheck: check({ targetNumber: 13 }), sceneCheck: null, travelRoll: ROLL, sceneRoll: null };
    const turn = extractTurn(hero(), hero({ fatigue: 2 }), record);
    expect(turn.dice).toBeNull();
    expect(turn.sceneDetail?.significantEncounter).toBe(true);
    expect(renderNarrativePackage(buildNarrativePackage(turn))).not.toContain('## dice');
  });

  it('feeds buildNarrativePackage end-to-end (turn-producer -> package)', () => {
    const record: StepRecord = { events: [sceneEvent], travelCheck: check(), sceneCheck: check({ degree: 'great_success' }), travelRoll: ROLL, sceneRoll: ROLL };
    const pkg = buildNarrativePackage(extractTurn(hero(), hero({ fatigue: 1 }), record));
    expect(pkg.oracle?.detail?.row?.scene).toBe('a turned ankle on scree'); // SD1 surfaced
    expect(pkg.dice?.outcome).toBe('strong');
    expect(pkg.patch?.fatigue_delta).toBe(1);
    expect(pkg.journal_facts).toEqual([]); // F-journal
  });

  it('the arrival step: no scene oracle and no dice; the travel check surfaces only in journey (A4.1, TP1)', () => {
    const record: StepRecord = {
      events: [
        { kind: 'travel_check', outcome: 'success', advance: 4, remainingAfter: 0, eyeDelta: 0 },
        { kind: 'arrival', durationDays: 7 },
      ],
      travelCheck: check({ degree: 'success', targetNumber: 13 }),
      sceneCheck: null, travelRoll: ROLL, sceneRoll: null,
    };
    const turn = extractTurn(hero(), hero(), record);
    expect(turn.oracleTable).toBeUndefined();
    expect(turn.sceneDetail).toBeUndefined();
    expect(turn.dice).toBeNull();
    expect(turn.detection).toBeNull();
    expect(turn.journey).toEqual({
      days_delta: 0,
      arrived: true,
      days_total: 7,
      travel_check: { ...ROLL_FACES, feat_symbol: null, success_icons: 1, target_number: 13, outcome: 'weak', total: 17 },
    });
    expect(Object.keys(turn.journey ?? {})).toEqual(['days_delta', 'arrived', 'days_total', 'travel_check']);
  });

  it('a non-arrival step: journey carries days_delta (0 included) and the travel check, no arrived/days_total', () => {
    const record: StepRecord = { events: [sceneEvent], travelCheck: check({ targetNumber: 99 }), sceneCheck: check(), travelRoll: ROLL, sceneRoll: ROLL };
    const same = extractTurn(hero(), hero(), record);
    expect(same.journey).toEqual({
      days_delta: 0,
      travel_check: { ...ROLL_FACES, feat_symbol: null, success_icons: 1, target_number: 99, outcome: 'weak', total: 17 },
    });
    expect('arrived' in (same.journey ?? {})).toBe(false);
    expect(extractTurn(hero(), hero(), record, [7, 8]).journey?.days_delta).toBe(1); // mishap +1 day
    expect(extractTurn(hero(), hero(), record, [7, 6]).journey?.days_delta).toBe(-1); // short cut -1 day
  });

  it('detection: eye_delta is the growth up to the detection (+1), not growth-plus-reset (TP1)', () => {
    const detection: JourneyEvent = {
      kind: 'detection',
      awareness: 14,
      threshold: 14,
      sceneText: 'Шпионы Врага узнают о задании героя.',
      resetTo: 0,
    };
    const record: StepRecord = { events: [sceneEvent, detection], travelCheck: check(), sceneCheck: check(), travelRoll: ROLL, sceneRoll: ROLL };
    // awareness 13 -> event awareness 14 (threshold reached) -> engine reset to the initial 0
    const turn = extractTurn(hero({ eye: { awareness: 13, initial: 0 } }), hero({ shadow: { points: 1, scars: 0 } }), record);
    expect(turn.patch).toEqual({ shadow_delta: 1, eye_delta: 1 });
    expect(turn.detection).toEqual({ table: 'detection_scenes', scene: 'Шпионы Врага узнают о задании героя.' });
    expect(turn.detection?.scene).toBe(detection.kind === 'detection' ? detection.sceneText : null); // verbatim
  });

  it('record.travelCheck === null (the engine already-arrived no-op) throws: not a turn', () => {
    const noop: StepRecord = { events: [], travelCheck: null, sceneCheck: null, travelRoll: null, sceneRoll: null };
    expect(() => extractJourneyTurn(jstate(hero(), 7, true), jstate(hero(), 7, true), noop)).toThrow(/not a turn/);
  });

  it('DD-DICE-FACES: faces come off the step roll verbatim (scene -> dice, travel -> journey.travel_check)', () => {
    const sceneRoll = roll(
      {
        successDice: [
          { face: 2, isSuccessIcon: false },
          { face: 6, isSuccessIcon: true },
          { face: 3, isSuccessIcon: false },
        ],
        successDiceCount: 3,
      },
      [false, true, false], // engine flags (weary): passed through, never re-derived
    );
    const record: StepRecord = { events: [sceneEvent], travelCheck: check(), sceneCheck: check({ total: 13 }), travelRoll: ROLL, sceneRoll };
    const turn = extractTurn(hero(), hero(), record);
    expect(turn.dice).toMatchObject({ feat_die: 7, success_dice: [2, 6, 3], success_counted: [false, true, false], total: 13 });
    expect(turn.journey?.travel_check).toMatchObject(ROLL_FACES);
    expect('feat_candidates' in (turn.dice ?? {})).toBe(false); // normal roll -> no candidates ...
    expect('feat_modifier' in (turn.dice ?? {})).toBe(false); // ... and no modifier
  });

  it('DD-DICE-FACES: feat_candidates lists every Feat face when favoured / ill-favoured; feat_die is the KEPT one', () => {
    const ill = roll({ feat: featDie(3), featCandidates: [featDie(9), featDie(3)], featModifier: 'ill_favoured' });
    const record: StepRecord = { events: [sceneEvent], travelCheck: check(), sceneCheck: check(), travelRoll: ROLL, sceneRoll: ill };
    const dice = extractTurn(hero(), hero(), record).dice;
    expect(dice?.feat_die).toBe(3);
    expect(dice?.feat_candidates).toEqual([9, 3]);
    expect(dice?.feat_modifier).toBe('ill_favoured'); // copied from the roll's featModifier
    const fav = roll({ feat: featDie(9), featCandidates: [featDie(9), featDie(3)], featModifier: 'favoured' });
    const favDice = extractTurn(hero(), hero(), { ...record, sceneRoll: fav }).dice;
    expect(favDice?.feat_modifier).toBe('favoured');
    expect(favDice?.feat_die).toBe(9);
  });

  it('DD-DICE-FACES: the faces never reach the Keeper text (render suppresses the UI-only keys)', () => {
    const ill = roll({ feat: featDie(3), featCandidates: [featDie(9), featDie(3)], featModifier: 'ill_favoured' });
    const record: StepRecord = { events: [sceneEvent], travelCheck: check(), sceneCheck: check(), travelRoll: ill, sceneRoll: ill };
    const pkg = buildNarrativePackage(extractTurn(hero(), hero(), record));
    expect(pkg.dice?.feat_candidates).toEqual([9, 3]); // present in the package (for the UI) ...
    const out = renderNarrativePackage(pkg);
    for (const k of ['feat_die', 'success_dice', 'feat_candidates', 'feat_modifier', 'success_counted']) {
      expect(out, k).not.toContain(`${k}:`); // ... absent from the rendered body, ## dice and ## journey alike
    }
  });

  it('a check without its roll is an engine invariant violation: throws', () => {
    const broken: StepRecord = { events: [sceneEvent], travelCheck: check(), sceneCheck: check(), travelRoll: ROLL, sceneRoll: null };
    expect(() => extractTurn(hero(), hero(), broken)).toThrow(/scene check without its roll/);
    const brokenTravel: StepRecord = { events: [sceneEvent], travelCheck: check(), sceneCheck: check(), travelRoll: null, sceneRoll: ROLL };
    expect(() => extractTurn(hero(), hero(), brokenTravel)).toThrow(/travel check without its roll/);
  });

  it('surface: the hero-level projection is internal; extractJourneyTurn is the public producer (P4)', () => {
    expect('extractTurn' in api).toBe(false);
    expect('projectStep' in api).toBe(false);
    expect(typeof api.extractJourneyTurn).toBe('function');
  });
});
