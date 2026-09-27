import { buildNarrativePackage, type EngineTurnResult, type NarrativePackage } from '@brodyazhnik/orchestrator';
import { describe, expect, it } from 'vitest';
import { DeterministicJudge } from '../src/harness/judge.js';
import { StubKeeper } from '../src/harness/keeper.js';
import { fixtureProvider, runScenario } from '../src/harness/run.js';
import type { Judge, JudgeContext, PackageProvider, Seed, Verdict } from '../src/harness/types.js';

const SEED: Seed = {
  id: 'golden.journey.clean',
  systemPrompt: 'STUB-PROMPT', // the real prompt (prompts/keeper.system.v0.md) is wired at full-cycle
  summary: 'a quiet stretch of road at dusk',
};
// Real orchestrator NarrativePackage (ws-b: RECONCILE 1 closed). length_target is required.
const PKG: NarrativePackage = {
  intent: 'journey',
  scene: 'journey',
  length_target: { min_chars: 400, max_chars: 800 },
};

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
    expect(t.verdict.axes.tone.status).toBe('pending'); // awaits LLM judge + tone.md (full-cycle)
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
    const other: NarrativePackage = {
      intent: 'council',
      scene: 'council',
      length_target: { min_chars: 800, max_chars: 1500 },
    };
    const t = await runScenario({
      seed: SEED,
      packageProvider: fixtureProvider(other),
      keeper: new StubKeeper(CLEAN_PROSE),
      judge: new DeterministicJudge(),
    });
    expect(t.package).toEqual(other);
  });

  it('runs the REAL orchestrator buildNarrativePackage at the seam (RECONCILE 1/4 closed, ws-b)', async () => {
    // Cross-package proof (gate B): evals imports orchestrator's buildNarrativePackage, which
    // in turn imports engine's SceneDetailRow -- both resolved to TS source via the workspace
    // symlink (@brodyazhnik/* -> main:./src/index.ts). If resolution failed, this test would
    // not even load. The fixture EngineTurnResult stands in for a real engine turn (no real
    // producer yet -- see orchestrator RECONCILE R-workspace-1 residue). SD1 row is surfaced
    // opaquely into oracle.detail WITHOUT re-rolling.
    const turn: EngineTurnResult = {
      intent: 'journey',
      scene: 'journey',
      oracleTable: 'journey_scenes',
      oracleResultRef: 'mishap',
      detailTable: 'scene_details.mishap',
      sceneDetail: {
        face: 3,
        scene: 'a turned ankle on scree',
        prompt: 'the descent goes wrong',
        skill: 'travel',
        significantEncounter: false,
      },
    };
    const engineDerived: PackageProvider = () => buildNarrativePackage(turn);
    const t = await runScenario({
      seed: SEED,
      packageProvider: engineDerived,
      keeper: new StubKeeper(CLEAN_PROSE),
      judge: new DeterministicJudge(),
    });
    expect(t.package.scene).toBe('journey');
    expect(t.package.oracle?.result_ref).toBe('mishap');
    expect(t.package.oracle?.detail?.row?.face).toBe(3); // SD1 surfaced, not re-rolled
    expect(t.package.length_target).toEqual({ min_chars: 400, max_chars: 800 });
    expect(t.verdict.pass).toBe(true);
  });

  it('golden: stub-keeper path is byte-stable (prompt/runner change caught by diff)', async () => {
    // Byte-golden is valid ONLY on the stub path. The real LLM keeper is not
    // byte-deterministic, so its transcript-diff is judge-scored at full-cycle, not byte.
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
          "length_target": {
            "max_chars": 800,
            "min_chars": 400,
          },
          "scene": "journey",
        },
        "scenarioId": "golden.journey.clean",
        "summary": "a quiet stretch of road at dusk",
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

  it('hands the judge the SAME package object the Keeper got, as ctx.package (A3.2)', async () => {
    // A caller-supplied ctx.package is a DECOY: the run's package must win over it.
    const decoy: NarrativePackage = { intent: 'council', scene: 'council', length_target: { min_chars: 1, max_chars: 2 } };
    const inner = new DeterministicJudge();
    const seen: JudgeContext[] = [];
    const recording: Judge = {
      score(prose: string, ctx: JudgeContext): Promise<Verdict> {
        seen.push(ctx);
        return inner.score(prose, ctx);
      },
    };
    const t = await runScenario({
      seed: SEED,
      packageProvider: fixtureProvider(PKG),
      keeper: new StubKeeper(CLEAN_PROSE),
      judge: recording,
      ctx: { lengthTarget: { minChars: 400, maxChars: 800 }, package: decoy },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.package).not.toBe(decoy);
    expect(seen[0]?.package).toBe(t.package); // the very object in the transcript
    expect(seen[0]?.package).toBe(PKG); // ... which is the provider's object
    expect(seen[0]?.lengthTarget).toEqual({ minChars: 400, maxChars: 800 }); // caller ctx preserved
  });
});
