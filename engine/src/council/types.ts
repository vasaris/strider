/**
 * Council subsystem types. The Council is the social-encounter resolver: the
 * party (in solo, the lone hero) accumulates successes up to a resistance
 * rating across a limited number of attempts (the council duration), then the
 * meeting is classified into one of three book outcomes.
 *
 * Boundary: this subsystem owns the DICE and the bookkeeping, never the
 * tactics. Which skill is used, the Keeper's read of the listeners' attitude,
 * and any roleplay bonus are judgements carried in from a CouncilPolicy -- the
 * engine applies them, it does not invent them (mirror of CombatPolicy). The
 * narrative (who the NPCs are, what is said) is Stage 2 and lives nowhere here.
 */

import type { CheckOutcome } from "../checks/types.js";
import type { HeroState } from "../hero/state.js";

/** Resistance rating of the council's goal (zavershenie_soveta.resistance). */
export type CouncilResistanceKey = "reasonable" | "bold" | "audacious";

/** The Keeper's read of the listeners (negotiations attitude modifier). */
export type CouncilAttitude = "cold" | "neutral" | "friendly";

/**
 * The three book outcomes. `failure_or_success_with_cost` splits by a player
 * choice (gated on Keeper permission) into refusal or goal-at-a-price, so it
 * surfaces as two terminal values here; the engine picks between them from a
 * policy flag, never on its own.
 */
export type CouncilOutcome = "goal_achieved" | "refusal" | "goal_at_a_price" | "catastrophe";

export interface CouncilState {
  readonly hero: HeroState;
  /** Resolved resistance rating (3/6/9), from the pack via the resistance key. */
  readonly resistance: number;
  /** Council-level attitude (a Keeper judgement set once at the start). */
  readonly attitude: CouncilAttitude;
  /** Total attempts allowed; null until the introduction sets it. */
  readonly duration: number | null;
  /** Negotiation attempts consumed so far. */
  readonly attemptsUsed: number;
  /** Successes accumulated toward the resistance rating. */
  readonly accumulated: number;
  /** Whether the introduction check succeeded; null until it is made. Carried
   * because catastrophe vs. shortfall hinges on it, not only on the tally. */
  readonly introductionSucceeded: boolean | null;
}

/** The transcript the Stage-2 narrative layer reads. */
export type CouncilEvent =
  | {
      readonly kind: "introduction";
      readonly skill: string;
      readonly outcome: CheckOutcome;
      readonly successIcons: number;
      readonly durationSet: number;
    }
  | {
      readonly kind: "negotiation";
      readonly attempt: number;
      readonly skill: string;
      readonly outcome: CheckOutcome;
      readonly successIcons: number;
      readonly successesGained: number;
      readonly accumulated: number;
    }
  | { readonly kind: "council_end"; readonly outcome: CouncilOutcome };

/**
 * The flat summary for any caller plus the full transcript for Stage 2. Mirror
 * of CombatResult: the seam the narrative Keeper reads.
 */
export interface CouncilResult {
  readonly outcome: CouncilOutcome;
  readonly resistance: number;
  readonly accumulated: number;
  readonly duration: number;
  readonly attemptsUsed: number;
  readonly introductionSucceeded: boolean;
  readonly hero: HeroState;
  readonly events: readonly CouncilEvent[];
}

/** The representative's plan for the introduction (which skill to lead with). */
export interface CouncilIntroPlan {
  readonly skill: string;
}

/** The plan for one negotiation attempt: skill plus any Keeper roleplay bonus. */
export interface CouncilNegotiationPlan {
  readonly skill: string;
  /** Keeper-granted roleplay bonus dice; 0, or a value the pack sanctions. */
  readonly roleplayBonusDice: number;
}

/**
 * The tactics provider. PURE: no RNG -- all randomness lives in the engine.
 * `acceptPriceOnShortfall` is the Keeper's permission to take the goal at a
 * price when the party falls short after a sound introduction; absent or false
 * means the party simply walks away with a refusal.
 */
export interface CouncilPolicy {
  readonly planIntroduction: (state: CouncilState, cfgs: CouncilConfigsLike) => CouncilIntroPlan;
  readonly planNegotiationRound: (state: CouncilState, cfgs: CouncilConfigsLike) => CouncilNegotiationPlan;
  readonly acceptPriceOnShortfall?: boolean;
}

/**
 * The shape a policy may read. Declared structurally here to avoid a cyclic
 * import with config.ts (which imports these types); the runtime value passed
 * is always the full CouncilConfigs.
 */
export interface CouncilConfigsLike {
  readonly council: CouncilConfig;
}

/** Council vocabulary, all read from kv.mechanics.council.zavershenie_soveta. */
export interface CouncilConfig {
  readonly resistance: Readonly<Record<CouncilResistanceKey, number>>;
  readonly introduction: {
    readonly durationOnFail: number;
    readonly durationSuccessBase: number;
    readonly durationSuccessPerSign: number;
    /** Advisory display list (examples per the book), not a whitelist. */
    readonly usefulSkills: readonly string[];
  };
  readonly negotiations: {
    readonly attitudeModifierDice: Readonly<Record<CouncilAttitude, number>>;
    /** Sanctioned roleplay bonus values (the book's "1, even 2"). */
    readonly goodRoleplayBonusDice: readonly number[];
    /** Advisory display list (examples per the book), not a whitelist. */
    readonly usefulSkills: readonly string[];
  };
}
