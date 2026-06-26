/**
 * Stage 1: open a council and run the introduction.
 *
 * The introduction is one representative check whose result sets the council
 * duration: a flat value on a failure, or a base value plus one per success
 * sign on a success (zavershenie_soveta.introduction). It does NOT add to the
 * accumulated total -- it only buys attempts. Attitude and roleplay bonuses
 * belong to the negotiations stage, so the introduction check carries neither
 * (0 bonus, 0 penalty).
 */

import type { Rng } from "../rng/rng.js";
import { runCouncilCheck } from "./check.js";
import type { CouncilConfig, CouncilConfigs } from "./config.js";
import { fail } from "./parse.js";
import type { CouncilAttitude, CouncilEvent, CouncilIntroPlan, CouncilResistanceKey, CouncilState } from "./types.js";

/** Open a council with a resolved resistance rating and a fixed attitude. */
export function startCouncil(
  hero: CouncilState["hero"],
  resistanceKey: CouncilResistanceKey,
  attitude: CouncilAttitude,
  cfg: CouncilConfig,
): CouncilState {
  return {
    hero,
    resistance: cfg.resistance[resistanceKey],
    attitude,
    duration: null,
    attemptsUsed: 0,
    accumulated: 0,
    introductionSucceeded: null,
  };
}

/** Run the representative's introduction check and fix the council duration. */
export function runIntroduction(
  state: CouncilState,
  plan: CouncilIntroPlan,
  cfgs: CouncilConfigs,
  rng: Rng,
): readonly [CouncilState, CouncilEvent, Rng] {
  if (state.introductionSucceeded !== null) fail("runIntroduction: introduction already done");

  const [res, next] = runCouncilCheck(state.hero, plan.skill, 0, 0, cfgs, rng);
  const succeeded = res.outcome === "success";
  const intro = cfgs.council.introduction;
  const duration = succeeded ? intro.durationSuccessBase + intro.durationSuccessPerSign * res.successIcons : intro.durationOnFail;

  const newState: CouncilState = { ...state, introductionSucceeded: succeeded, duration };
  const event: CouncilEvent = {
    kind: "introduction",
    skill: plan.skill,
    outcome: res.outcome,
    successIcons: res.successIcons,
    durationSet: duration,
  };
  return [newState, event, next] as const;
}
