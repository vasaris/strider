/**
 * Derive the CombatConfig from the verified rule cards. Every number and key is
 * read from the pack; nothing is baked. The four core tasks come from
 * combat.boevye_zadachi; the solo Advance task (prodvinutsya) is merged from its
 * own overlay card (kept separate per the overlay principle). The wider manoeuvre
 * MODE (ranged-only fighting, enemy/hero -1d, the special exit) is still carried
 * in prose and awaits its own combat-frame beat.
 */

import { asArray, asObject, boolField, fail, intField, paramsOf, strArray, strField } from "./parse.js";
import type {
  ActionEconomy,
  CombatConfig,
  CombatTaskKey,
  CombatTaskSpec,
  ComplicationTiers,
  ExitMethod,
  ExitMethods,
  GrappleLimits,
  ManeuverModeConfig,
  StanceDiceMod,
  StanceKey,
  StanceSpec,
  TaskEffect,
} from "./types.js";

const STANCE_KEYS: readonly StanceKey[] = ["forward", "open", "defensive", "ranged"];
// All valid task keys (for plan validation); the four core tasks live in
// combat.boevye_zadachi, while prodvinutsya (solo Advance) lives in the solo
// overlay card and is merged in separately.
const TASK_KEYS: readonly CombatTaskKey[] = ["cow", "rally", "protect", "prepare_shot", "prodvinutsya"];
const CORE_TASK_KEYS: readonly CombatTaskKey[] = ["cow", "rally", "protect", "prepare_shot"];

function asStanceKey(v: unknown, where: string): StanceKey {
  if (typeof v === "string" && (STANCE_KEYS as readonly string[]).includes(v)) return v as StanceKey;
  return fail(`${where}: expected one of ${STANCE_KEYS.join("|")}, got ${JSON.stringify(v)}`);
}

function asTaskKey(v: unknown, where: string): CombatTaskKey {
  if (typeof v === "string" && (TASK_KEYS as readonly string[]).includes(v)) return v as CombatTaskKey;
  return fail(`${where}: expected one of ${TASK_KEYS.join("|")}, got ${JSON.stringify(v)}`);
}

function asStanceType(v: unknown, where: string): "melee" | "ranged" {
  if (v === "melee" || v === "ranged") return v;
  return fail(`${where}.type: expected melee|ranged, got ${JSON.stringify(v)}`);
}

function deriveStance(raw: Record<string, unknown>, key: StanceKey): StanceSpec {
  const where = `stances.${key}`;
  const nameRu = strField(raw, "name_ru", where);
  const type = asStanceType(raw["type"], where);
  const task = asTaskKey(raw["task"], `${where}.task`);

  const base = { key, nameRu, type, task };

  // Hero attack-die modifier: flat, per-engaged-enemy, or absent (ranged stance).
  let heroAttackMod: StanceDiceMod | undefined;
  if (raw["hero_attack_mod_dice"] !== undefined) {
    heroAttackMod = { kind: "flat", dice: intField(raw, "hero_attack_mod_dice", where) };
  } else if (raw["hero_attack_mod_dice_per_engaged_enemy"] !== undefined) {
    heroAttackMod = { kind: "per_engaged_enemy", dice: intField(raw, "hero_attack_mod_dice_per_engaged_enemy", where) };
  }

  const enemyMeleeVsHeroMod =
    raw["enemy_melee_vs_hero_mod_dice"] !== undefined
      ? intField(raw, "enemy_melee_vs_hero_mod_dice", where)
      : undefined;

  const heroRangedOnly = raw["hero_ranged_only"] === undefined ? undefined : boolField(raw, "hero_ranged_only", where);
  const targetableOnlyByRanged =
    raw["targetable_only_by_ranged"] === undefined ? undefined : boolField(raw, "targetable_only_by_ranged", where);

  return {
    ...base,
    ...(heroAttackMod !== undefined ? { heroAttackMod } : {}),
    ...(enemyMeleeVsHeroMod !== undefined ? { enemyMeleeVsHeroMod } : {}),
    ...(heroRangedOnly !== undefined ? { heroRangedOnly } : {}),
    ...(targetableOnlyByRanged !== undefined ? { targetableOnlyByRanged } : {}),
  };
}

function deriveTaskEffect(raw: Record<string, unknown>, where: string): TaskEffect {
  const onSuccess = strField(raw, "on_success", where);
  const oneSign = raw["one_sign"] === undefined ? undefined : strField(raw, "one_sign", where);
  const twoSigns = raw["two_signs"] === undefined ? undefined : strField(raw, "two_signs", where);
  const perSign = raw["per_sign"] === undefined ? undefined : strField(raw, "per_sign", where);
  return {
    onSuccess,
    ...(oneSign !== undefined ? { oneSign } : {}),
    ...(twoSigns !== undefined ? { twoSigns } : {}),
    ...(perSign !== undefined ? { perSign } : {}),
  };
}

