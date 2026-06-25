import type { EyeRegion } from "../eye/types.js";
import type { JourneyRulesConfig } from "./config.js";
import type { Season } from "./state.js";

/** A planned journey: geography, conditions of travel, and entry danger zones. */
export interface Route {
  readonly totalHexes: number;
  readonly difficultHexes: number; // each adds duration per the rules config
  readonly mounted: boolean; // duration halved, rounded up
  readonly forcedMarch: boolean; // fixed hexes/day, extra fatigue/day
  readonly mountCarry: number; // mounts' carry rating (end-of-journey fatigue removal)
  readonly dangerZones: readonly number[]; // peril ratings; each played at entry
  readonly region: EyeRegion; // scene bias + pursuit threshold
  readonly season: Season; // failed-travel advance distance
}

/**
 * Base journey duration in days (journey.poryadok_puteshestviya):
 *  - normal: hexes + (rules.difficultTerrainDayPerHex) per difficult hex;
 *    mounted halves the result, rounded up.
 *  - forced march: a fixed hexes-per-day pace (difficult terrain not added).
 * Scene `journey_days_delta` effects adjust this afterward.
 */
export function journeyDuration(route: Route, cfg: JourneyRulesConfig): number {
  if (route.forcedMarch) {
    return Math.ceil(route.totalHexes / cfg.forcedMarchHexesPerDay);
  }
  const base = route.totalHexes + route.difficultHexes * cfg.difficultTerrainDayPerHex;
  return route.mounted && cfg.mountedHalveRoundUp ? Math.ceil(base / 2) : base;
}

/** Extra Fatigue accrued over a forced march of the given number of days. */
export function forcedMarchFatigue(days: number, cfg: JourneyRulesConfig): number {
  return Math.max(0, days) * cfg.forcedMarchExtraFatiguePerDay;
}
