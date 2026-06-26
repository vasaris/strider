/**
 * Progression config, assembled from the verified pack. Mirror of CouncilConfigs
 * / CombatConfigs. Each `deriveX` function is a pure seam: it takes one raw card
 * and reads its numbers out, so the anti-hardcode tests can feed a stub card
 * with different numbers and watch the config follow. `progressionConfigFromPack`
 * then wires them together with `pack.requireById`.
 *
 * Progression reads from several cards, so unlike council (one card) the
 * card-id literals live here (and in the CLI), per the engine invariant. No
 * number below is baked: training costs, milestone awards, caps, the Shadow-Path
 * flaw lists and the Reward/Virtue taxonomies all come from the cards.
 */

import type { Pack } from "../pack/pack.js";
import {
  asArray,
  asObject,
  fail,
  intField,
  objectKeys,
  paramsOf,
  parseValourWisdomCap,
  strArray,
  strField,
} from "./parse.js";
import type {
  ExperienceModel,
  GrantModel,
  MilestoneAward,
  PhaseCaps,
  ProgressionConfig,
  ShadowPathModel,
  TrainingCost,
} from "./types.js";

const EXPERIENCE_CARD = "kv.mechanics.hero_creation.experience";
const STRUKTURA_CARD = "kv.mechanics.fellowship_phase.struktura_fazy_bratstva";
const MILESTONES_CARD = "kv.solo.milestones";
const SHADOW_PATHS_CARD = "kv.mechanics.shadow.ispolzovanie_izyanov";
const NAGRADY_CARD = "kv.mechanics.rewards_virtues.nagrady";
const OSOBENNOSTI_CARD = "kv.mechanics.rewards_virtues.osobennosti";
const SPISOK_NAGRAD_CARD = "kv.mechanics.rewards_virtues.spisok_nagrad";
const SPISOK_OSOBENNOSTEY_CARD = "kv.mechanics.rewards_virtues.spisok_osobennostey";
const KULTURNYE_CARD = "kv.mechanics.rewards_virtues.kulturnye_osobennosti";
const SPISOK_NAVYKOV_CARD = "kv.mechanics.traits.spisok_navykov";
const SPISOK_BOEVYH_CARD = "kv.mechanics.traits.spisok_boevyh_umeniy";

// ---------------------------------------------------------------------------
// Derivers (pure; one card each)
// ---------------------------------------------------------------------------

/** Which pool buys what (hero_creation.experience). */
export function deriveExperienceModel(raw: unknown): ExperienceModel {
  const where = EXPERIENCE_CARD;
  const p = paramsOf(raw, where);
  return {
    skillPointsBuy: strArray(p["skill_points_for"], `${where}.skill_points_for`),
    adventurePointsBuy: strArray(p["adventure_points_for"], `${where}.adventure_points_for`),
  };
}

/** Training-cost rows and per-phase caps (struktura_fazy_bratstva.improve_stats). */
export function deriveTrainingCost(raw: unknown): { readonly trainingCost: TrainingCost; readonly caps: PhaseCaps } {
  const where = `${STRUKTURA_CARD}.improve_stats`;
  const improve = asObject(paramsOf(raw, STRUKTURA_CARD)["improve_stats"], where);
  const tc = asObject(improve["training_cost"], `${where}.training_cost`);
  const rows = asArray(tc["rows"], `${where}.training_cost.rows`);

  const skillByNewLevel: Record<number, number> = {};
  const valourWisdomByNewLevel: Record<number, number> = {};
  rows.forEach((row, i) => {
    const r = asObject(row, `${where}.training_cost.rows[${i}]`);
    const cost = intField(r, "cost", `${where}.training_cost.rows[${i}]`);
    const sl = r["new_skill_or_weapon_skill_level"];
    const vl = r["new_valour_or_wisdom_level"];
    if (typeof sl === "number" && Number.isInteger(sl)) skillByNewLevel[sl] = cost;
    if (typeof vl === "number" && Number.isInteger(vl)) valourWisdomByNewLevel[vl] = cost;
  });
  if (Object.keys(skillByNewLevel).length === 0) fail(`${where}.training_cost: no skill levels`);
  if (Object.keys(valourWisdomByNewLevel).length === 0) fail(`${where}.training_cost: no valour/wisdom levels`);

  const skills = asObject(improve["skills"], `${where}.skills`);
  const growth = asObject(improve["growth"], `${where}.growth`);
  const caps: PhaseCaps = {
    maxLevelsPerSkill: intField(skills, "max_per_skill_per_phase", `${where}.skills`),
    maxLevelsPerWeaponSkill: intField(growth, "max_per_weapon_skill_per_phase", `${where}.growth`),
    valourOrWisdomPerPhase: parseValourWisdomCap(
      growth["valour_or_wisdom_per_phase"],
      `${where}.growth.valour_or_wisdom_per_phase`,
    ),
  };
  return { trainingCost: { skillByNewLevel, valourWisdomByNewLevel }, caps };
}

