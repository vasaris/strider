// 3.3a-K4b: the beat cycle behind `full-cycle.mts --beats`, offline (stub Keeper / telemetry /
// judge; no key, no network). The real pack + the K4a scripted player supply the packages.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadJourneyEnv, type KeeperInput, type KeeperOutput } from '@brodyazhnik/orchestrator';
import { loadVkAddendumFromPack } from '@brodyazhnik/prose-gate';
import {
  createTelemetrySink,
  formatBeatCycle,
  runBeatCycle,
  summarizeBeats,
  type BeatRecord,
  type BeatType,
  type StreamingKeeper,
} from '../src/harness/beatCycle.js';
import { SUITE_JOURNEYS } from '../src/harness/suiteSeeds.js';
import type { AxisScore, Judge, JudgeContext, RubricAxis, Verdict } from '../src/harness/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const packDir = resolve(repoRoot, 'content-packs/kv');
const env = loadJourneyEnv(packDir);
const vk = loadVkAddendumFromPack(packDir);
const AXES: readonly RubricAxis[] = ['specificity', 'accuracy', 'playability', 'agency', 'tone', 'anti_slop'];

const SETUP_PROSE = 'Тропа ушла в сырую низину. Под сапогами чавкала глина, и пахло прелой листвой.';
const OTHER_PROSE = 'Ветер стих к вечеру. Где-то за кустами журчала вода, и в воздухе стоял запах дыма.';
const BLOCKED_SETUP = 'Тропа ушла в низину. Вся мана из тебя вытекла, ноги гудели от усталости.';

function verdict(score: number | null, error: string | null = null): Verdict {
  const axes = Object.fromEntries(
    AXES.map((a) => [a, { status: score === null ? 'error' : 'scored', score, notes: '' } satisfies AxisScore]),
  ) as Record<RubricAxis, AxisScore>;
  return {
    axes,
    antiSlop: { violations: [], blocking: false },
    budgetWarn: false,
    pass: true,
    aggregate: score === null ? null : { score, threshold: 80, pass: score >= 80, rule: 'mean' },
    error,
  };
}

/** Streams canned prose in 3 chunks (leading/trailing whitespace on purpose) and reports one
 *  telemetry record per call through `onCall`, like the dedicated AnthropicLlmClient would. */
function stubKeeper(proseFor: (input: KeeperInput, i: number) => string, onCall: ReturnType<typeof createTelemetrySink>['onCall']) {
  const inputs: KeeperInput[] = [];
  const keeper: StreamingKeeper = {
    async runStream(input, onText): Promise<KeeperOutput> {
      const i = inputs.length;
      inputs.push(input);
      const raw = `  ${proseFor(input, i)}\n`;
      const third = Math.ceil(raw.length / 3);
      for (let k = 0; k < raw.length; k += third) onText(raw.slice(k, k + third));
      onCall({ model: 'stub', duration_ms: 1000 + i * 100, ok: true, usage: null, stop_reason: 'end_turn', ttft_ms: 200 + i * 10 });
      return { prose: raw.trim() };
    },
  };
  return { keeper, inputs };
}

function stubJudge(scores: readonly (number | null)[]): Judge & { ctxs: JudgeContext[] } {
  const ctxs: JudgeContext[] = [];
  return {
    ctxs,
    async score(_prose, ctx) {
      const s = ctxs.length < scores.length ? scores[ctxs.length]! : 90;
      ctxs.push(ctx);
      return s === null ? verdict(null, 'parse error') : verdict(s);
    },
  };
}

const pick = (...ids: string[]) => SUITE_JOURNEYS.filter((j) => ids.includes(j.id));