function deriveTask(raw: Record<string, unknown>, key: CombatTaskKey): CombatTaskSpec {
  const where = `tasks.${key}`;
  const nameRu = strField(raw, "name_ru", where);
  const stance = asStanceKey(raw["stance"], `${where}.stance`);
  // A task carries either a single `check` or a `check_any` choice (solo Advance:
  // athletics OR search). When a choice is given, the first is the default skill.
  let skill: string;
  let skillAny: readonly string[] | undefined;
  if (raw["check_any"] !== undefined) {
    skillAny = strArray(raw["check_any"], `${where}.check_any`);
    const first = skillAny[0];
    if (first === undefined) fail(`${where}.check_any: empty`);
    skill = first;
  } else {
    skill = strField(raw, "check", where);
  }
  const maxPerRound = raw["max_per_round"] === undefined ? undefined : intField(raw, "max_per_round", where);
  const effect = deriveTaskEffect(asObject(raw["effect"], `${where}.effect`), `${where}.effect`);
  return {
    key,
    nameRu,
    stance,
    skill,
    ...(skillAny !== undefined ? { skillAny } : {}),
    ...(maxPerRound !== undefined ? { maxPerRound } : {}),
    effect,
  };
}

function deriveGrapple(raw: Record<string, unknown>): GrappleLimits {
  const where = "grapple";
  const perHero = asObject(raw["max_enemies_per_hero"], `${where}.max_enemies_per_hero`);
  const perEnemy = asObject(raw["max_heroes_per_enemy"], `${where}.max_heroes_per_enemy`);
  return {
    rangedHeroesCannotBeGrappled: boolField(raw, "ranged_heroes_cannot_be_grappled", where),
    maxEnemiesPerHero: {
      humanSize: intField(perHero, "human_size", `${where}.max_enemies_per_hero`),
      large: intField(perHero, "large", `${where}.max_enemies_per_hero`),
    },
    maxHeroesPerEnemy: {
      humanSize: intField(perEnemy, "human_size", `${where}.max_heroes_per_enemy`),
      large: intField(perEnemy, "large", `${where}.max_heroes_per_enemy`),
    },
  };
}

function deriveActions(raw: Record<string, unknown>): ActionEconomy {
  const where = "actions.per_turn";
  const perTurn = asObject(raw["per_turn"], where);
  return { main: intField(perTurn, "main", where), secondary: intField(perTurn, "secondary", where) };
}

function deriveComplicationTiers(raw: Record<string, unknown>): ComplicationTiers {
  const where = "tiers";
  const tiers = asObject(raw["tiers"], where);
  const comp = asObject(tiers["complication"], `${where}.complication`);
  const adv = asObject(tiers["advantage"], `${where}.advantage`);
  const dice = (o: unknown, w: string): number => intField(asObject(o, w), "dice", w);
  return {
    complication: {
      moderate: dice(comp["moderate"], `${where}.complication.moderate`),
      serious: dice(comp["serious"], `${where}.complication.serious`),
    },
    advantage: {
      moderate: dice(adv["moderate"], `${where}.advantage.moderate`),
      serious: dice(adv["serious"], `${where}.advantage.serious`),
    },
  };
}

function deriveExitMethod(raw: Record<string, unknown>, where: string): ExitMethod {
  const nameRu = strField(raw, "name_ru", where);
  const requiresStance = asStanceKey(raw["requires_stance"], `${where}.requires_stance`);
  // `roll` is false for a free exit, or a string naming the roll otherwise.
  const rollVal = raw["roll"];
  let requiresRoll: boolean;
  if (rollVal === false) requiresRoll = false;
  else if (typeof rollVal === "string" && rollVal.length > 0) requiresRoll = true;
  else return fail(`${where}.roll: expected false or a non-empty string, got ${JSON.stringify(rollVal)}`);
  return { nameRu, requiresStance, requiresRoll };
}

/** Parse a "minus_Nd" descriptor into its die count ("minus_1d" -> 1). */
function minusDice(descriptor: string, where: string): number {
  const m = /minus_(\d+)d/.exec(descriptor);
  if (!m || m[1] === undefined) fail(`${where}: cannot parse minus-dice descriptor ${JSON.stringify(descriptor)}`);
  return Number(m[1]);
}