/** Solo milestone awards (kv.solo.milestones; a lookup_table, so payload.rows). */
export function deriveMilestones(raw: unknown): readonly MilestoneAward[] {
  const where = MILESTONES_CARD;
  const payload = asObject(asObject(raw, where)["payload"], `${where}.payload`);
  const rows = asArray(payload["rows"], `${where}.payload.rows`);
  return rows.map((row, i) => {
    const r = asObject(row, `${where}.rows[${i}]`);
    return {
      milestone: strField(r, "milestone", `${where}.rows[${i}]`),
      adventurePoints: intField(r, "adventure_points", `${where}.rows[${i}]`),
      skillPoints: intField(r, "skill_points", `${where}.rows[${i}]`),
    };
  });
}

/** Shadow-Path flaw lists and the succumb threshold (ispolzovanie_izyanov). */
export function deriveShadowPaths(raw: unknown): { readonly pathFlaws: Readonly<Record<string, readonly string[]>>; readonly succumbAfterFlaws: number } {
  const where = SHADOW_PATHS_CARD;
  const p = paramsOf(raw, where);
  const paths = asObject(p["shadow_paths"], `${where}.shadow_paths`);
  const pathFlaws: Record<string, readonly string[]> = {};
  let flawCount = 0;
  for (const key of Object.keys(paths)) {
    const path = asObject(paths[key], `${where}.shadow_paths.${key}`);
    const flaws = strArray(path["flaws"], `${where}.shadow_paths.${key}.flaws`);
    pathFlaws[key] = flaws;
    flawCount = Math.max(flawCount, flaws.length);
  }
  // Succumbing happens once all flaws of a path are gained (the card describes
  // four-flaw paths); read the threshold off the data rather than baking 4.
  const succumbing = asObject(p["succumbing"], `${where}.succumbing`);
  const condition = succumbing["condition"];
  if (condition !== "all_four_flaws_gained") fail(`${where}.succumbing.condition: unexpected ${JSON.stringify(condition)}`);
  return { pathFlaws, succumbAfterFlaws: flawCount };
}

/** The grant rule: which raise grants a Reward vs a Virtue, and the cultural gate. */
export function deriveGrantRule(
  rawNagrady: unknown,
  rawOsobennosti: unknown,
  rawKulturnye: unknown,
): { readonly rewardGainPer: string; readonly virtueGainPer: string; readonly culturalMinWisdomLevel: number } {
  const nagrady = paramsOf(rawNagrady, NAGRADY_CARD);
  const osobennosti = paramsOf(rawOsobennosti, OSOBENNOSTI_CARD);
  const kulturnye = paramsOf(rawKulturnye, KULTURNYE_CARD);
  return {
    rewardGainPer: strField(nagrady, "gain_per", NAGRADY_CARD),
    virtueGainPer: strField(osobennosti, "gain_per", OSOBENNOSTI_CARD),
    culturalMinWisdomLevel: intField(kulturnye, "min_wisdom_level", KULTURNYE_CARD),
  };
}

/** Reward taxonomy keys (spisok_nagrad.rewards). */
export function deriveRewardKeys(raw: unknown): readonly string[] {
  return objectKeys(paramsOf(raw, SPISOK_NAGRAD_CARD)["rewards"], `${SPISOK_NAGRAD_CARD}.rewards`);
}

