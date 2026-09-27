import type { NarrativePackage } from '@brodyazhnik/orchestrator';
import { runScenario } from './run.js';
import type { Judge, JudgeContext, Keeper, RubricAxis, Seed, Transcript } from './types.js';

// Suite runner (A3.3, roadmap L3): run a set of seeds through the full cycle and summarize.
//
// Each seed goes through the EXISTING runScenario (seed -> package -> Keeper -> judge), so the
// judge sees each run's own package (runScenario injects ctx.package). The summary is pure and
// follows the harness rules already in place:
//   - an error-verdict is EXCLUDED from the pass-rate and flagged "re-run", never folded in as a
//     failing 0 (aggregate.ts suite forward-note);
//   - only verdicts with an aggregate (all six axes scored, RECONCILE 7) count as scored;
//   - a pass needs the >=80 aggregate AND the deterministic hard gate (verdict.pass).

/** PROVISIONAL (roadmap: suite pass-rate >= 80%). A named calibration knob, never a literal in logic. */
export const SUITE_PASS_RATE = 0.8;

const AXES: readonly RubricAxis[] = ['specificity', 'accuracy', 'playability', 'agency', 'tone', 'anti_slop'];

export interface SuiteConfig<S extends Seed> {
  readonly packageProvider: (seed: S) => NarrativePackage | Promise<NarrativePackage>;
  readonly keeper: Keeper;
  readonly judge: Judge;
  readonly ctx?: JudgeContext;
}

export interface AxisStat {
  readonly mean: number | null; // rounded to 1 decimal; null when n === 0
  readonly min: number | null;
  readonly n: number;
}

export interface SuiteSummary {
  readonly n: number;
  /** Scenario ids whose verdict carries an error: excluded from the pass-rate, flagged "re-run". */
  readonly errored: readonly string[];
  /** Verdicts with an aggregate (all six axes scored -- RECONCILE 7). */
  readonly scored: number;
  /** Per axis, over the verdicts where that axis has status 'scored'. */
  readonly perAxis: Readonly<Record<RubricAxis, AxisStat>>;
  /** Over the aggregate scores. */
  readonly aggregate: AxisStat;
  /** Verdicts whose deterministic anti-slop gate blocked. */
  readonly hardGateFails: number;
  /** aggregate.pass && verdict.pass (hard gate) && no error. */
  readonly passCount: number;
  /** passCount / scored; null when scored === 0. */
  readonly passRate: number | null;
  /** passRate >= SUITE_PASS_RATE; null when passRate is null. */
  readonly suitePass: boolean | null;
  readonly rule: string;
}

export interface SuiteReport {
  readonly transcripts: readonly Transcript[];
  readonly summary: SuiteSummary;
}

/** Run the seeds sequentially through runScenario, then summarize. */
export async function runSuite<S extends Seed>(seeds: readonly S[], cfg: SuiteConfig<S>): Promise<SuiteReport> {
  const transcripts: Transcript[] = [];
  for (const seed of seeds) {
    transcripts.push(
      await runScenario({
        seed,
        packageProvider: () => cfg.packageProvider(seed),
        keeper: cfg.keeper,
        judge: cfg.judge,
        ...(cfg.ctx ? { ctx: cfg.ctx } : {}),
      }),
    );
  }
  return { transcripts, summary: summarizeSuite(transcripts) };
}

