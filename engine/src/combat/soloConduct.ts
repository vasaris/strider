/**
 * Solo conduct of adversaries (Tact 4): with no Keeper, the lone player runs the
 * enemy. Tactics (which action, which target, which weapon) stay PLAYER
 * judgement -- the solo overlay collapses targeting onto the one hero and leans
 * on the "principle of coolness" (kv.mechanics.solo.srazhayas_s_soboy). The
 * engine owns only the dice: the binary uncertainties the pack routes through
 * the answers oracle (kv.mechanics.solo.sposobnosti_vraga -> kv.solo.answers).
 *
 * This is a thin, deterministic adapter over the already-built answers oracle
 * (oracles/answers.ts): it never reimplements the roll, it labels the question
 * so transcripts and Stage-2 prompts have a stable seam, and it wires the one
 * decision that mutates engine state (survives_defeat -> afterBattle). Enemy
 * abilities remain OPAQUE: the engine asks "activated? yes/no", the player reads
 * the cost from the card and plays the effect.
 */

import type { DiceConfig } from "../dice/config.js";
import { rollAnswer } from "../oracles/answers.js";
import type { FaceKey, OracleAnswersTable } from "../oracles/types.js";
import type { Rng } from "../rng/rng.js";
import { afterBattle } from "./adversary.js";
import type { EnemyState } from "./types.js";

/**
 * The binary enemy decision points the pack hands to the answers oracle:
 *  - activate_ability: a costly/risky enemy Ability (sposobnosti_vraga).
 *  - press_or_flee:    a Hatred enemy in a losing position may try to flee.
 *  - surrender:        a Resolve enemy outnumbered / badly hurt may yield.
 *  - survives_defeat:  after_battle -- a take-out at 0 Endurance may survive.
 * The label is for legibility; the engine branches on it only for survives_defeat.
 */
export type EnemyDecisionKind = "activate_ability" | "press_or_flee" | "surrender" | "survives_defeat";

export interface EnemyDecisionResult {
  readonly kind: EnemyDecisionKind;
  readonly answer: "yes" | "no";
  /** True on the rune ("yes and a twist") or the Eye ("no and a twist"). */
  readonly extreme: boolean;
  readonly featFace: FaceKey;
  readonly specialText: string | null;
}

/**
 * Roll one enemy decision through the answers oracle. `likelihoodKey` is the
 * player's read of the situation (null selects the table default); the engine
 * supplies only the deterministic, seeded result.
 */
export function rollEnemyDecision(
  answers: OracleAnswersTable,
  kind: EnemyDecisionKind,
  likelihoodKey: string | null,
  diceCfg: DiceConfig,
  rng: Rng,
): readonly [EnemyDecisionResult, Rng] {
  const [a, next] = rollAnswer(answers, likelihoodKey, diceCfg, rng);
  const result: EnemyDecisionResult = {
    kind,
    answer: a.answer,
    extreme: a.extreme,
    featFace: a.featFace,
    specialText: a.specialText,
  };
  return [result, next] as const;
}

/**
 * Resolve whether a defeated (taken-out) enemy survives, via the answers oracle,
 * and apply the verdict through afterBattle. The single decision kind that
 * mutates engine state. A no-op enemy (not a survivable take-out) is returned
 * unchanged but the oracle is still rolled (the answer is reported for the log).
 */
export function resolveEnemySurvival(
  enemy: EnemyState,
  answers: OracleAnswersTable,
  likelihoodKey: string | null,
  diceCfg: DiceConfig,
  rng: Rng,
): readonly [EnemyState, EnemyDecisionResult, Rng] {
  const [result, next] = rollEnemyDecision(answers, "survives_defeat", likelihoodKey, diceCfg, rng);
  const resolved = afterBattle(enemy, result.answer === "yes");
  return [resolved, result, next] as const;
}
