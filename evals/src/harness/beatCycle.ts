// 3.3a-K4b: the BEAT cycle behind `full-cycle.mts --beats` (keeper v0.4, judge v0.4). Offline-
// testable: the Keeper, the judge and the telemetry source are injected; full-cycle.mts only wires
// the real AnthropicKeeper / LlmJudge / AnthropicLlmClient (with onCall) and writes the report.
//
// Per suite journey (playScriptedJourney, K4a), per prose beat in play order:
//   1. Keeper prose via runStream; every delta goes into a FRESH createSentenceRelease(vk, pkg),
//      then finish(). prose = the trimmed prose runStream returns; accepted = the release verdict
//      has no block (the same scanTurnProse the live gate runs: stop-lists + NF1 on this package).
//   2. A setup's resolution gets previous prose = the ACCEPTED setup prose; a blocked setup passes
//      '' -> checkBeatTurn omits previous_prose (hasText), so no `## previous` (CT1: only gated
//      text goes forward).
//   3. The judge on every prose beat with ITS OWN package (+ that package's length_target).
// Telemetry: the caller's dedicated Keeper LlmClient pushes LlmCallTelemetry into a sink; after
// each runStream the beat takes the latest record, so each Keeper call is attributed to its beat.
// Errors (Keeper throw, empty prose) propagate, as in the default suite (runScenario).
//
// The beat report name starts with `beats-cycle-report.` -- NOT `full-cycle-report.`, which the
// corpus loaders sweep (pinned 58 proses).

import {
  renderNarrativePackage,
  type JourneyEnv,
  type KeeperInput,
  type KeeperOutput,
  type NarrativePackage,
} from '@brodyazhnik/orchestrator';
import type { LlmCallHook, LlmCallTelemetry, LlmCallUsage } from '@brodyazhnik/orchestrator/anthropic';
import { createSentenceRelease, type StopEntry } from '@brodyazhnik/prose-gate';
import { playScriptedJourney, type ScriptedBeat } from './beatScript.js';
import { summarizeSuite } from './suite.js';
import type { SuiteJourney } from './suiteSeeds.js';
import type { AggregateVerdict, AxisScore, Judge, RubricAxis, Transcript } from './types.js';

const AXES: readonly RubricAxis[] = ['specificity', 'accuracy', 'playability', 'agency', 'tone', 'anti_slop'];
export const BEAT_TYPES = ['setup', 'resolution', 'arrival', 'encounter'] as const;
export type BeatType = (typeof BEAT_TYPES)[number];

export interface StreamingKeeper {
  runStream(input: KeeperInput, onText: (delta: string) => void): Promise<KeeperOutput>;
}

/** Collects the Keeper client's onCall records; take() returns the latest since the last take. */
export interface TelemetrySink {
  readonly onCall: LlmCallHook;
  take(): LlmCallTelemetry | null;
}

export function createTelemetrySink(): TelemetrySink {
  let pending: LlmCallTelemetry[] = [];
  return {
    onCall: (t) => {
      pending.push(t);
    },
    take: () => {
      const last = pending.length > 0 ? pending[pending.length - 1]! : null;
      pending = [];
      return last;
    },
  };
}

export interface BeatCycleConfig {
  readonly env: JourneyEnv;
  readonly journeys: readonly SuiteJourney[];
  readonly keeperSystem: string;
  readonly keeper: StreamingKeeper;
  readonly judge: Judge;
  readonly vkAddendum: readonly StopEntry[] | null;
  /** Latest Keeper-call telemetry (a TelemetrySink's take); absent -> telemetry fields null. */
  readonly takeTelemetry?: () => LlmCallTelemetry | null;
}

export type LengthBand = 'in' | 'below' | 'above';

export interface BeatRecord {
  readonly id: string; // suite id
  readonly beat: BeatType;
  readonly key: string; // `<suite id>.<beat>`
  readonly package: string; // renderNarrativePackage(pkg)
  readonly prose: string;
  readonly length: { readonly chars: number; readonly min: number; readonly max: number; readonly band: LengthBand };
  readonly telemetry: {
    readonly ttft_ms: number | null;
    readonly duration_ms: number | null;
    readonly usage: LlmCallUsage | null;
    readonly stop_reason: string | null;
  };
  readonly release: { readonly releasedChars: number; readonly stoppedAt: number | null; readonly unitsEmitted: number };
  readonly gate: readonly { readonly list: string; readonly term: string; readonly severity: string }[];
  readonly accepted: boolean;
  readonly judge: {
    readonly axes: Readonly<Record<RubricAxis, AxisScore>>;
    readonly aggregate: AggregateVerdict | null;
    readonly pass: boolean;
    readonly error: string | null;
  };
}

