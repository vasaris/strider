// Keeper setup from files (3.1-C4): read the keeper prompt, the activated tone.md and the prompt
// assembly, assemble the Keeper system prompt, and record provenance (repo-relative path + sha256
// of the file BYTES) so a run record names exactly what the Keeper saw. One loader for the evals
// keyed scripts and the server route. Paths are repo-relative; repoRoot is the caller's.
// N1 (3.1-C7): every file is read once; text and sha256 come from the same bytes.

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

/** Reads one file's bytes by absolute path (injectable; the default is readFileSync). */
export type FileBytesReader = (absPath: string) => Uint8Array;

const fsReader: FileBytesReader = (absPath) => readFileSync(absPath);

/** Text and provenance from ONE read: both derive from the same bytes (N1). */
function readOnce(read: FileBytesReader, repoRoot: string, rel: string): { readonly text: string; readonly ref: FileRef } {
  const bytes = read(resolve(repoRoot, rel));
  return {
    text: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('utf8'),
    ref: { path: rel, sha256: createHash('sha256').update(bytes).digest('hex') },
  };
}

/** Path + sha256 of the file bytes. Throws if the file is missing. */
export function readFileRef(repoRoot: string, rel: string): FileRef {
  return readOnce(fsReader, repoRoot, rel).ref;
}

/** Read + validate a prompt-assembly document (parsePromptAssembly). */
export function loadPromptAssembly(repoRoot: string, rel: string = DEFAULT_ASSEMBLY): PromptAssembly {
  return parsePromptAssembly(JSON.parse(readOnce(fsReader, repoRoot, rel).text) as unknown);
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

export interface KeeperSetupOptions {
  readonly repoRoot: string;
  readonly keeperPrompt: string;
  readonly tone?: string;
  readonly assembly?: string;
}

export function loadKeeperSetup(opts: KeeperSetupOptions): KeeperSetup {
  return loadKeeperSetupWith(fsReader, opts);
}

/**
 * loadKeeperSetup over an injected reader (tests). N1: each file is read exactly ONCE, and the
 * system prompt, the assembly and the provenance hashes all derive from those same bytes -- a
 * file replaced between two reads can no longer make the recorded sha256 name other bytes than
 * the ones the Keeper saw.
 */
export function loadKeeperSetupWith(read: FileBytesReader, opts: KeeperSetupOptions): KeeperSetup {
  const keeper = readOnce(read, opts.repoRoot, opts.keeperPrompt);
  const tone = readOnce(read, opts.repoRoot, opts.tone ?? DEFAULT_TONE);
  const asm = readOnce(read, opts.repoRoot, opts.assembly ?? DEFAULT_ASSEMBLY);
  const assembly = parsePromptAssembly(JSON.parse(asm.text) as unknown);
  return {
    system: buildKeeperSystem(assembly, keeper.text, tone.text),
    assembly,
    provenance: { keeper: keeper.ref, tone: tone.ref, assembly: asm.ref },
  };
}
