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
  loadKeeperSetupWith,
  loadPromptAssembly,
  readFileRef,
  type FileBytesReader,
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

describe('loadKeeperSetupWith: one read per file (N1)', () => {
  const abs = (rel: string): string => resolve(repoRoot, rel);

  it('reads each of the 3 files exactly once and equals loadKeeperSetup', () => {
    const counts = new Map<string, number>();
    const read: FileBytesReader = (p) => {
      counts.set(p, (counts.get(p) ?? 0) + 1);
      return readFileSync(p);
    };
    const setup = loadKeeperSetupWith(read, { repoRoot, keeperPrompt: KEEPER });
    expect([...counts.entries()].sort()).toEqual(
      [[abs(KEEPER), 1], [abs(DEFAULT_TONE), 1], [abs(DEFAULT_ASSEMBLY), 1]].sort(),
    );
    expect(setup).toEqual(loadKeeperSetup({ repoRoot, keeperPrompt: KEEPER }));
  });

  it('a file that changes between reads cannot make provenance disagree with the text used', () => {
    // The pre-N1 race: text from one read, sha256 from a second read of a replaced file. Every
    // read here returns different bytes than the previous read of the same path.
    const generation = new Map<string, number>();
    const read: FileBytesReader = (p) => {
      const n = (generation.get(p) ?? 0) + 1;
      generation.set(p, n);
      const real = readFileSync(p);
      if (p === abs(DEFAULT_ASSEMBLY)) return real; // keep the assembly parseable
      return Buffer.concat([real, Buffer.from(`\n<!-- read ${n} -->\n`, 'utf8')]);
    };
    const setup = loadKeeperSetupWith(read, { repoRoot, keeperPrompt: KEEPER });
    const keeperBytes = Buffer.concat([bytes(KEEPER), Buffer.from('\n<!-- read 1 -->\n', 'utf8')]);
    const toneBytes = Buffer.concat([bytes(DEFAULT_TONE), Buffer.from('\n<!-- read 1 -->\n', 'utf8')]);
    const hash = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
    expect(setup.provenance.keeper.sha256).toBe(hash(keeperBytes));
    expect(setup.provenance.tone.sha256).toBe(hash(toneBytes));
    expect(setup.system).toBe(buildKeeperSystem(setup.assembly, keeperBytes.toString('utf8'), toneBytes.toString('utf8')));
    expect(setup.system).toContain('<!-- read 1 -->');
    expect(setup.system).not.toContain('<!-- read 2 -->');
  });

  it('the assembly provenance hashes the bytes that were parsed', () => {
    const variant = Buffer.from(JSON.stringify(JSON.parse(bytes(DEFAULT_ASSEMBLY).toString('utf8')), null, 4), 'utf8');
    let reads = 0;
    const read: FileBytesReader = (p) => {
      if (p !== abs(DEFAULT_ASSEMBLY)) return readFileSync(p);
      reads++;
      return reads === 1 ? variant : readFileSync(p);
    };
    const setup = loadKeeperSetupWith(read, { repoRoot, keeperPrompt: KEEPER });
    expect(reads).toBe(1);
    expect(setup.provenance.assembly.sha256).toBe(createHash('sha256').update(variant).digest('hex'));
    expect(setup.provenance.assembly.sha256).not.toBe(sha(DEFAULT_ASSEMBLY));
  });
});
