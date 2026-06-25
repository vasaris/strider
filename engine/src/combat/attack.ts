/**
 * Attack resolution (Tact 2): the core combat function. An attack is a combat-
 * skill check whose target number comes from the defender's parry, and on a hit
 * the target loses Endurance equal to the weapon's Damage. Special damage, the
 * Piercing protection roll and Wounds are Tact 3; here we only flag the
 * spendable success icons and whether a Piercing blow was triggered.
 *
 * The Feat die is read per side: for the hero the Gandalf rune is an automatic
 * success and the Eye is the worst result; for an enemy this is INVERTED — the
 * Eye is an automatic success (its highest result) and the rune is the lowest
 * (kv.mechanics.adversaries.format_opisaniya). So a combat-local evaluator owns
 * the inversion rather than polluting the hero-centric Checks subsystem.
 *
 * "+1 die / -1 die" battlefield and stance modifiers are Success dice
 * (combat.shagi..., combat.oslozhneniya...): the combat skill cannot be
 * favoured (kv.mechanics.traits.boevye_umeniya), so they feed bonus/penalty
 * Success dice, never an extra Feat die.
 */

import type { CheckConditions } from "../checks/types.js";
import { targetNumber } from "../checks/targetNumber.js";
import { checkConditions, heroFeatModifier } from "../conditions/derive.js";
import { isUnconscious, loseEndurance } from "../conditions/endurance.js";
import { rollCheckDice } from "../dice/roll.js";
import type { DiceRoll, FeatModifier } from "../dice/types.js";
import type { Rng } from "../rng/rng.js";
import { asObject, fail, intField, paramsOf, strField } from "./parse.js";
import type { CombatConfigs } from "./configs.js";
import type {
  AttackConfig,
  AttackOutcome,
  AttackParams,
  Combatant,
  CombatState,
  EnemyState,
  ModifierTier,
  StanceSpec,
} from "./types.js";

// --- config deriver ---

/** Derive AttackConfig from kv.mechanics.combat.sovershenie_atak. */
export function deriveAttackConfig(raw: unknown): AttackConfig {
  const params = paramsOf(raw, "combat.sovershenie_atak");
  const driven = asObject(params["driven_back"], "driven_back");
  const drivenBackTimesPerRound = intField(driven, "times_per_round", "driven_back");
  const drivenBackHalveRoundUp = strField(driven, "effect", "driven_back") === "halve_endurance_loss_round_up";

  const piercing = asObject(params["piercing_blow"], "piercing_blow");
  const triggers = piercing["trigger_feat_die"];
  if (!Array.isArray(triggers)) fail("piercing_blow.trigger_feat_die: expected array");
  const numbers: number[] = [];
  let eye = false;
  for (const t of triggers) {
    if (typeof t === "number" && Number.isInteger(t)) numbers.push(t);
    else if (t === "eye") eye = true;
    else fail(`piercing_blow.trigger_feat_die: unexpected entry ${JSON.stringify(t)}`);
  }

  return { drivenBackTimesPerRound, drivenBackHalveRoundUp, piercingTriggerFaces: { numbers, eye } };
}

// --- roll evaluation (side-aware) ---

export interface AttackEval {
  readonly hit: boolean;
  readonly autoSuccess: boolean;
  readonly total: number | null;
  readonly successIcons: number;
  readonly piercingTriggered: boolean;
}

export interface AttackEvalOpts {
  readonly side: "hero" | "enemy";
  readonly conditions?: CheckConditions;
  readonly piercingTriggerFaces: AttackConfig["piercingTriggerFaces"];
}

/**
 * Turn a rolled DiceRoll into an attack result against `tn`. Pure; no RNG.
 * Success-die faces in `wearyVoidedFaces` contribute 0 when weary (this is how
 * an enemy with no Hatred/Resolve — counted as weary — rolls).
 */
