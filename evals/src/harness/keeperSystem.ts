// System-prompt assembly for the Keeper and the judge (pure; no fs -- the .mts entries read files).
//
// Both APPEND the activated tone.md sidecar to their prompt with ONE shared separator, byte-
// identical to the judge assembly inlined in evals/calibrate.mts (anthropicKeeper.test.ts guards
// that symmetry against the calibrate.mts source). The `{{СЛОТ:...}}` placeholders in the prompts
// are NOT substituted -- the tone sidecar travels alongside, whole.

const TONE_SIDECAR_SEPARATOR = '\n\n---\n\n# Активированный tone.md (живой сайдкар)\n\n';

export function buildKeeperSystem(keeperPrompt: string, toneMd: string): string {
  return `${keeperPrompt}${TONE_SIDECAR_SEPARATOR}${toneMd}`;
}

/** The judge system: rubric prompt + tone.md, same separator as buildKeeperSystem (full-cycle.mts;
 *  calibrate.mts still inlines the identical template). */
export function buildJudgeSystem(judgePrompt: string, toneMd: string): string {
  return `${judgePrompt}${TONE_SIDECAR_SEPARATOR}${toneMd}`;
}
