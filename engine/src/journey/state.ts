import type { CheckResult } from "../checks/types.js";
import type { DiceRoll, FeatModifier } from "../dice/types.js";
import type { HeroState } from "../hero/state.js";
import type { Effect, FaceKey, OracleAnswer } from "../oracles/types.js";
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
  /**
   * A drawn scene awaiting the player's skill check (set by travelBeat, cleared by
   * checkBeat). ABSENT == null: the key is present ONLY while a check is pending; every
   * other path leaves it absent (never written as null), so states produced by
   * stepJourney serialise exactly as before the beat split.
   */
  readonly pending?: PendingSceneCheck | null;
}

/** The scene-table + detail draw of one step (TRANS1: shown to the player). Plain JSON data. */
export interface SceneDraw {
  readonly sceneType: string;
  readonly detail: SceneDetailRow; // the rolled detail row, verbatim
  readonly tableRoll: {
    readonly feat: number; // physical face of the KEPT Feat die
    readonly candidates: readonly number[]; // every physical Feat face rolled, in roll order (1 entry on a normal roll)
    readonly modifier: FeatModifier; // the regional modifier the roll used
  };
  readonly detailDie: number; // the d6 face that picked the detail row
}

/** A drawn scene awaiting the player's skill check (travelBeat -> checkBeat). */
export type PendingSceneCheck = SceneDraw;

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
  | { readonly kind: "arrival"; readonly durationDays: number }
  | {
      // A yes/no oracle question (kv.solo.answers). The question text is never stored.
      readonly kind: "oracle";
      readonly likelihoodKey: string;
      readonly featFace: FaceKey;
      readonly answer: "yes" | "no";
      readonly extreme: boolean;
    };

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

/**
 * One source of Eye Awareness growth within a beat (only entries with delta > 0, in order of
 * occurrence): the Eye on the hero's Travel check, the Eye on the hero's scene skill check, or
 * Shadow points gained through the scene consequence (out of combat). Detection-scene effects
 * are not listed: the detection resets Awareness, matching the orchestrator's eye_delta.
 */
export interface EyeSource {
  readonly source: "travel_check" | "scene_check" | "shadow";
  readonly delta: number;
}

/** A Hope spend for bonus Success dice on one roll: spent 0 or 1 point, and the dice it gave. */
export interface HopeSpend {
  readonly spent: 0 | 1;
  readonly bonusDice: number;
}

/**
 * How a travel beat ended: the journey arrived; a scene was drawn and awaits the player's
 * check (journey.pending); or a significant encounter was drawn and resolved (no check).
 */
export type TravelBeatKind = "arrival" | "pending" | "encounter";

/** Side record of travelBeat (the player's Travel check plus the scene draw that follows). */
export interface TravelBeatRecord {
  readonly kind: TravelBeatKind;
  readonly events: readonly JourneyEvent[]; // exactly the log slice this beat appended
  readonly travelCheck: CheckResult;
  readonly travelRoll: CheckRoll;
  readonly hope: HopeSpend;
  readonly scene: SceneDraw | null; // null exactly on "arrival"; on "pending" it equals next.journey.pending
  readonly eyeSources: readonly EyeSource[];
}

/** Side record of checkBeat (the player's skill check on the pending scene). */
export interface CheckBeatRecord {
  readonly events: readonly JourneyEvent[]; // exactly the log slice this beat appended
  readonly scene: SceneDraw; // the pending scene this beat resolved
  readonly sceneCheck: CheckResult;
  readonly sceneRoll: CheckRoll;
  readonly hope: HopeSpend;
  readonly eyeSources: readonly EyeSource[];
}

/** Side record of askOracle. */
export interface OracleRecord {
  readonly events: readonly JourneyEvent[]; // the single oracle event appended
  readonly answer: OracleAnswer;
}
