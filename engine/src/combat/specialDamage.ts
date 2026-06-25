/**
 * Hero special damage (Tact 3, kv.mechanics.combat.sovershenie_atak.special_
 * damage): spending success signs from a hit for extra effects. A PURE
 * calculator — it computes the effects as data and never touches RNG or state.
 * The combat loop (Tact 5) applies the extra Endurance loss to the target and
 * the round-local buffs (parry, the target's -1 die); resolving a Piercing blow
 * caused by Pierce is the wounds module's job.
 *
 * Enemy special damage (format_opisaniya.special_damage) is opaque, keeper /
 * oracle adjudicated, and is NOT modelled here (Tact 4).
 *
 * Numbers come from the pack. The Shield Thrust "-1 die" magnitude is encoded in
 * a key name (target_minus_1d_until_round_end), so it is parsed from that key
 * rather than baked.
 */

import { asObject, fail, intField, paramsOf } from "./parse.js";
import type { AttackConfig, SpecialDamageConfig, WeaponGroup } from "./types.js";

// --- config deriver ---

function numberRecord(v: unknown, where: string): Record<string, number> {
  const obj = asObject(v, where);
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(obj)) {
    if (typeof val !== "number" || !Number.isInteger(val)) fail(`${where}.${k}: expected an integer`);
    out[k] = val;
  }
  return out;
}

/** Derive SpecialDamageConfig from kv.mechanics.combat.sovershenie_atak. */
export function deriveSpecialDamageConfig(raw: unknown): SpecialDamageConfig {
  const params = paramsOf(raw, "combat.sovershenie_atak");
  const sd = asObject(params["special_damage"], "special_damage");
  const effects = asObject(sd["effects"], "special_damage.effects");

  const heavy = asObject(asObject(effects["heavy_blow"], "heavy_blow")["effect"], "heavy_blow.effect");
  const twoHandedBonus = intField(heavy, "two_handed_bonus", "heavy_blow.effect");

  const fend = asObject(asObject(effects["fend_off"], "fend_off")["effect"], "fend_off.effect");
  const parryByGroup = numberRecord(fend["parry_modifier_this_round"], "fend_off.parry_modifier_this_round");

  const pierceEffect = asObject(asObject(effects["pierce"], "pierce")["effect"], "pierce.effect");
  const featBonusByGroup = numberRecord(pierceEffect["feat_die_result_bonus"], "pierce.feat_die_result_bonus");
  const cap = intField(pierceEffect, "cap", "pierce.effect");

  const shield = asObject(asObject(effects["shield_thrust"], "shield_thrust")["effect"], "shield_thrust.effect");
  const shieldKey = Object.keys(shield).find((k) => /minus_\d+d/.test(k));
  if (shieldKey === undefined) fail("shield_thrust.effect: cannot find a target_minus_Nd key");
  const minusMatch = shieldKey.match(/minus_(\d+)d/);
  const targetMinusDice = minusMatch ? Number(minusMatch[1]) : fail("shield_thrust: cannot read -N dice magnitude");

  return {
    heavyBlow: { twoHandedBonus },
    fendOff: { parryByGroup },
    pierce: { featBonusByGroup, cap },
    shieldThrust: { targetMinusDice },
  };
}

// --- the calculator ---

/** What the player chose to spend success signs on. */
export interface SpecialDamageSpends {
  readonly heavyBlow?: number; // times (each costs one sign)
  readonly fendOff?: boolean;
  readonly pierce?: boolean;
  readonly shieldThrust?: boolean;
}

/** Everything the calculator needs about this attack and the combatants. */
export interface SpecialDamageContext {
  readonly weaponGroup: WeaponGroup;
  readonly twoHanded: boolean;
  readonly strengthRating: number;
  readonly hasShield: boolean;
  /** Numeric value of the attack's Feat face; null for the rune (no numeric base). */
  readonly baseFeatNumber: number | null;
  readonly targetAttributeLevel: number; // for the Shield Thrust condition
  readonly availableIcons: number; // success signs available to spend
  readonly piercingTriggerFaces: AttackConfig["piercingTriggerFaces"];
}

