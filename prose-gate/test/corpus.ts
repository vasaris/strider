// Shared test helper (3.3a-K3; extracted from sa1.test.ts): every recorded Keeper prose with the
// package it was written for -- full-cycle-report.*.json in evals/l4-records and evals/records,
// read as DATA with fs (no evals code is imported). Not a test file itself.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NarrativePackage } from '@brodyazhnik/orchestrator';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const packRoot = resolve(repoRoot, 'content-packs/kv');

export interface CorpusProse {
  readonly id: string;
  readonly prose: string;
  readonly pkg: NarrativePackage;
}

/** Every recorded Keeper prose: full-cycle-report.*.json in evals/l4-records and evals/records. */
export function loadCorpus(): CorpusProse[] {
  const out: CorpusProse[] = [];
  for (const dir of ['evals/l4-records', 'evals/records']) {
    const abs = resolve(repoRoot, dir);
    for (const f of readdirSync(abs).filter((n) => n.startsWith('full-cycle-report.') && n.endsWith('.json')).sort()) {
      const json = JSON.parse(readFileSync(resolve(abs, f), 'utf8')) as {
        report: { transcripts: { scenarioId: string; package: NarrativePackage; output: { prose: string } }[] };
      };
      for (const t of json.report.transcripts) {
        out.push({ id: `${dir}/${f}#${t.scenarioId}`, prose: t.output.prose, pkg: t.package });
      }
    }
  }
  return out;
}
