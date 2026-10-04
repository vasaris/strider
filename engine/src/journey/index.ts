export type {
  Attribute,
  CheckRoll,
  Consequence,
  HeroState,
  JourneyEvent,
  JourneyProgress,
  JourneyState,
  Season,
  StepRecord,
} from "./state.js";
export type {
  JourneyConfigs,
  JourneyRulesConfig,
  JourneyScenesTable,
  JourneySceneRow,
  SceneBias,
  SceneDetailRow,
  SceneDetailTable,
} from "./config.js";
export { deriveJourneyRulesConfig, journeyConfigsFromPack, parseJourneyScenesTable, parseSceneDetailTable } from "./config.js";
export type { Route } from "./route.js";
export { forcedMarchFatigue, journeyDuration } from "./route.js";
export type { EndFatigueInput } from "./fatigue.js";
export { removeFatigueAtJourneyEnd } from "./fatigue.js";
export { runDangerZone } from "./danger.js";
export { applyEffect, applyEffects, fatigueWaived } from "./effects.js";
export { runSkillCheck, runSkillCheckWithRoll } from "./check.js";
// resolveScene -> [JourneyState, CheckResult|null]; stepJourney -> [JourneyState, StepRecord]
// (channel B: the per-step CheckResults travel in a side record, NOT in the serialised log).
// runJourney still returns JourneyState (threads [0], discards the record).
// DD-DICE-FACES: the *WithRoll siblings also return the raw CheckRoll; StepRecord carries
// travelRoll / sceneRoll (null exactly when the matching check is null).
export { resolveScene, resolveSceneWithRoll } from "./scene.js";
export { runJourney, stepJourney } from "./run.js";
