// Keeper setup from files (3.1-C4): loadKeeperSetup on the REAL repo files assembles the same
// system as buildKeeperSystem over the same inputs, and its provenance hashes are the file-byte
// sha256 of exactly those files.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildKeeperSystem, parsePromptAssembly } from '../src/keeper/assembly.js';
import {
  DEFAULT_ASSEMBLY,
  DEFAULT_TONE,
  loadKeeperSetup,
  loadPromptAssembly,
  readFileRef,
} from '../src/keeper/setup.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const KEEPER = 'prompts/keeper.system.v0.3.md';
const bytes = (rel: string): Buffer => readFileSync(resolve(repoRoot, rel));
const sha = (rel: string): string => createHash('sha256').update(bytes(rel)).digest('hex');

describe('loadKeeperSetup (real files)', () => {
  const setup = loadKeeperSetup({ repoRoot, keeperPrompt: KEEPER });

  it('system == buildKeeperSystem(assembly, keeper prompt, tone.md)', () => {
    const asm = parsePromptAssembly(JSON.parse(bytes(DEFAULT_ASSEMBLY).toString('utf8')) as unknown);
    expect(setup.assembly).toEqual(asm);
    expect(setup.system).toBe(
      buildKeeperSystem(asm, bytes(KEEPER).toString('utf8'), bytes(DEFAULT_TONE).toString('utf8')),
    );
  });

  it('provenance: repo-relative paths + sha256 of the file bytes', () => {
    expect(setup.provenance).toEqual({
      keeper: { path: KEEPER, sha256: sha(KEEPER) },
      tone: { path: DEFAULT_TONE, sha256: sha(DEFAULT_TONE) },
      assembly: { path: DEFAULT_ASSEMBLY, sha256: sha(DEFAULT_ASSEMBLY) },
    });
    expect(readFileRef(repoRoot, KEEPER)).toEqual(setup.provenance.keeper);
  });

  it('defaults: tone = content-packs/kv/tone.md, assembly = prompts/assembly.v1.json; explicit paths win', () => {
    expect(DEFAULT_TONE).toBe('content-packs/kv/tone.md');
    expect(DEFAULT_ASSEMBLY).toBe('prompts/assembly.v1.json');
    expect(loadPromptAssembly(repoRoot)).toEqual(setup.assembly);
    const other = loadKeeperSetup({ repoRoot, keeperPrompt: 'prompts/keeper.system.v0.2.md', tone: DEFAULT_TONE, assembly: DEFAULT_ASSEMBLY });
    expect(other.provenance.keeper.path).toBe('prompts/keeper.system.v0.2.md');
    expect(other.system).not.toBe(setup.system);
  });

  it('a missing file throws (keeper, tone or assembly)', () => {
    expect(() => loadKeeperSetup({ repoRoot, keeperPrompt: 'prompts/missing.md' })).toThrow();
    expect(() => loadKeeperSetup({ repoRoot, keeperPrompt: KEEPER, tone: 'content-packs/kv/missing.md' })).toThrow();
    expect(() => loadKeeperSetup({ repoRoot, keeperPrompt: KEEPER, assembly: 'prompts/missing.json' })).toThrow();
    expect(() => readFileRef(repoRoot, 'nope/nothing.txt')).toThrow();
  });
});
