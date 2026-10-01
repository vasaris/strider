// The real narrative model behind the Keeper seam (3.1-C4; moved here from evals so the evals
// full cycle and the Stage 3.1.b server route issue byte-identical Keeper requests).

import type { KeeperOutput } from '../contract.js';
import { buildKeeperUser, type PromptAssembly } from './assembly.js';
import type { Keeper, KeeperInput, LlmClient } from './seam.js';

export interface AnthropicKeeperConfig {
  readonly llm: LlmClient;
  /** Model id -- CONFIG, not hardcoded in Keeper logic (the caller defaults it). */
  readonly model: string;
  /** The request framing (prompts/assembly.v1.json via loadPromptAssembly / loadKeeperSetup). */
  readonly assembly: PromptAssembly;
}

/**
 * Provider-agnostic despite the name: it never constructs `new Anthropic()`; the model call is
 * the injected LlmClient only (a mock offline in `npm test`; AnthropicLlmClient from the
 * `/anthropic` subpath in keyed scripts and the server route), symmetric with the evals LlmJudge.
 * `system` is `input.systemPrompt` passed through unchanged (the caller assembles it via
 * buildKeeperSystem / loadKeeperSetup); `user` is buildKeeperUser(assembly, input.package). The
 * whole reply is the prose, trimmed; the output is prose-only `{ prose }` with NO `questions`
 * key. An empty/whitespace-only reply throws `AnthropicKeeper: empty prose` -- KeeperOutput has
 * no error slot, so the plumbing fails loudly rather than handing the judge (or the player)
 * nothing. Errors from llm.complete propagate (nothing is caught).
 */
export class AnthropicKeeper implements Keeper {
  constructor(private readonly cfg: AnthropicKeeperConfig) {}

  async run(input: KeeperInput): Promise<KeeperOutput> {
    const raw = await this.cfg.llm.complete({
      model: this.cfg.model,
      system: input.systemPrompt,
      user: buildKeeperUser(this.cfg.assembly, input.package),
    });
    const prose = raw.trim();
    if (prose.length === 0) throw new Error('AnthropicKeeper: empty prose');
    return { prose };
  }
}