export function evaluateAttackRoll(roll: DiceRoll, tn: number, opts: AttackEvalOpts): AttackEval {
  const successIcons = roll.successDice.reduce((a, d) => a + (d.isSuccessIcon ? 1 : 0), 0);
  const face = roll.feat.face;

  const weary = opts.conditions?.weary === true;
  if (weary && opts.conditions?.wearyVoidedFaces === undefined) {
    throw new Error("evaluateAttackRoll: weary requires wearyVoidedFaces");
  }
  const voided = opts.conditions?.wearyVoidedFaces ?? [];
  const successSum = roll.successDice.reduce((a, d) => a + (weary && voided.includes(d.face) ? 0 : d.face), 0);

  const triggerMatched =
    (face.kind === "eye" && opts.piercingTriggerFaces.eye) ||
    (face.kind === "number" && opts.piercingTriggerFaces.numbers.includes(face.value));

  // Auto-success face flips by side: rune for heroes, Eye for enemies.
  const autoFaceKind = opts.side === "hero" ? "gandalf_rune" : "eye";

  let hit: boolean;
  let autoSuccess = false;
  let total: number | null = null;

  if (face.kind === autoFaceKind) {
    hit = true;
    autoSuccess = true;
  } else if (opts.side === "hero" && opts.conditions?.miserable === true && face.kind === "eye") {
    // Miserable hero: an Eye forces failure regardless of the sum.
    hit = false;
    total = successSum;
  } else {
    // Numbers contribute their value; the non-auto special face (Eye for hero,
    // rune for enemy) contributes 0.
    const numeric = face.kind === "number" ? face.value : 0;
    total = numeric + successSum;
    hit = total >= tn;
  }

  return { hit, autoSuccess, total, successIcons, piercingTriggered: hit && triggerMatched };
}

// --- full attack resolution ---

function isHero(c: Combatant): c is "hero" {
  return c === "hero";
}

function enemyAt(combat: CombatState, c: Combatant, where: string): { index: number; enemy: EnemyState } {
  if (isHero(c)) fail(`${where}: expected an enemy combatant`);
  const index = c.enemyIndex;
  const enemy = combat.enemies[index];
  if (enemy === undefined) fail(`${where}: no enemy at index ${index}`);
  return { index, enemy };
}

/** Count enemies still engaged and alive (the defensive penalty scales with this). */
function engagedEnemyCount(combat: CombatState): number {
  return combat.enemies.reduce((a, e) => a + (e.engaged && e.alive ? 1 : 0), 0);
}

function tierBonus(tier: ModifierTier | undefined, table: { moderate: number; serious: number }): number {
  if (tier === undefined) return 0;
  return tier === "moderate" ? table.moderate : table.serious;
}

/** Bonus/penalty Success dice from stance + battlefield tiers for this attack. */
function diceMods(
  combat: CombatState,
  params: AttackParams,
  stance: StanceSpec,
  cfgs: CombatConfigs,
): { bonus: number; penalty: number } {
  let bonus = 0;
  let penalty = 0;

  if (isHero(params.attacker)) {
    // Hero's own attack-die modifier from their stance.
    const mod = stance.heroAttackMod;
    if (mod !== undefined) {
      const dice = mod.kind === "per_engaged_enemy" ? mod.dice * engagedEnemyCount(combat) : mod.dice;
      if (dice >= 0) bonus += dice;
      else penalty += -dice;
    }
  } else {
    // Enemy attacking the hero: the hero's stance modifies the enemy's melee attack.
    const mod = stance.enemyMeleeVsHeroMod;
    if (mod !== undefined) {
      if (mod >= 0) bonus += mod;
      else penalty += -mod;
    }
  }

  // Battlefield advantage/complication apply to the acting combatant's check.
  bonus += tierBonus(params.advantage, cfgs.combat.complicationTiers.advantage);
  // complication tier values are negative in the pack (-1 / -2) -> add to penalty.
  penalty += -tierBonus(params.complication, cfgs.combat.complicationTiers.complication);

  return { bonus, penalty };
}

/**
 * Resolve one attack. Returns the outcome, the new combat state (target
 * Endurance applied; enemy destroyed / hero unconscious at 0), and the threaded
 * RNG. The cost of being driven back (spending the next main action to restore
 * stance) is action-economy and is handled by the combat loop, not here.
 */
