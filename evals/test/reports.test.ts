// RP1: keyed report names carry prompt version(s) + model + UTC stamp, and are written
// exclusively (never overwrite). Offline; temp files only under os.tmpdir().
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { promptVersionOf, reportFileName, utcStamp, writeReportExclusive } from '../src/reports.js';

const NOW = new Date('2026-09-28T10:11:12.345Z');
const KEEPER = 'prompts/keeper.system.v0.2.md';
const JUDGE = 'prompts/judge.system.v0.3.md';

describe('RP1 report names', () => {
  it('promptVersionOf reads the .system.v<N>[.<M>].md suffix', () => {
    expect(promptVersionOf(JUDGE)).toBe('v0.3');
    expect(promptVersionOf('prompts/judge.system.v0.md')).toBe('v0');
    expect(promptVersionOf(KEEPER)).toBe('v0.2');
  });

  it('promptVersionOf throws on a versionless path', () => {
    expect(() => promptVersionOf('prompts/judge.system.md')).toThrow();
    expect(() => promptVersionOf('prompts/judge.md')).toThrow();
    expect(() => promptVersionOf('')).toThrow();
  });

  it('utcStamp is UTC, second resolution', () => {
    expect(utcStamp(NOW)).toBe('20260928T101112Z');
  });

  it('exact name per kind', () => {
    expect(reportFileName({ kind: 'calibration', prompts: { judge: JUDGE }, model: 'claude-opus-4-8', now: NOW })).toBe(
      'calibration-report.judge-v0.3.claude-opus-4-8.20260928T101112Z.json',
    );
    expect(
      reportFileName({ kind: 'full-cycle', prompts: { keeper: KEEPER, judge: JUDGE }, model: 'claude-sonnet-5', now: NOW }),
    ).toBe('full-cycle-report.keeper-v0.2.judge-v0.3.claude-sonnet-5.20260928T101112Z.json');
    expect(reportFileName({ kind: 'keeper-smoke', prompts: { keeper: KEEPER }, model: 'claude-opus-4-8', now: NOW })).toBe(
      'keeper-smoke.keeper-v0.2.claude-opus-4-8.20260928T101112Z.json',
    );
  });

  it('beats-cycle: its own stem, never the swept full-cycle-report. one (3.3a-K4b)', () => {
    const name = reportFileName({
      kind: 'beats-cycle',
      prompts: { keeper: 'prompts/keeper.system.v0.4.md', judge: 'prompts/judge.system.v0.4.md' },
      model: 'claude-sonnet-5',
      now: NOW,
    });
    expect(name).toBe('beats-cycle-report.keeper-v0.4.judge-v0.4.claude-sonnet-5.20260928T101112Z.json');
    expect(name.startsWith('full-cycle-report')).toBe(false);
    expect(() => reportFileName({ kind: 'beats-cycle', prompts: { judge: JUDGE }, model: 'm', now: NOW })).toThrow(/keeper/);
    expect(() => reportFileName({ kind: 'beats-cycle', prompts: { keeper: KEEPER }, model: 'm', now: NOW })).toThrow(/judge/);
  });

  it('sanitizes the model id', () => {
    expect(reportFileName({ kind: 'calibration', prompts: { judge: JUDGE }, model: 'org/model:v1 beta', now: NOW })).toBe(
      'calibration-report.judge-v0.3.org_model_v1_beta.20260928T101112Z.json',
    );
  });

  it('throws on a missing required prompt or an empty model', () => {
    expect(() => reportFileName({ kind: 'calibration', prompts: {}, model: 'm', now: NOW })).toThrow(/judge/);
    expect(() => reportFileName({ kind: 'calibration', prompts: { keeper: KEEPER }, model: 'm', now: NOW })).toThrow(/judge/);
    expect(() => reportFileName({ kind: 'full-cycle', prompts: { judge: JUDGE }, model: 'm', now: NOW })).toThrow(/keeper/);
    expect(() => reportFileName({ kind: 'full-cycle', prompts: { keeper: KEEPER }, model: 'm', now: NOW })).toThrow(/judge/);
    expect(() => reportFileName({ kind: 'keeper-smoke', prompts: { judge: JUDGE }, model: 'm', now: NOW })).toThrow(/keeper/);
    expect(() => reportFileName({ kind: 'calibration', prompts: { judge: JUDGE }, model: '', now: NOW })).toThrow(/model/);
    expect(() =>
      reportFileName({ kind: 'calibration', prompts: { judge: 'prompts/judge.md' }, model: 'm', now: NOW }),
    ).toThrow();
  });

  it('each name starts with its evals/.gitignore stem (reports stay ignored)', () => {
    const cal = reportFileName({ kind: 'calibration', prompts: { judge: JUDGE }, model: 'm', now: NOW });
    const fc = reportFileName({ kind: 'full-cycle', prompts: { keeper: KEEPER, judge: JUDGE }, model: 'm', now: NOW });
    const ks = reportFileName({ kind: 'keeper-smoke', prompts: { keeper: KEEPER }, model: 'm', now: NOW });
    expect(cal.startsWith('calibration-report.')).toBe(true);
    expect(fc.startsWith('full-cycle-report')).toBe(true);
    const bc = reportFileName({ kind: 'beats-cycle', prompts: { keeper: KEEPER, judge: JUDGE }, model: 'm', now: NOW });
    expect(bc.startsWith('beats-cycle-report')).toBe(true);
    expect(readFileSync(new URL('../.gitignore', import.meta.url), 'utf8').split('\n')).toContain('beats-cycle-report*');
    expect(ks.startsWith('keeper-smoke.')).toBe(true);
    expect(ks).not.toBe('keeper-smoke.mts'); // the re-included script itself
  });
});

describe('RP1 writeReportExclusive', () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  it('creates once; a second write to the same path throws EEXIST and leaves the file unchanged', () => {
    dir = mkdtempSync(join(tmpdir(), 'rp1-'));
    const path = join(dir, 'calibration-report.judge-v0.3.m.20260928T101112Z.json');
    writeReportExclusive(path, 'first\n');
    expect(readFileSync(path, 'utf8')).toBe('first\n');
    expect(() => writeReportExclusive(path, 'second\n')).toThrow(expect.objectContaining({ code: 'EEXIST' }));
    expect(readFileSync(path, 'utf8')).toBe('first\n');
  });
});
