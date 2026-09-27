import { describe, expect, it } from 'vitest';
import {
  buildNarrativePackage,
  provisionalLengthFor,
  type EngineTurnResult,
} from '../src/provider.js';

// A journey scene that resolved to a significant-encounter detail (SD1 Fork A row).
const TURN: EngineTurnResult = {
  intent: 'journey',
  scene: 'journey',
  dice: {
    feat_die: 7,
    feat_symbol: null,
    success_dice: [6, 3],
    success_icons: 1,
    total: 16,
    target_number: 14,
    outcome: 'strong',
  },
  oracleTable: 'journey_scenes',
  oracleResultRef: 'terrible_misfortune',
  detailTable: 'scene_details.terrible_misfortune',
  sceneDetail: { face: 1, scene: 'Острый конфликт', prompt: 'Значимая встреча', skill: null, significantEncounter: true },
  patch: { fatigue_delta: 3, eye_delta: 1, conditions_gained: ['wounded'] },
  journalFacts: [{ kind: 'threat', text: 'a foe closes in' }],
};

describe('orchestrator package provider (structural seam)', () => {
  it('surfaces the full SD1 detail row into oracle.detail.row, without re-rolling', () => {
    const p = buildNarrativePackage(TURN);
    expect(p.oracle?.table).toBe('journey_scenes');
    expect(p.oracle?.detail?.table).toBe('scene_details.terrible_misfortune');
    expect(p.oracle?.detail?.row).toEqual({
      face: 1,
      scene: 'Острый конфликт',
      prompt: 'Значимая встреча',
      skill: null,
      significantEncounter: true,
    });
    expect(p.oracle?.detail?.detail).toBeNull(); // SD1 is exactly one second level
  });

  it('fills package fields from the turn; lore_chunks is an empty slot pre-activation', () => {
    const p = buildNarrativePackage(TURN);
    expect(p.intent).toBe('journey');
    expect(p.scene).toBe('journey');
    expect(p.dice?.outcome).toBe('strong');
    expect(p.patch?.fatigue_delta).toBe(3);
    expect(p.journal_facts).toEqual([{ kind: 'threat', text: 'a foe closes in' }]);
    expect(p.lore_chunks).toEqual([]); // empty until LT1 lore activation
  });

  it('length_target is provisional scene-bounds (real source: tone.md / LT1)', () => {
    expect(buildNarrativePackage(TURN).length_target).toEqual(provisionalLengthFor('journey'));
  });

  it('a turn without an oracle yields oracle null (e.g. a mundane action)', () => {
    const p = buildNarrativePackage({ intent: 'mundane', scene: 'free' });
    expect(p.oracle).toBeNull();
    expect(p.dice).toBeNull();
    expect(p.journal_facts).toEqual([]);
  });

  it('whole-package pin: key order and the TP1 slots default to null', () => {
    const p = buildNarrativePackage({ intent: 'mundane', scene: 'free' });
    expect(p).toEqual({
      intent: 'mundane',
      scene: 'free',
      length_target: provisionalLengthFor('free'),
      dice: null,
      oracle: null,
      detection: null,
      patch: null,
      journey: null,
      lore_chunks: [],
      journal_facts: [],
    });
    expect(Object.keys(p)).toEqual([
      'intent',
      'scene',
      'length_target',
      'dice',
      'oracle',
      'detection',
      'patch',
      'journey',
      'lore_chunks',
      'journal_facts',
    ]);
  });

  it('TP1: journey and detection pass through from the turn verbatim', () => {
    const journey = {
      days_delta: -1,
      travel_check: { feat_symbol: null, success_icons: 1, target_number: 13, outcome: 'weak' },
    } as const;
    const detection = { table: 'detection_scenes', scene: 'Слуги Врага устраивают засаду или ловушку.' };
    const p = buildNarrativePackage({ ...TURN, journey, detection });
    expect(p.journey).toEqual(journey);
    expect(p.detection).toEqual(detection);
    expect(p.dice?.target_number).toBe(14); // the scene check stays in dice, untouched by the travel roll
  });

  it('an oracle turn with no scene detail leaves oracle.detail null', () => {
    const p = buildNarrativePackage({
      intent: 'yes_no_question',
      scene: 'free',
      oracleTable: 'answer',
      oracleResultRef: 'likely.yes',
    });
    expect(p.oracle?.table).toBe('answer');
    expect(p.oracle?.detail ?? null).toBeNull();
  });
});
