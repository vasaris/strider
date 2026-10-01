// The judge system prompt (3.1-C4): rubric prompt + the activated tone.md sidecar, assembled with
// orchestrator's appendToneSidecar -- the SAME separator (prompts/assembly.v1.json) as the Keeper
// system. The judge stays in evals; only the shared framing lives in orchestrator. Pure (no fs --
// the .mts entries read the files).

import { appendToneSidecar, type PromptAssembly } from '@brodyazhnik/orchestrator';

export function buildJudgeSystem(asm: PromptAssembly, judgePrompt: string, toneMd: string): string {
  return appendToneSidecar(asm, judgePrompt, toneMd);
}
