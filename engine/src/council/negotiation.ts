/**
 * Stage 2: one negotiation attempt.
 *
 * A single skill check whose result adds to the accumulated total: a success
 * contributes one, plus one more per success sign (each sign is an extra
 * success, p. 18). A failure contributes nothing. The listeners' attitude and
 * any Keeper roleplay bonus shift the dice pool: attitude is a signed
 * modifier (cold -1, friendly +1) and roleplay is a non-negative grant; their
 * net splits into bonus and penalty success dice (the dice layer floors the
 * pool at zero). The roleplay grant is validated against the pack's sanctioned
 * set so a policy cannot invent an arbitrary bonus.
 */

import type { Rng } from "../rng/rng.js";
import { runCouncilCheck } from "./check.js";
import type { CouncilConfigs } from "./config.js";
import { fail } from "./parse.js";
import type { CouncilEvent, CouncilNegotiationPlan, CouncilState } from "./types.js";

export function runNegotiationRound(
  state: CouncilState,
  plan: CouncilNegotiationPlan,
  cfgs: CouncilConfigs,
  rng: Rng,
): readonly [CouncilState, CouncilEvent, Rng] {
  if (state.duration === null || state.introductionSucceeded === null) {
    fail("runNegotiationRound: introduction not done");
  }
  if (state.attemptsUsed >= state.duration) fail("runNegotiationRound: no attempts left");

  const neg = cfgs.council.negotiations;
  const roleplay = plan.roleplayBonusDice;
  if (roleplay !== 0 && !neg.goodRoleplayBonusDice.includes(roleplay)) {
    fail(`runNegotiationRound: roleplay bonus ${roleplay} not sanctioned by pack`);
  }
  if (!Number.isInteger(roleplay) || roleplay < 0) {
    fail(`runNegotiationRound: roleplay bonus must be a non-negative integer, got ${roleplay}`);
  }

  const net = neg.attitudeModifierDice[state.attitude] + roleplay;
  const bonus = Math.max(net, 0);
  const penalty = Math.max(-net, 0);

  const [res, next] = runCouncilCheck(state.hero, plan.skill, bonus, penalty, cfgs, rng);
  const successesGained = res.outcome === "success" ? 1 + res.successIcons : 0;
  const accumulated = state.accumulated + successesGained;
  const attemptsUsed = state.attemptsUsed + 1;

  const newState: CouncilState = { ...state, accumulated, attemptsUsed };
  const event: CouncilEvent = {
    kind: "negotiation",
    attempt: attemptsUsed,
    skill: plan.skill,
    outcome: res.outcome,
    successIcons: res.successIcons,
    successesGained,
    accumulated,
  };
  return [newState, event, next] as const;
}