export function resolveAttack(
  combat: CombatState,
  params: AttackParams,
  cfgs: CombatConfigs,
  rng: Rng,
): readonly [AttackOutcome, CombatState, Rng] {
  const heroAttacking = isHero(params.attacker);
  const heroDefending = isHero(params.target);
  if (heroAttacking === heroDefending) {
    fail("resolveAttack: exactly one of attacker/target must be the hero");
  }

  const { hero, heroFrame } = combat;
  const stance = cfgs.combat.stances[heroFrame.stance];

  // Target number, attacker dice, feat modifier, and conditions per side.
  let tn: number;
  let abilityRating: number;
  let featModifier: FeatModifier;
  let conditions: CheckConditions | undefined;
  let weaponDamage: number;

  if (heroAttacking) {
    const { enemy } = enemyAt(combat, params.target, "resolveAttack.target");
    tn = targetNumber(hero.attributes.strength, cfgs.check) + (enemy.block.parry ?? 0);
    abilityRating = hero.skills[heroFrame.equippedWeapon.group] ?? 0;
    featModifier = heroFeatModifier(hero);
    conditions = checkConditions(hero, cfgs.conditions);
    weaponDamage = heroFrame.equippedWeapon.damage;
  } else {
    const { enemy } = enemyAt(combat, params.attacker, "resolveAttack.attacker");
    const weaponIndex = params.enemyWeaponIndex ?? 0;
    const weapon = enemy.block.weapons[weaponIndex];
    if (weapon === undefined) fail(`resolveAttack: enemy has no weapon at index ${weaponIndex}`);
    tn = heroFrame.parryRating;
    abilityRating = weapon.rating;
    featModifier = "normal"; // enemies have no overwhelmed state
    // An enemy with no Hatred/Resolve counts as weary (format_opisaniya).
    conditions = enemy.pool === 0 ? { weary: true, wearyVoidedFaces: cfgs.conditions.wearyVoidedFaces } : undefined;
    weaponDamage = weapon.damage;
  }

  const { bonus, penalty } = diceMods(combat, params, stance, cfgs);
  const [roll, rng2] = rollCheckDice(
    cfgs.dice,
    { abilityRating, featModifier, bonusSuccessDice: bonus, penaltySuccessDice: penalty },
    rng,
  );

  const evalRes = evaluateAttackRoll(roll, tn, {
    side: heroAttacking ? "hero" : "enemy",
    ...(conditions !== undefined ? { conditions } : {}),
    piercingTriggerFaces: cfgs.attack.piercingTriggerFaces,
  });

  // Endurance loss = weapon Damage on a hit; driven-back halves it (round up).
  let enduranceLoss = evalRes.hit ? weaponDamage : 0;
  let drivenBackApplied = false;
  const canDriveBack =
    !heroAttacking &&
    params.heroDrivenBack === true &&
    cfgs.attack.drivenBackTimesPerRound >= 1 &&
    !heroFrame.drivenBackUsedThisRound;
  if (canDriveBack && enduranceLoss > 0) {
    enduranceLoss = cfgs.attack.drivenBackHalveRoundUp ? Math.ceil(enduranceLoss / 2) : Math.floor(enduranceLoss / 2);
    drivenBackApplied = true;
  }

  // Apply damage to the target and build the new state.
  let nextCombat: CombatState = combat;
  let targetDestroyed = false;
  let heroUnconscious = false;

  if (enduranceLoss > 0) {
    if (heroDefending) {
      const newHero = loseEndurance(hero, enduranceLoss);
      heroUnconscious = isUnconscious(newHero);
      nextCombat = {
        ...combat,
        hero: newHero,
        heroFrame: drivenBackApplied ? { ...heroFrame, drivenBackUsedThisRound: true } : heroFrame,
      };
    } else {
      const { index, enemy } = enemyAt(combat, params.target, "resolveAttack.target");
      const newEndurance = Math.max(0, enemy.endurance - enduranceLoss);
      targetDestroyed = newEndurance === 0;
      const newEnemy: EnemyState = {
        ...enemy,
        endurance: newEndurance,
        alive: !targetDestroyed,
        engaged: targetDestroyed ? false : enemy.engaged,
      };
      const enemies = combat.enemies.map((e, i) => (i === index ? newEnemy : e));
      nextCombat = { ...combat, enemies };
    }
  } else if (drivenBackApplied) {
    // Halved to >0 still counts as used; but with loss 0 there is nothing to halve.
    nextCombat = combat;
  }

  const outcome: AttackOutcome = {
    hit: evalRes.hit,
    autoSuccess: evalRes.autoSuccess,
    total: evalRes.total,
    successIcons: evalRes.successIcons,
    spendableIcons: evalRes.hit ? evalRes.successIcons : 0,
    enduranceLoss,
    piercingTriggered: evalRes.piercingTriggered,
    featFace: roll.feat.face,
    targetDestroyed,
    heroUnconscious,
    drivenBackApplied,
  };

  return [outcome, nextCombat, rng2] as const;
}
