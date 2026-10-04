// Eval-harness types. Plumbing for the scoring cycle: seed -> package -> Keeper ->
// judge. Cross-package import enabled by the root workspace (ws-b): the real
// orchestrator contract (NarrativePackage) resolves via @brodyazhnik/orchestrator.

import type { Keeper, KeeperOutput, NarrativePackage } from '@brodyazhnik/orchestrator';
import type { StopEntry, Violation } from '@brodyazhnik/prose-gate';

// ============================================================================
// RECONCILE -- mechanical checklist, not a drift hunt. Cross-package items 1/4
// are CLOSED at ws-b (the workspace wires the real types), 3 at A4.1, 2/5 at 3.1-C4; the
// rest stay, each gated on a later deliverable:
//   1. CLOSED (ws-b): ScenarioPackage alias -> orchestrator NarrativePackage. The
//      package the Keeper receives is now the real contract type.
//   2. CLOSED (3.1-C4): KeeperOutput is the orchestrator CONTRACT type (questions?:
//      ClarifyingQuestion[]), re-exported below; no harness-local provisional shape remains.
//   3. CLOSED (A4.1): lengthTarget is PACKAGE-sourced -- runScenario fills the judge's
//      ctx.lengthTarget from pkg.length_target (the package wins over a caller value). The
//      NUMBERS stay provisional in orchestrator provider.ts until tone.md owns them
//      (R-activation(tone.md) still OPEN).
//   4. CLOSED (ws-b): packageProvider fixture -> orchestrator buildNarrativePackage (the
//      real engine-turn -> package mapper; lives + is tested in orchestrator/, imported
//      here via the workspace, not duplicated).
//   5. CLOSED (3.1-C4): Keeper: StubKeeper -> AnthropicKeeper (same interface; real path is
//      judge-scored, not byte-golden). The live swap ran the full cycle on L4 and again in the
//      3.1-C3 keyed runs; the seam (Keeper/LlmClient/AnthropicKeeper/request assembly) now lives
//      in orchestrator (src/keeper/), shared with the Stage 3.1.b server route.
//   6. Judge anti_slop axis: the LLM judge REPLACES this deterministic axis with a
//      nuanced score -- do NOT sum deterministic + LLM on the same axis. OPEN -- judge.
//   7. Aggregation guard: the >=80 pass-rate verdict is assembled ONLY when all six
//      axes are 'scored'. OPEN -- stays until the full-cycle floor.
// ============================================================================

// RECONCILE 1 CLOSED (ws-b): the Keeper now receives the real orchestrator NarrativePackage.

// RECONCILE 2/5 CLOSED (3.1-C4): the Keeper seam types come from orchestrator (src/keeper/seam.ts
// + the contract KeeperOutput); re-exported so harness imports keep working.
export type { Keeper, KeeperInput, KeeperOutput, LlmClient, LlmRequest } from '@brodyazhnik/orchestrator';

/** Scenario seed: identity + system prompt + a human-facing transcript label. At full-cycle
 *  it also carries whatever the real orchestrator builder needs (engine state/action) to
 *  produce the package. `summary` was relocated here from the old ScenarioPackage (RECONCILE 1
 *  closed): NarrativePackage is pure mechanics, so the human label lives on the seed and is
 *  surfaced on the Transcript. */
export interface Seed {
  readonly id: string;
  readonly systemPrompt: string;
  readonly summary: string; // compact human-facing label, surfaced on the Transcript
}

/** Injected package source -- symmetric with Keeper/Judge (RECONCILE 4 CLOSED at ws-b: the
 *  real orchestrator buildNarrativePackage plugs in here). May be sync or async (the real
 *  builder is async). Making this an injection point keeps the seam a swap, not a runner edit. */
export type PackageProvider = (seed: Seed) => NarrativePackage | Promise<NarrativePackage>;

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
  readonly status: 'scored' | 'pending' | 'error';
  readonly score: number | null; // 0..100 when scored; null when pending/error
  readonly notes: string;
}

/** The >=80 pass-rate verdict (arch sec 0.7). Computed by a PLUGGABLE aggregate function
 *  ONLY when all six axes are 'scored' -- null while any axis is pending/error. */
export interface AggregateVerdict {
  readonly score: number; // 0..100
  readonly threshold: number; // 80
  readonly pass: boolean; // score >= threshold
  readonly rule: string; // which aggregate rule produced this (mean / mean+floor / weighted)
}

export interface Verdict {
  readonly axes: Readonly<Record<RubricAxis, AxisScore>>;
  readonly antiSlop: { readonly violations: readonly Violation[]; readonly blocking: boolean };
  readonly budgetWarn: boolean; // length outside target -> WARN, never blocks
  readonly pass: boolean; // deterministic HARD gate: anti-slop block-clean
  /** >=80 rubric verdict. Present only when all six axes are scored (the LLM judge);
   *  absent for the deterministic pre-gate (5 axes pending) -- RECONCILE 7 aggregation guard. */
  readonly aggregate?: AggregateVerdict | null;
  /** Set when the LLM evaluation itself failed (unparseable/refused). The judge returns
   *  this verdict instead of throwing or silently passing; aggregate is null when set. */
  readonly error?: string | null;
  /** First ~500 chars of the raw LLM reply, populated on a PARSE/schema error so the failure
   *  self-diagnoses (no manual dump). Null when there is no reply (the llm call threw) or on
   *  success. Flows into calibration-report.json via CalibrationReport.raw[i].verdict. */
  readonly rawSample?: string | null;
}

/** Pluggable aggregate (RECONCILE: swap mean -> mean+floor -> weighted at calibration
 *  without touching the judge). `mean(6)` is provisional and naive -- a catastrophe on one
 *  axis (e.g. tone=10) is masked by the average; calibration will likely add a per-axis floor. */
export type AggregateFn = (axisScores: Readonly<Record<RubricAxis, number>>) => AggregateVerdict;

export interface JudgeContext {
  /** Pack VK stop-list (LT1). Null until tone.md is activated; the seed still scans. */
  readonly vkAddendum?: readonly StopEntry[] | null;
  /** Prose length bounds -> budgetWarn (a WARN, never a block). runScenario sources them from
   *  the package's length_target and they win over a caller value (RECONCILE 3 closed, A4.1);
   *  direct judge.score callers (e.g. calibration) may still pass their own. */
  readonly lengthTarget?: { readonly minChars: number; readonly maxChars: number } | null;
  /** The package the Keeper received (decision 27.09 #1, A3.2). When set, LlmJudge renders it
   *  into the user message as a `ВХОДНОЙ ПАКЕТ:` block before the prose, so `accuracy` is scored
   *  against it; absent/null -> the judge's user message is byte-identical to the v0 form. */
  readonly package?: NarrativePackage | null;
}

/** UNIFIED async interface (no separate AsyncJudge). DeterministicJudge resolves
 *  immediately; the LLM judge awaits the model call. One interface, one runScenario path,
 *  symmetric with Keeper.run(): Promise. */
export interface Judge {
  score(prose: string, ctx: JudgeContext): Promise<Verdict>;
}

export interface Transcript {
  readonly scenarioId: string;
  readonly summary: string; // human-facing label, copied from the seed
  readonly package: NarrativePackage;
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
