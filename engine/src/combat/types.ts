/**
 * Combat subsystem types.
 *
 * Tact 1 scope: data model + config vocabulary only. No RNG, no rolling, no
 * state mutation logic (those begin in Tact 2 with attack resolution). This
 * file mirrors the engine discipline: keys are ASCII engine vocabulary; all
 * Russian display strings (nameRu, weapon/ability names) are OPAQUE pack
 * content carried as values and never branched on. No book number lives here.
 */

import type { FeatDieFace } from "../dice/types.js";
import type { HeroState, WoundSeverity } from "../hero/state.js";

/** The four canonical combat positions (kv.mechanics.combat.shagi...). */
export type StanceKey = "forward" | "open" | "defensive" | "ranged";

/** The four canonical combat tasks, each bound to a stance (combat.boevye_zadachi). */
export type CombatTaskKey = "cow" | "rally" | "protect" | "prepare_shot" | "prodvinutsya";

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
  readonly skill: string; // engine skill key (awe/inspire/athletics/search); default check
  /** Alternative checks when the task offers a choice (solo Advance: athletics OR search). */
  readonly skillAny?: readonly string[];
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

/**
 * A live enemy instance during a fight.
 *
 * Two distinct exits (kv.mechanics.adversaries.format_opisaniya):
 *  - Endurance reaches 0  -> TAKEN OUT of combat: `engaged=false`, but `alive`
 *    stays true (still breathing); `after_battle` decides survival if helped.
 *  - woundsTaken === might -> DESTROYED (killed): `engaged=false, alive=false`.
 * So `alive` is false only on a confirmed kill; "out at 0 Endurance, survivable"
 * is the derived state `!engaged && alive && endurance===0 && woundsTaken<might`.
 */
export interface EnemyState {
  readonly block: EnemyStatBlock;
  readonly endurance: number; // current
  readonly pool: number; // current Hatred/Resolve (without points -> counts as weary)
  /** Hatred/Resolve already spent THIS round; capped at Might (round-local, reset each round). */
  readonly poolSpentThisRound: number;
  readonly woundsTaken: number;
  readonly engaged: boolean; // false once taken out / killed / fled
  readonly alive: boolean; // false only on a confirmed kill (woundsTaken===might or after_battle death)
  /**
   * Round-local Success-die modifier applied to THIS enemy's own attack checks
   * until round end (e.g. Shield Thrust pushes it to -1). Signed; reset by the
   * round boundary (startRound). The loop folds it into the attack's
   * extraSuccessDice; resolveAttack stays pool-/debuff-agnostic.
   */
  readonly attackDiceModUntilRoundEnd: number;
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
  /** Two-handed weapons add +1 to Heavy Blow Endurance loss (sovershenie_atak). */
  readonly twoHanded?: boolean;
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
  /** A shield enables the Shield Thrust special damage (sovershenie_atak). */
  readonly hasShield?: boolean;
  /** Driven-back is once per round (combat.sovershenie_atak.driven_back). */
  readonly drivenBackUsedThisRound: boolean;
  /**
   * Round-local PARRY bonus from a successful Fend Off (special damage); added
   * to parryRating when an enemy attacks this hero. Reset by startRound.
   */
  readonly parryBonusThisRound: number;
  /**
   * The hero was driven back out of position (elected to halve incoming damage).
   * Costs the next main action to restore stance (driven_back.cost). Persists
   * across the round boundary; cleared only by a restore_stance main action.
   */
  readonly outOfPosition: boolean;
  /**
   * Bonus success dice granted by a successful combat task whose effect feeds
   * the next ranged attack (Prepare Shot / solo Advance: +1d on success, +1d per
   * sign). Woven into the next ranged-stance hero attack via extraSuccessDice and
   * cleared on use. Persists across the round boundary until consumed ("next
   * ranged attack"), so startRound does NOT reset it.
   */
  readonly pendingRangedBonusDice: number;
}

/** The container a fight mutates: persistent hero + combat frame + enemies. */
export interface CombatState {
  readonly hero: HeroState;
  readonly heroFrame: HeroCombatFrame;
  readonly enemies: readonly EnemyState[];
  readonly round: number;
  readonly phase: CombatPhase;
}

// --- Attack resolution (Tact 2) ---

/** Identifies a combatant: the lone hero, or an enemy by index. */
export type Combatant = "hero" | { readonly enemyIndex: number };

/** A battlefield modifier tier (combat.oslozhneniya_i_preimuschestva). */
export type ModifierTier = "moderate" | "serious";

