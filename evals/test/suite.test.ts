import { renderNarrativePackage, type NarrativePackage } from '@brodyazhnik/orchestrator';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { engineProvider, loadEngineEnv, type EngineSeed } from '../src/harness/engineProvider.js';
import { DeterministicJudge } from '../src/harness/judge.js';
import { StubKeeper } from '../src/harness/keeper.js';
import { LlmJudge } from '../src/harness/llmJudge.js';
import { SUITE_PASS_RATE, formatSuite, runSuite, summarizeSuite } from '../src/harness/suite.js';
import { toEngineSeeds } from '../src/harness/suiteSeeds.js';
import type {
  Judge,
  JudgeContext,
  Keeper,
  KeeperInput,
  KeeperOutput,
  LlmClient,
  LlmRequest,
  AxisScore,
  RubricAxis,
  Seed,
  Transcript,
  Verdict,
} from '../src/harness/types.js';

const env = loadEngineEnv(resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'content-packs/kv'));

// Clean, sensory, in-register prose (style of CLEAN_PROSE in harness.test.ts).
const CLEAN_PROSE =
  'Тропа вильнула к ольшанику; под сапогом хрустнул ледок, и потянуло дымом от дальнего костра.';

class MockLlm implements LlmClient {
  readonly calls: LlmRequest[] = [];
  constructor(private readonly responder: (req: LlmRequest, i: number) => string) {}
  complete(req: LlmRequest): Promise<string> {
    this.calls.push(req);
    return Promise.resolve(this.responder(req, this.calls.length - 1));
  }
}

/** Returns the scripted prose for the i-th run. */
class ScriptedKeeper implements Keeper {
  private i = 0;
  constructor(private readonly proses: readonly string[]) {}
  run(_input: KeeperInput): Promise<KeeperOutput> {
    return Promise.resolve({ prose: this.proses[this.i++] ?? '' });
  }
}

const rubric = (s: readonly [number, number, number, number, number, number]): string =>
  JSON.stringify({
    specificity: { score: s[0], notes: 'x' },
    accuracy: { score: s[1], notes: 'x' },
    playability: { score: s[2], notes: 'x' },
    agency: { score: s[3], notes: 'x' },
    tone: { score: s[4], notes: 'x' },
    anti_slop: { score: s[5], notes: 'x' },
  });

const AXIS_IDS: readonly RubricAxis[] = ['specificity', 'accuracy', 'playability', 'agency', 'tone', 'anti_slop'];

/** Hand-built transcript for summarizeSuite rule pins (no judge involved). */
function tx(
  id: string,
  v: {
    readonly aggregate: { readonly score: number; readonly pass: boolean } | null;
    readonly axis?: AxisScore;
    readonly overrides?: Partial<Record<RubricAxis, AxisScore>>;
    readonly error?: string;
  },
): Transcript {
  const axis = v.axis ?? { status: 'scored', score: 90, notes: '' };
  const axes = Object.fromEntries(AXIS_IDS.map((a) => [a, v.overrides?.[a] ?? axis])) as Record<RubricAxis, AxisScore>;
  const verdict: Verdict = {
    axes,
    antiSlop: { violations: [], blocking: false },
    budgetWarn: false,
    pass: true,
    aggregate: v.aggregate ? { ...v.aggregate, threshold: 80, rule: 'test' } : null,
    ...(v.error ? { error: v.error } : {}),
  };
  return {
    scenarioId: id,
    summary: id,
    package: { intent: 'journey', scene: 'journey', length_target: { min_chars: 400, max_chars: 800 } },
    output: { prose: 'x' },
    verdict,
  };
}

