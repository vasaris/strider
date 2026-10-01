// Keeper request assembly (3.1-C4; pure, no fs -- setup.ts reads the files).
//
// The two Russian strings that frame a Keeper request -- the tone.md sidecar separator and the
// one-line preamble of the user message -- live in prompts/assembly.v1.json, NOT in this source
// (orchestrator/src stays ASCII). They are byte-identical to the pre-C4 evals literals
// (evals/test/prompts.test.ts pins the file by sha256 and the values byte-for-byte; the
// keeper-requests.v0.3.json fixture pins the assembled requests).
//
// The `{{SLOT:...}}` placeholders in the prompts are NOT substituted: the activated tone.md
// travels alongside the prompt, whole, after the separator.

import type { NarrativePackage } from '../contract.js';
import { renderNarrativePackage } from '../render.js';

export const PROMPT_ASSEMBLY_SCHEMA = 'brodyazhnik.prompt-assembly/1';

export interface PromptAssembly {
  /** Appended between a system prompt (Keeper or judge) and the activated tone.md. */
  readonly toneSidecarSeparator: string;
  /** Prepended to the rendered package in the Keeper user message (includes its trailing blank line). */
  readonly keeperUserPreamble: string;
}

function requireString(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`parsePromptAssembly: '${key}' must be a non-empty string`);
  }
  return v;
}

/** Validate a parsed assembly document. Throws on a wrong schema id or a missing/empty field. */
export function parsePromptAssembly(doc: unknown): PromptAssembly {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    throw new Error('parsePromptAssembly: the document must be a JSON object');
  }
  const o = doc as Record<string, unknown>;
  if (o['schema'] !== PROMPT_ASSEMBLY_SCHEMA) {
    throw new Error(`parsePromptAssembly: schema must be '${PROMPT_ASSEMBLY_SCHEMA}'`);
  }
  return {
    toneSidecarSeparator: requireString(o, 'tone_sidecar_separator'),
    keeperUserPreamble: requireString(o, 'keeper_user_preamble'),
  };
}

/** prompt + separator + tone.md. Shared by the Keeper system and the evals judge system. */
export function appendToneSidecar(asm: PromptAssembly, prompt: string, toneMd: string): string {
  return prompt + asm.toneSidecarSeparator + toneMd;
}

/** The Keeper system prompt: keeper prompt + the activated tone.md sidecar. */
export function buildKeeperSystem(asm: PromptAssembly, keeperPrompt: string, toneMd: string): string {
  return appendToneSidecar(asm, keeperPrompt, toneMd);
}

/** The Keeper user message: the preamble + the rendered package (renderNarrativePackage --
 *  lossless; absent mechanics never appear). */
export function buildKeeperUser(asm: PromptAssembly, pkg: NarrativePackage): string {
  return asm.keeperUserPreamble + renderNarrativePackage(pkg);
}
