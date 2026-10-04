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
//     residue is now implemented (A1, track A; TP1): extractJourneyTurn() below is the real
//     producer -- dice via mapDice (engine CheckResult -> contract DiceResult), patch via
//     diffHeroState (prev/next hero diff), SD1 row off the scene event, and (TP1) journey days /
//     arrival / travel check plus the detection scene. journalFacts stays [] (arch sec 2.4
//     context-compression, Stage 3+). Raw dice faces (DD-DICE-FACES, 3.2.b): mapDice fills the
//     UI-only feat_die / success_dice / feat_candidates / feat_modifier / success_counted from the roll;
//     render.ts never emits them, so the Keeper/judge bytes are unchanged.
//     (R-WS1-RESIDUE moved to DEFERRED "Closed".)
//   R-workspace-2: CLOSED at ws-b -- evals imports this real buildNarrativePackage (mirrors
//     harness types.ts RECONCILE 1/4).
//   R-activation(tone.md): provisionalLengthFor -> read length bounds from tone.md (the
//     arch sec 2.3.4 numbers are provisional in code now; tone.md owns them at activation).
//     Still OPEN: blocked on 2.3.c (length relocation into tone.md).

import type { CheckResult, CheckRoll, HeroState, JourneyState, SceneDetailRow, StepRecord } from '@brodyazhnik/engine';
import type {
  CheckOutcome as ContractCheckOutcome,
  DetectionScene,
  DiceResult,
  IntentKind,
  JournalFact,
  JourneyStepSummary,
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
  readonly detection?: DetectionScene | null; // TP1: detection scene rolled this step
  readonly patch?: StatePatchSummary | null;
  readonly journey?: JourneyStepSummary | null; // TP1: days / arrival / travel check of this step
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
    detection: turn.detection ?? null,
    patch: turn.patch ?? null,
    journey: turn.journey ?? null,
    lore_chunks: [], // empty slot until LT1 lore activation (RAG retrieval is later)
    journal_facts: turn.journalFacts ?? [],
  };
}

// ============================================================================
// TURN-PRODUCER (A1.b, track A; TP1) -- closes the R-workspace-1 residue for dice + patch.
// extractJourneyTurn maps one engine journey step (prev state, next state, StepRecord) to the
// orchestrator's EngineTurnResult PROJECTION. It NEVER re-rolls: dice come from the scene
// CheckResult the engine already rolled this step (StepRecord, channel B), patch from a
// prev/next hero diff, the SD1 detail straight off the scene event, the detection scene off the
// detection event, and the journey days / arrival from the prev/next JourneyProgress.
//
// Dice = the SCENE check only (A4.1). The travel check surfaces ONLY in `journey.travel_check`,
// next to the day count (TP1): a step without a scene check (a significant encounter, the
// arrival step) carries dice null, so the Keeper cannot narrate the travel roll as the scene's
// result. The ONLY public producers of a journey package are extractJourneyTurn (here) and
// journeyTurn (turn.ts); the hero-level projection (projectStep) is internal, so no caller can
// assemble a journey package that silently drops days / arrival / detection (reviewer P4).
//
// Scope: journey turns only (F-turn-source: journey-step is the Stage-2-exit source;
// combat/council producers are later). journalFacts stays [] (F-journal: arch sec 2.4
// context-compression is Stage 3+). Raw dice faces (DD-DICE-FACES, 3.2.b dice panel) come from
// the step's CheckRoll (StepRecord.travelRoll / sceneRoll -- the very roll the check was
// evaluated from) into UI-only DiceResult fields; renderNarrativePackage suppresses them, so
// they never reach the Keeper or the judge.
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

/** Map an already-rolled engine CheckResult + its CheckRoll to the contract DiceResult. The
 *  UI-only faces (DD-DICE-FACES) are copied off the roll verbatim: feat_die = the KEPT Feat
 *  die's physical face, success_dice = the d6 faces, success_counted = the engine's per-die
 *  counted flags (never re-derived here); on a favoured / ill-favoured roll (the engine's
 *  featModifier, not inferred from faces) feat_candidates = every Feat face rolled and
 *  feat_modifier = that modifier -- both present or both absent. */
