import type { CheckResult } from "../checks/types.js";
import type { DiceRoll } from "../dice/types.js";
import type { HeroState } from "../hero/state.js";
import type { Effect } from "../oracles/types.js";
import type { Rng } from "../rng/rng.js";
import type { SceneDetailRow } from "./config.js";
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
      /**
       * Full opaque scene-detail row already rolled this scene (SD1). Additive: surfaced
       * so the orchestrator can place it in oracle.detail at 2.4 WITHOUT re-rolling
       * (which would desync the RNG). detailScene/skill/significantEncounter below are the
       * journey-mechanics view (skill/significant are DERIVED and lossy); `detail` is the
       * raw row [face, scene, prompt, skill, significantEncounter].
       */
      readonly detail: SceneDetailRow;
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

/**
 * Side-channel record of ONE journey step, returned by stepJourney alongside the next
 * state (channel B, ws-b/track-A). It carries the raw CheckResults the step rolled --
 * which the player-facing `log` deliberately does NOT, to keep the journal free of check
 * math -- so the orchestrator can build a NarrativePackage (dice/patch) WITHOUT re-rolling.
 *
 * `events` is the exact slice appended to `state.log` this step (single source of truth:
 * sliced from the log, not recomputed), so a consumer reading sceneDetail from an event
 * here can never diverge from the log.
 *
 * NOT serialised by the CLI (the journey report renders `log` only), so surfacing it keeps
 * the golden transcript byte-identical (empty-diff gate).
 */
export interface StepRecord {
  readonly events: readonly JourneyEvent[]; // exactly the events appended this step
  readonly travelCheck: CheckResult | null; // the travel check; null ONLY on the degenerate already-arrived no-op
  readonly sceneCheck: CheckResult | null; // the scene's skill check, or null (significant/none/arrival)
  // Raw dice of those checks (DD-DICE-FACES, for the UI dice panel). Null EXACTLY when the
  // matching check is null. The same roll the check was evaluated from -- never re-rolled.
  readonly travelRoll: CheckRoll | null;
  readonly sceneRoll: CheckRoll | null;
}

/**
 * The raw dice behind one skill check (runSkillCheckWithRoll). `roll` is the DiceRoll the
 * CheckResult was evaluated from (kept Feat die, every Feat candidate, Success dice faces).
 * `successCounted[i]` says whether `roll.successDice[i].face` entered the total -- from
 * successDiceCounted, the same function evaluateCheck sums with (false only for a face
 * voided by weariness). So, when the check's total is not null:
 *   total === roll.feat.numericValue + sum of successDice[i].face where successCounted[i].
 * On a Gandalf-rune auto-success the total is null and not consulted; the flags are still
 * reported as the rule would apply them.
 */
export interface CheckRoll {
  readonly roll: DiceRoll;
  readonly successCounted: readonly boolean[];
}
