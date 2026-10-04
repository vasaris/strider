// Public surface of the orchestrator package.
// Engine->Keeper contract, the package provider (turn -> package), the package renderer
// (package -> Keeper user-message text), one live journey turn (engine step -> package), and
// (3.1-C4) the Keeper seam: Keeper/LlmClient interfaces, the request assembly
// (prompts/assembly.v1.json), AnthropicKeeper over an injected LlmClient, the file-based Keeper
// setup with provenance, the pregenerated Wanderer/route and the pack-loaded journey env; (3.3a)
// the journey beat turns (travelBeatTurn / checkBeatTurn / oracleAnswer).
// The SDK-bound AnthropicLlmClient is deliberately NOT exported here: it lives behind the
// `@brodyazhnik/orchestrator/anthropic` subpath so this offline surface never pulls in the SDK.
export * from './contract.js';
// provider.ts: only its public names -- its engine -> contract mapping helpers (mapDice,
// diffHeroState, ...) are shared with beats.ts but stay internal.
export { buildNarrativePackage, extractJourneyTurn, provisionalBeatLengthFor, provisionalLengthFor, type EngineTurnResult } from './provider.js';
export * from './render.js';
export * from './turn.js';
export * from './beats.js';
export * from './keeper/seam.js';
export * from './keeper/assembly.js';
export * from './keeper/anthropicKeeper.js';
export * from './keeper/setup.js';
export * from './pregen.js';
export * from './journeyEnv.js';