function mapDice(check: CheckResult, checkRoll: CheckRoll): DiceResult {
  const { roll, successCounted } = checkRoll;
  const base: DiceResult = {
    feat_die: roll.feat.physicalFace,
    feat_symbol: check.isEyeOnFeat ? 'eye' : check.autoSuccess ? 'gandalf' : null,
    success_dice: roll.successDice.map((d) => d.face),
    success_icons: check.successIcons,
    target_number: check.targetNumber,
    outcome: mapOutcome(check),
    success_counted: [...successCounted],
    ...(roll.featModifier === 'normal'
      ? {}
      : { feat_candidates: roll.featCandidates.map((f) => f.physicalFace), feat_modifier: roll.featModifier }),
  };
  // total is number|null in the engine but number-only in the contract -> include only when present.
  return check.total === null ? base : { ...base, total: check.total };
}

/** A non-null check always has its roll (the engine nulls both or neither). */
function requireRoll(roll: CheckRoll | null, which: string): CheckRoll {
  if (roll === null) throw new Error(`extractJourneyTurn: ${which} check without its roll (engine invariant)`);
  return roll;
}

/** Derive the contract StatePatchSummary from a prev/next hero diff. Includes only what
 *  changed (summary, not a full dump). `eyeBeforeReset` is the awareness the engine recorded on
 *  a detection event (BEFORE it reset to the initial rating): eye_delta is growth up to the
 *  detection, the reset itself is implied by `detection`, not folded into the delta. */
function diffHeroState(prev: HeroState, next: HeroState, eyeBeforeReset: number | null): StatePatchSummary {
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
  const eyeDelta = (eyeBeforeReset ?? next.eye.awareness) - prev.eye.awareness;
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
 * INTERNAL hero-level projection of one journey step (not exported from the package: a public
 * journey package must also carry days / arrival / detection -- see extractJourneyTurn).
 * `record.events` is the exact slice the engine appended this step (single source of truth); the
 * SD1 detail is read off the scene event verbatim. Dice are the SCENE check only (that is what
 * the Keeper narrates); a step with no scene check has dice null.
 */
function projectStep(prev: HeroState, next: HeroState, record: StepRecord): EngineTurnResult {
  const sceneEvent = record.events.find((e) => e.kind === 'scene');
  const detectionEvent = record.events.find((e) => e.kind === 'detection');
  const eyeBeforeReset = detectionEvent !== undefined && detectionEvent.kind === 'detection' ? detectionEvent.awareness : null;
  const base: EngineTurnResult = {
    intent: 'journey',
    scene: 'journey',
    dice: record.sceneCheck === null ? null : mapDice(record.sceneCheck, requireRoll(record.sceneRoll, 'scene')),
    patch: diffHeroState(prev, next, eyeBeforeReset),
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

/**
 * Build the EngineTurnResult of one REAL journey step (TP1): the hero-level projection plus the
 * journey progress (days_delta from the prev/next JourneyProgress -- scene journey_days_delta
 * effects; arrived/days_total on the arrival step; the travel check next to the days) and the
 * detection scene (opaque pack text off the detection event, verbatim).
 *
 * Throws on `record.travelCheck === null`: that is the engine's degenerate already-arrived no-op,
 * not a turn -- it must never reach the Keeper (journeyTurn guards it with JourneyOverError).
 */
export function extractJourneyTurn(prev: JourneyState, next: JourneyState, record: StepRecord): EngineTurnResult {
  if (record.travelCheck === null) {
    throw new Error('extractJourneyTurn: no travel check -- the already-arrived no-op is not a turn');
  }
  const arrivalEvent = record.events.find((e) => e.kind === 'arrival');
  const detectionEvent = record.events.find((e) => e.kind === 'detection');
  const journey: JourneyStepSummary = {
    days_delta: next.journey.durationDays - prev.journey.durationDays,
    ...(arrivalEvent !== undefined && arrivalEvent.kind === 'arrival'
      ? { arrived: true as const, days_total: arrivalEvent.durationDays }
      : {}),
    travel_check: mapDice(record.travelCheck, requireRoll(record.travelRoll, 'travel')),
  };
  const detection: DetectionScene | null =
    detectionEvent !== undefined && detectionEvent.kind === 'detection'
      ? { table: 'detection_scenes', scene: detectionEvent.sceneText }
      : null;
  return { ...projectStep(prev.hero, next.hero, record), journey, detection };
}
