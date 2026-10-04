import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadVkAddendumFromPack, type StopEntry } from '@brodyazhnik/prose-gate';
import { formatReport, runCalibration } from '../src/harness/calibrationRunner.js';
import type { CalibrationReport, CalibrationRow } from '../src/harness/calibrationRunner.js';
import type { CalibrationCase } from '../src/harness/cases.js';
import { CALIBRATION_CASES } from '../src/harness/cases.js';
import type { LlmClient, RubricAxis } from '../src/harness/types.js';

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

describe('runCalibration forwards opts.ctx to the judge (A3.2)', () => {
  const OK_JSON = JSON.stringify({
    specificity: { score: 85, notes: 'x' },
    accuracy: { score: 85, notes: 'x' },
    playability: { score: 85, notes: 'x' },
    agency: { score: 85, notes: 'x' },
    tone: { score: 85, notes: 'x' },
    anti_slop: { score: 85, notes: 'x' },
  });
  const llm: LlmClient = { complete: () => Promise.resolve(OK_JSON) };
  // A fixture addendum term that no built-in stop-list carries, so only the ctx can block it.
  const VK: readonly StopEntry[] = [{ term: 'тестовое клише', severity: 'block', reason: 'test VK addendum' }];
  const CASES: readonly CalibrationCase[] = [
    { id: 'T1', kind: 'good', prose: 'Под сапогом хрустнул ледок; тестовое клише висело в воздухе.' },
  ];

  it('with ctx.vkAddendum the deterministic gate blocks the addendum term', async () => {
    const r = await runCalibration({ llm, model: 'm', systemPrompt: 's', cases: CASES, ctx: { vkAddendum: VK } });
    expect(r.rows[0]?.antiSlopBlocking).toBe(true);
  });

  it('without ctx the same prose is not blocked', async () => {
    const r = await runCalibration({ llm, model: 'm', systemPrompt: 's', cases: CASES });
    expect(r.rows[0]?.antiSlopBlocking).toBe(false);
  });
});

describe('calibration invariance pin (NF1 never touches calibration)', () => {
  // Calibration cases carry no package, so the judges' scanTurnProse reduces to scanProse and
  // NF1 (grounding.ts) never applies. This pins the deterministic gate over CALIBRATION_CASES
  // with the live VK addendum: measured on HEAD 3a9cd89 BEFORE NF1 landed (13 cases, B1-B4
  // blocking, 17 violations). A DELIBERATE change to cases.ts or to the pack stop-list must
  // re-pin this hash with an explanation in the commit message.
  const OK_JSON = JSON.stringify({
    specificity: { score: 85, notes: 'x' },
    accuracy: { score: 85, notes: 'x' },
    playability: { score: 85, notes: 'x' },
    agency: { score: 85, notes: 'x' },
    tone: { score: 85, notes: 'x' },
    anti_slop: { score: 85, notes: 'x' },
  });
  const llm: LlmClient = { complete: () => Promise.resolve(OK_JSON) };
  const packRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'content-packs/kv');

  it('deterministic rows/verdicts hash is unchanged and carries no nf1_* violation', async () => {
    const report = await runCalibration({
      llm,
      model: 'mock',
      systemPrompt: 'S',
      cases: CALIBRATION_CASES,
      ctx: { vkAddendum: loadVkAddendumFromPack(packRoot) },
    });
    const blob = JSON.stringify({
      rows: report.rows.map((r) => ({ id: r.id, antiSlopBlocking: r.antiSlopBlocking })),
      det: report.raw.map((r) => ({ id: r.id, antiSlop: r.verdict.antiSlop })),
    });
    expect(createHash('sha256').update(blob).digest('hex')).toBe(
      '4920a8af74acef5fe0077e67f1ecceaafdb05de6e115a320096ab60f7c9609c0',
    );
    const lists = report.raw.flatMap((r) => r.verdict.antiSlop.violations.map((v) => v.list));
    expect(lists.some((l) => l.startsWith('nf1_'))).toBe(false);
  });
});
