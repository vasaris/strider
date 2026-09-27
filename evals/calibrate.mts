// Ad-hoc tone-judge calibration runner. NOT part of `npm test` (that suite is offline, on the
// mock LlmClient, no key/tokens). This makes real Anthropic API calls and is run BY IVAN in his
// keyed shell:
//
//     export ANTHROPIC_API_KEY=...        # in your terminal; do NOT paste the key into chat/files
//     cd evals && npx tsx calibrate.mts      # tsx lives in evals/ (the workspace root has none)
//
// The key is read ONLY from process.env, never written/logged/printed. The raw report goes to
// evals/calibration-report.judge-<judge prompt version>.<judge model>.<UTC stamp>.json
// (gitignored; RP1: a new file per run, created exclusively -- never overwrites an earlier
// report). Bring that file's contents here for analysis -- the first run is DIAGNOSTIC; do not
// tune the rubric off it without review.
// A4.3: judge prompt v0.3; the deterministic gate runs with the live VK addendum (pack sidecar).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnthropicLlmClient } from './src/harness/anthropicLlmClient.js';
import { CALIBRATION_CASES } from './src/harness/cases.js';
import { formatReport, runCalibration } from './src/harness/calibrationRunner.js';
import { loadVkAddendumFromPack } from './src/lt1gate.js';
import { reportFileName, writeReportExclusive } from './src/reports.js';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is not set in this shell.\n' +
      '  Run in your keyed terminal (do NOT paste the key into chat or any file):\n' +
      '    export ANTHROPIC_API_KEY=...\n' +
      '    cd evals && npx tsx calibrate.mts\n',
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url)); // evals/
const repoRoot = resolve(here, '..');

const JUDGE_PROMPT = 'prompts/judge.system.v0.3.md';
const judgePrompt = readFileSync(resolve(repoRoot, JUDGE_PROMPT), 'utf8');
const toneMd = readFileSync(resolve(repoRoot, 'content-packs/kv/tone.md'), 'utf8');
const systemPrompt = `${judgePrompt}\n\n---\n\n# Активированный tone.md (живой сайдкар)\n\n${toneMd}`;

const model = process.env.JUDGE_MODEL ?? 'claude-opus-4-8';

const report = await runCalibration({
  llm: new AnthropicLlmClient(),
  model,
  systemPrompt,
  cases: CALIBRATION_CASES,
  ctx: { vkAddendum: loadVkAddendumFromPack(resolve(repoRoot, 'content-packs/kv')) },
});

console.log(formatReport(report));

const out = resolve(here, reportFileName({ kind: 'calibration', prompts: { judge: JUDGE_PROMPT }, model, now: new Date() }));
writeReportExclusive(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nRaw per-axis report -> ${out} (gitignored). Bring its contents here for analysis.`);
