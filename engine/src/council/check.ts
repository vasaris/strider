/**
 * One council skill check, shared by the introduction and negotiation stages.
 * Mirror of combat's runTaskCheck: derive the skill's attribute and TN from the
 * pack, roll with the hero's Feat modifier and condition voiding, and hand back
 * the CheckResult plus the threaded RNG. The bonus/penalty success dice are the
 * only stage-specific inputs (attitude + roleplay fold into them upstream); the
 * introduction passes 0/0.
 */

import { evaluateCheck } from "../checks/evaluate.js";
import { targetNumber } from "../checks/targetNumber.js";
import type { CheckResult } from "../checks/types.js";
import { checkConditions, heroFeatModifier } from "../conditions/derive.js";
import { rollCheckDice } from "../dice/roll.js";
import type { HeroState } from "../hero/state.js";
import type { Rng } from "../rng/rng.js";
import type { CouncilConfigs } from "./config.js";
import { fail } from "./parse.js";

export function runCouncilCheck(
  hero: HeroState,
  skill: string,
  bonusSuccessDice: number,
  penaltySuccessDice: number,
  cfgs: CouncilConfigs,
  rng: Rng,
): readonly [CheckResult, Rng] {
  const attribute = cfgs.skillAttribute[skill];
  if (attribute === undefined) fail(`runCouncilCheck: unknown skill "${skill}"`);
  const skillRating = hero.skills[skill] ?? 0;
  const tn = targetNumber(hero.attributes[attribute], cfgs.check);
  const [roll, next] = rollCheckDice(
    cfgs.dice,
    { abilityRating: skillRating, featModifier: heroFeatModifier(hero), bonusSuccessDice, penaltySuccessDice },
    rng,
  );
  return [evaluateCheck(roll, tn, cfgs.check, checkConditions(hero, cfgs.conditions)), next] as const;
}
