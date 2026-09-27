import { describe, expect, it } from 'vitest';
import {
  type ClarifyingQuestion,
  type LengthTarget,
  type NarrativePackage,
  type OracleResult,
} from '../src/contract.js';

// Illustrative length target. The CANON ranges (arch sec 2.3 rule 4) are NOT asserted
// here -- they are a calibration parameter owned by tone.md (LT1), tuned in chat 2.3.
// The contract round-trips at ANY numbers, so the fixture uses arbitrary values.
const ILLUSTRATIVE_LENGTH: LengthTarget = { min_chars: 120, max_chars: 240 };

// A representative package exercising every slot: dice, oracle WITH the SD1 second
// level nested, a state patch, an opaque lore chunk, and journal facts. If the
// contract shape drifts, this fixture stops type-checking -- that is the round-trip.
const FIXTURE: NarrativePackage = {
  intent: 'journey',
  scene: 'journey',
  length_target: ILLUSTRATIVE_LENGTH,
  dice: {
    feat_die: 7,
    feat_symbol: null,
    success_dice: [6, 3],
    success_icons: 1,
    total: 16,
    target_number: 14,
    outcome: 'strong',
  },
  oracle: {
    table: 'misfortune',
    result_ref: 'kv.solo.scene.terrible_misfortune',
    // SD1 second-level sub-table slot -- present here to prove the contract already
    // carries it before the engine rolls it (chat 2.2.a).
    detail: {
      table: 'scene_details.terrible_misfortune',
      result_ref: 'kv.solo.scene_details.terrible_misfortune.row_4',
      detail: null,
    },
  },
  detection: { table: 'detection_scenes', scene: 'opaque pack text at runtime' },
  patch: {
    fatigue_delta: 2,
    eye_delta: 1,
    conditions_gained: ['weary'],
    notes: ['crossing took its toll'],
  },
  journey: {
    days_delta: 0,
    travel_check: { feat_symbol: null, success_icons: 0, target_number: 14, outcome: 'failure' },
  },
  lore_chunks: [
    { chunk_id: 'lore.eriador.placeholder', text: 'opaque pack content at runtime' },
  ],
  journal_facts: [{ kind: 'threat', text: 'the Eye stirs' }],
};

describe('narrative contract', () => {
  it('a full package satisfies the contract shape (round-trip)', () => {
    expect(FIXTURE.intent).toBe('journey');
    expect(FIXTURE.dice?.outcome).toBe('strong');
    expect(FIXTURE.journal_facts?.[0]?.kind).toBe('threat');
  });

  it('length_target round-trips at arbitrary (non-canon) numbers', () => {
    // Type carries the shape only; the calibrated numbers come from tone.md (LT1).
    expect(FIXTURE.length_target.max_chars).toBeGreaterThan(FIXTURE.length_target.min_chars);
    const other: NarrativePackage = { ...FIXTURE, length_target: { min_chars: 1, max_chars: 9999 } };
    expect(other.length_target.min_chars).toBe(1);
  });

  it('carries the SD1 second-level oracle slot without contract change', () => {
    const detail: OracleResult | null | undefined = FIXTURE.oracle?.detail;
    expect(detail).not.toBeNull();
    expect(detail?.table).toBe('scene_details.terrible_misfortune');
    // The slot nests recursively but terminates: detail.detail is null here.
    expect(detail?.detail).toBeNull();
  });

  it('TP1: journey progress (days_delta 0 included, arrival fields optional) and detection slots', () => {
    expect(FIXTURE.journey?.days_delta).toBe(0);
    expect(FIXTURE.journey?.arrived).toBeUndefined();
    expect(FIXTURE.journey?.travel_check.outcome).toBe('failure');
    expect(FIXTURE.detection?.table).toBe('detection_scenes');
    const arrival: NarrativePackage = {
      ...FIXTURE,
      dice: null,
      oracle: null,
      detection: null,
      journey: { days_delta: 0, arrived: true, days_total: 6, travel_check: { outcome: 'weak' } },
    };
    expect(arrival.journey?.days_total).toBe(6);
    // A package without the TP1 slots is still a valid package (additive extension).
    const { journey: _j, detection: _d, ...legacy } = FIXTURE;
    const stillValid: NarrativePackage = legacy;
    expect(stillValid.intent).toBe('journey');
  });

  it('clarifying questions support both modes (Q2); options present iff mode=options', () => {
    const free: ClarifyingQuestion = { prompt: 'where to next?', mode: 'free_text' };
    const bounded: ClarifyingQuestion = {
      prompt: 'ford or bridge?',
      mode: 'options',
      options: ['ford', 'bridge'],
    };
    expect(free.mode).toBe('free_text');
    expect(bounded.mode === 'options' && bounded.options.length).toBe(2);
  });
});
