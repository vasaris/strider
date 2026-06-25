export type { CheckConfig, CheckConfigSources } from "./config.js";
export { deriveCheckConfig } from "./config.js";

export type {
  CheckConditions,
  CheckOutcome,
  CheckResult,
  DegreeTier,
  RiskDegree,
  RiskDegreeSpec,
  SpecialSuccessOption,
  SuccessDegree,
} from "./types.js";

export { targetNumber } from "./targetNumber.js";
export { degreeFromIcons, evaluateCheck } from "./evaluate.js";
export { specialSuccessOptions, spendableIcons } from "./special.js";
export { failureOutcome } from "./risk.js";
export type { HopeSpendInput, HopeSpendResult } from "./hope.js";
export { spendHopeForDice } from "./hope.js";
