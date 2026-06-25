import type { FeatDieResult } from "../../src/dice/types.js";
import type {
  FeatDieEventTable,
  OracleAnswersTable,
  OracleLoreTable,
} from "../../src/oracles/types.js";

export function featNumber(value: number): FeatDieResult {
  return { physicalFace: value, face: { kind: "number", value }, numericValue: value, isEye: false, isAutoSuccess: false };
}
export const FEAT_EYE: FeatDieResult = {
  physicalFace: 11,
  face: { kind: "eye" },
  numericValue: 0,
  isEye: true,
  isAutoSuccess: false,
};
export const FEAT_GANDALF: FeatDieResult = {
  physicalFace: 12,
  face: { kind: "gandalf_rune" },
  numericValue: 0,
  isEye: false,
  isAutoSuccess: true,
};

/** Constructed answers table with non-KV thresholds, to prove pack-driven logic. */
export const ANSWERS: OracleAnswersTable = {
  likelihoods: [
    { key: "certain", label: "certain", yesIfAtLeast: 2, isDefault: false },
    { key: "even", label: "even", yesIfAtLeast: 6, isDefault: true },
    { key: "unthinkable", label: "unthinkable", yesIfAtLeast: 9, isDefault: false },
  ],
  gandalfRune: { answer: "yes", extreme: true, text: "yes, and a twist" },
  eye: { answer: "no", extreme: true, text: "no, and a twist" },
};

/** Tiny lore table: section faces 3 and "eye", two rows each. */
export const LORE: OracleLoreTable = {
  sections: [
    {
      face: 3,
      rows: [
        { action: "seek", aspect: "ancient", focus: "road" },
        { action: "guard", aspect: "hidden", focus: "gate" },
      ],
    },
    {
      face: "eye",
      rows: [
        { action: "betray", aspect: "cruel", focus: "fear" },
        { action: "ruin", aspect: "fell", focus: "war" },
      ],
    },
  ],
};

export const EVENT: FeatDieEventTable = {
  rows: [
    { face: "eye", text: "the Eye turns", effects: [{ op: "eye_awareness_delta", value: 2 }] },
    { face: 5, text: "a lucky break", effects: [] },
    { face: "gandalf_rune", text: "an ally arrives", effects: [] },
  ],
};
