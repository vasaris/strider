// Keeper setup from files (3.1-C4): read the keeper prompt, the activated tone.md and the prompt
// assembly, assemble the Keeper system prompt, and record provenance (repo-relative path + sha256
// of the file BYTES) so a run record names exactly what the Keeper saw. One loader for the evals
// keyed scripts and the server route. Paths are repo-relative; repoRoot is the caller's.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildKeeperSystem, parsePromptAssembly, type PromptAssembly } from './assembly.js';

export interface FileRef {
  readonly path: string; // repo-relative, as given
  readonly sha256: string; // hex digest of the file bytes
}

export const DEFAULT_TONE = 'content-packs/kv/tone.md';
export const DEFAULT_ASSEMBLY = 'prompts/assembly.v1.json';

/** Path + sha256 of the file bytes. Throws if the file is missing. */
export function readFileRef(repoRoot: string, rel: string): FileRef {
  const bytes = readFileSync(resolve(repoRoot, rel));
  return { path: rel, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** Read + validate a prompt-assembly document (parsePromptAssembly). */
export function loadPromptAssembly(repoRoot: string, rel: string = DEFAULT_ASSEMBLY): PromptAssembly {
  return parsePromptAssembly(JSON.parse(readFileSync(resolve(repoRoot, rel), 'utf8')) as unknown);
}

export interface KeeperSetup {
  readonly system: string; // buildKeeperSystem(assembly, keeper prompt, tone.md)
  readonly assembly: PromptAssembly; // pass to AnthropicKeeper / buildKeeperUser
  readonly provenance: {
    readonly keeper: FileRef;
    readonly tone: FileRef;
    readonly assembly: FileRef;
  };
}

export function loadKeeperSetup(opts: {
  readonly repoRoot: string;
  readonly keeperPrompt: string;
  readonly tone?: string;
  readonly assembly?: string;
}): KeeperSetup {
  const tone = opts.tone ?? DEFAULT_TONE;
  const assemblyPath = opts.assembly ?? DEFAULT_ASSEMBLY;
  const read = (rel: string): string => readFileSync(resolve(opts.repoRoot, rel), 'utf8');
  const assembly = loadPromptAssembly(opts.repoRoot, assemblyPath);
  return {
    system: buildKeeperSystem(assembly, read(opts.keeperPrompt), read(tone)),
    assembly,
    provenance: {
      keeper: readFileRef(opts.repoRoot, opts.keeperPrompt),
      tone: readFileRef(opts.repoRoot, tone),
      assembly: readFileRef(opts.repoRoot, assemblyPath),
    },
  };
}
