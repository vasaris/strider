/**
 * Oracle subsystem types. Oracles are engine mechanics (principle #2): the
 * engine rolls the dice and looks up the verified table; the narrative layer
 * interprets the result text and effects but never replaces the roll.
 *
 * Effects are carried opaquely: Oracles pass {op, value, ...} through to the
 * effect interpreter (Eye / state layer); they are not applied here.
 */

import type { FeatDieResult } from "../dice/types.js";

/** Identifies a Feat-die face for table lookups: 1..10, or a special face. */
export type FaceKey = number | "eye" | "gandalf_rune";

/** Opaque effect carried from a table row. `op` is required; rest is unread here. */
export type Effect = Readonly<Record<string, unknown>> & { readonly op: string };

/** Project a rolled Feat die onto its table-lookup key. */
export function featFaceKey(feat: FeatDieResult): FaceKey {
  if (feat.isAutoSuccess) return "gandalf_rune";
  if (feat.isEye) return "eye";
  return feat.numericValue; // number faces 1..10 carry their value
}

// --- Answers (oracle_yes_no) ---

export interface OracleLikelihood {
  readonly key: string;
  readonly label: string;
  readonly yesIfAtLeast: number;
  readonly isDefault: boolean;
}

export interface SpecialAnswer {
  readonly answer: "yes" | "no";
  readonly extreme: boolean;
  readonly text: string;
}

export interface OracleAnswersTable {
  readonly likelihoods: readonly OracleLikelihood[];
  readonly gandalfRune: SpecialAnswer;
  readonly eye: SpecialAnswer;
}

export interface OracleAnswer {
  readonly answer: "yes" | "no";
  /** True on the rune ("yes and ...") or the Eye ("no and ..."). */
  readonly extreme: boolean;
  readonly likelihoodKey: string;
  readonly featFace: FaceKey;
  /** Pack text for a special face (rune/Eye); null on a numeric result. */
  readonly specialText: string | null;
}

// --- Lore (lore_table) ---

export interface LoreRow {
  readonly action: string;
  readonly aspect: string;
  readonly focus: string;
}

export interface LoreSection {
  readonly face: FaceKey;
  readonly rows: readonly LoreRow[]; // 6
}

export interface OracleLoreTable {
  readonly sections: readonly LoreSection[]; // 12
}

export interface LoreResult {
  readonly sectionFace: FaceKey;
  readonly rowIndex: number;
  readonly action: string;
  readonly aspect: string;
  readonly focus: string;
}

// --- Feat-die event (feat_die_event_table: luck / misfortune / detection) ---

export interface FeatEventRow {
  readonly face: FaceKey;
  readonly text: string;
  readonly effects: readonly Effect[];
}

export interface FeatDieEventTable {
  readonly rows: readonly FeatEventRow[]; // 12
}

export interface FeatEventResult {
  readonly face: FaceKey;
  readonly text: string;
  readonly effects: readonly Effect[];
}
