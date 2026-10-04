import { type Rng, rollDie } from "../rng/rng.js";
import type { FeatDieConfig } from "./config.js";
import type { FeatDieFace, FeatDieResult, FeatModifier } from "./types.js";

/** Map a physical face to its semantic Feat face. */
function classifyFace(physicalFace: number, cfg: FeatDieConfig): FeatDieFace {
  if (physicalFace === cfg.gandalfRuneFace) return { kind: "gandalf_rune" };
  if (physicalFace === cfg.eyeFace) return { kind: "eye" };
  return { kind: "number", value: physicalFace };
}

/** The Feat result a physical face reads as (no RNG; shared by rolling and odds enumeration). */
export function featDieResultOfFace(physicalFace: number, cfg: FeatDieConfig): FeatDieResult {
  const face = classifyFace(physicalFace, cfg);
  switch (face.kind) {
    case "gandalf_rune":
      return { physicalFace, face, numericValue: 0, isEye: false, isAutoSuccess: true };
    case "eye":
      return { physicalFace, face, numericValue: cfg.eyeNumericValue, isEye: true, isAutoSuccess: false };
    case "number":
      return { physicalFace, face, numericValue: face.value, isEye: false, isAutoSuccess: false };
  }
}

/** Roll one Feat die. */
export function rollFeatDie(cfg: FeatDieConfig, rng: Rng): readonly [FeatDieResult, Rng] {
  const [physicalFace, next] = rollDie(cfg.sides, rng);
  return [featDieResultOfFace(physicalFace, cfg), next] as const;
}

/**
 * Total ordering of Feat results, per the rulebook (checks.feat_die_values):
 * the Gandalf rune is the best result obtainable, the Eye is the worst. Numbers
 * order by value in between. Used to pick best (favoured) / worst (ill-favoured).
 */
export function featRank(r: FeatDieResult): number {
  if (r.isAutoSuccess) return Number.POSITIVE_INFINITY; // Gandalf rune: best
  if (r.isEye) return Number.NEGATIVE_INFINITY; // Eye: worst
  return r.numericValue; // numbers compare by value
}

/**
 * Resolve the effective modifier (checks.favoured_edge_cases): if a roll is
 * simultaneously favoured and ill-favoured — from conflicting causes — it
 * becomes a normal one-die roll, even if causes are lopsided. A hero who is
 * *himself* ill-favoured (e.g. shadow == hope max) is handled upstream by the
 * caller passing illFavouredReasons; that is a state condition, not dice logic.
 */
export function resolveFeatModifier(favouredReasons: number, illFavouredReasons: number): FeatModifier {
  const fav = favouredReasons > 0;
  const ill = illFavouredReasons > 0;
  if (fav && ill) return "normal";
  if (fav) return "favoured";
  if (ill) return "ill_favoured";
  return "normal";
}

function rollN(cfg: FeatDieConfig, count: number, rng: Rng): readonly [FeatDieResult[], Rng] {
  const out: FeatDieResult[] = [];
  let cur = rng;
  for (let i = 0; i < count; i++) {
    const [r, next] = rollFeatDie(cfg, cur);
    out.push(r);
    cur = next;
  }
  return [out, cur] as const;
}

function pickBest(candidates: readonly FeatDieResult[]): FeatDieResult {
  return candidates.reduce((acc, r) => (featRank(r) > featRank(acc) ? r : acc));
}

function pickWorst(candidates: readonly FeatDieResult[]): FeatDieResult {
  return candidates.reduce((acc, r) => (featRank(r) < featRank(acc) ? r : acc));
}

/**
 * Roll the Feat die(s) under a modifier and return the kept die plus all
 * candidates (for provenance / transcript / later Eye-awareness rules).
 */
export function rollFeatWithModifier(
  cfg: FeatDieConfig,
  modifier: FeatModifier,
  rng: Rng,
): readonly [{ chosen: FeatDieResult; candidates: FeatDieResult[] }, Rng] {
  const count = modifier === "normal" ? cfg.normalDiceCount : cfg.modifiedDiceCount;
  const [candidates, next] = rollN(cfg, count, rng);
  if (candidates.length === 0) {
    throw new Error(`rollFeatWithModifier: dice count resolved to 0 for modifier "${modifier}"`);
  }
  return [{ chosen: keptFeatDie(modifier, candidates), candidates }, next] as const;
}

/**
 * The Feat die kept from the candidates under a modifier: best (favoured), worst
 * (ill-favoured), or the only candidate (normal). No RNG; rollFeatWithModifier and the
 * check-odds enumeration (journey previewCheck) share it.
 */
export function keptFeatDie(modifier: FeatModifier, candidates: readonly FeatDieResult[]): FeatDieResult {
  switch (modifier) {
    case "favoured":
      return pickBest(candidates);
    case "ill_favoured":
      return pickWorst(candidates);
    case "normal":
      // normalDiceCount is 1; the kept die is the (only) candidate.
      return candidates[0] as FeatDieResult;
  }
}
