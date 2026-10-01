// Judge-path byte identity (3.1-C4). The judge stays in evals; its system prompt is
// buildJudgeSystem = orchestrator appendToneSidecar over prompts/assembly.v1.json. The pre-C4
// separator is written here as a literal, so the move is proven byte-identical on the judge side
// too (the Keeper side is pinned by keeperRequests.test.ts). Replaces the old calibrate.mts grep
// drift guard of anthropicKeeper.test.ts (whose plumbing tests moved to orchestrator/test/keeper.test.ts).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKeeperSystem, loadPromptAssembly } from '@brodyazhnik/orchestrator';
import { describe, expect, it } from 'vitest';
import { buildJudgeSystem } from '../src/harness/judgeSystem.js';

const evalsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(evalsDir, '..');
const asm = loadPromptAssembly(repoRoot);

// The pre-C4 literal (evals keeperSystem.ts TONE_SIDECAR_SEPARATOR / calibrate.mts inline template).
const PRE_C4_SEP = '\n\n---\n\n# Активированный tone.md (живой сайдкар)\n\n';

describe('judge system assembly (3.1-C4)', () => {
  it('buildJudgeSystem(asm, J, T) === J + the pre-C4 separator + T', () => {
    expect(buildJudgeSystem(asm, 'J', 'T')).toBe('J' + PRE_C4_SEP + 'T');
    const judge = readFileSync(resolve(repoRoot, 'prompts/judge.system.v0.4.md'), 'utf8');
    const tone = readFileSync(resolve(repoRoot, 'content-packs/kv/tone.md'), 'utf8');
    expect(buildJudgeSystem(asm, judge, tone)).toBe(judge + PRE_C4_SEP + tone);
  });

  it('the judge and the Keeper share one separator', () => {
    expect(buildJudgeSystem(asm, 'J', 'T')).toBe(buildKeeperSystem(asm, 'J', 'T'));
  });

  it('calibrate.mts and full-cycle.mts call buildJudgeSystem; no inline template remains', () => {
    for (const name of ['calibrate.mts', 'full-cycle.mts']) {
      const src = readFileSync(resolve(evalsDir, name), 'utf8');
      expect(src, name).toContain('buildJudgeSystem(');
      expect(src, name).not.toContain('Активированный tone.md');
      expect(src, name).not.toContain('${judgePrompt}');
    }
  });
});