/**
 * Attack-resolution numbers, from kv.mechanics.combat.sovershenie_atak.
 * Endurance thresholds (weary at <= Load, out at 0) are NOT duplicated here:
 * the hero side reuses the Conditions subsystem and 0 is a structural boundary.
 */
export interface AttackConfig {
  readonly drivenBackTimesPerRound: number;
  readonly drivenBackHalveRoundUp: boolean;
  /** Being driven back costs the next main action to restore stance (driven_back.cost). */
  readonly drivenBackCostsMainAction: boolean;
  /** Feat faces that trigger a Piercing blow (numbers + the Eye); resolved in Tact 3. */
  readonly piercingTriggerFaces: { readonly numbers: readonly number[]; readonly eye: boolean };
}

/** One attack to resolve. */
export interface AttackParams {
  readonly attacker: Combatant;
  readonly target: Combatant;
  /** Which enemy weapon the attacker uses (default 0); the hero uses equippedWeapon. */
  readonly enemyWeaponIndex?: number;
  readonly complication?: ModifierTier; // battlefield penalty on this check
  readonly advantage?: ModifierTier; // battlefield bonus on this check
  /** Hero electing to be driven back to halve incoming damage (enemy -> hero only). */
  readonly heroDrivenBack?: boolean;
  /**
   * Signed Success-die delta the combat loop injects on this attack: positive
   * for an enemy spending pool (+1 die per point, format_opisaniya) or any other
   * loop-owned bonus, negative for a round-local debuff (e.g. Shield Thrust).
   * resolveAttack folds it into bonus/penalty and stays unaware of its origin;
   * the loop owns when pool is spent (combat owns dice, not tactics). Default 0.
   */
  readonly extraSuccessDice?: number;
}

/** The outcome of one attack; special damage and Piercing resolution are Tact 3. */
export interface AttackOutcome {
  readonly hit: boolean;
  readonly autoSuccess: boolean;
  readonly total: number | null; // null on auto-success
  readonly successIcons: number;
  readonly spendableIcons: number; // icons available for special damage (Tact 3)
  readonly enduranceLoss: number; // applied to the target
  readonly piercingTriggered: boolean; // 10 or Eye on the Feat die (Tact 3 resolves)
  /** Physical Feat face of the attack; Tact 3 reads it to recompute Piercing after Pierce. */
  readonly featFace: FeatDieFace;
  /** Target reduced to 0 Endurance -> taken OUT of combat (not necessarily killed; see after_battle). */
  readonly targetTakenOut: boolean;
  readonly heroUnconscious: boolean; // hero reduced to 0 Endurance
  readonly drivenBackApplied: boolean;
}

// --- Wounds (Tact 3, kv.mechanics.combat.raneniya) ---

/** First-aid HEALING numbers; all read from the pack, none baked here. */
export interface FirstAidConfig {
  readonly reduceDaysBase: number; // days removed by a successful check
  readonly perSuccessSign: number; // extra days removed per success icon
  readonly minDays: number; // healing can never drop below this
  readonly retryAfterDaysOnFail: number; // a failed check may be retried after this many days
}

/** Dying-rescue numbers (raneniya.dying). */
export interface DyingConfig {
  readonly addRecoveryDaysIfMarked: number; // extra days if the wound was marked
  readonly reviveEndurance: number; // Endurance on a successful rescue
}

/** The full wound rule vocabulary derived from combat.raneniya. */
export interface WoundConfig {
  /** Display name per severity (opaque pack strings), keyed by engine severity. */
  readonly severityNameRu: Readonly<Record<WoundSeverity, string>>;
  readonly firstAid: FirstAidConfig;
  readonly dying: DyingConfig;
}

// --- Special damage (Tact 3, sovershenie_atak.special_damage) ---

/** A hero special-damage effect. Enemy special damage is opaque (Tact 4). */
export type SpecialDamageKey = "heavy_blow" | "fend_off" | "pierce" | "shield_thrust";

/** Numbers for the four hero special-damage effects, derived from the pack. */
export interface SpecialDamageConfig {
  readonly heavyBlow: { readonly twoHandedBonus: number }; // extra loss = STRENGTH (+bonus if two-handed)
  readonly fendOff: { readonly parryByGroup: Readonly<Record<string, number>> };
  readonly pierce: { readonly featBonusByGroup: Readonly<Record<string, number>>; readonly cap: number };
  readonly shieldThrust: { readonly targetMinusDice: number };
}
