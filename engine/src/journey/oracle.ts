import { rollAnswer } from "../oracles/answers.js";
import { JourneyBeatError } from "./beats.js";
import type { JourneyConfigs } from "./config.js";
import type { JourneyEvent, JourneyState, OracleRecord } from "./state.js";

/**
 * Ask the yes/no oracle during a journey (kv.solo.answers, IdO p.12): one Feat die read
 * against the likelihood (null = the pack default); the Gandalf rune answers yes, extreme;
 * the Eye answers no, extreme. A table roll, not a hero check: it NEVER grows the Eye (R2).
 * Allowed at any point before arrival, with or without a pending scene check. The question
 * text is not part of the engine state.
 *
 * @throws JourneyBeatError journey_over (arrived)
 */
export function askOracle(
  state: JourneyState,
  input: { readonly likelihood: string | null },
  cfg: JourneyConfigs,
): readonly [JourneyState, OracleRecord] {
  if (state.journey.arrived) throw new JourneyBeatError("journey_over");
  const [answer, rng] = rollAnswer(cfg.oracles.answers, input.likelihood, cfg.dice, state.rng);
  const event: JourneyEvent = {
    kind: "oracle",
    likelihoodKey: answer.likelihoodKey,
    featFace: answer.featFace,
    answer: answer.answer,
    extreme: answer.extreme,
  };
  return [{ ...state, rng, log: [...state.log, event] }, { events: [event], answer }] as const;
}
