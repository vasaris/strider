import { evaluateCheck, successDiceCounted } from "../checks/evaluate.js";
import { targetNumber } from "../checks/targetNumber.js";
import type { CheckResult } from "../checks/types.js";
import { checkConditions, heroFeatModifier } from "../conditions/index.js";
import { rollCheckDice } from "../dice/roll.js";
import type { Rng } from "../rng/rng.js";
import type { JourneyConfigs } from "./config.js";
import type { CheckRoll, HeroState } from "./state.js";

/**
 * Resolve a skill check: the skill rating supplies the Success dice, the skill's
 * governing attribute sets the target number (tnBase - attribute rating). The
 * hero's conditions apply: overwhelmed forces an ill-favoured Feat die, and
 * weary / miserable feed into evaluation. No Hope spend in the milestone, so no
 * bonus/penalty dice.
 *
 * Delegates to runSkillCheckWithRoll (one code path: identical RNG draws and result)
 * and drops the raw roll.
 */
export function runSkillCheck(
  hero: HeroState,
  skill: string,
  cfg: JourneyConfigs,
  rng: Rng,
): readonly [CheckResult, Rng] {
  const [result, , next] = runSkillCheckWithRoll(hero, skill, cfg, rng);
  return [result, next] as const;
}

/**
 * runSkillCheck that also returns the raw dice it rolled (CheckRoll: the DiceRoll plus
 * the per-Success-die "counted" flags from successDiceCounted -- the same function
 * evaluateCheck sums with, under the same conditions). Consumes the RNG exactly as
 * runSkillCheck (which delegates here); computing the flags draws nothing.
 */
export function runSkillCheckWithRoll(
  hero: HeroState,
  skill: string,
  cfg: JourneyConfigs,
  rng: Rng,
): readonly [CheckResult, CheckRoll, Rng] {
  const attribute = cfg.skillAttribute[skill];
  if (attribute === undefined) throw new Error(`runSkillCheck: unknown skill "${skill}"`);
  const skillRating = hero.skills[skill] ?? 0;
  const tn = targetNumber(hero.attributes[attribute], cfg.checks);
  const [roll, next] = rollCheckDice(
    cfg.dice,
    { abilityRating: skillRating, featModifier: heroFeatModifier(hero), bonusSuccessDice: 0, penaltySuccessDice: 0 },
    rng,
  );
  const conditions = checkConditions(hero, cfg.conditions);
  const result = evaluateCheck(roll, tn, cfg.checks, conditions);
  return [result, { roll, successCounted: successDiceCounted(roll, conditions) }, next] as const;
}
