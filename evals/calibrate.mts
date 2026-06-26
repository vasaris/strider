// Ad-hoc tone-judge calibration runner. NOT part of `npm test` (that suite is offline, on the
// mock LlmClient, no key/tokens). This makes real Anthropic API calls and is run BY IVAN in his
// keyed shell:
//
//     export ANTHROPIC_API_KEY=...        # in your terminal; do NOT paste the key into chat/files
//     npx tsx evals/calibrate.mts
//
// The key is read ONLY from process.env, never written/logged/printed. The raw report goes to
// evals/calibration-report.json (gitignored). Bring that file's contents here for analysis --
// the first run is DIAGNOSTIC; do not tune the rubric off it without review.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnthropicLlmClient } from './src/harness/anthropicLlmClient.js';
import { CALIBRATION_CASES } from './src/harness/cases.js';
import { formatReport, runCalibration } from './src/harness/calibrationRunner.js';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is not set in this shell.\n' +
      '  Run in your keyed terminal (do NOT paste the key into chat or any file):\n' +
      '    export ANTHROPIC_API_KEY=...\n' +
      '    npx tsx evals/calibrate.mts\n',
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url)); // evals/
const repoRoot = resolve(here, '..');

const judgePrompt = readFileSync(resolve(repoRoot, 'prompts/judge.system.v0.md'), 'utf8');
const toneMd = readFileSync(resolve(repoRoot, 'content-packs/kv/tone.md'), 'utf8');
const systemPrompt = `${judgePrompt}\n\n---\n\n# Активированный tone.md (живой сайдкар)\n\n${toneMd}`;

const model = process.env.JUDGE_MODEL ?? 'claude-opus-4-8';

const report = await runCalibration({
  llm: new AnthropicLlmClient(),
  model,
  systemPrompt,
  cases: CALIBRATION_CASES,
});

console.log(formatReport(report));

const out = resolve(here, 'calibration-report.json');
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`\nRaw per-axis report -> ${out} (gitignored). Bring its contents here for analysis.`);
