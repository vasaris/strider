import type { CheckResult, HeroState, JourneyEvent, StepRecord } from '@brodyazhnik/engine';
import { describe, expect, it } from 'vitest';
import { buildNarrativePackage, extractTurn } from '../src/provider.js';

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

describe('extractTurn (turn-producer: engine step -> EngineTurnResult)', () => {
  it('maps the scene oracle refs + surfaces the SD1 row verbatim (no re-roll)', () => {
    const record: StepRecord = { events: [sceneEvent], travelCheck: check(), sceneCheck: check() };
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
      sceneCheck: check({ degree: 'great_success', successIcons: 99 }),
    };
    const turn = extractTurn(hero(), hero(), record);
    expect(turn.dice?.outcome).toBe('strong'); // from degree, regardless of the 99 icons
    expect(turn.dice?.success_icons).toBe(99); // icons passed through verbatim, not reinterpreted
  });

  it('maps every degree tier and failure', () => {
    const mk = (c: Partial<CheckResult>) =>
      extractTurn(hero(), hero(), { events: [], travelCheck: check(c), sceneCheck: null }).dice?.outcome;
    expect(mk({ outcome: 'failure', degree: null })).toBe('failure');
    expect(mk({ degree: 'success' })).toBe('weak');
    expect(mk({ degree: 'great_success' })).toBe('strong');
    expect(mk({ degree: 'extraordinary_success' })).toBe('extraordinary');
  });

  it('maps feat symbol (eye / gandalf / none) and omits total when null', () => {
    const eye = extractTurn(hero(), hero(), { events: [], travelCheck: check({ isEyeOnFeat: true }), sceneCheck: null });
    expect(eye.dice?.feat_symbol).toBe('eye');
    const gandalf = extractTurn(hero(), hero(), { events: [], travelCheck: check({ autoSuccess: true, total: null }), sceneCheck: null });
    expect(gandalf.dice?.feat_symbol).toBe('gandalf');
    expect('total' in (gandalf.dice ?? {})).toBe(false); // total omitted (contract is number-only)
  });

  it('derives the patch from a prev/next hero diff (only non-zero deltas + condition transitions)', () => {
    const prev = hero();
    const next = hero({ fatigue: 3, eye: { awareness: 1, initial: 0 }, wounded: true });
    const turn = extractTurn(prev, next, { events: [], travelCheck: check(), sceneCheck: null });
    expect(turn.patch).toEqual({ fatigue_delta: 3, eye_delta: 1, conditions_gained: ['wounded'] });
  });

  it('prefers the scene check over the travel check for the salient die', () => {
    const record: StepRecord = {
      events: [sceneEvent],
      travelCheck: check({ targetNumber: 99 }), // travel TN
      sceneCheck: check({ targetNumber: 14 }), // scene TN -> this one wins
    };
    expect(extractTurn(hero(), hero(), record).dice?.target_number).toBe(14);
  });

  it('feeds buildNarrativePackage end-to-end (turn-producer -> package)', () => {
    const record: StepRecord = { events: [sceneEvent], travelCheck: check(), sceneCheck: check({ degree: 'great_success' }) };
    const pkg = buildNarrativePackage(extractTurn(hero(), hero({ fatigue: 1 }), record));
    expect(pkg.oracle?.detail?.row?.scene).toBe('a turned ankle on scree'); // SD1 surfaced
    expect(pkg.dice?.outcome).toBe('strong');
    expect(pkg.patch?.fatigue_delta).toBe(1);
    expect(pkg.journal_facts).toEqual([]); // F-journal
  });

  it('a travel-only (arrival) step: no scene oracle, dice from the travel check', () => {
    const record: StepRecord = { events: [], travelCheck: check({ degree: 'success' }), sceneCheck: null };
    const turn = extractTurn(hero(), hero(), record);
    expect(turn.oracleTable).toBeUndefined();
    expect(turn.sceneDetail).toBeUndefined();
    expect(turn.dice?.outcome).toBe('weak');
  });
});
