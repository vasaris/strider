/**
 * Fellowship Phase subsystem types. The Stage-1 closer: the wrapper that
 * sequences the four phase steps (determine duration, choose place, improve
 * stats, choose undertakings), performs the deterministic spiritual recovery
 * (Hope restore = HEART rating; Yule = full restore; Shadow-point removal 1/2/3,
 * solo via kv.solo.shadow_recovery), applies the Yule extras (bonus skill points
 * = WITS rating; aging), and delegates the improve-stats step to the already
 * built Progression driver (runProgression). RNG-free: like Progression, the
 * Fellowship Phase rolls no dice -- everything is table lookup and arithmetic.
 *
 * Every number in FellowshipConfig is read from the verified pack at config time
 * (config.ts); nothing here is baked. Recovery amounts that depend on the hero
 * (HEART/WITS ratings) are read off HeroState at apply time, not stored.
 */

import type { ProgressionInput, ProgressionResult } from "../progression/types.js";

// ---------------------------------------------------------------------------
// Config (all values read from the pack in config.ts)
// ---------------------------------------------------------------------------

/** Per-undertaking metadata from the catalog (nachinaniya_fazy_bratstva). */
export interface UndertakingMeta {
  /** Marked yule:true -- exempt from the per-phase distinctness rule. */
  readonly yuleTagged: boolean;
  /** Calling id for which this undertaking is free (extra slot), or null. */
  readonly freeIfCalling: string | null;
}

/** Spiritual-recovery model (struktura.spiritual_recovery + solo shadow table). */
export interface RecoveryModel {
  /** Descriptor pinned to "heart_rating"; resolved against hero.attributes.heart. */
  readonly hopeRecovered: "heart_rating";
  /** Yule restores Hope fully (struktura.spiritual_recovery.yule = full_hope). */
  readonly yuleFullHope: boolean;
  /** Named deed tiers -> Shadow points removed (minor/active/great_deeds). */
  readonly shadowReductionTiers: Readonly<Record<string, number>>;
  /** Solo-canonical removal amounts (kv.solo.shadow_recovery rows); cross-check. */
  readonly soloShadowAmounts: readonly number[];
}

/** Yule extras (fellowship_phase.yol). */
export interface YuleModel {
  readonly fullHope: boolean;
  readonly agingYears: number;
  /** Descriptor pinned to "wits_rating"; resolved against hero.attributes.wits. */
  readonly bonusSkillPoints: "wits_rating";
}

/** Undertaking selection budget and catalog (nachinaniya_fazy_bratstva). */
export interface UndertakingModel {
  readonly normal: { readonly partyCommon: number; readonly freeCalling: number; readonly maxTotal: number };
  readonly yule: { readonly perHero: number; readonly plusPartyCommon: number };
  /** Distinctness exemption token (book: "yule_tagged"). */
  readonly distinctExcept: string;
  readonly catalog: Readonly<Record<string, UndertakingMeta>>;
}

/** The full Fellowship Phase config; every value sourced from the verified pack. */
export interface FellowshipConfig {
  /** Ordered phase steps (struktura.steps). */
  readonly steps: readonly string[];
  /** Duration descriptors (struktura.duration); no day arithmetic -- the card
   * carries descriptors, not day counts. */
  readonly duration: { readonly min: string; readonly max: string; readonly longest: string };
  /** Narrative place tags (struktura.place); recorded, not semantically checked. */
  readonly placeTags: readonly string[];
  readonly recovery: RecoveryModel;
  readonly yule: YuleModel;
  readonly undertakings: UndertakingModel;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * One Fellowship Phase pass. Duration and place are narrative choices recorded
 * opaquely (a Yule phase must use the longest descriptor). The Shadow-reduction
 * tier is the player's judgement of the adventuring phase against the Shadow
 * (null = no success -> no removal). The improve-stats step is a full
 * Progression input (milestones / spend plan / bouts of madness), delegated to
 * runProgression. Undertaking keys are validated against the pack budget.
 */
export interface FellowshipInput {
  readonly isYule: boolean;
  readonly duration: string;
  readonly place: string;
  readonly shadowReductionTier: string | null;
  readonly undertakings: readonly string[];
  readonly progression: ProgressionInput;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface RecoveryResult {
  /** Hope actually added this phase (delta after clamping to max). */
  readonly hopeRestored: number;
  /** The Yule full-restore rule fired this phase. */
  readonly yuleFullHope: boolean;
  /** Shadow points actually removed (0 when no tier / already at zero). */
  readonly shadowRemoved: number;
}

export interface YuleResult {
  /** Bonus skill points credited (= WITS rating). */
  readonly bonusSkillPoints: number;
  /** Years the hero aged (recorded; no age field on HeroState yet -- Stage 4). */
  readonly agedYears: number;
}

export interface FellowshipResult {
  readonly isYule: boolean;
  readonly duration: string;
  readonly place: string;
  readonly recovery: RecoveryResult;
  /** Present only on a Yule phase. */
  readonly yule: YuleResult | null;
  /** The improve-stats growth pass (from runProgression). */
  readonly progression: ProgressionResult;
  /** Validated undertaking keys, recorded opaquely (effects applied later). */
  readonly undertakingsChosen: readonly string[];
}
