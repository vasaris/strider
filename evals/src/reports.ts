// RP1 (DEFERRED RP1; first eval commit of Stage 3): keyed reports never overwrite each other.
// The raw calibration JSONs of v0.1/v0.2 were lost because calibrate.mts always wrote
// evals/calibration-report.json, and full-cycle.mts overwrote full-cycle-report.<model>.json.
// Every keyed report name now carries the prompt version(s), the model and a UTC timestamp, and
// is written with an EXCLUSIVE create ('wx'): an existing file is an error, never a silent
// overwrite. Names keep the evals/.gitignore stems (calibration-report.*, full-cycle-report*,
// keeper-smoke.*), so the working-copy reports stay ignored; the audit trail stays a deliberate
// copy into evals/l4-records/.
import { writeFileSync } from 'node:fs';

export type ReportKind = 'calibration' | 'full-cycle' | 'keeper-smoke';

export interface ReportNameInput {
  readonly kind: ReportKind;
  /** Repo-relative prompt paths (e.g. 'prompts/judge.system.v0.3.md'). calibration needs judge;
   *  full-cycle needs keeper AND judge; keeper-smoke needs keeper. */
  readonly prompts: { readonly keeper?: string; readonly judge?: string };
  /** calibration: the judge model; full-cycle / keeper-smoke: the Keeper model. */
  readonly model: string;
  readonly now: Date;
}

const PROMPT_VERSION = /\.system\.(v\d+(?:\.\d+)*)\.md$/;

/** 'prompts/judge.system.v0.3.md' -> 'v0.3'; 'prompts/judge.system.v0.md' -> 'v0'. Throws on a
 *  path without a `.system.v<N>[.<M>...].md` suffix. */
export function promptVersionOf(promptPath: string): string {
  const m = PROMPT_VERSION.exec(promptPath);
  if (!m?.[1]) throw new Error(`prompt path has no .system.v<N>.md version: ${promptPath}`);
  return m[1];
}

/** 2026-09-28T10:11:12.345Z -> '20260928T101112Z' (UTC, second resolution). */
export function utcStamp(now: Date): string {
  return `${now.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

function sanitizeModel(model: string): string {
  if (model.length === 0) throw new Error('report model is empty');
  return model.replace(/[^A-Za-z0-9._-]/g, '_');
}

function need(path: string | undefined, role: 'keeper' | 'judge', kind: ReportKind): string {
  if (path === undefined) throw new Error(`${kind} report needs prompts.${role}`);
  return promptVersionOf(path);
}

export function reportFileName(input: ReportNameInput): string {
  const { kind, prompts } = input;
  const model = sanitizeModel(input.model);
  const stamp = utcStamp(input.now);
  switch (kind) {
    case 'calibration':
      return `calibration-report.judge-${need(prompts.judge, 'judge', kind)}.${model}.${stamp}.json`;
    case 'full-cycle':
      return (
        `full-cycle-report.keeper-${need(prompts.keeper, 'keeper', kind)}` +
        `.judge-${need(prompts.judge, 'judge', kind)}.${model}.${stamp}.json`
      );
    case 'keeper-smoke':
      return `keeper-smoke.keeper-${need(prompts.keeper, 'keeper', kind)}.${model}.${stamp}.json`;
  }
}

/** Create `path` with `body` (utf8); throws (EEXIST) if it already exists -- never overwrites. */
export function writeReportExclusive(path: string, body: string): void {
  writeFileSync(path, body, { encoding: 'utf8', flag: 'wx' });
}
