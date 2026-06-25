/**
 * The full attack pipeline (Tact 5): one call that ties the four Tact 2-4 pieces
 * the combat loop needs in sequence -- resolveAttack -> hero special damage ->
 * Piercing protection roll -> Wound -- into a single result with the threaded
 * RNG and the post-attack state. This is where Debt #3 is paid: the pure
 * applySpecialDamage outputs (extra Endurance loss, the Fend Off parry buff, the
 * Shield Thrust debuff) are applied to state here, not inside the calculators.
 *
 * Hero special damage applies only when the hero attacks (enemy special damage
 * is opaque, Tact 4). The Piercing roll reads the DEFENDER's pre-blow conditions
 * (protection_roll_before_weariness_applied): for a hero defender we evaluate
 * conditions on the hero as they were BEFORE this blow's Endurance loss.
 */

import { isUnconscious } from "../conditions/endurance.js";
import { checkConditions } from "../conditions/derive.js";
import type { CheckConditions } from "../checks/types.js";
import type { Rng } from "../rng/rng.js";
import { applyEnemyWound, enemyIsWeary } from "./adversary.js";
import { resolveAttack } from "./attack.js";
import type { CombatConfigs } from "./configs.js";
import { fail } from "./parse.js";
import { applySpecialDamage } from "./specialDamage.js";
import type { SpecialDamageContext, SpecialDamageResult, SpecialDamageSpends } from "./specialDamage.js";
import type { AttackOutcome, AttackParams, CombatState, EnemyState } from "./types.js";
import { resolvePiercing, takeWound } from "./wounds.js";
import type { EnemyWoundEvent } from "./adversary.js";
import type { PiercingResult, WoundEvent } from "./wounds.js";

/** The combined outcome of one attack run through the full pipeline. */
export interface FullAttackResult {
  readonly base: AttackOutcome;
  /** Present only for a hero attack that hit and chose special-damage spends. */
  readonly special?: SpecialDamageResult;
  /** Present only when a Piercing blow was triggered and a protection roll happened. */
  readonly piercing?: PiercingResult;
  /** Present only when the protection roll failed and a Wound landed. */
  readonly wound?: WoundEvent | EnemyWoundEvent;
  /** True once the attack (base + special) reduced the enemy target to 0 Endurance. */
  readonly enemyTakenOut: boolean;
}

function setEnemy(state: CombatState, index: number, enemy: EnemyState): CombatState {
  return { ...state, enemies: state.enemies.map((e, i) => (i === index ? enemy : e)) };
}

function requireEnemyIndex(params: AttackParams, side: "attacker" | "target"): number {
  const c = params[side];
  if (c === "hero") fail(`resolveFullAttack: expected an enemy as ${side}`);
  return c.enemyIndex;
}

/** Apply the pure hero-special-damage outputs to combat state (Debt #3). */
function applyHeroSpecial(
  state: CombatState,
  targetIndex: number,
  special: SpecialDamageResult,
  cfgs: CombatConfigs,
): readonly [CombatState, boolean] {
  let next = state;
  let takenOut = false;

  // Extra Endurance loss (Heavy Blow) lands on the target enemy; 0 takes it out
  // (engaged=false, alive stays true -- after_battle decides survival).
  if (special.extraEnduranceLoss > 0) {
    const enemy = next.enemies[targetIndex];
    if (enemy === undefined) fail(`applyHeroSpecial: no enemy at ${targetIndex}`);
    const newEndurance = Math.max(0, enemy.endurance - special.extraEnduranceLoss);
    takenOut = newEndurance === 0;
    next = setEnemy(next, targetIndex, {
      ...enemy,
      endurance: newEndurance,
      engaged: takenOut ? false : enemy.engaged,
    });
  }

  // Fend Off raises the hero's PARRY for the rest of the round (round-local).
  if (special.parryBonusThisRound > 0) {
    next = {
      ...next,
      heroFrame: { ...next.heroFrame, parryBonusThisRound: next.heroFrame.parryBonusThisRound + special.parryBonusThisRound },
    };
  }

  // Shield Thrust pushes the target down one (config) Success die until round end.
  if (special.shieldThrustApplied) {
    const enemy = next.enemies[targetIndex];
    if (enemy === undefined) fail(`applyHeroSpecial: no enemy at ${targetIndex}`);
    next = setEnemy(next, targetIndex, {
      ...enemy,
      attackDiceModUntilRoundEnd: enemy.attackDiceModUntilRoundEnd - cfgs.specialDamage.shieldThrust.targetMinusDice,
    });
  }

  return [next, takenOut] as const;
}

/**
 * Resolve one attack end to end. `spends` are the hero's chosen special-damage
 * signs (ignored for enemy attacks and for a miss). Returns the combined result,
 * the new combat state, and the threaded RNG.
 */
