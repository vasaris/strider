/**
 * Wounds (Tact 3): Injuries, their severity, first aid, the dying crisis, and
 * the Piercing protection roll (kv.mechanics.combat.raneniya +
 * kv.mechanics.combat.sovershenie_atak.piercing_blow).
 *
 * A wound's authoritative state is persistent on HeroState (it outlives the
 * fight: the Injury mark slows Rest recovery, serious wounds carry healing
 * days, a dying hero needs rescue within ~1h). The combat layer computes the
 * transitions here and writes them onto HeroState; conditions/Rest reads them.
 *
 * Every number (healing reduction, the +days on a marked dying rescue, the
 * revive Endurance) is read from the verified pack — none is baked here. The
 * severity-per-face table is structural (rune -> light, a number -> serious with
 * days = that number, the Eye -> terrible), not a book literal.
 *
 * The Piercing protection roll is a side-aware check, so it reuses the combat
 * evaluator that already owns the Feat-die inversion (hero: rune protects, Eye
 * is 0; enemy: inverted) rather than duplicating that logic.
 */

import type { CheckConditions } from "../checks/types.js";
import type { DiceConfig } from "../dice/config.js";
import { rollCheckDice } from "../dice/roll.js";
import type { FeatDieFace } from "../dice/types.js";
import type { HeroState, WoundSeverity, WoundState } from "../hero/state.js";
import type { Rng } from "../rng/rng.js";
import { evaluateAttackRoll } from "./attack.js";
import { asObject, fail, intField, paramsOf, strField } from "./parse.js";
import type { WoundConfig } from "./types.js";

// --- config deriver ---

/** Derive WoundConfig from kv.mechanics.combat.raneniya. */
export function deriveWoundConfig(raw: unknown): WoundConfig {
  const params = paramsOf(raw, "combat.raneniya");

  const severity = asObject(params["wound_severity"], "wound_severity");
  const byFace = asObject(severity["by_feat_die"], "wound_severity.by_feat_die");
  const light = asObject(byFace["gandalf_rune"], "wound_severity.gandalf_rune");
  const serious = asObject(byFace["1-10"], "wound_severity.1-10");
  const terrible = asObject(byFace["eye"], "wound_severity.eye");
  const severityNameRu: Record<WoundSeverity, string> = {
    light: strField(light, "name_ru", "wound_severity.gandalf_rune"),
    serious: strField(serious, "name_ru", "wound_severity.1-10"),
    terrible: strField(terrible, "name_ru", "wound_severity.eye"),
  };

  const aid = asObject(params["first_aid"], "first_aid");
  const firstAidConfig = {
    reduceDaysBase: intField(aid, "reduces_severity_days", "first_aid"),
    perSuccessSign: intField(aid, "per_success_sign", "first_aid"),
    minDays: intField(aid, "min_days", "first_aid"),
    retryAfterDaysOnFail: intField(aid, "retry_after_days_on_fail", "first_aid"),
  };

  const dyingRaw = asObject(params["dying"], "dying");
  const addDays = intField(dyingRaw, "if_wound_marked_add_recovery_days", "dying");
  const rescue = asObject(dyingRaw["rescue"], "dying.rescue");
  // The revive Endurance is encoded in the rescue string, e.g.
  // "revive_in_1h_with_1_endurance"; parse the magnitude, never bake it.
  const onSuccess = strField(rescue, "on_success", "dying.rescue");
  const reviveMatch = onSuccess.match(/with_(\d+)_endurance/);
  const reviveEndurance = reviveMatch
    ? Number(reviveMatch[1])
    : fail("dying.rescue.on_success: cannot read revive Endurance magnitude");

  return {
    severityNameRu,
    firstAid: firstAidConfig,
    dying: { addRecoveryDaysIfMarked: addDays, reviveEndurance },
  };
}

// --- severity roll ---

export interface WoundRollResult {
  readonly severity: WoundSeverity;
  /** Outstanding recovery days (serious: the Feat result; light/terrible: 0). */
  readonly healingDays: number;
  /** Terrible wounds drop the hero straight into the dying crisis. */
  readonly dying: boolean;
}

/**
 * Map a Feat face to a wound severity (pure): the rune is a Light wound, the Eye
 * a Terrible one (dying), any number a Serious wound whose healing days equal the
 * rolled value. Conditions do NOT apply — this is a table lookup, not a check.
 */
export function severityForFace(face: FeatDieFace): WoundRollResult {
  if (face.kind === "gandalf_rune") return { severity: "light", healingDays: 0, dying: false };
  if (face.kind === "eye") return { severity: "terrible", healingDays: 0, dying: true };
  return { severity: "serious", healingDays: face.value, dying: false };
}

/**
 * Roll one Feat die against the severity table. A pure feat-die roll: the
 * Success-dice count is 0, so only the Feat face matters.
 */
export function rollWoundSeverity(diceCfg: DiceConfig, rng: Rng): readonly [WoundRollResult, Rng] {
  const [roll, rng2] = rollCheckDice(
    diceCfg,
    { abilityRating: 0, featModifier: "normal", bonusSuccessDice: 0, penaltySuccessDice: 0 },
    rng,
  );
  return [severityForFace(roll.feat.face), rng2] as const;
}

// --- applying wounds to the hero ---

/** What happened when a wound landed (for transcripts / the combat loop). */
export type WoundEvent =
  | { readonly kind: "first_wound"; readonly severity: WoundSeverity; readonly healingDays: number; readonly dying: boolean }
  | { readonly kind: "second_wound" };

