// Ad-hoc AnthropicKeeper smoke (A2). NOT part of `npm test` (that suite is offline, on the mock
// LlmClient, no key/tokens). This makes a real Anthropic API call and is run BY IVAN in his
// keyed shell:
//
//     export ANTHROPIC_API_KEY=...        # in your terminal; do NOT paste the key into chat/files
//     cd evals && npx tsx keeper-smoke.mts
//
// Run from evals/: tsx is an evals devDependency and the workspace root has none, so a root-level
// `npx tsx` would not find a local tsx (and would offer to download one). The script resolves its
// files from import.meta.url, so the cwd does not matter otherwise.
//
// Optional: KEEPER_MODEL (default claude-opus-4-8). The key is read ONLY from process.env, never
// written/logged/printed. The output goes to
// evals/keeper-smoke.keeper-<keeper prompt version>.<model>.<UTC stamp>.json (gitignored; RP1: a
// new file per run, created exclusively -- never overwrites an earlier one). This is the
// Keeper smoke only -- no judge here; the full cycle engine -> package -> Keeper -> judge is A3.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnthropicKeeper, buildNarrativePackage, loadKeeperSetup, type EngineTurnResult } from '@brodyazhnik/orchestrator';
import { AnthropicLlmClient } from '@brodyazhnik/orchestrator/anthropic';
import { reportFileName, writeReportExclusive } from './src/reports.js';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is not set in this shell.\n' +
      '  Run in your keyed terminal (do NOT paste the key into chat or any file):\n' +
      '    export ANTHROPIC_API_KEY=...\n' +
      '    cd evals && npx tsx keeper-smoke.mts\n',
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url)); // evals/
const repoRoot = resolve(here, '..');

const KEEPER_PROMPT = 'prompts/keeper.system.v0.3.md';
// 3.1-C4: keeper prompt + tone.md over prompts/assembly.v1.json (orchestrator loadKeeperSetup).
const setup = loadKeeperSetup({ repoRoot, keeperPrompt: KEEPER_PROMPT });
const systemPrompt = setup.system;

// Hand-built projection of an SD1 journey step (extractTurn is internal now; the public producer
// is orchestrator's extractJourneyTurn). This fixture carries no journey/detection sections -- it
// is a Keeper smoke, not a live step. Dice follow mapDice: no raw faces (DEFERRED DD-DICE-FACES).
const turn: EngineTurnResult = {
  intent: 'journey',
  scene: 'journey',
  dice: { feat_symbol: null, success_icons: 1, total: 17, target_number: 14, outcome: 'strong' },
  oracleTable: 'journey_scenes',
  oracleResultRef: 'mishap',
  detailTable: 'scene_details.mishap',
  // face/scene/prompt/skill copied verbatim from content-packs/kv/tables/solo/scene_details.mishap.json
  // (face 3). significantEncounter mirrors the engine parser (engine/src/journey/config.ts:154:
  // `o["significant_encounter"] === true`): the pack row's optional flag is absent on face 3 -> false.
  sceneDetail: {
    face: 3,
    scene: 'Препятствие на пути',
    prompt: 'БДИТЕЛЬНОСТЬ, чтобы найти обход',
    skill: 'awareness',
    significantEncounter: false,
  },
  patch: { fatigue_delta: 2 },
  journalFacts: [],
};
const pkg = buildNarrativePackage(turn); // -> oracle.detail.row set, oracle.row null, lore_chunks []

const model = process.env.KEEPER_MODEL ?? 'claude-opus-4-8';
const keeper = new AnthropicKeeper({ llm: new AnthropicLlmClient(), model, assembly: setup.assembly });
const output = await keeper.run({ systemPrompt, package: pkg });

console.log(output.prose);

const out = resolve(here, reportFileName({ kind: 'keeper-smoke', prompts: { keeper: KEEPER_PROMPT }, model, now: new Date() }));
writeReportExclusive(out, `${JSON.stringify({ model, prompts: setup.provenance, package: pkg, output }, null, 2)}\n`);
console.log(`\nKeeper smoke -> ${out} (gitignored).`);
