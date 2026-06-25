/**
 * Combat subsystem types.
 *
 * Tact 1 scope: data model + config vocabulary only. No RNG, no rolling, no
 * state mutation logic (those begin in Tact 2 with attack resolution). This
 * file mirrors the engine discipline: keys are ASCII engine vocabulary; all
 * Russian display strings (nameRu, weapon/ability names) are OPAQUE pack
 * content carried as values and never branched on. No book number lives here.
 */

import type { HeroState } from "../hero/state.js";

/** The four canonical combat positions (kv.mechanics.combat.shagi...). */
export type StanceKey = "forward" | "open" | "defensive" | "ranged";

/** The four canonical combat tasks, each bound to a stance (combat.boevye_zadachi). */
export type CombatTaskKey = "cow" | "rally" | "protect" | "prepare_shot";

/** The four weapon-skill groups plus brawling (traits.spisok_boevyh_umeniy). */
export type WeaponGroup = "swords" | "spears" | "axes" | "bows" | "brawling";

/** Phase of a combat (combat.posledovatelnost_boya): first volleys, then melee. */
export type CombatPhase = "first_volleys" | "melee_rounds";

/**
 * A stance's hero attack-die modifier. Flat for most stances; the defensive
 * stance scales the penalty per engaged enemy, so the shape differs and is made
 * explicit rather than collapsed to a single number.
 */
export type StanceDiceMod =
  | { readonly kind: "flat"; readonly dice: number }
  | { readonly kind: "per_engaged_enemy"; readonly dice: number };

/** One combat position with its modifiers and bound task (verbatim from pack). */
export interface StanceSpec {
  readonly key: StanceKey;
  readonly nameRu: string; // opaque pack content
  readonly type: "melee" | "ranged";
  /** Hero's melee attack-die modifier. Absent for the ranged stance. */
  readonly heroAttackMod?: StanceDiceMod;
  /** Modifier to an enemy's melee attack-die against this hero. Absent for ranged. */
  readonly enemyMeleeVsHeroMod?: number;
  readonly task: CombatTaskKey;
  readonly heroRangedOnly?: boolean;
  readonly targetableOnlyByRanged?: boolean;
}

/**
 * A combat task's effect rungs, carried OPAQUELY. The strings encode TOR's
 * party-coordination semantics ("forward_heroes_plus_1d...") which the runtime
 * / narrative layer interprets; the config deriver does not branch on them. The
 * solo-applicability of a task is a runtime policy decided later (with the solo
 * overlay backfill), not derived here.
 */
export interface TaskEffect {
  readonly onSuccess: string;
  readonly oneSign?: string;
  readonly twoSigns?: string;
  readonly perSign?: string;
}

/** One combat task bound to a stance and a skill (combat.boevye_zadachi). */
export interface CombatTaskSpec {
  readonly key: CombatTaskKey;
  readonly nameRu: string; // opaque
  readonly stance: StanceKey;
  readonly skill: string; // engine skill key (awe/inspire/athletics/search)
  readonly maxPerRound?: number; // rally is once per round
  readonly effect: TaskEffect;
}

/** Action economy per turn (one main + one secondary). */
export interface ActionEconomy {
  readonly main: number;
  readonly secondary: number;
}

/** Grapple limits by target size (combat.shagi...grapple). */
export interface GrappleLimits {
  readonly rangedHeroesCannotBeGrappled: boolean;
  readonly maxEnemiesPerHero: { readonly humanSize: number; readonly large: number };
  readonly maxHeroesPerEnemy: { readonly humanSize: number; readonly large: number };
}

/** Complication / advantage die tiers (combat.oslozhneniya_i_preimuschestva). */
export interface ComplicationTiers {
  readonly complication: { readonly moderate: number; readonly serious: number };
  readonly advantage: { readonly moderate: number; readonly serious: number };
}

/** One way to leave an unwinnable fight (combat.vyhod_iz_boya). */
export interface ExitMethod {
  readonly nameRu: string; // opaque
  readonly requiresStance: StanceKey;
  /** Whether leaving needs a roll (the ranged exit is free; defensive needs an attack check). */
  readonly requiresRoll: boolean;
}

