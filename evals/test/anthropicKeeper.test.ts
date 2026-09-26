import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderNarrativePackage, type NarrativePackage } from '@brodyazhnik/orchestrator';
import { describe, expect, it } from 'vitest';
import { AnthropicKeeper, buildKeeperUser } from '../src/harness/anthropicKeeper.js';
import { DeterministicJudge } from '../src/harness/judge.js';
import { buildKeeperSystem } from '../src/harness/keeperSystem.js';
import { fixtureProvider, runScenario } from '../src/harness/run.js';
import type { KeeperInput, LlmClient, LlmRequest, Seed } from '../src/harness/types.js';

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

// Clean, sensory, in-register prose (style of CLEAN_PROSE in harness.test.ts).
const MOCK_PROSE =
  'Поперёк тропы лёг подмытый ствол; кора под ладонью скользкая, из-под корней тянет сырой глиной и прелым листом.';

const SEP = '\n\n---\n\n# Активированный tone.md (живой сайдкар)\n\n';

describe('AnthropicKeeper plumbing (mock client; no key/network)', () => {
  it('assembles the request: model + system passed through + rendered package in user', async () => {
    const llm = new MockLlm(() => MOCK_PROSE);
    await new AnthropicKeeper({ llm, model: 'test-model' }).run(INPUT);
    expect(llm.calls).toHaveLength(1);
    const req = llm.calls[0];
    expect(req?.model).toBe('test-model');
    expect(req?.system).toBe(SYSTEM);
    expect(req?.user).toBe(
      'Входной пакет хода — единственный источник фактов. Напиши прозу сцены.\n\n' + renderNarrativePackage(PKG),
    );
    expect(req?.user).toBe(buildKeeperUser(PKG));
    expect(req?.user).toContain('result_ref: mishap');
    expect(req?.user).toContain('target_number: 16');
    expect(req?.user.endsWith(renderNarrativePackage(PKG))).toBe(true);
  });

  it('returns the trimmed reply as prose-only output (no questions key)', async () => {
    const keeper = new AnthropicKeeper({ llm: new MockLlm(() => `  \n${MOCK_PROSE}\n `), model: 'm' });
    const out = await keeper.run(INPUT);
    expect(out).toEqual({ prose: MOCK_PROSE });
    expect('questions' in out).toBe(false);
  });

  it('throws on an empty or whitespace-only reply (no error slot on KeeperOutput)', async () => {
    const blank = new AnthropicKeeper({ llm: new MockLlm(() => ' \n '), model: 'm' });
    await expect(blank.run(INPUT)).rejects.toThrow('AnthropicKeeper: empty prose');
    const empty = new AnthropicKeeper({ llm: new MockLlm(() => ''), model: 'm' });
    await expect(empty.run(INPUT)).rejects.toThrow('AnthropicKeeper: empty prose');
  });

  it('swaps into runScenario by substitution (runner untouched)', async () => {
    const seed: Seed = { id: 'a2.keeper.swap', systemPrompt: SYSTEM, summary: 'an obstacle on the path' };
    const mock = new MockLlm(() => MOCK_PROSE);
    const t = await runScenario({
      seed,
      packageProvider: fixtureProvider(PKG),
      keeper: new AnthropicKeeper({ llm: mock, model: 'm' }),
      judge: new DeterministicJudge(),
    });
    expect(t.output.prose).toBe(MOCK_PROSE);
    expect(t.package).toEqual(PKG);
    expect(mock.calls[0]?.system).toBe(seed.systemPrompt);
    expect(mock.calls[0]?.user).toContain(renderNarrativePackage(PKG));
    expect(t.verdict.pass).toBe(true);
  });

  it('buildKeeperSystem appends tone.md with the same separator bytes as the judge assembly', () => {
    const sys = buildKeeperSystem('K', 'T');
    expect(sys.startsWith('K')).toBe(true);
    expect(sys.endsWith('T')).toBe(true);
    expect(sys).toBe(`K${SEP}T`);

    // Drift guard: calibrate.mts assembles the judge system with the SAME separator. If either
    // side changes its bytes, this fails.
    const calibratePath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'calibrate.mts');
    const src = readFileSync(calibratePath, 'utf8');
    expect(src).toContain('`${judgePrompt}' + SEP.replaceAll('\n', '\\n') + '${toneMd}`');
  });

  it('propagates an llm.complete rejection unchanged (nothing swallowed)', async () => {
    const boom = new Error('boom');
    const llm: LlmClient = { complete: () => Promise.reject(boom) };
    await expect(new AnthropicKeeper({ llm, model: 'm' }).run(INPUT)).rejects.toBe(boom);
  });
});