function stat(values: readonly number[]): AxisStat {
  if (values.length === 0) return { mean: null, min: null, n: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return { mean: Math.round(mean * 10) / 10, min: Math.min(...values), n: values.length };
}

/** Pure summary of a suite's transcripts (see SuiteSummary for each rule). */
export function summarizeSuite(transcripts: readonly Transcript[]): SuiteSummary {
  const verdicts = transcripts.map((t) => ({ id: t.scenarioId, v: t.verdict }));
  const errored = verdicts.filter(({ v }) => Boolean(v.error)).map(({ id }) => id);
  const withAggregate = verdicts.filter(({ v }) => !v.error && v.aggregate);
  const perAxis = Object.fromEntries(
    AXES.map((a) => [
      a,
      stat(verdicts.flatMap(({ v }) => (v.axes[a].status === 'scored' && v.axes[a].score !== null ? [v.axes[a].score] : []))),
    ]),
  ) as Record<RubricAxis, AxisStat>;
  const passCount = withAggregate.filter(({ v }) => v.aggregate?.pass === true && v.pass).length;
  const scored = withAggregate.length;
  const passRate = scored === 0 ? null : passCount / scored;
  return {
    n: transcripts.length,
    errored,
    scored,
    perAxis,
    aggregate: stat(withAggregate.flatMap(({ v }) => (v.aggregate ? [v.aggregate.score] : []))),
    hardGateFails: verdicts.filter(({ v }) => v.antiSlop.blocking).length,
    passCount,
    passRate,
    suitePass: passRate === null ? null : passRate >= SUITE_PASS_RATE,
    rule:
      `pass = aggregate.pass && deterministic hard gate && no error; passRate = passCount / scored ` +
      `(errored excluded, re-run); suitePass = passRate >= ${SUITE_PASS_RATE} (PROVISIONAL)`,
  };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
function num(n: number | null): string {
  return n === null ? '-' : String(n);
}

function sceneCell(pkg: NarrativePackage): string {
  const o = pkg.oracle ?? null;
  return `${o?.result_ref ?? '-'}/${num(o?.detail?.row?.face ?? null)}/${pkg.dice?.outcome ?? '-'}`;
}

/** Prose length vs package.length_target -- INFORMATIONAL ('!' when outside). The verdict's
 *  budgetWarn is untouched (RECONCILE 3 stays open: length is package-sourced here, ctx there). */
function lenCell(prose: string, pkg: NarrativePackage): string {
  const { min_chars: min, max_chars: max } = pkg.length_target;
  const out = prose.length < min || prose.length > max ? '!' : '';
  return `${prose.length}/${min}..${max}${out}`;
}

/** Human-readable table + summary lines. */
export function formatSuite(report: SuiteReport): string {
  const lines: string[] = [];
  lines.push(`${pad('id', 20)} ${pad('scene/face/outcome', 30)} ${pad('len', 16)} ${pad('det', 9)} spc acc ply agn ton ans | agg`);
  for (const t of report.transcripts) {
    const v = t.verdict;
    const blocks = v.antiSlop.violations.filter((x) => x.severity === 'block').length;
    const det = v.antiSlop.blocking ? `BLOCK(${blocks})` : 'clean';
    const axes = AXES.map((a) => pad(num(v.axes[a].score), 4)).join('');
    const agg = v.aggregate ? `${v.aggregate.score}(${v.aggregate.pass ? 'Y' : 'N'})` : '-';
    const err = v.error ? ` ERR ${v.error}` : '';
    lines.push(
      `${pad(t.scenarioId, 20)} ${pad(sceneCell(t.package), 30)} ${pad(lenCell(t.output.prose, t.package), 16)} ${pad(det, 9)} ${axes}| ${agg}${err}`,
    );
  }
  const s = report.summary;
  const fmt = (x: AxisStat): string => `mean ${num(x.mean)} min ${num(x.min)} (n ${x.n})`;
  lines.push('');
  for (const a of AXES) lines.push(`${pad(a, 12)} ${fmt(s.perAxis[a])}`);
  lines.push(`${pad('aggregate', 12)} ${fmt(s.aggregate)}`);
  lines.push(`hard-gate fails: ${s.hardGateFails}/${s.n}`);
  lines.push(`pass: ${s.passCount}/${s.scored} scored; passRate ${s.passRate === null ? '-' : s.passRate.toFixed(3)}`);
  lines.push(
    `suitePass (PROVISIONAL, >= ${SUITE_PASS_RATE}): ${s.suitePass === null ? '- (nothing scored)' : s.suitePass ? 'YES' : 'NO'}`,
  );
  if (s.errored.length > 0) lines.push(`errored (excluded, re-run): ${s.errored.join(', ')}`);
  lines.push(`rule: ${s.rule}`);
  return lines.join('\n');
}
