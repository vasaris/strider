// Prompt assembly (3.1-C4): parse validation, and the exact bytes appendToneSidecar /
// buildKeeperUser produce with the REAL prompts/assembly.v1.json. The expected strings are built
// from the parsed file values, not retyped here (orchestrator/test stays free of the Russian
// literals; evals/test/prompts.test.ts pins the file and its values byte-for-byte).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PROMPT_ASSEMBLY_SCHEMA,
  appendToneSidecar,
  buildKeeperSystem,
  buildKeeperUser,
  parsePromptAssembly,
} from '../src/keeper/assembly.js';
import type { NarrativePackage } from '../src/contract.js';
import { renderNarrativePackage } from '../src/render.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const raw = JSON.parse(readFileSync(resolve(repoRoot, 'prompts/assembly.v1.json'), 'utf8')) as Record<string, string>;

const PKG: NarrativePackage = {
  intent: 'journey',
  scene: 'journey',
  length_target: { min_chars: 400, max_chars: 800 },
  dice: null,
  oracle: null,
  patch: { fatigue_delta: 1 },
  lore_chunks: [],
};

describe('parsePromptAssembly', () => {
  it('maps the real file to the two fields', () => {
    const asm = parsePromptAssembly(raw);
    expect(raw['schema']).toBe(PROMPT_ASSEMBLY_SCHEMA);
    expect(asm).toEqual({
      toneSidecarSeparator: raw['tone_sidecar_separator'],
      keeperUserPreamble: raw['keeper_user_preamble'],
    });
  });

  it('throws on a non-object, a wrong/missing schema, or a missing/empty/non-string field', () => {
    const ok = { schema: PROMPT_ASSEMBLY_SCHEMA, tone_sidecar_separator: 'S', keeper_user_preamble: 'P' };
    expect(() => parsePromptAssembly(ok)).not.toThrow();
    expect(() => parsePromptAssembly(null)).toThrow(/JSON object/);
    expect(() => parsePromptAssembly('x')).toThrow(/JSON object/);
    expect(() => parsePromptAssembly([ok])).toThrow(/JSON object/);
    expect(() => parsePromptAssembly({ ...ok, schema: 'brodyazhnik.prompt-assembly/2' })).toThrow(/schema/);
    const { schema: _s, ...noSchema } = ok;
    expect(() => parsePromptAssembly(noSchema)).toThrow(/schema/);
    expect(() => parsePromptAssembly({ ...ok, tone_sidecar_separator: '' })).toThrow(/tone_sidecar_separator/);
    expect(() => parsePromptAssembly({ ...ok, keeper_user_preamble: 7 })).toThrow(/keeper_user_preamble/);
    const { keeper_user_preamble: _p, ...noPreamble } = ok;
    expect(() => parsePromptAssembly(noPreamble)).toThrow(/keeper_user_preamble/);
  });
});

describe('assembly bytes (real prompts/assembly.v1.json)', () => {
  const asm = parsePromptAssembly(raw);

  it('appendToneSidecar = prompt + separator + tone; buildKeeperSystem is the same', () => {
    expect(appendToneSidecar(asm, 'K', 'T')).toBe(`K${raw['tone_sidecar_separator']}T`);
    expect(buildKeeperSystem(asm, 'K', 'T')).toBe(appendToneSidecar(asm, 'K', 'T'));
    // whitespace at the edges is preserved, nothing trimmed or normalised
    expect(appendToneSidecar(asm, '\n K \n', '\nT\n\n')).toBe(`\n K \n${raw['tone_sidecar_separator']}\nT\n\n`);
  });

  it('buildKeeperUser = preamble (with its trailing blank line) + the rendered package', () => {
    expect(raw['keeper_user_preamble']?.endsWith('\n\n')).toBe(true);
    expect(buildKeeperUser(asm, PKG)).toBe(`${raw['keeper_user_preamble']}${renderNarrativePackage(PKG)}`);
  });
});
