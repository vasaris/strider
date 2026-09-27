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
// written/logged/printed. The output goes to evals/keeper-smoke.json (gitignored). This is the
// Keeper smoke only -- no judge here; the full cycle engine -> package -> Keeper -> judge is A3.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNarrativePackage, type EngineTurnResult } from '@brodyazhnik/orchestrator';
import { AnthropicLlmClient } from './src/harness/anthropicLlmClient.js';
import { AnthropicKeeper } from './src/harness/anthropicKeeper.js';
import { buildKeeperSystem } from './src/harness/keeperSystem.js';

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

const keeperPrompt = readFileSync(resolve(repoRoot, 'prompts/keeper.system.v0.1.md'), 'utf8');
const toneMd = readFileSync(resolve(repoRoot, 'content-packs/kv/tone.md'), 'utf8');
const systemPrompt = buildKeeperSystem(keeperPrompt, toneMd);

// Fixture turn shaped exactly like orchestrator extractTurn() output for an SD1 journey step, so
// the package is what the real producer would hand the Keeper. Dice follow mapDice: no raw faces
// (DEFERRED DD-DICE-FACES).
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
const keeper = new AnthropicKeeper({ llm: new AnthropicLlmClient(), model });
const output = await keeper.run({ systemPrompt, package: pkg });

console.log(output.prose);

const out = resolve(here, 'keeper-smoke.json');
writeFileSync(out, `${JSON.stringify({ model, package: pkg, output }, null, 2)}\n`, 'utf8');
console.log(`\nKeeper smoke -> ${out} (gitignored).`);