export interface SpecialDamageResult {
  readonly signsSpent: number;
  readonly extraEnduranceLoss: number; // from Heavy Blow
  readonly parryBonusThisRound: number; // from Fend Off
  /** The Feat result after Pierce (capped); null when there was no numeric base. */
  readonly featResultAfterPierce: number | null;
  readonly piercingNowTriggered: boolean; // Pierce raised the result onto a trigger face
  readonly shieldThrustApplied: boolean; // target loses one die until round end
  /** Spends that could not be applied (wrong weapon group / no budget / condition unmet). */
  readonly rejected: readonly string[];
}

/**
 * Resolve the chosen special-damage spends into effect data. Pure: no RNG, no
 * state. Spends are processed in a fixed order (heavy blow, fend off, pierce,
 * shield thrust); any spend that is ineligible or exceeds the sign budget is
 * recorded in `rejected` and skipped.
 */
export function applySpecialDamage(
  spends: SpecialDamageSpends,
  ctx: SpecialDamageContext,
  cfg: SpecialDamageConfig,
): SpecialDamageResult {
  let signsSpent = 0;
  let extraEnduranceLoss = 0;
  let parryBonusThisRound = 0;
  let featResultAfterPierce = ctx.baseFeatNumber;
  let piercingNowTriggered = false;
  let shieldThrustApplied = false;
  const rejected: string[] = [];

  const budgetLeft = (): number => ctx.availableIcons - signsSpent;

  // Heavy Blow — any weapon; may be spent multiple times.
  const heavyTimes = spends.heavyBlow ?? 0;
  for (let i = 0; i < heavyTimes; i++) {
    if (budgetLeft() < 1) {
      rejected.push("heavy_blow: not enough success signs");
      break;
    }
    extraEnduranceLoss += ctx.strengthRating + (ctx.twoHanded ? cfg.heavyBlow.twoHandedBonus : 0);
    signsSpent += 1;
  }

  // Fend Off — any melee weapon (the parry table omits bows).
  if (spends.fendOff === true) {
    const bonus = cfg.fendOff.parryByGroup[ctx.weaponGroup];
    if (bonus === undefined) {
      rejected.push("fend_off: weapon group not eligible");
    } else if (budgetLeft() < 1) {
      rejected.push("fend_off: not enough success signs");
    } else {
      parryBonusThisRound += bonus;
      signsSpent += 1;
    }
  }

  // Pierce — bows / spears / swords; raises the numeric Feat result (capped) and
  // may push it onto a Piercing trigger face.
  if (spends.pierce === true) {
    const bonus = cfg.pierce.featBonusByGroup[ctx.weaponGroup];
    if (bonus === undefined) {
      rejected.push("pierce: weapon group not eligible");
    } else if (budgetLeft() < 1) {
      rejected.push("pierce: not enough success signs");
    } else {
      signsSpent += 1;
      if (ctx.baseFeatNumber !== null) {
        const raised = Math.min(cfg.pierce.cap, ctx.baseFeatNumber + bonus);
        featResultAfterPierce = raised;
        if (ctx.piercingTriggerFaces.numbers.includes(raised)) piercingNowTriggered = true;
      }
      // baseFeatNumber === null (the rune): no numeric base to raise; the rune is
      // already an automatic success, so Pierce cannot create a Piercing blow.
    }
  }

  // Shield Thrust — shields; needs a shield and STRENGTH above the target's level.
  if (spends.shieldThrust === true) {
    if (!ctx.hasShield) {
      rejected.push("shield_thrust: no shield equipped");
    } else if (!(ctx.strengthRating > ctx.targetAttributeLevel)) {
      rejected.push("shield_thrust: STRENGTH not above target level");
    } else if (budgetLeft() < 1) {
      rejected.push("shield_thrust: not enough success signs");
    } else {
      shieldThrustApplied = true;
      signsSpent += 1;
    }
  }

  return {
    signsSpent,
    extraEnduranceLoss,
    parryBonusThisRound,
    featResultAfterPierce,
    piercingNowTriggered,
    shieldThrustApplied,
    rejected,
  };
}