describe('3.3a-K4b runBeatCycle', () => {
  it('plays setup+resolution, arrival and encounter; records telemetry, release, gate, judge per beat', async () => {
    const sink = createTelemetrySink();
    const { keeper, inputs } = stubKeeper((_in, i) => (i === 0 ? SETUP_PROSE : OTHER_PROSE), sink.onCall);
    const judge = stubJudge([85, 70, 90, null]);
    const report = await runBeatCycle({
      env,
      journeys: pick('j.border.shortcut', 'j.dark.significant', 'j.border.arrival'),
      keeperSystem: 'SYSTEM',
      keeper,
      judge,
      vkAddendum: vk,
      takeTelemetry: sink.take,
    });
    const b = report.beats;
    expect(b.map((x) => `${x.id}:${x.beat}`)).toEqual([
      'j.border.shortcut:setup',
      'j.border.shortcut:resolution',
      'j.dark.significant:encounter',
      'j.border.arrival:arrival',
    ]);
    expect(inputs).toHaveLength(4);
    expect(inputs.every((x) => x.systemPrompt === 'SYSTEM')).toBe(true);
    // each beat judged with ITS OWN package and length target
    expect(judge.ctxs.map((c) => c.package)).toEqual(inputs.map((x) => x.package));
    expect(judge.ctxs[1]!.lengthTarget).toEqual({
      minChars: inputs[1]!.package.length_target.min_chars,
      maxChars: inputs[1]!.package.length_target.max_chars,
    });
    expect(judge.ctxs.every((c) => c.vkAddendum === vk)).toBe(true);

    const setup = b[0]!;
    expect(setup.prose).toBe(SETUP_PROSE);
    expect(setup.gate).toEqual([]);
    expect(setup.accepted).toBe(true);
    expect(setup.release).toEqual({ releasedChars: SETUP_PROSE.length, stoppedAt: null, unitsEmitted: 2 });
    expect(setup.telemetry).toEqual({ ttft_ms: 200, duration_ms: 1000, usage: null, stop_reason: 'end_turn' });
    expect(b[3]!.telemetry.ttft_ms).toBe(230);
    expect(setup.length.chars).toBe(SETUP_PROSE.length);
    const lt = inputs[0]!.package.length_target;
    expect(setup.length.band).toBe(SETUP_PROSE.length < lt.min_chars ? 'below' : SETUP_PROSE.length > lt.max_chars ? 'above' : 'in');
    expect(setup.judge.aggregate?.score).toBe(85);
    expect(b[3]!.judge.error).toBe('parse error');

    // the resolution receives the ACCEPTED setup prose as `## previous`
    expect(inputs[1]!.package.previous_prose).toBe(SETUP_PROSE);
    expect(b[1]!.package).toContain('## previous');
    expect(b[1]!.package).toContain(SETUP_PROSE);

    const o = report.summary.overall;
    expect(o).toMatchObject({ n: 4, scored: 3, errored: ['j.border.arrival.arrival'], passCount: 2, aggregateMin: 70 });
    expect(o.aggregateMean).toBe(81.7);
    expect(o.medianTtftMs).toBe(215);
    expect(report.summary.perBeat.setup.n).toBe(1);
    expect(report.summary.perBeat.arrival.scored).toBe(0);
    expect(report.summary.perBeat.arrival.passShare).toBeNull();

    const table = formatBeatCycle(report);
    expect(table).toContain('j.border.shortcut');
    expect(table).toContain('errored (excluded, re-run): j.border.arrival.arrival');
  });

  it('a blocked setup (stop-list term) gives the resolution NO previous prose', async () => {
    const sink = createTelemetrySink();
    const { keeper, inputs } = stubKeeper((_in, i) => (i === 0 ? BLOCKED_SETUP : OTHER_PROSE), sink.onCall);
    const report = await runBeatCycle({
      env,
      journeys: pick('j.border.shortcut'),
      keeperSystem: 'SYSTEM',
      keeper,
      judge: stubJudge([]),
      vkAddendum: vk,
      takeTelemetry: sink.take,
    });
    const [setup, resolution] = report.beats;
    expect(setup!.accepted).toBe(false);
    expect(setup!.gate).toContainEqual(expect.objectContaining({ term: 'мана', severity: 'block' }));
    expect(setup!.release.stoppedAt).not.toBeNull();
    expect(setup!.release.releasedChars).toBeLessThan(BLOCKED_SETUP.length);
    expect(inputs[1]!.package.previous_prose).toBeUndefined();
    expect(resolution!.package).not.toContain('## previous');
    expect(report.summary.overall.blockedBeats).toBe(1);
    expect(report.summary.overall.blockFindings).toBeGreaterThanOrEqual(1);
  });
});

