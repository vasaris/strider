// The real narrative model behind the Keeper seam (3.1-C4; moved here from evals so the evals
// full cycle and the Stage 3.1.b server route issue byte-identical Keeper requests).

import type { KeeperOutput } from '../contract.js';
import { buildKeeperUser, type PromptAssembly } from './assembly.js';
import type { Keeper, KeeperInput, LlmClient, LlmRequest } from './seam.js';

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
    return proseOf(await this.cfg.llm.complete(this.request(input)));
  }

  /**
   * Streamed run (3.3a-K3, DEFERRED LAT1): the SAME request as run(); `onText` receives the raw
   * text deltas as they arrive (untrimmed -- the caller's release decides what reaches the player).
   * With an LlmClient that has no stream(), falls back to complete() and emits the whole raw text
   * as one onText call (none when it is empty). The output is trimmed and an empty reply throws,
   * exactly like run().
   */
  async runStream(input: KeeperInput, onText: (delta: string) => void): Promise<KeeperOutput> {
    const req = this.request(input);
    const llm = this.cfg.llm;
    if (llm.stream !== undefined) return proseOf(await llm.stream(req, onText));
    const raw = await llm.complete(req);
    if (raw.length > 0) onText(raw);
    return proseOf(raw);
  }

  private request(input: KeeperInput): LlmRequest {
    return {
      model: this.cfg.model,
      system: input.systemPrompt,
      user: buildKeeperUser(this.cfg.assembly, input.package),
    };
  }
}

function proseOf(raw: string): KeeperOutput {
  const prose = raw.trim();
  if (prose.length === 0) throw new Error('AnthropicKeeper: empty prose');
  return { prose };
}
