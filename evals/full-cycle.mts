// Full-cycle suite run (A3.3 = roadmap L4): live engine turn -> package -> AnthropicKeeper ->
// LlmJudge (with the package) over the pinned suite seeds. NOT part of `npm test` (that suite is
// offline, on mocks, no key/tokens). This makes real Anthropic API calls -- 2 per seed (one
// Keeper, one judge) -- and is run BY IVAN in his keyed shell:
//
//     export ANTHROPIC_API_KEY=...        # in your terminal; do NOT paste the key into chat/files
//     cd evals && npx tsx full-cycle.mts
//
// Run from evals/: tsx is an evals devDependency and the workspace root has none. The script
// resolves its files from import.meta.url, so the cwd does not matter otherwise.
//
// Env (all optional): KEEPER_MODEL, JUDGE_MODEL (both default claude-opus-4-8); SEEDS = comma-
// separated suite ids to run a subset (an unknown id is an error that lists the valid ids).
// The key is read ONLY from process.env, never written/logged/printed. Output:
// evals/full-cycle-report.keeper-<keeper prompt version>.judge-<judge prompt version>.
// <keeper-model>.<UTC stamp>.json (gitignored; RP1: a new file per run, created exclusively --
// never overwrites an earlier report).
//
// --beats (3.3a-K4b): the BEAT cycle instead (keeper v0.4, judge v0.4; src/harness/beatCycle.ts):
// every suite journey played by the scripted player (beatScript.ts) as prose beats -- setup +
// resolution, or one arrival / encounter -- each Keeper call STREAMED through the sentence release
// (the resolution gets the ACCEPTED setup prose as previous prose; a blocked setup gives none),
// each prose beat judged with its own package. 2 API calls per prose beat (one Keeper, one judge).
// A dedicated Keeper client's onCall telemetry (ttft / duration / usage / stop_reason) lands per
// beat. Same env and SEEDS. Output: evals/beats-cycle-report.keeper-v0.4.judge-v0.4.<keeper-model>.
// <UTC stamp>.json (gitignored, RP1 exclusive). Any other argument is an error.
//
//     cd evals && npx tsx full-cycle.mts --beats
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnthropicKeeper, loadJourneyEnv, loadKeeperSetup, readFileRef } from '@brodyazhnik/orchestrator';
import { AnthropicLlmClient } from '@brodyazhnik/orchestrator/anthropic';
import { engineProvider } from './src/harness/engineProvider.js';
import { buildJudgeSystem } from './src/harness/judgeSystem.js';
import { LlmJudge } from './src/harness/llmJudge.js';
import { createTelemetrySink, formatBeatCycle, runBeatCycle } from './src/harness/beatCycle.js';
import { formatSuite, runSuite } from './src/harness/suite.js';
import { SUITE_JOURNEYS, toEngineSeeds } from './src/harness/suiteSeeds.js';
import { loadVkAddendumFromPack } from '@brodyazhnik/prose-gate';
import { reportFileName, writeReportExclusive } from './src/reports.js';

const args = process.argv.slice(2);
const badArgs = args.filter((a) => a !== '--beats');
if (badArgs.length > 0) {
  console.error(`Unknown argument(s): ${badArgs.join(' ')}\n  Usage: npx tsx full-cycle.mts [--beats]`);
  process.exit(1);
}
const BEATS = args.includes('--beats');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is not set in this shell.\n' +
      '  Run in your keyed terminal (do NOT paste the key into chat or any file):\n' +
      '    export ANTHROPIC_API_KEY=...\n' +
      '    cd evals && npx tsx full-cycle.mts\n',
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url)); // evals/
const repoRoot = resolve(here, '..');

const KEEPER_PROMPT = BEATS ? 'prompts/keeper.system.v0.4.md' : 'prompts/keeper.system.v0.3.md';
const JUDGE_PROMPT = 'prompts/judge.system.v0.4.md';
const read = (rel: string): string => readFileSync(resolve(repoRoot, rel), 'utf8');

const keeperModel = process.env.KEEPER_MODEL ?? 'claude-opus-4-8';
const judgeModel = process.env.JUDGE_MODEL ?? 'claude-opus-4-8';

