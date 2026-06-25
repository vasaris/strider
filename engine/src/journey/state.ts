import type { CheckResult } from "../checks/types.js";
import type { HeroState } from "../hero/state.js";
import type { Effect } from "../oracles/types.js";
import type { Rng } from "../rng/rng.js";
import type { Route } from "./route.js";

export type { Attribute, HeroState } from "../hero/state.js";

export type Season = "summer_spring" | "winter_autumn";

export interface JourneyProgress {
  readonly route: Route;
  readonly remainingHexes: number;
  /** Base duration (from the route) adjusted by scene journey_days_delta effects. */
  readonly durationDays: number;
  readonly arrived: boolean;
}

export interface JourneyState {
  readonly hero: HeroState;
  readonly journey: JourneyProgress;
  readonly rng: Rng;
  readonly log: readonly JourneyEvent[];
}

/** Structured transcript entries. The engine reports facts; no prose invention. */
export type JourneyEvent =
  | {
      readonly kind: "travel_check";
      readonly outcome: CheckResult["outcome"];
      readonly advance: number;
      readonly remainingAfter: number;
      readonly eyeDelta: number;
    }
  | {
      readonly kind: "scene";
      readonly sceneType: string;
      readonly detailScene: string;
      readonly skill: string | null;
      readonly significantEncounter: boolean;
      readonly checkOutcome: CheckResult["outcome"] | null;
      readonly fatigueGained: number;
      readonly appliedOps: readonly string[];
      readonly eyeDelta: number;
    }
  | {
      readonly kind: "detection";
      readonly awareness: number;
      readonly threshold: number;
      readonly sceneText: string;
      readonly resetTo: number;
    }
  | { readonly kind: "arrival"; readonly durationDays: number };

/** A scene consequence: effects applied when the check outcome matches the trigger. */
export interface Consequence {
  readonly trigger: "on_success" | "on_failure";
  readonly effects: readonly Effect[];
}
