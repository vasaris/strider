// Orchestrator package provider: engine turn result -> NarrativePackage (arch sec 8 --
// the orchestrator assembles the package the Keeper consumes).
//
// CROSS-PACKAGE LINK (ws-b): SceneDetailRow is now the REAL engine type, imported via the
// root workspace (@brodyazhnik/engine resolves to engine main:./src/index.ts). The
// structural EngineSceneDetail duplicate is gone. The mapper's correctness is proven by
// fixture here; engine-side SD1 correctness (Fork A) by the engine suite.
//
// RECONCILE status:
//   R-workspace-1: CLOSED. SceneDetailRow -> real engine type (ws-b). The turn-producer
//     residue is now implemented (A1, track A): extractTurn() below is the real producer --
//     dice via mapDice (engine CheckResult -> contract DiceResult), patch via diffHeroState
//     (prev/next hero diff), SD1 row off the scene event. journalFacts stays [] (arch sec 2.4
//     context-compression, Stage 3+). Raw dice faces (feat_die/success_dice) were re-homed to
//     docs/DEFERRED.md#DD-DICE-FACES (a UI/dice-panel concern, DUE Stage 3.2.b), not the Keeper's.
//     (R-WS1-RESIDUE moved to DEFERRED "Closed".)
//   R-workspace-2: CLOSED at ws-b -- evals imports this real buildNarrativePackage (mirrors
//     harness types.ts RECONCILE 1/4).
//   R-activation(tone.md): provisionalLengthFor -> read length bounds from tone.md (the
//     arch sec 2.3.4 numbers are provisional in code now; tone.md owns them at activation).
//     Still OPEN: blocked on 2.3.c (length relocation into tone.md).

import type { CheckResult, HeroState, SceneDetailRow, StepRecord } from '@brodyazhnik/engine';
import type {
  CheckOutcome as ContractCheckOutcome,
  DiceResult,
  IntentKind,
  JournalFact,
  LengthTarget,
  NarrativePackage,
  OracleResult,
  SceneKind,
  StatePatchSummary,
} from './contract.js';

/**
 * Structural engine-turn result the orchestrator maps to a package. This is an orchestrator
 * PROJECTION, not an engine type (engine has no turn-result type -- see RECONCILE R-workspace-1
 * above). dice/patch are carried in contract shape here (the engine -> contract rename belongs
 * to the future real producer); the value this mapper adds is package ASSEMBLY -- chiefly
 * surfacing the already-rolled SD1 detail into oracle.detail WITHOUT re-rolling (RNG-safe),
 * plus the lore slot and length. sceneDetail is now the REAL engine SceneDetailRow.
 */
export interface EngineTurnResult {
  readonly intent: IntentKind; // orchestrator classifier output (the engine does not classify)
  readonly scene: SceneKind;
  readonly dice?: DiceResult | null;
  readonly oracleTable?: string; // top-level oracle table id (e.g. 'journey_scenes')
  readonly oracleResultRef?: string; // top-level rolled entry ref (e.g. the scene type)
  readonly detailTable?: string; // scene_details.* sub-table id (SD1)
  readonly sceneDetail?: SceneDetailRow | null; // SD1 Fork A raw row, already rolled (real engine type)
  readonly patch?: StatePatchSummary | null;
  readonly journalFacts?: readonly JournalFact[];
}

// PROVISIONAL (RECONCILE 3): scene -> length bounds. The real source is tone.md / LT1
// (the numbers were relocated there); these arch sec 2.3.4 defaults live here ONLY until
// tone.md owns the calibration at activation. Marked so they are not mistaken for canon.
const PROVISIONAL_LENGTH: Readonly<Record<SceneKind, LengthTarget>> = {
  journey: { min_chars: 400, max_chars: 800 },
  combat: { min_chars: 300, max_chars: 600 },
  council: { min_chars: 800, max_chars: 1500 },
  free: { min_chars: 800, max_chars: 1500 },
  fellowship_phase: { min_chars: 800, max_chars: 1500 },
};

export function provisionalLengthFor(scene: SceneKind): LengthTarget {
  return PROVISIONAL_LENGTH[scene];
}

/** Assemble the second-level oracle (SD1): surface the already-rolled row opaquely into
 *  oracle.detail.row. Never re-rolls. */
function buildOracle(turn: EngineTurnResult): OracleResult | null {
  if (turn.oracleTable === undefined || turn.oracleResultRef === undefined) {
    return null; // no oracle this turn (e.g. a pure skill check / mundane action)
  }
  const detail: OracleResult | null =
    turn.sceneDetail && turn.detailTable !== undefined
      ? {
          table: turn.detailTable,
          result_ref: `${turn.detailTable}#face=${turn.sceneDetail.face}`,
          detail: null, // SD1 is exactly one second level (no arbitrary depth)
          row: { ...turn.sceneDetail }, // full opaque SD1 row for the Keeper
        }
      : null;
  return { table: turn.oracleTable, result_ref: turn.oracleResultRef, detail, row: null };
}

/**
 * Map a structural engine turn result to the NarrativePackage the Keeper consumes. This is
 * the real provider that the harness PackageProvider seam injects (RECONCILE 1/4): at the
 * workspace `runScenario({ packageProvider: () => buildNarrativePackage(turn), ... })`.
 */
export function buildNarrativePackage(turn: EngineTurnResult): NarrativePackage {
  return {
    intent: turn.intent,
    scene: turn.scene,
    length_target: provisionalLengthFor(turn.scene),
    dice: turn.dice ?? null,
    oracle: buildOracle(turn),
    patch: turn.patch ?? null,
    lore_chunks: [], // empty slot until LT1 lore activation (RAG retrieval is later)
    journal_facts: turn.journalFacts ?? [],
  };
}

