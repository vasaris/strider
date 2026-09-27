// Eval-harness types. Plumbing for the scoring cycle: seed -> package -> Keeper ->
// judge. Cross-package import enabled by the root workspace (ws-b): the real
// orchestrator contract (NarrativePackage) resolves via @brodyazhnik/orchestrator.

import type { NarrativePackage } from '@brodyazhnik/orchestrator';
import type { StopEntry, Violation } from '../antislop.js';

// ============================================================================
// RECONCILE -- mechanical checklist, not a drift hunt. Cross-package items 1/4
// are CLOSED at ws-b (the workspace wires the real types); the rest stay, each
// gated on a later deliverable:
//   1. CLOSED (ws-b): ScenarioPackage alias -> orchestrator NarrativePackage. The
//      package the Keeper receives is now the real contract type.
//   2. KeeperOutput.questions: string[] -> orchestrator ClarifyingQuestion[]. OPEN --
//      adjacent to the real KeeperOutput (full-cycle/AnthropicKeeper), not ws-b.
//   3. lengthTarget: lives in JudgeContext here -> PACKAGE-sourced once tone.md owns the
//      bounds. OPEN -- blocked on 2.3.c (length relocation into tone.md) + a real package.
//   4. CLOSED (ws-b): packageProvider fixture -> orchestrator buildNarrativePackage (the
//      real engine-turn -> package mapper; lives + is tested in orchestrator/, imported
//      here via the workspace, not duplicated).
//   5. Keeper: StubKeeper -> AnthropicKeeper (same interface; real path is
//      judge-scored, not byte-golden). OPEN -- full-cycle. A2 landed AnthropicKeeper behind
//      this seam (offline, mock LlmClient); the live swap in a real run is the full cycle (A3).
//   6. Judge anti_slop axis: the LLM judge REPLACES this deterministic axis with a
//      nuanced score -- do NOT sum deterministic + LLM on the same axis. OPEN -- judge.
//   7. Aggregation guard: the >=80 pass-rate verdict is assembled ONLY when all six
//      axes are 'scored'. OPEN -- stays until the full-cycle floor.
// ============================================================================

// RECONCILE 1 CLOSED (ws-b): the Keeper now receives the real orchestrator NarrativePackage.

// PROVISIONAL (RECONCILE 2).
export interface KeeperOutput {
  readonly prose: string;
  readonly questions?: readonly string[];
}

export interface KeeperInput {
  readonly systemPrompt: string;
  readonly package: NarrativePackage;
}

/** The narrative model behind one seam. Both implementations exist: StubKeeper (canned,
 *  byte-deterministic) and AnthropicKeeper (injected LlmClient; judge-scored). */
export interface Keeper {
  run(input: KeeperInput): Promise<KeeperOutput>;
}

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

/** The model call behind one seam, injectable (mock offline / AnthropicLlmClient in keyed
 *  scripts). Two callers share it:
 *   - judge (LlmJudge): system = rubric sec 0.7 + activated tone.md; user = the prose to
 *     score, plus the rendered package block when ctx.package is set (buildJudgeUser); the raw
 *     reply is the rubric JSON, parsed + Zod-validated by LlmJudge.
 *   - keeper (AnthropicKeeper): system = keeper prompt + activated tone.md (buildKeeperSystem);
 *     user = the rendered package (buildKeeperUser); the raw reply is the prose, trimmed by
 *     AnthropicKeeper.
 *  complete() returns the model's raw text output; interpretation belongs to the caller. */
export interface LlmRequest {
  readonly model: string; // RECONCILE: model is config, not hardcoded in caller logic
  readonly system: string; // assembled by the caller (judge: rubric+tone; keeper: prompt+tone)
  readonly user: string; // judge: the prose (+ package block if given); keeper: the rendered package
}
export interface LlmClient {
  complete(req: LlmRequest): Promise<string>;
}

export interface JudgeContext {
  /** Pack VK stop-list (LT1). Null until tone.md is activated; the seed still scans. */
  readonly vkAddendum?: readonly StopEntry[] | null;
  /** Prose length bounds (RECONCILE 3: provisional here; package-sourced at 2.4). */
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
