// Orchestrator package provider: engine turn result -> NarrativePackage (arch sec 8 --
// the orchestrator assembles the package the Keeper consumes).
//
// CROSS-PACKAGE SEAM (Option 2, structural -- NOT a relative import of engine/). This file
// defines a STRUCTURAL EngineTurnResult shape and maps it to the contract. Engine-side
// correctness (the engine really emits the SD1 detail row -- Fork A) is proven in the
// engine suite; the mapper's correctness is proven by fixture here.
//
// RECONCILE -- explicit Option-2 debt, so it does not dissolve:
//   R-workspace-1: structural EngineTurnResult -> real engine types. Includes reconciling
//     the dice/patch SHAPE (engine camelCase -> contract snake_case), abstracted by the
//     fixture now; the relative-import debt of Option 1 is avoided until the workspace.
//   R-workspace-2: the harness's 3-field structural adapter -> this real buildNarrativePackage
//     (evals imports orchestrator once the root workspace exists). Mirrors harness
//     types.ts RECONCILE 1/4.
//   R-activation(tone.md): provisionalLengthFor -> read length bounds from tone.md (the
//     arch sec 2.3.4 numbers are provisional in code now; tone.md owns them at activation).

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

/** SD1 Fork A row, mirrored structurally (engine journey SceneDetailRow). At the workspace
 *  this becomes engine's real SceneDetailRow type. */
export interface EngineSceneDetail {
  readonly face: number;
  readonly scene: string;
  readonly prompt: string;
  readonly skill: string | null;
  readonly significantEncounter: boolean;
}

/**
 * Structural engine-turn result the orchestrator maps to a package. dice/patch are carried
 * in contract shape here (the engine -> contract field rename is upstream/workspace); the
 * value this mapper adds is package ASSEMBLY -- chiefly surfacing the already-rolled SD1
 * detail into oracle.detail WITHOUT re-rolling (RNG-safe), plus the lore slot and length.
 */
export interface EngineTurnResult {
  readonly intent: IntentKind; // orchestrator classifier output (the engine does not classify)
  readonly scene: SceneKind;
  readonly dice?: DiceResult | null;
  readonly oracleTable?: string; // top-level oracle table id (e.g. 'journey_scenes')
  readonly oracleResultRef?: string; // top-level rolled entry ref (e.g. the scene type)
  readonly detailTable?: string; // scene_details.* sub-table id (SD1)
  readonly sceneDetail?: EngineSceneDetail | null; // SD1 Fork A raw row, already rolled
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