/** Solo manoeuvre position (solo.manevrennaya_poziciya_dalniy_boy). */
function deriveManeuver(raw: unknown): ManeuverModeConfig {
  const where = "solo.manevrennaya_poziciya_dalniy_boy";
  const mode = asObject(paramsOf(raw, where)["maneuver_mode"], `${where}.maneuver_mode`);
  const enemyMod = asObject(mode["enemy_attack_modifier"], `${where}.enemy_attack_modifier`);
  const enemyMeleeMinus = minusDice(strField(enemyMod, "melee", `${where}.enemy_attack_modifier`), `${where}.enemy_attack_modifier.melee`);
  // Ranged enemy attacks take no penalty; assert the card says so.
  if (enemyMod["ranged"] !== "none") {
    fail(`${where}.enemy_attack_modifier.ranged: expected "none", got ${JSON.stringify(enemyMod["ranged"])}`);
  }
  const heroRangedMinus = minusDice(
    strField(mode, "hero_ranged_attack_modifier", where),
    `${where}.hero_ranged_attack_modifier`,
  );
  const leave = asObject(mode["leave_combat"], `${where}.leave_combat`);
  const exitCheck = strField(leave, "check", `${where}.leave_combat`);
  const exitNoPenalty = leave["penalty"] === "none";
  return { enemyMeleeMinus, heroRangedMinus, exitCheck, exitNoPenalty };
}

function deriveExit(raw: Record<string, unknown>): ExitMethods {
  const methods = asObject(raw["methods"], "methods");
  return {
    rangedExit: deriveExitMethod(asObject(methods["ranged_exit"], "methods.ranged_exit"), "methods.ranged_exit"),
    defensiveExit: deriveExitMethod(
      asObject(methods["defensive_exit"], "methods.defensive_exit"),
      "methods.defensive_exit",
    ),
  };
}

/**
 * Build the CombatConfig.
 *  - stancesRaw:   kv.mechanics.combat.shagi_v_raunde_blizhnego_boya
 *  - tasksRaw:     kv.mechanics.combat.boevye_zadachi
 *  - complRaw:     kv.mechanics.combat.oslozhneniya_i_preimuschestva
 *  - exitRaw:      kv.mechanics.combat.vyhod_iz_boya
 *  - soloTasksRaw: kv.mechanics.solo.prodvinutsya (the solo Advance task; kept in
 *                  its own overlay card, merged into tasks here)
 *  - maneuverRaw:  kv.mechanics.solo.manevrennaya_poziciya_dalniy_boy (the ranged
 *                  manoeuvre-position mode)
 */
export function deriveCombatConfig(
  stancesRaw: unknown,
  tasksRaw: unknown,
  complRaw: unknown,
  exitRaw: unknown,
  soloTasksRaw: unknown,
  maneuverRaw: unknown,
): CombatConfig {
  const sParams = paramsOf(stancesRaw, "combat.shagi");
  const stancesObj = asObject(sParams["stances"], "stances");
  const stances = {} as Record<StanceKey, StanceSpec>;
  for (const key of STANCE_KEYS) {
    stances[key] = deriveStance(asObject(stancesObj[key], `stances.${key}`), key);
  }

  const orderArr = asArray(sParams["stance_order"], "stance_order");
  const stanceOrder = orderArr.map((v, i) => asStanceKey(v, `stance_order[${i}]`));

  const tParams = paramsOf(tasksRaw, "combat.boevye_zadachi");
  const tasksObj = asObject(tParams["tasks"], "tasks");
  const tasks = {} as Record<CombatTaskKey, CombatTaskSpec>;
  for (const key of CORE_TASK_KEYS) {
    tasks[key] = deriveTask(asObject(tasksObj[key], `tasks.${key}`), key);
  }

  // Solo overlay: the Advance task lives in its own verified card (kept separate
  // from the core card per the overlay principle); merge it into the task map.
  const soloParams = paramsOf(soloTasksRaw, "solo.prodvinutsya");
  const soloTasksObj = asObject(soloParams["tasks"], "solo.prodvinutsya.tasks");
  tasks["prodvinutsya"] = deriveTask(
    asObject(soloTasksObj["prodvinutsya"], "tasks.prodvinutsya"),
    "prodvinutsya",
  );

  const cParams = paramsOf(complRaw, "combat.oslozhneniya");
  const manipulate = asObject(cParams["manipulate_action"], "manipulate_action");
  const manipulateSkill = strField(manipulate, "check", "manipulate_action");

  const eParams = paramsOf(exitRaw, "combat.vyhod_iz_boya");

  return {
    stances,
    stanceOrder,
    tasks,
    actions: deriveActions(asObject(sParams["actions"], "actions")),
    grapple: deriveGrapple(asObject(sParams["grapple"], "grapple")),
    complicationTiers: deriveComplicationTiers(cParams),
    manipulateSkill,
    exit: deriveExit(eParams),
    maneuver: deriveManeuver(maneuverRaw),
  };
}
