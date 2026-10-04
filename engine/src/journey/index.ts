export type {
  Attribute,
  CheckBeatRecord,
  CheckRoll,
  Consequence,
  EyeSource,
  HeroState,
  HopeSpend,
  JourneyEvent,
  JourneyProgress,
  JourneyState,
  OracleRecord,
  PendingSceneCheck,
  SceneDraw,
  Season,
  StepRecord,
  TravelBeatKind,
  TravelBeatRecord,
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
export type { SkillCheckSetup } from "./check.js";
export { runSkillCheck, runSkillCheckWithRoll, skillCheckSetup } from "./check.js";
// resolveScene -> [JourneyState, CheckResult|null]; stepJourney -> [JourneyState, StepRecord]
// (channel B: the per-step CheckResults travel in a side record, NOT in the serialised log).
// runJourney still returns JourneyState (threads [0], discards the record).
// DD-DICE-FACES: the *WithRoll siblings also return the raw CheckRoll; StepRecord carries
// travelRoll / sceneRoll (null exactly when the matching check is null).
export type { SceneResolution } from "./scene.js";
export {
  drawScene,
  isSignificantDetail,
  resolveEncounter,
  resolveScene,
  resolveSceneCheck,
  resolveSceneWithRoll,
} from "./scene.js";
export { runJourney, stepJourney } from "./run.js";
// 3.3a: one engine step split into player beats. travelBeat (Travel check, then arrival / a
// pending scene check / a resolved significant encounter) -> checkBeat (the pending scene's
// check); stepJourney = travelBeat + checkBeat with no Hope spent. previewCheck: the exact odds
// the roll panel shows (no RNG). askOracle: a yes/no question (never grows the Eye).
export { JourneyBeatError, TRAVEL_SKILL, checkBeat, travelBeat } from "./beats.js";
export type { CheckPreview } from "./preview.js";
export { checkSuccessOdds, previewCheck } from "./preview.js";
export { askOracle } from "./oracle.js";
