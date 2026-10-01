// AnthropicKeeper plumbing (3.1-C4; moved from evals/test/anthropicKeeper.test.ts with the class).
// Mock LlmClient only -- no key, no network. The assembly is the real prompts/assembly.v1.json, so
// the user-message bytes asserted here are the production framing.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { NarrativePackage } from '../src/contract.js';
import { AnthropicKeeper } from '../src/keeper/anthropicKeeper.js';
import { buildKeeperUser } from '../src/keeper/assembly.js';
import type { KeeperInput, LlmClient, LlmRequest } from '../src/keeper/seam.js';
import { loadPromptAssembly } from '../src/keeper/setup.js';
import { renderNarrativePackage } from '../src/render.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASM = loadPromptAssembly(repoRoot);

class MockLlm implements LlmClient {
  readonly calls: LlmRequest[] = [];
  constructor(private readonly responder: (req: LlmRequest) => string) {}
  complete(req: LlmRequest): Promise<string> {
    this.calls.push(req);
    return Promise.resolve(this.responder(req));
  }
}

const PKG: NarrativePackage = {
  intent: 'journey',
  scene: 'journey',
  length_target: { min_chars: 400, max_chars: 800 },
  dice: { feat_symbol: null, success_icons: 1, total: 17, target_number: 16, outcome: 'strong' },
  oracle: {
    table: 'journey_scenes',
    result_ref: 'mishap',
    row: null,
    detail: {
      table: 'scene_details.mishap',
      result_ref: 'scene_details.mishap#face=3',
      detail: null,
      row: {
        face: 3,
        scene: 'Препятствие на пути',
        prompt: 'БДИТЕЛЬНОСТЬ, чтобы найти обход',
        skill: 'awareness',
        significantEncounter: false,
      },
    },
  },
  patch: { fatigue_delta: 2 },
  lore_chunks: [],
};

// Leading/trailing whitespace on purpose: the real system ends with tone.md's trailing newline,
// and `toBe(SYSTEM)` must catch any trim/normalisation.
const SYSTEM = '\n  KEEPER-PROMPT line 1\nline 2\n\n---\n\nTONE sidecar\n\n';
const INPUT: KeeperInput = { systemPrompt: SYSTEM, package: PKG };

// Clean, sensory, in-register prose (style of CLEAN_PROSE in evals harness.test.ts).
const MOCK_PROSE =
  'Поперёк тропы лёг подмытый ствол; кора под ладонью скользкая, из-под корней тянет сырой глиной и прелым листом.';

describe('AnthropicKeeper plumbing (mock client; no key/network)', () => {
  it('assembles the request: model + system passed through + rendered package in user', async () => {
    const llm = new MockLlm(() => MOCK_PROSE);
    await new AnthropicKeeper({ llm, model: 'test-model', assembly: ASM }).run(INPUT);
    expect(llm.calls).toHaveLength(1);
    const req = llm.calls[0];
    expect(req?.model).toBe('test-model');
    expect(req?.system).toBe(SYSTEM);
    expect(req?.user).toBe(
      'Входной пакет хода — единственный источник фактов. Напиши прозу сцены.\n\n' + renderNarrativePackage(PKG),
    );
    expect(req?.user).toBe(buildKeeperUser(ASM, PKG));
    expect(req?.user).toContain('result_ref: mishap');
    expect(req?.user).toContain('target_number: 16');
    expect(req?.user.endsWith(renderNarrativePackage(PKG))).toBe(true);
  });

  it('returns the trimmed reply as prose-only output (no questions key)', async () => {
    const keeper = new AnthropicKeeper({ llm: new MockLlm(() => `  \n${MOCK_PROSE}\n `), model: 'm', assembly: ASM });
    const out = await keeper.run(INPUT);
    expect(out).toEqual({ prose: MOCK_PROSE });
    expect('questions' in out).toBe(false);
  });

  it('throws on an empty or whitespace-only reply (no error slot on KeeperOutput)', async () => {
    const blank = new AnthropicKeeper({ llm: new MockLlm(() => ' \n '), model: 'm', assembly: ASM });
    await expect(blank.run(INPUT)).rejects.toThrow('AnthropicKeeper: empty prose');
    const empty = new AnthropicKeeper({ llm: new MockLlm(() => ''), model: 'm', assembly: ASM });
    await expect(empty.run(INPUT)).rejects.toThrow('AnthropicKeeper: empty prose');
  });

  it('propagates an llm.complete rejection unchanged (nothing swallowed)', async () => {
    const boom = new Error('boom');
    const llm: LlmClient = { complete: () => Promise.reject(boom) };
    await expect(new AnthropicKeeper({ llm, model: 'm', assembly: ASM }).run(INPUT)).rejects.toBe(boom);
  });

  it('frames the user message with the INJECTED assembly (no hidden literal)', async () => {
    const llm = new MockLlm(() => MOCK_PROSE);
    const asm = { toneSidecarSeparator: '|S|', keeperUserPreamble: 'P:' };
    await new AnthropicKeeper({ llm, model: 'm', assembly: asm }).run(INPUT);
    expect(llm.calls[0]?.user).toBe('P:' + renderNarrativePackage(PKG));
  });
});
