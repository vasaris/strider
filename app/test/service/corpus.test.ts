// Corpus sanity through the APP gate path (K4): gateProse (src/server/service/gate.ts) with the
// pack's VK addendum over the 58 recorded Keeper proses (evals/l4-records + evals/records, read as
// DATA with fs -- no evals code is imported), each with its own recorded package. The expected
// verdicts are the ones prose-gate's own SA1 corpus test pins: 5 blocked proses (4 known + the
// SA1 mishap) and 2 SA1 warns. No prose text is asserted on, only ids and verdict shapes.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { NarrativePackage } from '@brodyazhnik/orchestrator';
import { describe, expect, it } from 'vitest';

import { gateProse } from '../../src/server/service/gate';
import { REPO, VK } from '../support/service';

interface CorpusProse {
  readonly id: string;
  readonly prose: string;
  readonly pkg: NarrativePackage;
}

function loadCorpus(): CorpusProse[] {
  const out: CorpusProse[] = [];
  for (const dir of ['evals/l4-records', 'evals/records']) {
    const abs = join(REPO, dir);
    for (const f of readdirSync(abs).filter((n) => n.startsWith('full-cycle-report.') && n.endsWith('.json')).sort()) {
      const json = JSON.parse(readFileSync(join(abs, f), 'utf8')) as {
        report: { transcripts: { scenarioId: string; package: NarrativePackage; output: { prose: string } }[] };
      };
      for (const t of json.report.transcripts) out.push({ id: `${dir}/${f}#${t.scenarioId}`, prose: t.output.prose, pkg: t.package });
    }
  }
  return out;
}

describe('the app gate over the recorded corpus', () => {
  const corpus = loadCorpus();

  it('58 proses, 5 blocked (4 known + the SA1 mishap), 2 SA1 warns', () => {
    expect(corpus).toHaveLength(58);
    const blocked: Record<string, string[]> = {};
    let sa1Warns = 0;
    for (const c of corpus) {
      const v = gateProse(c.prose, VK, c.pkg);
      expect(v.blocked).toBe(v.findings.some((f) => f.severity === 'block'));
      if (v.blocked) blocked[c.id] = v.findings.filter((f) => f.severity === 'block').map((f) => f.list);
      sa1Warns += v.findings.filter((f) => f.list === 'sa1_plural' && f.severity === 'warn').length;
    }
    expect(blocked).toEqual({
      'evals/l4-records/full-cycle-report.v0.1.claude-opus-4-8.json#j.border.shortcut': ['mixed_script'],
      'evals/l4-records/full-cycle-report.v0.1.claude-opus-4-8.json#j.dark.misfortune': ['nf1_name'],
      'evals/l4-records/full-cycle-report.v0.3.claude-opus-4-8.json#j.wild.meeting': ['nf1_name'],
      'evals/records/full-cycle-report.keeper-v0.3.judge-v0.4.claude-opus-4-8.20260927T223309Z.json#j.wild.mishap': ['sa1_plural'],
      'evals/records/full-cycle-report.keeper-v0.3.judge-v0.4.claude-sonnet-5.20260927T222434Z.json#j.dark.despair': ['mixed_script'],
    });
    expect(sa1Warns).toBe(2);
  });
});