describe('suite runner (A3.3)', () => {
  it('golden: the live engine -> package wiring over the 9 suite seeds (stub keeper, deterministic judge)', async () => {
    const report = await runSuite(toEngineSeeds('STUB-PROMPT'), {
      packageProvider: engineProvider(env),
      keeper: new StubKeeper(CLEAN_PROSE),
      judge: new DeterministicJudge(),
    });
    expect(formatSuite(report)).toMatchInlineSnapshot(`
      "id                   scene/face/outcome             len              det       spc acc ply agn ton ans | agg
      j.border.shortcut    short_cut/2/weak               92/400..800!     clean     -   -   -   -   -   100 | -
      j.border.inspiring   inspiring_sight/5/strong       92/400..800!     clean     -   -   -   -   -   100 | -
      j.wild.mishap        mishap/6/failure               92/400..800!     clean     -   -   -   -   -   100 | -
      j.wild.meeting       chance_meeting/1/weak          92/400..800!     clean     -   -   -   -   -   100 | -
      j.dark.badchoice     bad_choice/2/failure           92/400..800!     clean     -   -   -   -   -   100 | -
      j.dark.despair       despair/5/failure              92/400..800!     clean     -   -   -   -   -   100 | -
      j.dark.misfortune    terrible_misfortune/3/failure  92/400..800!     clean     -   -   -   -   -   100 | -
      j.dark.significant   despair/1/-                    92/400..800!     clean     -   -   -   -   -   100 | -
      j.dark.midjourney    mishap/4/failure               92/400..800!     clean     -   -   -   -   -   100 | -

      specificity  mean - min - (n 0)
      accuracy     mean - min - (n 0)
      playability  mean - min - (n 0)
      agency       mean - min - (n 0)
      tone         mean - min - (n 0)
      anti_slop    mean 100 min 100 (n 9)
      aggregate    mean - min - (n 0)
      hard-gate fails: 0/9
      pass: 0/0 scored; passRate -
      suitePass (PROVISIONAL, >= 0.8): - (nothing scored)
      rule: pass = aggregate.pass && deterministic hard gate && no error; passRate = passCount / scored (errored excluded, re-run); suitePass = passRate >= 0.8 (PROVISIONAL)"
    `);
    expect(report.summary).toMatchInlineSnapshot(`
      {
        "aggregate": {
          "mean": null,
          "min": null,
          "n": 0,
        },
        "errored": [],
        "hardGateFails": 0,
        "n": 9,
        "passCount": 0,
        "passRate": null,
        "perAxis": {
          "accuracy": {
            "mean": null,
            "min": null,
            "n": 0,
          },
          "agency": {
            "mean": null,
            "min": null,
            "n": 0,
          },
          "anti_slop": {
            "mean": 100,
            "min": 100,
            "n": 9,
          },
          "playability": {
            "mean": null,
            "min": null,
            "n": 0,
          },
          "specificity": {
            "mean": null,
            "min": null,
            "n": 0,
          },
          "tone": {
            "mean": null,
            "min": null,
            "n": 0,
          },
        },
        "rule": "pass = aggregate.pass && deterministic hard gate && no error; passRate = passCount / scored (errored excluded, re-run); suitePass = passRate >= 0.8 (PROVISIONAL)",
        "scored": 0,
        "suitePass": null,
      }
    `);
    expect(report.transcripts.map((t) => renderNarrativePackage(t.package)).join('\n\n')).toMatchInlineSnapshot(`
      "## turn
      intent: journey
      scene: journey
      length_target: 400..800 chars
      ## dice
      feat_symbol: null
      success_icons: 0
      total: 17
      target_number: 15
      outcome: weak
      ## oracle
      table: journey_scenes
      result_ref: short_cut
      ### detail
      table: scene_details.short_cut
      result_ref: scene_details.short_cut#face=2
      row.face: 2
      row.scene: Укромный путь
      row.prompt: ИССЛЕДОВАНИЕ, чтобы ориентироваться в глуши
      row.skill: exploration
      row.significant_encounter: false
      ## patch
      fatigue_delta: 1

      ## turn
      intent: journey
      scene: journey
      length_target: 400..800 chars
      ## dice
      feat_symbol: gandalf
      success_icons: 1
      target_number: 14
      outcome: strong
      ## oracle
      table: journey_scenes
      result_ref: inspiring_sight
      ### detail
      table: scene_details.inspiring_sight
      result_ref: scene_details.inspiring_sight#face=5
      row.face: 5
      row.scene: Древнее сооружение
      row.prompt: БДИТЕЛЬНОСТЬ, чтобы понять его значение
      row.skill: awareness
      row.significant_encounter: false

      ## turn
      intent: journey
      scene: journey
      length_target: 400..800 chars
      ## dice
      feat_symbol: null
      success_icons: 0
      total: 3
      target_number: 14
      outcome: failure
      ## oracle
      table: journey_scenes
      result_ref: mishap
      ### detail
      table: scene_details.mishap
      result_ref: scene_details.mishap#face=6
      row.face: 6
      row.scene: Блуждающие враги
      row.prompt: БДИТЕЛЬНОСТЬ, чтобы узнать об их приближении
      row.skill: awareness
      row.significant_encounter: false
      ## patch
      fatigue_delta: 3

      ## turn
      intent: journey
      scene: journey
      length_target: 400..800 chars
      ## dice
      feat_symbol: null
      success_icons: 0
      total: 14
      target_number: 14
      outcome: weak
      ## oracle
      table: journey_scenes
      result_ref: chance_meeting
      ### detail
      table: scene_details.chance_meeting
      result_ref: scene_details.chance_meeting#face=1
      row.face: 1
      row.scene: Одинокий охотник
      row.prompt: ОХОТА, чтобы обменяться историями
      row.skill: hunting
      row.significant_encounter: false

      ## turn
      intent: journey
      scene: journey
      length_target: 400..800 chars
      ## dice
      feat_symbol: null
      success_icons: 0
      total: 9
      target_number: 15
      outcome: failure
      ## oracle
      table: journey_scenes
      result_ref: bad_choice
      ### detail
      table: scene_details.bad_choice
      result_ref: scene_details.bad_choice#face=2
      row.face: 2
      row.scene: Потерянный путь
      row.prompt: ИССЛЕДОВАНИЕ, чтобы вернуться по следам
      row.skill: exploration
      row.significant_encounter: false
      ## patch
      fatigue_delta: 2
      shadow_delta: 1
      eye_delta: 1

      ## turn
      intent: journey
      scene: journey
      length_target: 400..800 chars
      ## dice
      feat_symbol: null
      success_icons: 0
      total: 12
      target_number: 15
      outcome: failure
      ## oracle
      table: journey_scenes
      result_ref: despair
      ### detail
      table: scene_details.despair
      result_ref: scene_details.despair#face=5
      row.face: 5
      row.scene: Осквернённое место
      row.prompt: ИССЛЕДОВАНИЕ, чтобы найти способ выбраться
      row.skill: exploration
      row.significant_encounter: false
      ## patch
      fatigue_delta: 2
      shadow_delta: 2
      eye_delta: 2

      ## turn
      intent: journey
      scene: journey
      length_target: 400..800 chars
      ## dice
      feat_symbol: null
      success_icons: 1
      total: 10
      target_number: 15
      outcome: failure
      ## oracle
      table: journey_scenes
      result_ref: terrible_misfortune
      ### detail
      table: scene_details.terrible_misfortune
      result_ref: scene_details.terrible_misfortune#face=3
      row.face: 3
      row.scene: Ужасная погода
      row.prompt: ИССЛЕДОВАНИЕ, чтобы найти приют
      row.skill: exploration
      row.significant_encounter: false
      ## patch
      fatigue_delta: 3
      eye_delta: 1
      conditions_gained: wounded

      ## turn
      intent: journey
      scene: journey
      length_target: 400..800 chars
      ## oracle
      table: journey_scenes
      result_ref: despair
      ### detail
      table: scene_details.despair
      result_ref: scene_details.despair#face=1
      row.face: 1
      row.scene: Слуги Врага
      row.prompt: Значимая встреча
      row.skill: null
      row.significant_encounter: true
      ## patch
      fatigue_delta: 2

      ## turn
      intent: journey
      scene: journey
      length_target: 400..800 chars
      ## dice
      feat_symbol: null
      success_icons: 1
      total: 12
      target_number: 14
      outcome: failure
      ## oracle
      table: journey_scenes
      result_ref: mishap
      ### detail
      table: scene_details.mishap
      result_ref: scene_details.mishap#face=4
      row.face: 4
      row.scene: Неуловимая добыча
      row.prompt: ОХОТА, чтобы выследить добычу
      row.skill: hunting
      row.significant_encounter: false
      ## patch
      fatigue_delta: 3"
    `);
  });

  it('summary math: errors excluded, hard gate enforced, pass-rate over scored', async () => {
    const PKG: NarrativePackage = { intent: 'journey', scene: 'journey', length_target: { min_chars: 400, max_chars: 800 } };
    const seeds: Seed[] = ['s1', 's2', 's3', 's4'].map((id) => ({ id, systemPrompt: 'K', summary: id }));
    const replies = [
      rubric([85, 90, 80, 88, 84, 92]), // passes (mean 86.5 -> 87)
      rubric([50, 50, 50, 50, 50, 50]), // fails the aggregate
      'not json {{{', // eval error -> excluded, re-run
      rubric([85, 90, 80, 88, 84, 92]), // passes the aggregate ...
    ];
    const report = await runSuite(seeds, {
      packageProvider: () => PKG,
      // ... but s4's prose trips the deterministic hard gate (wrong-system calque).
      keeper: new ScriptedKeeper([CLEAN_PROSE, CLEAN_PROSE, CLEAN_PROSE, 'Герой теряет хиты и бредёт дальше.']),
      judge: new LlmJudge({ llm: new MockLlm((_req, i) => replies[i] ?? ''), model: 'm', systemPrompt: 'J' }),
    });
    const s = report.summary;
    expect(s.n).toBe(4);
    expect(s.errored).toEqual(['s3']);
    expect(s.scored).toBe(3);
    expect(s.perAxis).toEqual({
      specificity: { mean: 73.3, min: 50, n: 3 },
      accuracy: { mean: 76.7, min: 50, n: 3 },
      playability: { mean: 70, min: 50, n: 3 },
      agency: { mean: 75.3, min: 50, n: 3 },
      tone: { mean: 72.7, min: 50, n: 3 },
      anti_slop: { mean: 78, min: 50, n: 3 },
    });
    expect(s.aggregate).toEqual({ mean: 74.7, min: 50, n: 3 });
    expect(s.hardGateFails).toBe(1);
    expect(s.passCount).toBe(1);
    expect(s.passRate).toBe(1 / 3);
    expect(s.suitePass).toBe(false);
    expect(s).toMatchInlineSnapshot(`
      {
        "aggregate": {
          "mean": 74.7,
          "min": 50,
          "n": 3,
        },
        "errored": [
          "s3",
        ],
        "hardGateFails": 1,
        "n": 4,
        "passCount": 1,
        "passRate": 0.3333333333333333,
        "perAxis": {
          "accuracy": {
            "mean": 76.7,
            "min": 50,
            "n": 3,
          },
          "agency": {
            "mean": 75.3,
            "min": 50,
            "n": 3,
          },
          "anti_slop": {
            "mean": 78,
            "min": 50,
            "n": 3,
          },
          "playability": {
            "mean": 70,
            "min": 50,
            "n": 3,
          },
          "specificity": {
            "mean": 73.3,
            "min": 50,
            "n": 3,
          },
          "tone": {
            "mean": 72.7,
            "min": 50,
            "n": 3,
          },
        },
        "rule": "pass = aggregate.pass && deterministic hard gate && no error; passRate = passCount / scored (errored excluded, re-run); suitePass = passRate >= 0.8 (PROVISIONAL)",
        "scored": 3,
        "suitePass": false,
      }
    `);
  });

  it('RECONCILE 7: with the deterministic judge nothing is scored -> no pass-rate, no verdict', async () => {
    const report = await runSuite(toEngineSeeds('K'), {
      packageProvider: engineProvider(env),
      keeper: new StubKeeper(CLEAN_PROSE),
      judge: new DeterministicJudge(),
    });
    expect(report.summary.scored).toBe(0);
    expect(report.summary.passRate).toBeNull();
    expect(report.summary.suitePass).toBeNull();
    expect(report.summary.aggregate).toEqual({ mean: null, min: null, n: 0 });
  });

  it('the judge sees each run its own package (ctx.package is the transcript package)', async () => {
    const inner = new DeterministicJudge();
    const seen: JudgeContext[] = [];
    const recording: Judge = {
      score(prose: string, ctx: JudgeContext): Promise<Verdict> {
        seen.push(ctx);
        return inner.score(prose, ctx);
      },
    };
    const seeds: EngineSeed[] = toEngineSeeds('K');
    const report = await runSuite(seeds, { packageProvider: engineProvider(env), keeper: new StubKeeper(CLEAN_PROSE), judge: recording });
    expect(seen).toHaveLength(seeds.length);
    report.transcripts.forEach((t, i) => {
      expect(seen[i]?.package, t.scenarioId).toBe(t.package);
    });
    expect(new Set(report.transcripts.map((t) => JSON.stringify(t.package))).size).toBe(seeds.length);
  });

  it("formatSuite's '!' length mark is the verdict's budgetWarn (package bounds via runScenario)", async () => {
    const PKG: NarrativePackage = { intent: 'journey', scene: 'journey', length_target: { min_chars: 400, max_chars: 800 } };
    const inRange = `${CLEAN_PROSE} `.repeat(6).trim(); // 6 x 92 chars + 5 spaces
    const seeds: Seed[] = [
      { id: 'short', systemPrompt: 'K', summary: 'short' },
      { id: 'fits', systemPrompt: 'K', summary: 'fits' },
    ];
    const report = await runSuite(seeds, {
      packageProvider: () => PKG,
      keeper: new ScriptedKeeper([CLEAN_PROSE, inRange]),
      judge: new DeterministicJudge(),
    });
    expect(report.transcripts.map((t) => t.verdict.budgetWarn)).toEqual([true, false]);
    const rows = formatSuite(report).split('\n');
    const short = rows.find((l) => l.startsWith('short')) ?? '';
    const fits = rows.find((l) => l.startsWith('fits')) ?? '';
    expect(short).toContain(`${CLEAN_PROSE.length}/400..800!`);
    expect(fits).toContain(`${inRange.length}/400..800 `);

    // The mark reads the verdict, not the prose length: a hand-built out-of-range transcript with
    // budgetWarn false gets no '!', and with budgetWarn true it does.
    const quiet = tx('quiet', { aggregate: null }); // prose 'x' (1 char), budgetWarn false
    const loud: Transcript = { ...quiet, scenarioId: 'loud', verdict: { ...quiet.verdict, budgetWarn: true } };
    const hand = formatSuite({ transcripts: [quiet, loud], summary: summarizeSuite([quiet, loud]) }).split('\n');
    expect(hand.find((l) => l.startsWith('quiet'))).toContain('1/400..800 ');
    expect(hand.find((l) => l.startsWith('loud'))).toContain('1/400..800!');
  });

  it('suitePass boundary: passRate exactly SUITE_PASS_RATE passes (4/5), below fails (3/5)', () => {
    expect(SUITE_PASS_RATE).toBe(0.8); // the boundary below is written for this value
    const ok = { score: 90, pass: true };
    const bad = { score: 60, pass: false };
    const four = summarizeSuite([ok, ok, ok, ok, bad].map((a, i) => tx(`b${i}`, { aggregate: a })));
    expect(four.scored).toBe(5);
    expect(four.passRate).toBe(0.8);
    expect(four.suitePass).toBe(true);
    const three = summarizeSuite([ok, ok, ok, bad, bad].map((a, i) => tx(`c${i}`, { aggregate: a })));
    expect(three.passRate).toBe(0.6);
    expect(three.suitePass).toBe(false);
  });

  it('rule pins: non-scored axes never count; an errored verdict never counts, even with a stray aggregate', () => {
    const s = summarizeSuite([
      tx('ok', { aggregate: { score: 90, pass: true } }),
      // (a) a pending axis carrying a stray score must not enter perAxis
      tx('pending', {
        aggregate: { score: 80, pass: true },
        overrides: { tone: { status: 'pending', score: 55, notes: '' }, agency: { status: 'error', score: 55, notes: '' } },
      }),
      // (b) an errored verdict with a stray non-null aggregate: excluded from scored AND the aggregate stat
      tx('errored', { aggregate: { score: 10, pass: false }, axis: { status: 'error', score: null, notes: '' }, error: 'boom' }),
    ]);
    expect(s.perAxis.tone).toEqual({ mean: 90, min: 90, n: 1 });
    expect(s.perAxis.agency).toEqual({ mean: 90, min: 90, n: 1 });
    expect(s.perAxis.specificity).toEqual({ mean: 90, min: 90, n: 2 });
    expect(s.errored).toEqual(['errored']);
    expect(s.scored).toBe(2);
    expect(s.aggregate).toEqual({ mean: 85, min: 80, n: 2 });
    expect(s.passRate).toBe(1);
  });
});