export interface BeatGroupSummary {
  readonly n: number;
  readonly scored: number;
  readonly errored: readonly string[]; // beat keys; excluded from the pass share
  readonly aggregateMean: number | null; // 1 decimal
  readonly aggregateMin: number | null;
  readonly passCount: number; // aggregate.pass && hard gate && no error
  readonly passShare: number | null; // passCount / scored
  readonly blockFindings: number;
  readonly warnFindings: number;
  readonly blockedBeats: number;
  readonly medianTtftMs: number | null;
  readonly medianDurationMs: number | null;
  readonly length: Readonly<Record<LengthBand, number>>;
}

export interface BeatCycleSummary {
  readonly perBeat: Readonly<Record<BeatType, BeatGroupSummary>>;
  readonly overall: BeatGroupSummary;
  readonly rule: string;
}

export interface BeatCycleReport {
  readonly beats: readonly BeatRecord[];
  readonly summary: BeatCycleSummary;
}

function band(chars: number, pkg: NarrativePackage): LengthBand {
  const { min_chars: min, max_chars: max } = pkg.length_target;
  return chars < min ? 'below' : chars > max ? 'above' : 'in';
}

async function playBeat(cfg: BeatCycleConfig, b: ScriptedBeat): Promise<BeatRecord> {
  const release = createSentenceRelease(cfg.vkAddendum, b.pkg);
  let pushedUnits = 0;
  let pushedChars = 0;
  const out = await cfg.keeper.runStream({ systemPrompt: cfg.keeperSystem, package: b.pkg }, (delta) => {
    for (const u of release.push(delta)) {
      pushedUnits++;
      pushedChars += u.length;
    }
  });
  const fin = release.finish();
  const t = cfg.takeTelemetry?.() ?? null;
  const prose = out.prose;
  const lt = b.pkg.length_target;
  const verdict = await cfg.judge.score(prose, {
    vkAddendum: cfg.vkAddendum,
    package: b.pkg,
    lengthTarget: { minChars: lt.min_chars, maxChars: lt.max_chars },
  });
  return {
    id: b.key.slice(0, b.key.length - b.beat.length - 1),
    beat: b.beat,
    key: b.key,
    package: renderNarrativePackage(b.pkg),
    prose,
    length: { chars: prose.length, min: lt.min_chars, max: lt.max_chars, band: band(prose.length, b.pkg) },
    telemetry: {
      ttft_ms: t?.ttft_ms ?? null,
      duration_ms: t?.duration_ms ?? null,
      usage: t !== null && t.ok ? t.usage : null,
      stop_reason: t !== null && t.ok ? t.stop_reason : null,
    },
    // finish() releases the tail (if any) as ONE more unit
    release: {
      releasedChars: fin.released.length,
      stoppedAt: fin.stoppedAt,
      unitsEmitted: pushedUnits + (fin.released.length > pushedChars ? 1 : 0),
    },
    gate: fin.verdict.map((v) => ({ list: v.list, term: v.term, severity: v.severity })),
    accepted: !fin.verdict.some((v) => v.severity === 'block'),
    judge: { axes: verdict.axes, aggregate: verdict.aggregate ?? null, pass: verdict.pass, error: verdict.error ?? null },
  };
}

