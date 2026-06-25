import type { DiceConfig } from "../dice/config.js";
import { rollFeatDie } from "../dice/featDie.js";
import { rollSuccessDie } from "../dice/successDie.js";
import type { Rng } from "../rng/rng.js";
import { type FaceKey, featFaceKey, type LoreResult, type OracleLoreTable } from "./types.js";

/** Pure lore lookup: section by Feat face, row by 0-based index. */
export function loreCell(t: OracleLoreTable, sectionFace: FaceKey, rowIndex: number): LoreResult {
  const section = t.sections.find((s) => s.face === sectionFace);
  if (!section) throw new Error(`loreCell: no section for face ${JSON.stringify(sectionFace)}`);
  const row = section.rows[rowIndex];
  if (row === undefined) {
    throw new RangeError(`loreCell: row ${rowIndex} out of range (section has ${section.rows.length})`);
  }
  return { sectionFace, rowIndex, action: row.action, aspect: row.aspect, focus: row.focus };
}

/**
 * Roll the lore oracle: one Feat die picks the section, one Success die picks
 * the row; the cell yields all three columns (action/aspect/focus). Reading one
 * or all columns, or re-rolling per column, is the caller's choice.
 */
export function rollLore(t: OracleLoreTable, cfg: DiceConfig, rng: Rng): readonly [LoreResult, Rng] {
  const [feat, r1] = rollFeatDie(cfg.feat, rng);
  const [successDie, r2] = rollSuccessDie(cfg.success, r1);
  const sectionFace = featFaceKey(feat);
  const rowIndex = successDie.face - 1; // d6 face 1..6 -> row 0..5
  return [loreCell(t, sectionFace, rowIndex), r2] as const;
}
