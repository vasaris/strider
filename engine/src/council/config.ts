/**
 * Council configs, assembled from one verified pack (mirror of CombatConfigs /
 * JourneyConfigs). `deriveCouncilConfig` is the pure seam: it takes the raw
 * zavershenie_soveta card and reads every council number out of it, so the
 * anti-hardcode tests can feed a stub card with different numbers and watch the
 * config follow. `councilConfigsFromPack` then bolts on the shared check, dice,
 * conditions and skill->attribute pieces.
 */

import { checkConfigFromPack, diceConfigFromPack } from "../pack/configFromPack.js";
import { deriveConditionsConfig } from "../conditions/index.js";
import type { CheckConfig } from "../checks/config.js";
import type { ConditionsConfig } from "../conditions/config.js";
import type { DiceConfig } from "../dice/config.js";
import type { Attribute } from "../hero/state.js";
import type { Pack } from "../pack/pack.js";
import { parseSkillAttribute } from "../pack/skills.js";
import { asObject, intArray, intField, paramsOf, parseDurationFormula, strArray, strField } from "./parse.js";
import type { CouncilConfig } from "./types.js";

export type { CouncilConfig } from "./types.js";

const COUNCIL_CARD = "kv.mechanics.council.zavershenie_soveta";

export interface CouncilConfigs {
  readonly council: CouncilConfig;
  readonly check: CheckConfig;
  readonly conditions: ConditionsConfig;
  readonly dice: DiceConfig;
  /** Skill -> governing attribute (for council-check TNs); from the skills card. */
  readonly skillAttribute: Readonly<Record<string, Attribute>>;
}

/** Pure: read the council vocabulary from one raw rule card. */
export function deriveCouncilConfig(raw: unknown): CouncilConfig {
  const where = COUNCIL_CARD;
  const params = paramsOf(raw, where);

  const resistanceRaw = asObject(params["resistance"], `${where}.resistance`);
  const resistance = {
    reasonable: intField(resistanceRaw, "reasonable", `${where}.resistance`),
    bold: intField(resistanceRaw, "bold", `${where}.resistance`),
    audacious: intField(resistanceRaw, "audacious", `${where}.resistance`),
  };

  const introRaw = asObject(params["introduction"], `${where}.introduction`);
  const durationOnFail = intField(introRaw, "duration_on_fail", `${where}.introduction`);
  const { base, perSign } = parseDurationFormula(
    strField(introRaw, "duration_on_success", `${where}.introduction`),
    `${where}.introduction.duration_on_success`,
  );
  const introUseful = strArray(introRaw["useful_skills"], `${where}.introduction.useful_skills`);

  const negRaw = asObject(params["negotiations"], `${where}.negotiations`);
  const attRaw = asObject(negRaw["attitude_modifier_dice"], `${where}.negotiations.attitude_modifier_dice`);
  const attitudeModifierDice = {
    cold: intField(attRaw, "cold", `${where}.negotiations.attitude_modifier_dice`),
    neutral: intField(attRaw, "neutral", `${where}.negotiations.attitude_modifier_dice`),
    friendly: intField(attRaw, "friendly", `${where}.negotiations.attitude_modifier_dice`),
  };
  const goodRoleplayBonusDice = intArray(
    negRaw["good_roleplay_bonus_dice"],
    `${where}.negotiations.good_roleplay_bonus_dice`,
  );
  const negUseful = strArray(negRaw["useful_skills"], `${where}.negotiations.useful_skills`);

  return {
    resistance,
    introduction: {
      durationOnFail,
      durationSuccessBase: base,
      durationSuccessPerSign: perSign,
      usefulSkills: introUseful,
    },
    negotiations: {
      attitudeModifierDice,
      goodRoleplayBonusDice,
      usefulSkills: negUseful,
    },
  };
}

export function councilConfigFromPack(pack: Pack): CouncilConfig {
  return deriveCouncilConfig(pack.requireById(COUNCIL_CARD).raw);
}

export function councilConfigsFromPack(pack: Pack): CouncilConfigs {
  return {
    council: councilConfigFromPack(pack),
    check: checkConfigFromPack(pack),
    conditions: deriveConditionsConfig(pack),
    dice: diceConfigFromPack(pack),
    skillAttribute: parseSkillAttribute(pack),
  };
}
