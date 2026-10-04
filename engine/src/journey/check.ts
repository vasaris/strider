import { evaluateCheck, successDiceCounted } from "../checks/evaluate.js";
import { targetNumber } from "../checks/targetNumber.js";
import type { CheckConditions, CheckResult } from "../checks/types.js";
import { checkConditions, heroFeatModifier, isOverwhelmed } from "../conditions/index.js";
import { rollCheckDice } from "../dice/roll.js";
import type { FeatModifier } from "../dice/types.js";
import type { Rng } from "../rng/rng.js";
import type { JourneyConfigs } from "./config.js";
import type { Attribute, CheckRoll, HeroState } from "./state.js";

/**
 * Everything a skill check derives from the hero BEFORE rolling: the Success dice (skill
 * rating), the target number (tnBase - governing attribute rating), the Feat modifier the
 * engine applies (today only overwhelmed -> ill-favoured; favoured skills are FAV1) with its
 * reasons, and the condition modifiers for evaluation (weary / miserable). The ONE derivation:
 * runSkillCheckWithRoll rolls from it and previewCheck reports and enumerates from it, so the
 * preview can never disagree with the roll. No RNG.
 */
export interface SkillCheckSetup {
  readonly skill: string;
  readonly rating: number;
  readonly attribute: Attribute;
  readonly attributeRating: number;
  readonly tn: number;
  readonly featModifier: FeatModifier;
  readonly reasons: readonly "overwhelmed"[];
  readonly conditions: CheckConditions;
}

export function skillCheckSetup(hero: HeroState, skill: string, cfg: JourneyConfigs): SkillCheckSetup {
  const attribute = cfg.skillAttribute[skill];
  if (attribute === undefined) throw new Error(`runSkillCheck: unknown skill "${skill}"`);
  const attributeRating = hero.attributes[attribute];
  return {
    skill,
    rating: hero.skills[skill] ?? 0,
    attribute,
    attributeRating,
    tn: targetNumber(attributeRating, cfg.checks),
    featModifier: heroFeatModifier(hero),
    reasons: isOverwhelmed(hero) ? ["overwhelmed"] : [],
    conditions: checkConditions(hero, cfg.conditions),
  };
}

/**
 * Resolve a skill check: the skill rating supplies the Success dice, the skill's
 * governing attribute sets the target number (tnBase - attribute rating). The
 * hero's conditions apply: overwhelmed forces an ill-favoured Feat die, and
 * weary / miserable feed into evaluation. `bonusSuccessDice` are pre-resolved
 * bonus dice (a Hope spend; the caller has already spent the point, so the hero
 * passed in is the post-spend hero); default 0 = no bonus.
 *
 * Delegates to runSkillCheckWithRoll (one code path: identical RNG draws and result)
 * and drops the raw roll.
 */
export function runSkillCheck(
  hero: HeroState,
  skill: string,
  cfg: JourneyConfigs,
  rng: Rng,
  bonusSuccessDice = 0,
): readonly [CheckResult, Rng] {
  const [result, , next] = runSkillCheckWithRoll(hero, skill, cfg, rng, bonusSuccessDice);
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
  bonusSuccessDice = 0,
): readonly [CheckResult, CheckRoll, Rng] {
  const setup = skillCheckSetup(hero, skill, cfg);
  const [roll, next] = rollCheckDice(
    cfg.dice,
    { abilityRating: setup.rating, featModifier: setup.featModifier, bonusSuccessDice, penaltySuccessDice: 0 },
    rng,
  );
  const result = evaluateCheck(roll, setup.tn, cfg.checks, setup.conditions);
  return [result, { roll, successCounted: successDiceCounted(roll, setup.conditions) }, next] as const;
}
