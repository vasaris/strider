// The evals-specific half of the AnthropicKeeper tests (3.1-C4): the orchestrator AnthropicKeeper
// swaps into the evals runner by substitution. Its plumbing tests (request assembly, trim, empty
// prose, error propagation) moved to orchestrator/test/keeper.test.ts with the class.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AnthropicKeeper,
  loadPromptAssembly,
  renderNarrativePackage,
  type NarrativePackage,
} from '@brodyazhnik/orchestrator';
import { describe, expect, it } from 'vitest';
import { DeterministicJudge } from '../src/harness/judge.js';
import { fixtureProvider, runScenario } from '../src/harness/run.js';
import type { LlmClient, LlmRequest, Seed } from '../src/harness/types.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

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

// Clean, sensory, in-register prose (style of CLEAN_PROSE in harness.test.ts).
const MOCK_PROSE =
  'Поперёк тропы лёг подмытый ствол; кора под ладонью скользкая, из-под корней тянет сырой глиной и прелым листом.';

describe('orchestrator AnthropicKeeper in the evals runner (mock client; no key/network)', () => {
  it('swaps into runScenario by substitution (runner untouched)', async () => {
    const seed: Seed = { id: 'a2.keeper.swap', systemPrompt: SYSTEM, summary: 'an obstacle on the path' };
    const mock = new MockLlm(() => MOCK_PROSE);
    const t = await runScenario({
      seed,
      packageProvider: fixtureProvider(PKG),
      keeper: new AnthropicKeeper({ llm: mock, model: 'm', assembly: loadPromptAssembly(repoRoot) }),
      judge: new DeterministicJudge(),
    });
    expect(t.output.prose).toBe(MOCK_PROSE);
    expect(t.package).toEqual(PKG);
    expect(mock.calls[0]?.system).toBe(seed.systemPrompt);
    expect(mock.calls[0]?.user).toContain(renderNarrativePackage(PKG));
    expect(t.verdict.pass).toBe(true);
  });

});
