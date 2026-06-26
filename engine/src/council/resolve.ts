/**
 * Final stage: classify a finished council into one of the three book outcomes.
 *
 * Decision tree (zavershenie_soveta, "zavershenie soveta"):
 *   accumulated >= resistance              -> goal_achieved
 *   accumulated == 0                        -> catastrophe   (every check failed)
 *   shortfall AND introduction failed       -> catastrophe   (too few after a
 *                                              bad introduction)
 *   shortfall AND introduction succeeded    -> the party fell short: a refusal,
 *                                              or -- only with the Keeper's
 *                                              permission (policy) -- the goal at
 *                                              a price.
 *
 * The refusal/price split is a player choice gated on Keeper permission, so the
 * engine reads it from the policy and never decides it on its own.
 */

import { fail } from "./parse.js";
import type { CouncilEvent, CouncilOutcome, CouncilPolicy, CouncilResult, CouncilState } from "./types.js";

export function resolveCouncil(
  state: CouncilState,
  events: readonly CouncilEvent[],
  policy: CouncilPolicy,
): CouncilResult {
  if (state.duration === null || state.introductionSucceeded === null) {
    fail("resolveCouncil: introduction not done");
  }

  let outcome: CouncilOutcome;
  if (state.accumulated >= state.resistance) {
    outcome = "goal_achieved";
  } else if (state.accumulated === 0 || !state.introductionSucceeded) {
    outcome = "catastrophe";
  } else {
    outcome = policy.acceptPriceOnShortfall === true ? "goal_at_a_price" : "refusal";
  }

  const endEvent: CouncilEvent = { kind: "council_end", outcome };
  return {
    outcome,
    resistance: state.resistance,
    accumulated: state.accumulated,
    duration: state.duration,
    attemptsUsed: state.attemptsUsed,
    introductionSucceeded: state.introductionSucceeded,
    hero: state.hero,
    events: [...events, endEvent],
  };
}
