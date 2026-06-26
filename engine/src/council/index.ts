export type {
  CouncilAttitude,
  CouncilConfig,
  CouncilConfigsLike,
  CouncilEvent,
  CouncilIntroPlan,
  CouncilNegotiationPlan,
  CouncilOutcome,
  CouncilPolicy,
  CouncilResistanceKey,
  CouncilResult,
  CouncilState,
} from "./types.js";

export type { CouncilConfigs } from "./config.js";
export { councilConfigFromPack, councilConfigsFromPack, deriveCouncilConfig } from "./config.js";

export { runCouncilCheck } from "./check.js";
export { runIntroduction, startCouncil } from "./start.js";
export { runNegotiationRound } from "./negotiation.js";
export { resolveCouncil } from "./resolve.js";
export type { CouncilSetup } from "./runCouncil.js";
export { MAX_COUNCIL_ATTEMPTS, runCouncil } from "./runCouncil.js";
