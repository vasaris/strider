import { describe, expect, it } from 'vitest';
import { DeterministicJudge } from '../src/harness/judge.js';
import { StubKeeper } from '../src/harness/keeper.js';
import { fixtureProvider, runScenario } from '../src/harness/run.js';
import type { ScenarioPackage, Seed } from '../src/harness/types.js';

const SEED: Seed = {
  id: 'golden.journey.clean',
  systemPrompt: 'STUB-PROMPT', // the real prompt (prompts/keeper.system.v0.md) is wired at 2.4
};
const PKG: ScenarioPackage = { intent: 'journey', scene: 'journey', summary: 'a quiet stretch of road at dusk' };

// Clean, sensory, in-register prose (leads with touch/sound/smell; no calque/cliche/VK).
const CLEAN_PROSE =
  'Тропа вильнула к ольшанику; под сапогом хрустнул ледок, и потянуло дымом от дальнего костра.';

describe('eval harness: cycle plumbing', () => {
  it('runs seed -> provider -> stub keeper -> deterministic judge and passes clean prose', async () => {
    const t = await runScenario({
      seed: SEED,
      packageProvider: fixtureProvider(PKG),
      keeper: new StubKeeper(CLEAN_PROSE),
      judge: new DeterministicJudge(),
    });
    expect(t.output.prose).toBe(CLEAN_PROSE);
    expect(t.verdict.pass).toBe(true);
    expect(t.verdict.axes.anti_slop.status).toBe('scored');
    expect(t.verdict.axes.tone.status).toBe('pending'); // awaits LLM judge + tone.md (2.4)
  });

  it('blocks prose with a wrong-system calque', async () => {
    const t = await runScenario({
      seed: SEED,
      packageProvider: fixtureProvider(PKG),
      keeper: new StubKeeper('Герой теряет хиты и бредёт дальше.'),
      judge: new DeterministicJudge(),
    });
    expect(t.verdict.antiSlop.blocking).toBe(true);
    expect(t.verdict.pass).toBe(false);
    expect(t.verdict.axes.anti_slop.score).toBe(0);
  });

  it('treats length outside target as a WARN, not a block', async () => {
    const t = await runScenario({
      seed: SEED,
      packageProvider: fixtureProvider(PKG),
      keeper: new StubKeeper(CLEAN_PROSE),
      judge: new DeterministicJudge(),
      ctx: { lengthTarget: { minChars: 400, maxChars: 800 } },
    });
    expect(t.verdict.budgetWarn).toBe(true); // CLEAN_PROSE is far under 400 chars
    expect(t.verdict.pass).toBe(true); // anti-slop clean -> still passes
  });

  it('package source is injected (seam): swapping the provider does not touch the runner', async () => {
    const other: ScenarioPackage = { intent: 'council', scene: 'council', summary: 'a tense parley' };
    const t = await runScenario({
      seed: SEED,
      packageProvider: fixtureProvider(other),
      keeper: new StubKeeper(CLEAN_PROSE),
      judge: new DeterministicJudge(),
    });
    expect(t.package).toEqual(other); // at 2.4 this provider becomes orchestrator's real builder
  });

  it('golden: stub-keeper path is byte-stable (prompt/runner change caught by diff)', async () => {
    // Byte-golden is valid ONLY on the stub path. The real LLM keeper is not
    // byte-deterministic, so its transcript-diff is judge-scored at 2.4, not byte.
    const t = await runScenario({
      seed: SEED,
      packageProvider: fixtureProvider(PKG),
      keeper: new StubKeeper(CLEAN_PROSE),
      judge: new DeterministicJudge(),
    });
    expect(t).toMatchInlineSnapshot(`
      {
        "output": {
          "prose": "Тропа вильнула к ольшанику; под сапогом хрустнул ледок, и потянуло дымом от дальнего костра.",
        },
        "package": {
          "intent": "journey",
          "scene": "journey",
          "summary": "a quiet stretch of road at dusk",
        },
        "scenarioId": "golden.journey.clean",
        "verdict": {
          "antiSlop": {
            "blocking": false,
            "violations": [],
          },
          "axes": {
            "accuracy": {
              "notes": "awaits LLM judge (chat 2.4)",
              "score": null,
              "status": "pending",
            },
            "agency": {
              "notes": "awaits LLM judge (chat 2.4)",
              "score": null,
              "status": "pending",
            },
            "anti_slop": {
              "notes": "0 violation(s), blocking=false",
              "score": 100,
              "status": "scored",
            },
            "playability": {
              "notes": "awaits LLM judge (chat 2.4)",
              "score": null,
              "status": "pending",
            },
            "specificity": {
              "notes": "awaits LLM judge (chat 2.4)",
              "score": null,
              "status": "pending",
            },
            "tone": {
              "notes": "awaits LLM judge (chat 2.4)",
              "score": null,
              "status": "pending",
            },
          },
          "budgetWarn": false,
          "pass": true,
        },
      }
    `);
  });
});
