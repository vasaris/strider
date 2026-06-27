import { describe, expect, it } from 'vitest';
import { formatReport } from '../src/harness/calibrationRunner.js';
import type { CalibrationReport, CalibrationRow } from '../src/harness/calibrationRunner.js';
import type { RubricAxis } from '../src/harness/types.js';

const NULL_SCORES = {
  specificity: null,
  accuracy: null,
  playability: null,
  agency: null,
  tone: null,
  anti_slop: null,
} as Record<RubricAxis, number | null>;

function row(over: Partial<CalibrationRow>): CalibrationRow {
  return {
    id: 'G1',
    kind: 'good',
    targetAxis: null,
    scores: NULL_SCORES,
    aggregate: null,
    antiSlopBlocking: false,
    error: null,
    rawSample: null,
    provisionalOk: null,
    ...over,
  };
}

function report(rows: CalibrationRow[]): CalibrationReport {
  return { model: 'test', rows, raw: [] };
}

describe('formatReport rawSample echo (offline)', () => {
  it('echoes a one-line rawSample slice on a parse error and COLLAPSES newlines', () => {
    const multiline = '{\n  "specificity": {\n    "score": 85,\n';
    const out = formatReport(
      report([row({ id: 'G1', error: 'llm output truncated (unbalanced JSON — likely max_tokens)', rawSample: multiline })]),
    );
    const g1Lines = out.split('\n').filter((l) => l.startsWith('G1'));
    expect(g1Lines).toHaveLength(1); // the multi-line rawSample did NOT split the table row
    const line = g1Lines[0] ?? '';
    expect(line).toContain('ERROR: llm output truncated');
    expect(line).toContain('raw:');
    expect(line).toContain('{ "specificity": { "score": 85,'); // whitespace collapsed
  });

  it('emits no raw: segment when there is no rawSample (clean row)', () => {
    const out = formatReport(report([row({ id: 'G2', scores: { ...NULL_SCORES } })]));
    const line = out.split('\n').find((l) => l.startsWith('G2')) ?? '';
    expect(line).not.toContain('raw:');
  });
});