const validIds = SUITE_JOURNEYS.map((j) => j.id);
const wanted = (process.env.SEEDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
const unknown = wanted.filter((id) => !validIds.includes(id));
if (unknown.length > 0) {
  console.error(`Unknown SEEDS id(s): ${unknown.join(', ')}\n  Valid ids: ${validIds.join(', ')}`);
  process.exit(1);
}

// 3.1-C4: the Keeper system (keeper prompt + tone.md over prompts/assembly.v1.json) and its
// provenance come from orchestrator loadKeeperSetup -- the same assembly the server route uses.
const setup = loadKeeperSetup({ repoRoot, keeperPrompt: KEEPER_PROMPT });
const keeperSystem = setup.system;
const judgeSystem = buildJudgeSystem(setup.assembly, read(JUDGE_PROMPT), read(setup.provenance.tone.path));
const ctx = { vkAddendum: loadVkAddendumFromPack(resolve(repoRoot, 'content-packs/kv')) };
const env = loadJourneyEnv(resolve(repoRoot, 'content-packs/kv'));

if (BEATS) {
  const journeys = SUITE_JOURNEYS.filter((j) => wanted.length === 0 || wanted.includes(j.id));
  const sink = createTelemetrySink();
  // dedicated Keeper client: its onCall records are attributed to the beat that made the call
  const keeperLlm = new AnthropicLlmClient(undefined, { onCall: sink.onCall });
  const keeper = new AnthropicKeeper({ llm: keeperLlm, model: keeperModel, assembly: setup.assembly });
  const judge = new LlmJudge({ llm: new AnthropicLlmClient(), model: judgeModel, systemPrompt: judgeSystem, shortCircuit: false });
  const report = await runBeatCycle({
    env,
    journeys,
    keeperSystem,
    keeper,
    judge,
    vkAddendum: ctx.vkAddendum,
    takeTelemetry: sink.take,
  });
  console.log(formatBeatCycle(report));
  const sameModel = keeperModel === judgeModel;
  if (sameModel) {
    console.log(
      `\nWARNING: Keeper and judge are the same model (${keeperModel}) -- self-preference risk ` +
        '(reviewer decision 27.09 #3); note it in the calibration record.',
    );
  }
  const out = resolve(
    here,
    reportFileName({ kind: 'beats-cycle', prompts: { keeper: KEEPER_PROMPT, judge: JUDGE_PROMPT }, model: keeperModel, now: new Date() }),
  );
  const record = {
    mode: 'beats',
    keeperModel,
    judgeModel,
    sameModel,
    prompts: {
      keeper: setup.provenance.keeper,
      judge: readFileRef(repoRoot, JUDGE_PROMPT),
      tone: setup.provenance.tone,
      assembly: setup.provenance.assembly,
    },
    packId: env.packId,
    packVersion: env.packVersion,
    seeds: journeys.map((j) => j.id),
    report,
  };
  writeReportExclusive(out, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`\nBeat-cycle report -> ${out} (gitignored).`);
} else {
  const seeds = toEngineSeeds(keeperSystem).filter((s) => wanted.length === 0 || wanted.includes(s.id));

  const llm = new AnthropicLlmClient();
  const keeper = new AnthropicKeeper({ llm, model: keeperModel, assembly: setup.assembly });
  const judge = new LlmJudge({ llm, model: judgeModel, systemPrompt: judgeSystem, shortCircuit: false });

  const report = await runSuite(seeds, { packageProvider: engineProvider(env), keeper, judge, ctx });

  console.log(formatSuite(report));
  const sameModel = keeperModel === judgeModel;
  if (sameModel) {
    console.log(
      `\nWARNING: Keeper and judge are the same model (${keeperModel}) -- self-preference risk ` +
        '(reviewer decision 27.09 #3); note it in the calibration record.',
    );
  }

  const out = resolve(
    here,
    reportFileName({
      kind: 'full-cycle',
      prompts: { keeper: KEEPER_PROMPT, judge: JUDGE_PROMPT },
      model: keeperModel,
      now: new Date(),
    }),
  );
  const record = {
    keeperModel,
    judgeModel,
    sameModel,
    prompts: {
      keeper: setup.provenance.keeper,
      judge: readFileRef(repoRoot, JUDGE_PROMPT),
      tone: setup.provenance.tone,
      assembly: setup.provenance.assembly,
    },
    packId: env.packId,
    packVersion: env.packVersion,
    seeds: seeds.map((s) => s.id),
    report,
  };
  writeReportExclusive(out, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`\nFull-cycle report -> ${out} (gitignored).`);
}
