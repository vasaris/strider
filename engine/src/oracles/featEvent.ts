import type { DiceConfig } from "../dice/config.js";
import { rollFeatDie } from "../dice/featDie.js";
import type { Rng } from "../rng/rng.js";
import { type FaceKey, featFaceKey, type FeatDieEventTable, type FeatEventResult } from "./types.js";

/** Pure lookup: the row whose face matches. */
export function featEventRow(t: FeatDieEventTable, face: FaceKey): FeatEventResult {
  const row = t.rows.find((r) => r.face === face);
  if (!row) throw new Error(`featEventRow: no row for face ${JSON.stringify(face)}`);
  return { face: row.face, text: row.text, effects: row.effects };
}

/**
 * Roll a Feat-die event oracle (luck / misfortune / detection): one Feat die
 * selects the row. Effects on the row are carried through for the effect
 * interpreter; this subsystem does not apply them.
 */
export function rollFeatDieEvent(t: FeatDieEventTable, cfg: DiceConfig, rng: Rng): readonly [FeatEventResult, Rng] {
  const [feat, next] = rollFeatDie(cfg.feat, rng);
  return [featEventRow(t, featFaceKey(feat)), next] as const;
}