/** Apply a rolled first wound: place the mark, record detail, terrible -> dying. */
export function applyFirstWound(hero: HeroState, roll: WoundRollResult): HeroState {
  const wound: WoundState = { severity: roll.severity, healingDays: roll.healingDays, marked: true };
  if (roll.dying) {
    return { ...hero, wounded: true, wound, dying: true, endurance: { ...hero.endurance, current: 0 } };
  }
  return { ...hero, wounded: true, wound };
}

/**
 * Apply a second wound: lose all Endurance and start dying. No new mark, no
 * severity roll (raneniya). The hero must already be marked.
 */
export function applySecondWound(hero: HeroState): HeroState {
  return { ...hero, dying: true, endurance: { ...hero.endurance, current: 0 } };
}

/**
 * Route a wound the hero just received: an already-marked hero takes a second
 * wound (no roll); otherwise roll severity for the first wound.
 */
export function takeWound(
  hero: HeroState,
  diceCfg: DiceConfig,
  rng: Rng,
): readonly [HeroState, WoundEvent, Rng] {
  if (hero.wounded) {
    return [applySecondWound(hero), { kind: "second_wound" }, rng] as const;
  }
  const [roll, rng2] = rollWoundSeverity(diceCfg, rng);
  const event: WoundEvent = {
    kind: "first_wound",
    severity: roll.severity,
    healingDays: roll.healingDays,
    dying: roll.dying,
  };
  return [applyFirstWound(hero, roll), event, rng2] as const;
}

// --- first aid + dying rescue + post-combat cleanup ---

/**
 * Apply a SUCCESSFUL first-aid HEALING check to an injury: cut the outstanding
 * days by the base amount plus one per success sign, floored at the minimum.
 * The caller owns the once-per-wound and retry-after-fail gating (temporal
 * policy). A wound with no outstanding days (light) is returned unchanged.
 */
export function firstAid(wound: WoundState, successSigns: number, cfg: WoundConfig): WoundState {
  if (wound.healingDays <= 0) return wound;
  const reduce = cfg.firstAid.reduceDaysBase + cfg.firstAid.perSuccessSign * successSigns;
  const days = Math.max(cfg.firstAid.minDays, wound.healingDays - reduce);
  return { ...wound, healingDays: days };
}

/**
 * Resolve a dying hero's rescue. On a successful HEALING check the hero revives
 * with the configured Endurance; a marked wound adds the configured recovery
 * days and the survived Injury leaves one permanent mark. On failure the hero
 * dies. The HEALING check itself is rolled by the caller (within ~1h).
 */
export function dyingRescue(hero: HeroState, success: boolean, cfg: WoundConfig): HeroState {
  if (!success) {
    return { ...hero, dead: true, dying: false };
  }
  const wound =
    hero.wound !== null && hero.wound.marked
      ? { ...hero.wound, healingDays: hero.wound.healingDays + cfg.dying.addRecoveryDaysIfMarked }
      : hero.wound;
  return {
    ...hero,
    dying: false,
    dead: false,
    endurance: { ...hero.endurance, current: cfg.dying.reviveEndurance },
    permanentInjuryMarks: hero.permanentInjuryMarks + 1,
    wound,
  };
}

/**
 * Clear a light wound's mark once the fight ends (light wounds recover in hours,
 * raneniya). A hook for the combat-end step (Tact 5); other severities persist.
 */
export function clearLightWoundAfterCombat(hero: HeroState): HeroState {
  if (hero.wound !== null && hero.wound.severity === "light") {
    return { ...hero, wounded: false, wound: null };
  }
  return hero;
}

// --- piercing protection roll ---

export interface PiercingResult {
  /** The protection check met or beat the injury TN -> no wound. */
  readonly passed: boolean;
  readonly woundTriggered: boolean;
  readonly total: number | null; // null on an auto-success protection
  readonly tn: number; // the attacker's weapon injury rating
}

/**
 * Resolve a Piercing blow against a defender: roll 1 Feat die plus Success dice
 * equal to the defender's armour PROTECTION rating, against a TN equal to the
 * attacker's weapon injury rating; failing means a wound. The Feat die is read
 * per the DEFENDER's side (hero: rune protects, Eye is 0; enemy: inverted).
 *
 * If the same blow made the hero weary, the caller must pass the PRE-blow
 * conditions (protection_roll_before_weariness_applied).
 */
export function resolvePiercing(
  defenderSide: "hero" | "enemy",
  armourProtectionDice: number,
  injuryTn: number,
  conditions: CheckConditions | undefined,
  diceCfg: DiceConfig,
  rng: Rng,
): readonly [PiercingResult, Rng] {
  if (armourProtectionDice < 0) fail("resolvePiercing: armour protection cannot be negative");
  const [roll, rng2] = rollCheckDice(
    diceCfg,
    { abilityRating: armourProtectionDice, featModifier: "normal", bonusSuccessDice: 0, penaltySuccessDice: 0 },
    rng,
  );
  const evalRes = evaluateAttackRoll(roll, injuryTn, {
    side: defenderSide,
    ...(conditions !== undefined ? { conditions } : {}),
    piercingTriggerFaces: { numbers: [], eye: false },
  });
  const passed = evalRes.hit;
  return [{ passed, woundTriggered: !passed, total: evalRes.total, tn: injuryTn }, rng2] as const;
}
