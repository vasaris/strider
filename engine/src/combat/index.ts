export type {
  ActionEconomy,
  AttackConfig,
  AttackOutcome,
  AttackParams,
  Combatant,
  CombatConfig,
  CombatPhase,
  CombatState,
  CombatTaskKey,
  CombatTaskSpec,
  ComplicationTiers,
  DyingConfig,
  EnemyState,
  EnemyStatBlock,
  EnemyWeapon,
  ExitMethod,
  ExitMethods,
  FirstAidConfig,
  GrappleLimits,
  HeroCombatFrame,
  HeroWeapon,
  ModifierTier,
  SpecialDamageConfig,
  SpecialDamageKey,
  StanceDiceMod,
  StanceKey,
  StanceSpec,
  TaskEffect,
  WeaponGroup,
  WoundConfig,
} from "./types.js";

export { deriveCombatConfig } from "./config.js";
export { deriveEnemyStatBlock, spawnEnemy } from "./enemy.js";
export type { AttackEval, AttackEvalOpts } from "./attack.js";
export { deriveAttackConfig, evaluateAttackRoll, resolveAttack } from "./attack.js";
export type { PiercingResult, WoundEvent, WoundRollResult } from "./wounds.js";
export {
  applyFirstWound,
  applySecondWound,
  clearLightWoundAfterCombat,
  deriveWoundConfig,
  dyingRescue,
  firstAid,
  resolvePiercing,
  rollWoundSeverity,
  severityForFace,
  takeWound,
} from "./wounds.js";
export type { SpecialDamageContext, SpecialDamageResult, SpecialDamageSpends } from "./specialDamage.js";
export { applySpecialDamage, deriveSpecialDamageConfig } from "./specialDamage.js";
export type { CombatConfigs } from "./configs.js";
export { combatConfigsFromPack } from "./configs.js";
export {
  attackConfigFromPack,
  combatConfigFromPack,
  enemyStatBlockFromPack,
  specialDamageConfigFromPack,
  woundConfigFromPack,
} from "./fromPack.js";
