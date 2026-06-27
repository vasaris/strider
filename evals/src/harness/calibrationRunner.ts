import { aggregateMean } from './aggregate.js';
import type { CalibrationCase } from './cases.js';
import { LlmJudge } from './llmJudge.js';
import type { JudgeContext, LlmClient, RubricAxis, Verdict } from './types.js';

const AXES: readonly RubricAxis[] = [
  'specificity',
  'accuracy',
  'playability',
  'agency',
  'tone',
  'anti_slop',
];

// Provisional subtle-axis "dropped" cutoff -- DIAGNOSTIC ANNOTATION ONLY, not a gate.
// The real cutoff is a calibration decision made after the raw report is reviewed.
const PROVISIONAL_DROP_BELOW = 70;

export interface CalibrationRow {
  readonly id: string;
  readonly kind: CalibrationCase['kind'];
  readonly targetAxis: RubricAxis | null;
  readonly scores: Readonly<Record<RubricAxis, number | null>>;
  readonly aggregate: { readonly score: number; readonly pass: boolean } | null;
  readonly antiSlopBlocking: boolean; // deterministic gate (informational)
  readonly error: string | null;
  readonly rawSample: string | null; // raw LLM reply on a parse error (self-diagnosis); null otherwise
  /** Per-kind PROVISIONAL expectation (diagnostic only): good->agg pass; coarse->agg fail;
   *  subtle->target axis below the provisional cutoff AND deterministic anti_slop clean. */
  readonly provisionalOk: boolean | null;
}

export interface CalibrationReport {
  readonly model: string;
  readonly rows: readonly CalibrationRow[];
  readonly raw: ReadonlyArray<{ readonly id: string; readonly verdict: Verdict }>;
}

function rowFromVerdict(c: CalibrationCase, v: Verdict): CalibrationRow {
  const scores = Object.fromEntries(AXES.map((a) => [a, v.axes[a].score])) as Record<RubricAxis, number | null>;
  const aggregate = v.aggregate ? { score: v.aggregate.score, pass: v.aggregate.pass } : null;
  const antiSlopBlocking = v.antiSlop.blocking;
  const error = v.error ?? null;
  const rawSample = v.rawSample ?? null;
  const target = c.targetAxis ?? null;

  let provisionalOk: boolean | null;
  if (error) {
    provisionalOk = null; // an eval error is not a pass/fail -- excluded (see aggregate.ts note)
  } else if (c.kind === 'good') {
    provisionalOk = aggregate?.pass === true;
  } else if (c.kind === 'coarse') {
    provisionalOk = aggregate ? !aggregate.pass : null;
  } else {
    // subtle
    const ts = target ? scores[target] : null;
    provisionalOk = ts !== null && ts < PROVISIONAL_DROP_BELOW && !antiSlopBlocking;
  }

  return { id: c.id, kind: c.kind, targetAxis: target, scores, aggregate, antiSlopBlocking, error, rawSample, provisionalOk };
}

/**
 * Run the judge (short-circuit OFF -- scores EVERYTHING incl. block-caught prose) over the
 * case set and collect a report. `aggregate` is mean WITHOUT a floor on the first run by
 * design -- we want to see raw axes before deciding whether a per-axis floor is warranted.
 * Pure: takes the LlmClient injected (mock in tests, AnthropicLlmClient at calibration).
 */
export async function runCalibration(opts: {
  readonly llm: LlmClient;
  readonly model: string;
  readonly systemPrompt: string;
  readonly cases: readonly CalibrationCase[];
  readonly ctx?: JudgeContext;
}): Promise<CalibrationReport> {
  const judge = new LlmJudge({
    llm: opts.llm,
    model: opts.model,
    systemPrompt: opts.systemPrompt,
    shortCircuit: false, // calibration: the LLM must see block-caught prose too
    aggregate: aggregateMean, // no floor on the first diagnostic run
  });
  const ctx = opts.ctx ?? {};
  const rows: CalibrationRow[] = [];
  const raw: Array<{ id: string; verdict: Verdict }> = [];
  for (const c of opts.cases) {
    const verdict = await judge.score(c.prose, ctx);
    raw.push({ id: c.id, verdict });
    rows.push(rowFromVerdict(c, verdict));
  }
  return { model: opts.model, rows, raw };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
function cell(n: number | null): string {
  return pad(n === null ? '—' : String(n), 4);
}

/** Human-readable table. The raw per-axis JSON (report.raw) is the full picture; this is the
 *  summary the user reads at a glance. */
export function formatReport(r: CalibrationReport): string {
  const lines: string[] = [];
  lines.push(`Tone-judge calibration (DIAGNOSTIC, first run) — model: ${r.model}`);
  lines.push('axes: spc acc ply agn ton ans   | agg(pass) | detBlock | target | provOK');
  for (const row of r.rows) {
    const s = row.scores;
    const axisCells = `${cell(s.specificity)}${cell(s.accuracy)}${cell(s.playability)}${cell(s.agency)}${cell(s.tone)}${cell(s.anti_slop)}`;
    const agg = row.aggregate ? `${pad(String(row.aggregate.score), 3)}(${row.aggregate.pass ? 'Y' : 'N'})` : ' — (—)';
    const prov = row.provisionalOk === null ? '—' : row.provisionalOk ? 'OK' : 'XX';
    const tgt = pad(row.targetAxis ?? '—', 11);
    const errMsg = row.error ? `  ERROR: ${row.error}` : '';
    // Echo a one-line rawSample slice so a parse failure reads off the table without opening the
    // JSON. Collapse whitespace first (a multi-line reply would otherwise break the table layout).
    const sample = row.rawSample ? `  raw: ${row.rawSample.replace(/\s+/g, ' ').trim().slice(0, 120)}` : '';
    lines.push(`${pad(row.id, 3)} ${pad(row.kind, 7)} ${axisCells} | ${agg} |   ${row.antiSlopBlocking ? 'BLOCK' : 'clean'} | ${tgt} | ${prov}${errMsg}${sample}`);
  }
  const goods = r.rows.filter((x) => x.kind === 'good');
  const subtles = r.rows.filter((x) => x.kind === 'subtle');
  const goodPass = goods.filter((x) => x.provisionalOk === true).length;
  const subtleOk = subtles.filter((x) => x.provisionalOk === true).length;
  lines.push('');
  lines.push(`PROVISIONAL (diagnostic only): good ${goodPass}/${goods.length} >=80; subtle ${subtleOk}/${subtles.length} dropped on target axis w/ clean det anti_slop.`);
  lines.push('Do NOT tune the rubric on this alone -- bring the raw report here for analysis first.');
  return lines.join('\n');
}
