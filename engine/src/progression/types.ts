/**
 * Progression subsystem types. The deterministic growth core for a hero between
 * adventures: earning experience (solo milestone table), spending it through the
 * pack cost table (with the per-phase caps), and advancing one step on the
 * Shadow Path after a bout of madness. No RNG and no narrative -- pure
 * (state, plan, config) -> (result, state). The Fellowship Phase (next
 * subsystem) wraps these with duration/place/undertakings/spiritual-recovery.
 *
 * Every number in ProgressionConfig is read from the verified pack at config
 * time (config.ts); nothing here is baked.
 */

// ---------------------------------------------------------------------------
// Config (all values read from the pack in config.ts)
// ---------------------------------------------------------------------------

/**
 * Training cost to reach a NEW level, split by what the level applies to. Read
 * from fellowship_phase.struktura_fazy_bratstva.improve_stats.training_cost.rows
 * (skills/weapon-skills are paid in skill/adventure points respectively; valour
 * and wisdom in adventure points -- which pool pays is ExperienceModel's job).
 */
export interface TrainingCost {
  /** new skill / weapon-skill level -> point cost. */
  readonly skillByNewLevel: Readonly<Record<number, number>>;
  /** new valour / wisdom level -> point cost. */
  readonly valourWisdomByNewLevel: Readonly<Record<number, number>>;
}

/** Per-phase improvement caps (struktura_fazy_bratstva.improve_stats). */
export interface PhaseCaps {
  readonly maxLevelsPerSkill: number;
  readonly maxLevelsPerWeaponSkill: number;
  /** How many of {valour, wisdom} may be raised in one phase (book: one only). */
  readonly valourOrWisdomPerPhase: number;
}

/** Which pool pays for what (hero_creation.experience.parameters). */
export interface ExperienceModel {
  /** Targets bought with skill points (book: ["skills"]). */
  readonly skillPointsBuy: readonly string[];
  /** Targets bought with adventure points (book: ["weapon_skills","valour","wisdom"]). */
  readonly adventurePointsBuy: readonly string[];
}

/** One solo milestone row (kv.solo.milestones); reaching it earns these points. */
export interface MilestoneAward {
  /** Opaque display label of the milestone (carried from the pack as-is). */
  readonly milestone: string;
  readonly adventurePoints: number;
  readonly skillPoints: number;
}

/** Shadow Path model (ispolzovanie_izyanov + per-calling shadow_path). */
export interface ShadowPathModel {
  /** calling id -> shadow path key (from each calling card). */
  readonly callingToPath: Readonly<Record<string, string>>;
  /** path key -> ordered Flaw labels (opaque display values). */
  readonly pathFlaws: Readonly<Record<string, readonly string[]>>;
  /** Flaw count after which the hero has succumbed (all gained). */
  readonly succumbAfterFlaws: number;
}

/** Reward / Virtue taxonomy and the grant rule (rewards_virtues.*). */
export interface GrantModel {
  /** Valid Reward keys (spisok_nagrad). */
  readonly rewardKeys: readonly string[];
  /** Valid regular Virtue keys (spisok_osobennostey). */
  readonly virtueKeys: readonly string[];
  /** Valid cultural Virtue keys, per culture id (osobennosti_<culture>). */
  readonly culturalVirtueKeysByCulture: Readonly<Record<string, readonly string[]>>;
  /** Minimum WISDOM level to take a cultural Virtue (kulturnye_osobennosti). */
  readonly culturalMinWisdomLevel: number;
  /** What a new level grants: "valour_level" -> reward (nagrady.gain_per). */
  readonly rewardGainPer: string;
  /** What a new level grants: "wisdom_level" -> virtue (osobennosti.gain_per). */
  readonly virtueGainPer: string;
}

/** The full progression config; every value sourced from the verified pack. */
export interface ProgressionConfig {
  readonly experience: ExperienceModel;
  readonly trainingCost: TrainingCost;
  readonly caps: PhaseCaps;
  readonly milestones: readonly MilestoneAward[];
  readonly shadowPath: ShadowPathModel;
  readonly grants: GrantModel;
  /** Valid skill ids (traits.spisok_navykov). */
  readonly validSkills: readonly string[];
  /** Valid weapon-skill ids (traits.spisok_boevyh_umeniy). */
  readonly validWeaponSkills: readonly string[];
}

// ---------------------------------------------------------------------------
// Earn
// ---------------------------------------------------------------------------

export interface EarnResult {
  readonly adventurePointsGained: number;
  readonly skillPointsGained: number;
  /** Opaque labels of the milestones applied, in order. */
  readonly milestones: readonly string[];
}

// ---------------------------------------------------------------------------
// Spend
// ---------------------------------------------------------------------------

/**
 * One spend choice. WHICH target to raise (and which Reward/Virtue to take on a
 * valour/wisdom level) is the player's / policy's input, exactly like combat
 * tactics; the engine validates it against the pack and applies the cost. Each
 * raise is a single level (the book allows at most one level per skill, one per
 * weapon-skill, and one of valour-or-wisdom, per phase).
 */
export type SpendItem =
  | { readonly kind: "skill"; readonly id: string; readonly toRating: number }
  | { readonly kind: "weaponSkill"; readonly id: string; readonly toRating: number }
  | { readonly kind: "valour"; readonly toLevel: number; readonly grantRewardKey: string }
  | { readonly kind: "wisdom"; readonly toLevel: number; readonly grantVirtueKey: string };

export interface SpendPlan {
  readonly items: readonly SpendItem[];
}

/** A Reward or Virtue granted by a valour/wisdom level-up (recorded opaquely). */
export interface GrantEvent {
  readonly kind: "reward" | "virtue";
  readonly key: string;
}

export interface SpendResult {
  readonly skillPointsSpent: number;
  readonly adventurePointsSpent: number;
  readonly grants: readonly GrantEvent[];
}

// ---------------------------------------------------------------------------
// Shadow Path
// ---------------------------------------------------------------------------

export interface ShadowStepResult {
  /** The shadow path key (calling-derived). */
  readonly path: string;
  /** The Flaw label gained this step (opaque display value). */
  readonly flawGained: string;
  /** Total Flaws gained after this step. */
  readonly flawsGainedTotal: number;
  /** All Flaws gained: the next overwhelmed makes the hero leave the game. */
  readonly succumbed: boolean;
}

// ---------------------------------------------------------------------------
// Run (thin growth driver)
// ---------------------------------------------------------------------------

/** A between-adventures growth pass: what was reached, what to spend, how many
 * bouts of madness occurred (each advances one Shadow-Path step). */
export interface ProgressionInput {
  /** Indices into config.milestones for each milestone reached. */
  readonly milestoneIndices: readonly number[];
  readonly spendPlan: SpendPlan;
  readonly boutsOfMadness: number;
}

export interface ProgressionResult {
  readonly earn: EarnResult;
  readonly spend: SpendResult;
  readonly shadowSteps: readonly ShadowStepResult[];
}