/** Regular Virtue taxonomy keys (spisok_osobennostey.virtues). */
export function deriveVirtueKeys(raw: unknown): readonly string[] {
  return objectKeys(paramsOf(raw, SPISOK_OSOBENNOSTEY_CARD)["virtues"], `${SPISOK_OSOBENNOSTEY_CARD}.virtues`);
}

/** Skill ids (traits.spisok_navykov.skills). */
export function deriveSkillIds(raw: unknown): readonly string[] {
  return objectKeys(paramsOf(raw, SPISOK_NAVYKOV_CARD)["skills"], `${SPISOK_NAVYKOV_CARD}.skills`);
}

/** Weapon-skill ids (traits.spisok_boevyh_umeniy.weapon_skills). */
export function deriveWeaponSkillIds(raw: unknown): readonly string[] {
  return objectKeys(paramsOf(raw, SPISOK_BOEVYH_CARD)["weapon_skills"], `${SPISOK_BOEVYH_CARD}.weapon_skills`);
}

// ---------------------------------------------------------------------------
// Pack assembly
// ---------------------------------------------------------------------------

/** calling_id -> shadow_path, scanned from every calling card in the pack. */
function deriveCallingToPath(pack: Pack): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const entry of pack.listByType("rule_card")) {
    const payload = (entry.raw as { payload?: { parameters?: Record<string, unknown> } }).payload;
    const params = payload?.parameters;
    if (!params) continue;
    const callingId = params["calling_id"];
    const shadowPath = params["shadow_path"];
    if (typeof callingId === "string" && typeof shadowPath === "string") {
      out[callingId] = shadowPath;
    }
  }
  if (Object.keys(out).length === 0) fail("no calling cards with calling_id + shadow_path");
  return out;
}

/** culture_id -> cultural virtue keys, scanned from every culture-virtue card. */
function deriveCulturalVirtueKeys(pack: Pack): Readonly<Record<string, readonly string[]>> {
  const out: Record<string, readonly string[]> = {};
  for (const entry of pack.listByType("rule_card")) {
    const payload = (entry.raw as { payload?: { parameters?: Record<string, unknown> } }).payload;
    const params = payload?.parameters;
    if (!params) continue;
    const cultureId = params["culture_id"];
    const cultural = params["cultural_virtues"];
    if (typeof cultureId === "string" && typeof cultural === "object" && cultural !== null) {
      out[cultureId] = Object.keys(cultural as Record<string, unknown>);
    }
  }
  return out;
}

export function progressionConfigFromPack(pack: Pack): ProgressionConfig {
  const { trainingCost, caps } = deriveTrainingCost(pack.requireById(STRUKTURA_CARD).raw);
  const { pathFlaws, succumbAfterFlaws } = deriveShadowPaths(pack.requireById(SHADOW_PATHS_CARD).raw);
  const grantRule = deriveGrantRule(
    pack.requireById(NAGRADY_CARD).raw,
    pack.requireById(OSOBENNOSTI_CARD).raw,
    pack.requireById(KULTURNYE_CARD).raw,
  );

  const shadowPath: ShadowPathModel = {
    callingToPath: deriveCallingToPath(pack),
    pathFlaws,
    succumbAfterFlaws,
  };

  const grants: GrantModel = {
    rewardKeys: deriveRewardKeys(pack.requireById(SPISOK_NAGRAD_CARD).raw),
    virtueKeys: deriveVirtueKeys(pack.requireById(SPISOK_OSOBENNOSTEY_CARD).raw),
    culturalVirtueKeysByCulture: deriveCulturalVirtueKeys(pack),
    culturalMinWisdomLevel: grantRule.culturalMinWisdomLevel,
    rewardGainPer: grantRule.rewardGainPer,
    virtueGainPer: grantRule.virtueGainPer,
  };

  return {
    experience: deriveExperienceModel(pack.requireById(EXPERIENCE_CARD).raw),
    trainingCost,
    caps,
    milestones: deriveMilestones(pack.requireById(MILESTONES_CARD).raw),
    shadowPath,
    grants,
    validSkills: deriveSkillIds(pack.requireById(SPISOK_NAVYKOV_CARD).raw),
    validWeaponSkills: deriveWeaponSkillIds(pack.requireById(SPISOK_BOEVYH_CARD).raw),
  };
}