// ============================================================================
// TURN-PRODUCER (A1.b, track A) -- closes the R-workspace-1 residue for dice + patch.
// extractTurn maps one engine journey step (prev hero, next hero, StepRecord) to the
// orchestrator's EngineTurnResult PROJECTION. It NEVER re-rolls: dice come from the scene
// CheckResult the engine already rolled this step (StepRecord, channel B), patch from a
// prev/next hero diff, and the SD1 detail straight off the scene event.
//
// Dice = the SCENE check only (A4.1). The travel check is never surfaced: a step without a
// scene check (a significant encounter, the arrival step) carries no dice, so the Keeper cannot
// narrate the travel roll as the scene's result. The travel check, journey days, arrival and
// detection are to surface together later (DEFERRED TP1).
//
// Scope: journey turns only (F-turn-source: journey-step is the Stage-2-exit source;
// combat/council producers are later). journalFacts stays [] (F-journal: arch sec 2.4
// context-compression is Stage 3+). Raw dice faces (feat_die/success_dice) are intentionally
// left undefined here -- they are a UI concern (DD-DICE-FACES, DUE Stage 3.2.b dice panel),
// not the Keeper's; the contract leaves them optional.
// ============================================================================

/** Map the engine's binary outcome+degree to the contract's 4-value CheckOutcome. Reads the
 *  pack-derived `degree` (set by evaluateCheck from DegreeTier), never a literal icon count. */
function mapOutcome(check: CheckResult): ContractCheckOutcome {
  if (check.outcome === 'failure') return 'failure';
  switch (check.degree) {
    case 'success':
      return 'weak';
    case 'great_success':
      return 'strong';
    case 'extraordinary_success':
      return 'extraordinary';
    default:
      // success with a null degree is an engine invariant violation, not a content case.
      throw new Error('mapOutcome: success outcome with null degree');
  }
}

/** Map an already-rolled engine CheckResult to the contract DiceResult. Raw faces
 *  (feat_die/success_dice) are omitted on purpose (DD-DICE-FACES / UI). */
function mapDice(check: CheckResult): DiceResult {
  const base: DiceResult = {
    feat_symbol: check.isEyeOnFeat ? 'eye' : check.autoSuccess ? 'gandalf' : null,
    success_icons: check.successIcons,
    target_number: check.targetNumber,
    outcome: mapOutcome(check),
  };
  // total is number|null in the engine but number-only in the contract -> include only when present.
  return check.total === null ? base : { ...base, total: check.total };
}

/** Derive the contract StatePatchSummary from a prev/next hero diff. Includes only what
 *  changed (summary, not a full dump). */
function diffHeroState(prev: HeroState, next: HeroState): StatePatchSummary {
  const patch: {
    endurance_delta?: number;
    fatigue_delta?: number;
    hope_delta?: number;
    shadow_delta?: number;
    eye_delta?: number;
    conditions_gained?: string[];
    conditions_cleared?: string[];
  } = {};
  const enduranceDelta = next.endurance.current - prev.endurance.current;
  const fatigueDelta = next.fatigue - prev.fatigue;
  const hopeDelta = next.hope.current - prev.hope.current;
  const shadowDelta = next.shadow.points - prev.shadow.points;
  const eyeDelta = next.eye.awareness - prev.eye.awareness;
  if (enduranceDelta !== 0) patch.endurance_delta = enduranceDelta;
  if (fatigueDelta !== 0) patch.fatigue_delta = fatigueDelta;
  if (hopeDelta !== 0) patch.hope_delta = hopeDelta;
  if (shadowDelta !== 0) patch.shadow_delta = shadowDelta;
  if (eyeDelta !== 0) patch.eye_delta = eyeDelta;

  const gained: string[] = [];
  const cleared: string[] = [];
  if (!prev.wounded && next.wounded) gained.push('wounded');
  if (prev.wounded && !next.wounded) cleared.push('wounded');
  if (!prev.dying && next.dying) gained.push('dying');
  if (prev.dying && !next.dying) cleared.push('dying');
  if (gained.length > 0) patch.conditions_gained = gained;
  if (cleared.length > 0) patch.conditions_cleared = cleared;
  return patch;
}

/**
 * Build an EngineTurnResult from one journey step. `record.events` is the exact slice the
 * engine appended this step (single source of truth); the SD1 detail is read off the scene
 * event verbatim. Dice are the SCENE check only (that is what the Keeper narrates); a step with
 * no scene check has dice null -- the travel check is never surfaced (DEFERRED TP1).
 */
export function extractTurn(prev: HeroState, next: HeroState, record: StepRecord): EngineTurnResult {
  const sceneEvent = record.events.find((e) => e.kind === 'scene');
  const base: EngineTurnResult = {
    intent: 'journey',
    scene: 'journey',
    dice: record.sceneCheck === null ? null : mapDice(record.sceneCheck),
    patch: diffHeroState(prev, next),
    journalFacts: [], // F-journal: context-compression is Stage 3+ (arch sec 2.4)
  };
  if (sceneEvent === undefined || sceneEvent.kind !== 'scene') return base;
  return {
    ...base,
    oracleTable: 'journey_scenes',
    oracleResultRef: sceneEvent.sceneType,
    detailTable: `scene_details.${sceneEvent.sceneType}`,
    sceneDetail: sceneEvent.detail,
  };
}
