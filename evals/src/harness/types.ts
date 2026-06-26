// Eval-harness types. Plumbing for the scoring cycle: seed -> package -> Keeper ->
// judge. Self-contained in evals/; no cross-package imports (orchestrator/engine are
// separate packages without a workspace -- that is a Stage-3 decision).

import type { StopEntry, Violation } from '../antislop.js';

// ============================================================================
// RECONCILE AT 2.4 -- mechanical checklist, not a drift hunt. Every provisional
// divergence from the orchestrator contract is listed here so 2.4 is a swap, not
// a search:
//   1. ScenarioPackage: minimal alias (intent/scene/summary) -> orchestrator
//      NarrativePackage. StubKeeper does not read it, so drift risk is ~zero now.
//   2. KeeperOutput.questions: string[] -> orchestrator ClarifyingQuestion[].
//   3. lengthTarget: lives in JudgeContext here -> at 2.4 it is PACKAGE-sourced
//      (orchestrator sets it by scene type, arch sec 2.3.4); the judge reads it
//      from the package.
//   4. packageProvider: fixtureProvider() -> orchestratorPackageProvider (the real
//      engine -> package builder; the harness CALLS it, does not duplicate it).
//   5. Keeper: StubKeeper -> AnthropicKeeper (same interface; real path is
//      judge-scored, not byte-golden).
//   6. Judge anti_slop axis: the LLM judge REPLACES this deterministic axis with a
//      nuanced score -- do NOT sum deterministic + LLM on the same axis.
//   7. Aggregation guard: the >=80 pass-rate verdict is assembled ONLY when all six
//      axes are 'scored'. No aggregate while any axis is 'pending' (none now).
// ============================================================================

// PROVISIONAL (RECONCILE 1). Minimal fields only; the StubKeeper does NOT read package
// internals, so this is a SEAM, not a copy of the contract.
export interface ScenarioPackage {
  readonly intent: string;
  readonly scene: string;
  readonly summary: string; // compact human-facing seed label for the transcript
}

// PROVISIONAL (RECONCILE 2).
export interface KeeperOutput {
  readonly prose: string;
  readonly questions?: readonly string[];
}

export interface KeeperInput {
  readonly systemPrompt: string;
  readonly package: ScenarioPackage;
}

/** The narrative model behind one seam. StubKeeper now; AnthropicKeeper at 2.4. */
export interface Keeper {
  run(input: KeeperInput): Promise<KeeperOutput>;
}

/** Scenario seed: identity + system prompt. At 2.4 it also carries whatever the real
 *  orchestrator builder needs (engine state/action) to produce the package. */
export interface Seed {
  readonly id: string;
  readonly systemPrompt: string;
}

/** Injected package source -- symmetric with Keeper/Judge (RECONCILE 4). fixtureProvider
 *  now; orchestratorPackageProvider at 2.4. May be sync or async (the real builder is
 *  async). Making this an injection point keeps the seam a swap, not a runner edit. */
export type PackageProvider = (seed: Seed) => ScenarioPackage | Promise<ScenarioPackage>;

// --- Judge: the Verdict carries ALL SIX rubric axes from the start (arch sec 2.5 /
// sec 0.7 line 123, threshold 80+) so chat 2.4 fills slots rather than reshaping it. ---
export type RubricAxis =
  | 'specificity'
  | 'accuracy'
  | 'playability'
  | 'agency'
  | 'tone'
  | 'anti_slop';

export interface AxisScore {
  readonly status: 'scored' | 'pending';
  readonly score: number | null; // 0..100 when scored; null when pending
  readonly notes: string;
}

export interface Verdict {
  readonly axes: Readonly<Record<RubricAxis, AxisScore>>;
  readonly antiSlop: { readonly violations: readonly Violation[]; readonly blocking: boolean };
  readonly budgetWarn: boolean; // length outside target -> WARN, never blocks
  readonly pass: boolean; // deterministic HARD gate: anti-slop block-clean
}

export interface JudgeContext {
  /** Pack VK stop-list (LT1). Null until tone.md is activated; the seed still scans. */
  readonly vkAddendum?: readonly StopEntry[] | null;
  /** Prose length bounds (RECONCILE 3: provisional here; package-sourced at 2.4). */
  readonly lengthTarget?: { readonly minChars: number; readonly maxChars: number } | null;
}

export interface Judge {
  score(prose: string, ctx: JudgeContext): Verdict;
}

export interface Transcript {
  readonly scenarioId: string;
  readonly package: ScenarioPackage;
  readonly output: KeeperOutput;
  readonly verdict: Verdict;
}

/** runScenario inputs. The three real collaborators -- packageProvider, keeper, judge --
 *  are all injected, so 2.4 swaps each by substitution, never by editing the runner. */
export interface RunConfig {
  readonly seed: Seed;
  readonly packageProvider: PackageProvider;
  readonly keeper: Keeper;
  readonly judge: Judge;
  readonly ctx?: JudgeContext;
}
