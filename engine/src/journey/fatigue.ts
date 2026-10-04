import type { CheckResult } from "../checks/types.js";
import type { HeroState } from "../hero/state.js";
import type { JourneyRulesConfig } from "./config.js";

export interface EndFatigueInput {
  /** Mounts' carry rating; removed first. */
  readonly mountCarry: number;
  /** End-of-journey travel check; on a success removes base + 1 per success sign, else nothing. */
  readonly travelCheck: CheckResult;
  /** Number of safe long rests taken afterward; each removes the configured amount. */
  readonly safeLongRests: number;
}

/**
 * Remove journey Fatigue at the end (journey.poryadok_puteshestviya): first by
 * the mounts' carry rating, then by the travel check (base + 1 per success
 * sign), then by each safe long rest. Floored at 0.
 *
 * The travel check removes Fatigue ONLY ON A SUCCESS (KV p.111, "on a success ..."); the
 * pack parameter lost that qualifier, so the gate lives here. A failed check removes 0.
 */
export function removeFatigueAtJourneyEnd(h: HeroState, input: EndFatigueInput, cfg: JourneyRulesConfig): HeroState {
  const fromCheck = input.travelCheck.outcome === "success" ? cfg.endFatigueTravelCheckBase + input.travelCheck.successIcons : 0;
  const removed = Math.max(0, input.mountCarry) + fromCheck + Math.max(0, input.safeLongRests) * cfg.perSafeLongRest;
  return { ...h, fatigue: Math.max(0, h.fatigue - removed) };
}
