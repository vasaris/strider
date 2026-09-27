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
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnthropicKeeper } from './src/harness/anthropicKeeper.js';
import { AnthropicLlmClient } from './src/harness/anthropicLlmClient.js';
import { engineProvider, loadEngineEnv } from './src/harness/engineProvider.js';
import { buildJudgeSystem, buildKeeperSystem } from './src/harness/keeperSystem.js';
import { LlmJudge } from './src/harness/llmJudge.js';
import { formatSuite, runSuite } from './src/harness/suite.js';
import { SUITE_JOURNEYS, toEngineSeeds } from './src/harness/suiteSeeds.js';
import { loadVkAddendumFromPack } from './src/lt1gate.js';
import { reportFileName, writeReportExclusive } from './src/reports.js';

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

const KEEPER_PROMPT = 'prompts/keeper.system.v0.2.md';
const JUDGE_PROMPT = 'prompts/judge.system.v0.3.md';
const TONE = 'content-packs/kv/tone.md';
const read = (rel: string): string => readFileSync(resolve(repoRoot, rel), 'utf8');
const fileRef = (rel: string): { path: string; sha256: string } => ({
  path: rel,
  sha256: createHash('sha256').update(readFileSync(resolve(repoRoot, rel))).digest('hex'),
});

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

const toneMd = read(TONE);
const keeperSystem = buildKeeperSystem(read(KEEPER_PROMPT), toneMd);
const judgeSystem = buildJudgeSystem(read(JUDGE_PROMPT), toneMd);
const ctx = { vkAddendum: loadVkAddendumFromPack(resolve(repoRoot, 'content-packs/kv')) };
const env = loadEngineEnv(resolve(repoRoot, 'content-packs/kv'));

const seeds = toEngineSeeds(keeperSystem).filter((s) => wanted.length === 0 || wanted.includes(s.id));

const llm = new AnthropicLlmClient();
const keeper = new AnthropicKeeper({ llm, model: keeperModel });
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
  prompts: { keeper: fileRef(KEEPER_PROMPT), judge: fileRef(JUDGE_PROMPT), tone: fileRef(TONE) },
  packVersion: env.packVersion,
  seeds: seeds.map((s) => s.id),
  report,
};
writeReportExclusive(out, `${JSON.stringify(record, null, 2)}\n`);
console.log(`\nFull-cycle report -> ${out} (gitignored).`);
