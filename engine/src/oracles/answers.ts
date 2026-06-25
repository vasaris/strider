import type { DiceConfig } from "../dice/config.js";
import { rollFeatDie } from "../dice/featDie.js";
import type { FeatDieResult } from "../dice/types.js";
import type { Rng } from "../rng/rng.js";
import { featFaceKey, type OracleAnswer, type OracleAnswersTable, type OracleLikelihood } from "./types.js";

function resolveLikelihood(t: OracleAnswersTable, key: string | null): OracleLikelihood {
  if (key === null) {
    const def = t.likelihoods.find((l) => l.isDefault);
    if (!def) throw new Error("answerFor: no default likelihood in table");
    return def;
  }
  const found = t.likelihoods.find((l) => l.key === key);
  if (!found) throw new Error(`answerFor: unknown likelihood "${key}"`);
  return found;
}

/**
 * Pure yes/no lookup (no RNG). A numeric Feat result answers yes iff it meets
 * the likelihood threshold; the Gandalf rune is always "yes" extreme and the
 * Eye always "no" extreme (kv.solo.answers). `likelihoodKey` of null selects the
 * table default.
 */
export function answerFor(t: OracleAnswersTable, likelihoodKey: string | null, feat: FeatDieResult): OracleAnswer {
  const likelihood = resolveLikelihood(t, likelihoodKey); // validates key even on special faces
  const featFace = featFaceKey(feat);

  if (feat.isAutoSuccess) {
    return {
      answer: t.gandalfRune.answer,
      extreme: t.gandalfRune.extreme,
      likelihoodKey: likelihood.key,
      featFace,
      specialText: t.gandalfRune.text,
    };
  }
  if (feat.isEye) {
    return {
      answer: t.eye.answer,
      extreme: t.eye.extreme,
      likelihoodKey: likelihood.key,
      featFace,
      specialText: t.eye.text,
    };
  }

  const yes = feat.numericValue >= likelihood.yesIfAtLeast;
  return {
    answer: yes ? "yes" : "no",
    extreme: false,
    likelihoodKey: likelihood.key,
    featFace,
    specialText: null,
  };
}

/** Roll the answers oracle (one Feat die) and resolve. */
export function rollAnswer(
  t: OracleAnswersTable,
  likelihoodKey: string | null,
  cfg: DiceConfig,
  rng: Rng,
): readonly [OracleAnswer, Rng] {
  const [feat, next] = rollFeatDie(cfg.feat, rng);
  return [answerFor(t, likelihoodKey, feat), next] as const;
}