export function resolveFullAttack(
  combat: CombatState,
  params: AttackParams,
  spends: SpecialDamageSpends | undefined,
  cfgs: CombatConfigs,
  rng: Rng,
): readonly [FullAttackResult, CombatState, Rng] {
  const heroAttacking = params.attacker === "hero";
  const preBlowHero = combat.hero; // pre-blow conditions for a hero-defender protection roll

  const [base, afterBase, rngA] = resolveAttack(combat, params, cfgs, rng);
  let state = afterBase;
  let rngCur = rngA;
  let special: SpecialDamageResult | undefined;
  let piercing: PiercingResult | undefined;
  let wound: WoundEvent | EnemyWoundEvent | undefined;
  let enemyTakenOut = base.targetTakenOut;

  if (heroAttacking) {
    const targetIndex = requireEnemyIndex(params, "target");

    // --- hero special damage (only on a hit with chosen spends) ---
    if (base.hit && spends !== undefined) {
      const enemy = state.enemies[targetIndex];
      if (enemy === undefined) fail(`resolveFullAttack: no enemy at ${targetIndex}`);
      const ctx: SpecialDamageContext = {
        weaponGroup: combat.heroFrame.equippedWeapon.group,
        twoHanded: combat.heroFrame.equippedWeapon.twoHanded ?? false,
        strengthRating: combat.hero.attributes.strength,
        hasShield: combat.heroFrame.hasShield ?? false,
        baseFeatNumber: base.featFace.kind === "number" ? base.featFace.value : null,
        targetAttributeLevel: enemy.block.level,
        availableIcons: base.spendableIcons,
        piercingTriggerFaces: cfgs.attack.piercingTriggerFaces,
      };
      special = applySpecialDamage(spends, ctx, cfgs.specialDamage);
      const [withSpecial, extraTookOut] = applyHeroSpecial(state, targetIndex, special, cfgs);
      state = withSpecial;
      enemyTakenOut = enemyTakenOut || extraTookOut;
    }

    // --- Piercing -> Wound on the enemy ---
    const piercingTriggered = base.piercingTriggered || (special?.piercingNowTriggered ?? false);
    if (piercingTriggered) {
      const enemy = state.enemies[targetIndex];
      if (enemy === undefined) fail(`resolveFullAttack: no enemy at ${targetIndex}`);
      if (enemy.alive) {
        const injuryTn = combat.heroFrame.equippedWeapon.injury;
        const conditions: CheckConditions | undefined = enemyIsWeary(enemy)
          ? { weary: true, wearyVoidedFaces: cfgs.conditions.wearyVoidedFaces }
          : undefined;
        const [pres, rngP] = resolvePiercing("enemy", enemy.block.armour, injuryTn, conditions, cfgs.dice, rngCur);
        rngCur = rngP;
        piercing = pres;
        if (pres.woundTriggered) {
          const [newEnemy, ev] = applyEnemyWound(enemy);
          wound = ev;
          state = setEnemy(state, targetIndex, newEnemy);
        }
      }
    }
  } else {
    // --- enemy attacking the hero: no hero special damage ---
    const attackerIndex = requireEnemyIndex(params, "attacker");
    const attacker = combat.enemies[attackerIndex];
    if (attacker === undefined) fail(`resolveFullAttack: no enemy at ${attackerIndex}`);

    if (base.piercingTriggered && !state.hero.dead) {
      const weaponIndex = params.enemyWeaponIndex ?? 0;
      const weapon = attacker.block.weapons[weaponIndex];
      if (weapon === undefined) fail(`resolveFullAttack: enemy has no weapon at ${weaponIndex}`);
      // Protection uses the hero's conditions BEFORE this blow's Endurance loss.
      const conditions = checkConditions(preBlowHero, cfgs.conditions);
      const [pres, rngP] = resolvePiercing(
        "hero",
        combat.heroFrame.armourProtection,
        weapon.wound,
        conditions,
        cfgs.dice,
        rngCur,
      );
      rngCur = rngP;
      piercing = pres;
      if (pres.woundTriggered) {
        const [newHero, ev, rngW] = takeWound(state.hero, cfgs.dice, rngCur);
        rngCur = rngW;
        wound = ev;
        state = { ...state, hero: newHero };
      }
    }
  }

  const result: FullAttackResult = {
    base,
    ...(special !== undefined ? { special } : {}),
    ...(piercing !== undefined ? { piercing } : {}),
    ...(wound !== undefined ? { wound } : {}),
    enemyTakenOut,
  };
  return [result, state, rngCur] as const;
}

/** True once the hero can no longer act (unconscious at 0 Endurance, dying, or dead). */
export function heroIsDown(state: CombatState): boolean {
  return isUnconscious(state.hero) || state.hero.dying || state.hero.dead;
}
