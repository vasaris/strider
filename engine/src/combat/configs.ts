/**
 * Aggregate of every config the combat runtime needs, assembled from one
 * verified pack (mirror of JourneyConfigs). Resolution functions take this so
 * they never reach into the pack themselves.
 */

import { checkConfigFromPack, diceConfigFromPack } from "../pack/configFromPack.js";
import { deriveConditionsConfig } from "../conditions/index.js";
import type { CheckConfig } from "../checks/config.js";
import type { ConditionsConfig } from "../conditions/config.js";
import type { DiceConfig } from "../dice/config.js";
import type { Attribute } from "../hero/state.js";
import type { Pack } from "../pack/pack.js";
import { asObject, fail } from "./parse.js";
import {
  attackConfigFromPack,
  combatConfigFromPack,
  specialDamageConfigFromPack,
  woundConfigFromPack,
} from "./fromPack.js";
import type { AttackConfig, CombatConfig, SpecialDamageConfig, WoundConfig } from "./types.js";

export interface CombatConfigs {
  readonly combat: CombatConfig;
  readonly attack: AttackConfig;
  readonly wounds: WoundConfig;
  readonly specialDamage: SpecialDamageConfig;
  readonly check: CheckConfig;
  readonly conditions: ConditionsConfig;
  readonly dice: DiceConfig;
  /** Skill -> governing attribute (for combat-task checks); from traits.spisok_navykov. */
  readonly skillAttribute: Readonly<Record<string, Attribute>>;
}

/** Skill -> governing attribute, read from the verified skills card (no baked map). */
function parseSkillAttribute(pack: Pack): Record<string, Attribute> {
  const payload = asObject(asObject(pack.requireById("kv.mechanics.traits.spisok_navykov").raw, "skills card")["payload"], "skills.payload");
  const skills = asObject(asObject(payload["parameters"], "skills.parameters")["skills"], "skills.parameters.skills");
  const out: Record<string, Attribute> = {};
  for (const [key, def] of Object.entries(skills)) {
    const cat = asObject(def, `skills.${key}`)["category"];
    if (cat === "strength" || cat === "heart" || cat === "wits") out[key] = cat;
    else fail(`skill ${key}: unexpected category ${JSON.stringify(cat)}`);
  }
  return out;
}

export function combatConfigsFromPack(pack: Pack): CombatConfigs {
  return {
    combat: combatConfigFromPack(pack),
    attack: attackConfigFromPack(pack),
    wounds: woundConfigFromPack(pack),
    specialDamage: specialDamageConfigFromPack(pack),
    check: checkConfigFromPack(pack),
    conditions: deriveConditionsConfig(pack),
    dice: diceConfigFromPack(pack),
    skillAttribute: parseSkillAttribute(pack),
  };
}
