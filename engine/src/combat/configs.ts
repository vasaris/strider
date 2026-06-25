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
import type { Pack } from "../pack/pack.js";
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
  };
}
