import { evaluateCheck } from "../checks/evaluate.js";
import { targetNumber } from "../checks/targetNumber.js";
import type { CheckResult } from "../checks/types.js";
import { rollCheckDice } from "../dice/roll.js";
import type { Rng } from "../rng/rng.js";
import type { JourneyConfigs } from "./config.js";
import type { HeroState } from "./state.js";

/**
 * Resolve a skill check: the skill rating supplies the Success dice, the skill's
 * governing attribute sets the target number (tnBase - attribute rating). No
 * Hope spend in the milestone, so no bonus/penalty dice; feat modifier normal.
 */
export function runSkillCheck(
  hero: HeroState,
  skill: string,
  cfg: JourneyConfigs,
  rng: Rng,
): readonly [CheckResult, Rng] {
  const attribute = cfg.skillAttribute[skill];
  if (attribute === undefined) throw new Error(`runSkillCheck: unknown skill "${skill}"`);
  const skillRating = hero.skills[skill] ?? 0;
  const tn = targetNumber(hero.attributes[attribute], cfg.checks);
  const [roll, next] = rollCheckDice(
    cfg.dice,
    { abilityRating: skillRating, featModifier: "normal", bonusSuccessDice: 0, penaltySuccessDice: 0 },
    rng,
  );
  return [evaluateCheck(roll, tn, cfg.checks), next] as const;
}