/** Play every journey's prose beats through Keeper (streamed, gated) and judge; then summarize. */
export async function runBeatCycle(cfg: BeatCycleConfig): Promise<BeatCycleReport> {
  const beats: BeatRecord[] = [];
  for (const j of cfg.journeys) {
    // the setup is played inside the callback: its accepted prose feeds the resolution package
    const played = new Map<string, BeatRecord>();
    const scripted = await playScriptedJourney(cfg.env, j, {
      resolutionPreviousProse: async (setup) => {
        const rec = await playBeat(cfg, setup);
        played.set(setup.key, rec);
        return rec.accepted ? rec.prose : '';
      },
    });
    for (const b of scripted) beats.push(played.get(b.key) ?? (await playBeat(cfg, b)));
  }
  return { beats, summary: summarizeBeats(beats) };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

function summarizeGroup(beats: readonly BeatRecord[]): BeatGroupSummary {
  // Reuse the suite rules (errored excluded; scored = aggregate present; pass = aggregate.pass &&
  // hard gate && no error) via summarizeSuite over minimal transcripts.
  const transcripts = beats.map(
    (b) =>
      ({
        scenarioId: b.key,
        verdict: {
          axes: b.judge.axes,
          aggregate: b.judge.aggregate,
          pass: b.judge.pass,
          error: b.judge.error,
          antiSlop: { violations: [], blocking: !b.judge.pass },
          budgetWarn: false,
        },
      }) as unknown as Transcript,
  );
  const s = summarizeSuite(transcripts);
  const findings = beats.flatMap((b) => b.gate);
  const lengths: Record<LengthBand, number> = { in: 0, below: 0, above: 0 };
  for (const b of beats) lengths[b.length.band]++;
  return {
    n: beats.length,
    scored: s.scored,
    errored: s.errored,
    aggregateMean: s.aggregate.mean,
    aggregateMin: s.aggregate.min,
    passCount: s.passCount,
    passShare: s.passRate,
    blockFindings: findings.filter((f) => f.severity === 'block').length,
    warnFindings: findings.filter((f) => f.severity === 'warn').length,
    blockedBeats: beats.filter((b) => !b.accepted).length,
    medianTtftMs: median(beats.flatMap((b) => (b.telemetry.ttft_ms === null ? [] : [b.telemetry.ttft_ms]))),
    medianDurationMs: median(beats.flatMap((b) => (b.telemetry.duration_ms === null ? [] : [b.telemetry.duration_ms]))),
    length: lengths,
  };
}

/** Pure summary per beat type and overall. */
export function summarizeBeats(beats: readonly BeatRecord[]): BeatCycleSummary {
  const perBeat = Object.fromEntries(BEAT_TYPES.map((t) => [t, summarizeGroup(beats.filter((b) => b.beat === t))])) as Record<
    BeatType,
    BeatGroupSummary
  >;
  return {
    perBeat,
    overall: summarizeGroup(beats),
    rule:
      'pass = aggregate.pass && deterministic hard gate && no error; passShare = passCount / scored ' +
      '(errored excluded, re-run); blocked beat = the release verdict (stop-lists + NF1) has a block; ' +
      'medians over beats with telemetry (even n: rounded mean of the middle two)',
  };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
function num(n: number | null): string {
  return n === null ? '-' : String(n);
}

/** Human-readable table + summary lines (the formatSuite style). */
export function formatBeatCycle(report: BeatCycleReport): string {
  const lines: string[] = [];
  lines.push(
    `${pad('id', 20)} ${pad('beat', 10)} ${pad('len/target', 16)} ${pad('ttft', 6)} ${pad('dur', 6)} ${pad('gate', 9)} ` +
      'spc acc ply agn ton ans | agg',
  );
  for (const b of report.beats) {
    const blocks = b.gate.filter((g) => g.severity === 'block').length;
    const warns = b.gate.length - blocks;
    const gate = blocks > 0 ? `BLOCK(${blocks})` : warns > 0 ? `warn(${warns})` : 'clean';
    const mark = b.length.band === 'in' ? '' : b.length.band === 'below' ? '<' : '>';
    const len = `${b.length.chars}/${b.length.min}..${b.length.max}${mark}`;
    const axes = AXES.map((a) => pad(num(b.judge.axes[a].score), 4)).join('');
    const agg = b.judge.aggregate ? `${b.judge.aggregate.score}(${b.judge.aggregate.pass ? 'Y' : 'N'})` : '-';
    const err = b.judge.error ? ` ERR ${b.judge.error}` : '';
    lines.push(
      `${pad(b.id, 20)} ${pad(b.beat, 10)} ${pad(len, 16)} ${pad(num(b.telemetry.ttft_ms), 6)} ` +
        `${pad(num(b.telemetry.duration_ms), 6)} ${pad(gate, 9)} ${axes}| ${agg}${err}`,
    );
  }
  const row = (name: string, g: BeatGroupSummary): string =>
    `${pad(name, 11)} n ${g.n} scored ${g.scored} | agg mean ${num(g.aggregateMean)} min ${num(g.aggregateMin)} | ` +
    `pass ${g.passCount}/${g.scored} (${g.passShare === null ? '-' : g.passShare.toFixed(3)}) | ` +
    `gate block ${g.blockFindings} warn ${g.warnFindings} blocked beats ${g.blockedBeats} | ` +
    `med ttft ${num(g.medianTtftMs)} dur ${num(g.medianDurationMs)} | len in ${g.length.in} below ${g.length.below} above ${g.length.above}`;
  const s = report.summary;
  lines.push('');
  for (const t of BEAT_TYPES) lines.push(row(t, s.perBeat[t]));
  lines.push(row('overall', s.overall));
  if (s.overall.errored.length > 0) lines.push(`errored (excluded, re-run): ${s.overall.errored.join(', ')}`);
  lines.push(`rule: ${s.rule}`);
  return lines.join('\n');
}