export interface ExitMethods {
  readonly rangedExit: ExitMethod;
  readonly defensiveExit: ExitMethod;
}

/** The full combat rule vocabulary, derived from the verified pack. */
export interface CombatConfig {
  readonly stances: Readonly<Record<StanceKey, StanceSpec>>;
  /** Action order across stances (forward -> open -> defensive -> ranged). */
  readonly stanceOrder: readonly StanceKey[];
  readonly tasks: Readonly<Record<CombatTaskKey, CombatTaskSpec>>;
  readonly actions: ActionEconomy;
  readonly grapple: GrappleLimits;
  readonly complicationTiers: ComplicationTiers;
  /** Skill used by the manipulate action to gain advantage / clear complication. */
  readonly manipulateSkill: string; // battle
  readonly exit: ExitMethods;
}

// --- Enemy stat block (adversaries.format_opisaniya + type cards) ---

/** One enemy combat proficiency. All display strings opaque. */
export interface EnemyWeapon {
  readonly name: string; // opaque
  readonly rating: number; // success dice on the enemy's attack check
  readonly damage: number; // Endurance loss inflicted on a hit
  readonly wound: number; // Injury rating: TN of the hero's PROTECTION roll when Pierced
  readonly special: readonly string[]; // opaque special-damage labels
}

/**
 * A static enemy stat block. The Hatred/Resolve pool plays the role of the
 * hero's Hope; which one an enemy carries is recorded in poolKind. Abilities and
 * distinctive qualities are opaque named talents (keeper/oracle adjudicated),
 * not automated here.
 */
export interface EnemyStatBlock {
  readonly key: string; // ascii enemy key, e.g. "goblin_luchnik"
  readonly nameRu: string; // opaque
  readonly level: number; // single attribute level (combat modifier)
  readonly endurance: number; // maximum
  readonly might: number; // wounds to destroy AND attacks per round
  readonly pool: number; // maximum Hatred or Resolve
  readonly poolKind: "hatred" | "resolve";
  readonly parry: number | null; // modifier added to the attacking hero's STRENGTH TN
  readonly armour: number; // PROTECTION success dice when Pierced
  readonly weapons: readonly EnemyWeapon[];
  readonly abilities: readonly string[]; // opaque
  readonly distinctive: readonly string[]; // opaque
}

/** A live enemy instance during a fight. Destroyed when woundsTaken === might. */
export interface EnemyState {
  readonly block: EnemyStatBlock;
  readonly endurance: number; // current
  readonly pool: number; // current Hatred/Resolve (without points -> counts as weary)
  readonly woundsTaken: number;
  readonly engaged: boolean; // false once left behind / fled
  readonly alive: boolean;
}

// --- Hero combat frame + combat state ---

/**
 * The hero's equipped weapon for a fight. In Stage 1 these combat numbers are
 * scenario-supplied inputs (the equipment economy is Stage 4); the weapon group
 * doubles as the weapon-skill key whose rating lives on HeroState.skills.
 */
export interface HeroWeapon {
  readonly group: WeaponGroup;
  readonly nameRu?: string; // opaque, optional
  readonly damage: number;
  readonly injury: number; // injury rating (the weapon's wound TN)
}

/**
 * Combat-transient hero state. HeroState (the persistent sheet) stays the shared
 * foundation and is not extended for the fight; round-local state lives here and
 * grows in later tacts (task buffs, driven-back usage).
 */
export interface HeroCombatFrame {
  readonly stance: StanceKey;
  readonly parryRating: number; // the hero's PARRY: enemies attack against this TN
  readonly armourProtection: number; // hero PROTECTION success dice
  readonly equippedWeapon: HeroWeapon;
}

/** The container a fight mutates: persistent hero + combat frame + enemies. */
export interface CombatState {
  readonly hero: HeroState;
  readonly heroFrame: HeroCombatFrame;
  readonly enemies: readonly EnemyState[];
  readonly round: number;
  readonly phase: CombatPhase;
}