function rec(beat: BeatType, opts: Partial<{ agg: number | null; error: string; pass: boolean; ttft: number | null; dur: number; gate: BeatRecord['gate']; band: BeatRecord['length']['band'] }>): BeatRecord {
  const v = verdict(opts.agg === undefined ? 90 : opts.agg, opts.error ?? null);
  const gate = opts.gate ?? [];
  return {
    id: `j.${beat}`,
    beat,
    key: `j.${beat}.${beat}.${Math.random()}`,
    package: '',
    prose: 'x',
    length: { chars: 1, min: 1, max: 2, band: opts.band ?? 'in' },
    telemetry: { ttft_ms: opts.ttft === undefined ? 100 : opts.ttft, duration_ms: opts.dur ?? 1000, usage: null, stop_reason: null },
    release: { releasedChars: 1, stoppedAt: null, unitsEmitted: 1 },
    gate,
    accepted: !gate.some((g) => g.severity === 'block'),
    judge: { axes: v.axes, aggregate: v.aggregate ?? null, pass: opts.pass ?? true, error: v.error ?? null },
  };
}

describe('3.3a-K4b summarizeBeats', () => {
  it('means / min / medians / pass share / errored exclusion / gate and length counts', () => {
    const block = { list: 'calque', term: 'мана', severity: 'block' };
    const warn = { list: 'sa1', term: 'x', severity: 'warn' };
    const beats = [
      rec('setup', { agg: 85, ttft: 100, dur: 1000 }),
      rec('setup', { agg: 78, ttft: 300, dur: 3000, band: 'below' }),
      rec('setup', { agg: 92, ttft: null, dur: 2000, pass: false, gate: [block, warn], band: 'above' }), // hard gate fails
      rec('setup', { agg: null, error: 'boom', ttft: 400, dur: 4000 }), // errored: excluded
      rec('resolution', { agg: 81, gate: [warn] }),
    ];
    const s = summarizeBeats(beats);
    expect(s.perBeat.setup).toMatchObject({
      n: 4,
      scored: 3,
      aggregateMean: 85, // (85+78+92)/3
      aggregateMin: 78,
      passCount: 1, // 85 only: 78 < 80, 92 fails the hard gate
      blockFindings: 1,
      warnFindings: 1,
      blockedBeats: 1,
      medianTtftMs: 300, // [100, 300, 400]
      medianDurationMs: 2500, // [1000, 2000, 3000, 4000]
      length: { in: 2, below: 1, above: 1 },
    });
    expect(s.perBeat.setup.passShare).toBeCloseTo(1 / 3);
    expect(s.perBeat.setup.errored).toHaveLength(1);
    expect(s.perBeat.encounter).toMatchObject({ n: 0, scored: 0, aggregateMean: null, passShare: null, medianTtftMs: null });
    expect(s.overall).toMatchObject({ n: 5, scored: 4, passCount: 2, aggregateMean: 84, warnFindings: 2, medianTtftMs: 200 });
    expect(s.overall.passShare).toBe(0.5);
  });
});

describe('3.3a-K4b full-cycle.mts module boundary (the default path is untouched)', () => {
  const src = readFileSync(resolve(here, '..', 'full-cycle.mts'), 'utf8');
  it('default: keeper v0.3 through runSuite/formatSuite into a full-cycle report; --beats: beatCycle into beats-cycle', () => {
    expect(src).toContain("BEATS ? 'prompts/keeper.system.v0.4.md' : 'prompts/keeper.system.v0.3.md'");
    const [beatsBranch, defaultBranch] = src.split('} else {');
    expect(defaultBranch).toContain('runSuite(seeds, { packageProvider: engineProvider(env), keeper, judge, ctx })');
    expect(defaultBranch).toContain('formatSuite(report)');
    expect(defaultBranch).toContain("kind: 'full-cycle'");
    expect(defaultBranch).not.toMatch(/beat/i);
    expect(beatsBranch).toContain('runBeatCycle(');
    expect(beatsBranch).toContain("kind: 'beats-cycle'");
    expect(beatsBranch).not.toContain('runSuite(');
  });
});
