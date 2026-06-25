import type { CheckResult } from "../checks/types.js";
import type { HeroState } from "../hero/state.js";
import type { JourneyRulesConfig } from "./config.js";

export interface EndFatigueInput {
  /** Mounts' carry rating; removed first. */
  readonly mountCarry: number;
  /** End-of-journey travel check; removes base + 1 per success sign. */
  readonly travelCheck: CheckResult;
  /** Number of safe long rests taken afterward; each removes the configured amount. */
  readonly safeLongRests: number;
}

/**
 * Remove journey Fatigue at the end (journey.poryadok_puteshestviya): first by
 * the mounts' carry rating, then by the travel check (base + 1 per success
 * sign), then by each safe long rest. Floored at 0.
 */
export function removeFatigueAtJourneyEnd(h: HeroState, input: EndFatigueInput, cfg: JourneyRulesConfig): HeroState {
  const fromCheck = cfg.endFatigueTravelCheckBase + input.travelCheck.successIcons;
  const removed = Math.max(0, input.mountCarry) + fromCheck + Math.max(0, input.safeLongRests) * cfg.perSafeLongRest;
  return { ...h, fatigue: Math.max(0, h.fatigue - removed) };
}
