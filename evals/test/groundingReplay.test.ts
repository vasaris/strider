// NF1 ACCEPTANCE: replay the grounding check over the 4 committed L4 full-cycle records
// (evals/l4-records/, 4 x 9 = 36 Keeper proses) offline. The invented 'Пригорье' (DEFERRED NF1
// evidence) must block in exactly the two known transcripts and nowhere else.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { replayGrounding, type ReplayRecord, type ReplayTranscript } from '../src/groundingReplay.js';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'l4-records');

function loadRecords(): ReplayRecord[] {
  return readdirSync(dir)
    .filter((f) => f.startsWith('full-cycle-report.') && f.endsWith('.json'))
    .sort()
    .map((f) => {
      const json = JSON.parse(readFileSync(resolve(dir, f), 'utf8')) as {
        report: { transcripts: readonly ReplayTranscript[] };
      };
      return { name: f.slice(0, -'.json'.length), transcripts: json.report.transcripts };
    });
}

describe('NF1 replay over the committed L4 records (acceptance)', () => {
  const records = loadRecords();
  const rows = replayGrounding(records);

  it('reads 4 records x 9 transcripts', () => {
    expect(records).toHaveLength(4);
    expect(rows).toHaveLength(36);
  });

  it('blocks EXACTLY the two known Пригорье inventions', () => {
    const blocked = rows.filter((r) => r.blocks.length > 0).map((r) => [r.record, r.scenarioId, r.blocks]);
    expect(blocked).toEqual([
      ['full-cycle-report.v0.1.claude-opus-4-8', 'j.dark.misfortune', ['Пригорья']],
      ['full-cycle-report.v0.3.claude-opus-4-8', 'j.wild.meeting', ['Пригорья']],
    ]);
  });

  it('pins the relative-backstory warns (10; all seeds have empty journal_facts)', () => {
    const warned = rows.filter((r) => r.warns.length > 0).map((r) => [r.record, r.scenarioId, r.warns]);
    expect(warned).toEqual([
      ['full-cycle-report.v0.1.claude-opus-4-8', 'j.wild.mishap', ['Второй день']],
      ['full-cycle-report.v0.1.claude-opus-4-8', 'j.wild.meeting', ['второй день']],
      ['full-cycle-report.v0.1.claude-sonnet-5', 'j.wild.mishap', ['вчера', 'позавчера']],
      ['full-cycle-report.v0.1.claude-sonnet-5', 'j.wild.meeting', ['вчерашнего']],
      // 'вчера' here is the documented comparison false class ("будто дождь тут шёл вчера").
      ['full-cycle-report.v0.3.claude-opus-4-8', 'j.border.shortcut', ['вчера']],
      ['full-cycle-report.v0.3.claude-opus-4-8', 'j.border.inspiring', ['третий день']],
      ['full-cycle-report.v0.3.claude-opus-4-8', 'j.wild.mishap', ['Второй день']],
      ['full-cycle-report.v0.3.claude-opus-4-8', 'j.wild.meeting', ['вторые сутки', 'третий день']],
    ]);
    expect(rows.reduce((n, r) => n + r.warns.length, 0)).toBe(10);
  });
});
