export type {
  DiceConfig,
  DiceConfigSources,
  FeatDieConfig,
  SuccessDieConfig,
} from "./config.js";
export { deriveDiceConfig } from "./config.js";

export type {
  DiceRoll,
  FeatDieFace,
  FeatDieResult,
  FeatModifier,
  SuccessDieResult,
} from "./types.js";

export {
  featDieResultOfFace,
  featRank,
  keptFeatDie,
  resolveFeatModifier,
  rollFeatDie,
  rollFeatWithModifier,
} from "./featDie.js";

export type { SuccessDiceCountInput } from "./successDie.js";
export { resolveSuccessDiceCount, rollSuccessDice, rollSuccessDie } from "./successDie.js";

export type { CheckDiceSpec } from "./roll.js";
export { rollCheckDice } from "./roll.js";
