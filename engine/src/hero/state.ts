import type { EyeState } from "../eye/types.js";

/** The three core attributes; their rating sets a check's target number. */
export type Attribute = "strength" | "heart" | "wits";

/** Severity of an Injury, from the wound-severity table (combat.raneniya). */
export type WoundSeverity = "light" | "serious" | "terrible";

/**
 * The detail of a hero's current Injury. The boolean `wounded` flag stays the
 * sheet Injury mark (it already drives slower recovery in conditions); this
 * carries the severity, the outstanding healing days and whether THIS wound put
 * a mark on the sheet (relevant to the dying-rescue +days rule). Null when the
 * hero carries no injury detail. Wounds outlive a fight by definition (Rest,
 * p. 71), so the authoritative model is persistent here, not combat-local.
 */
export interface WoundState {
  readonly severity: WoundSeverity;
  readonly healingDays: number; // outstanding days of recovery (serious: feat result)
  readonly marked: boolean; // this wound placed the Injury mark
}

/**
 * The hero's mechanical state. Foundational and shared across subsystems
 * (journey, conditions, combat, council, progression), so it lives here rather
 * than inside any one of them.
 */
export interface HeroState {
  readonly attributes: Readonly<Record<Attribute, number>>; // ratings -> TN = tnBase - rating
  readonly skills: Readonly<Record<string, number>>; // skill rating -> success dice
  readonly endurance: { readonly current: number; readonly max: number };
  /** Gear weight. Total Load = loadGear + fatigue (journey Iznurenie raises Load). */
  readonly loadGear: number;
  readonly fatigue: number; // journey-only Iznurenie
  readonly hope: { readonly current: number; readonly max: number };
  readonly shadow: { readonly points: number; readonly scars: number };
  readonly eye: EyeState;
  readonly inspired: boolean; // Wanderer on journey skill checks
  readonly wounded: boolean; // the Injury sheet mark
  /** Current Injury detail; null when the hero has taken no wound. */
  readonly wound: WoundState | null;
  /** Crisis: 0 Endurance, needs a successful HEALING rescue within ~1h (raneniya). */
  readonly dying: boolean;
  /** A dying hero who was not rescued in time. Ends the run. */
  readonly dead: boolean;
  /** Permanent marks left by survived Injuries (scar/limp/...); flavour, no mechanics. */
  readonly permanentInjuryMarks: number;

  // ---- Progression (growth between adventures) ----
  // All fields below are optional and additive: heroes built before the
  // Progression subsystem (journey/combat/council scenarios) omit them and are
  // unaffected. None is read by those subsystems; they are written by
  // progression/ and read by it (and, later, the Fellowship Phase).

  /** The two experience pools (hero_creation.experience). */
  readonly experience?: { readonly adventurePoints: number; readonly skillPoints: number };
  /** VALOUR rating; raised with adventure points (valour_wisdom.doblest). */
  readonly valour?: number;
  /** WISDOM rating; raised with adventure points (valour_wisdom.mudrost). */
  readonly wisdom?: number;
  /** Weapon-skill ratings, parallel to `skills` (traits.spisok_boevyh_umeniy). */
  readonly weaponSkills?: Readonly<Record<string, number>>;
  /** Acquired Virtue (Osobennost) keys; opaque, effects applied at point of use. */
  readonly virtues?: readonly string[];
  /** Acquired Reward (Nagrada) keys; opaque, equipment-bound (applied in Stage 4). */
  readonly rewards?: readonly string[];
  /** Calling id; derives the hero's Shadow Path (hero_creation.calling_*). */
  readonly calling?: string;
  /** Culture id; gates which cultural Virtues are available (osobennosti_<culture>). */
  readonly culture?: string;
  /** Shadow-Path progress: which path and how many Flaws gained so far. */
  readonly shadowPath?: { readonly key: string; readonly flawsGained: number };
  /** Acquired Flaw labels (negative Distinctive Features); opaque display values. */
  readonly flaws?: readonly string[];
  /** Journal of reached milestones (opaque display labels from the solo table). */
  readonly milestonesReached?: readonly string[];
}
