// Keeper system-prompt assembly (pure; no fs -- the .mts entry reads the files).
//
// v0 APPENDS the activated tone.md sidecar to the Keeper prompt, byte-symmetric with the judge
// system assembly in evals/calibrate.mts (same separator bytes; anthropicKeeper.test.ts guards
// the symmetry). The `{{СЛОТ:...}}` placeholders in prompts/keeper.system.v0.md are NOT
// substituted in v0 -- the tone sidecar travels alongside, whole.

export function buildKeeperSystem(keeperPrompt: string, toneMd: string): string {
  return `${keeperPrompt}\n\n---\n\n# Активированный tone.md (живой сайдкар)\n\n${toneMd}`;
}
