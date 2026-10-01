// The Keeper seam (3.1-C4; moved here from evals/src/harness/types.ts). One interface for the
// narrative model, shared by the eval harness (StubKeeper / AnthropicKeeper over a mock or a keyed
// LlmClient) and the Stage 3.1.b server route. The route and the evals full cycle therefore build
// the Keeper request through exactly the same code (assembly.ts + anthropicKeeper.ts).
//
// KeeperOutput is the CONTRACT type (contract.ts: prose + optional ClarifyingQuestion[]), not a
// harness-local provisional shape.

import type { KeeperOutput, NarrativePackage } from '../contract.js';

export interface KeeperInput {
  readonly systemPrompt: string; // assembled by the caller (buildKeeperSystem / loadKeeperSetup)
  readonly package: NarrativePackage;
}

/** The narrative model behind one seam. Implementations: StubKeeper (evals; canned,
 *  byte-deterministic) and AnthropicKeeper (./anthropicKeeper.ts; injected LlmClient;
 *  judge-scored, not byte-golden). */
export interface Keeper {
  run(input: KeeperInput): Promise<KeeperOutput>;
}

/** The model call behind one seam, injectable (a mock offline / AnthropicLlmClient from the
 *  `@brodyazhnik/orchestrator/anthropic` subpath in keyed scripts and the server route). Two
 *  callers share it:
 *   - judge (evals LlmJudge): system = rubric + activated tone.md (buildJudgeSystem); user = the
 *     prose to score, plus the rendered package block when given; the raw reply is the rubric
 *     JSON, parsed + Zod-validated by LlmJudge.
 *   - keeper (AnthropicKeeper): system = keeper prompt + activated tone.md (buildKeeperSystem);
 *     user = the preamble + rendered package (buildKeeperUser); the raw reply is the prose,
 *     trimmed by AnthropicKeeper.
 *  complete() returns the model's raw text output; interpretation belongs to the caller. */
export interface LlmRequest {
  readonly model: string; // config, not hardcoded in caller logic
  readonly system: string; // assembled by the caller (judge: rubric+tone; keeper: prompt+tone)
  readonly user: string; // judge: the prose (+ package block if given); keeper: the rendered package
}

export interface LlmClient {
  complete(req: LlmRequest): Promise<string>;
}
