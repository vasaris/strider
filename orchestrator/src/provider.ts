// Orchestrator package provider: engine turn result -> NarrativePackage (arch sec 8 --
// the orchestrator assembles the package the Keeper consumes).
//
// CROSS-PACKAGE LINK (ws-b): SceneDetailRow is now the REAL engine type, imported via the
// root workspace (@brodyazhnik/engine resolves to engine main:./src/index.ts). The
// structural EngineSceneDetail duplicate is gone. The mapper's correctness is proven by
// fixture here; engine-side SD1 correctness (Fork A) by the engine suite.
//
// RECONCILE status:
//   R-workspace-1: PARTIAL. SceneDetailRow -> real engine type: CLOSED (field-identical,
//     zero rename). RESIDUE -> full-cycle/AnthropicKeeper (see docs/DEFERRED.md R-WS1-RESIDUE):
//     there is no real engine-turn PRODUCER yet -- buildNarrativePackage is fed only by
//     fixtures/tests. EngineTurnResult stays an orchestrator PROJECTION (engine has no
//     turn-result type; resolveScene/runJourney return JourneyState + JourneyEvent[]).
//     When a real producer is wired, it must build EngineTurnResult by:
//       * dice (engine camelCase -> contract snake_case DiceResult):
//           feat_die      <- feat.face
//           feat_symbol   <- feat.isEye ? 'eye' : feat.isGandalf ? 'gandalf' : null
//           success_dice  <- successDice.map(d => d.face)
//           success_icons <- count of success-icon faces
//           target_number <- check TN (18 - attribute, solo)
//           outcome       <- CheckResult.outcome
//       * patch (contract StatePatchSummary deltas): engine returns a WHOLE JourneyState;
//           deltas must be DERIVED by diffing prev/next (eyeDelta/fatigueGained are already
//           on the JourneyEvent; endurance/hope/shadow need a diff).
//       * journalFacts: engine does NOT produce these (arch sec 2.4 context-compression,
//           Stage 3+); empty until that subsystem exists.
//   R-workspace-2: CLOSED at ws-b -- evals imports this real buildNarrativePackage (mirrors
//     harness types.ts RECONCILE 1/4).
//   R-activation(tone.md): provisionalLengthFor -> read length bounds from tone.md (the
//     arch sec 2.3.4 numbers are provisional in code now; tone.md owns them at activation).
//     Still OPEN: blocked on 2.3.c (length relocation into tone.md).

import type { SceneDetailRow } from '@brodyazhnik/engine';
import type {
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
