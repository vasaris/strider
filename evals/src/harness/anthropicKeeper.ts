import { renderNarrativePackage, type NarrativePackage } from '@brodyazhnik/orchestrator';
import type { Keeper, KeeperInput, KeeperOutput, LlmClient } from './types.js';

export interface AnthropicKeeperConfig {
  readonly llm: LlmClient;
  /** Model id -- CONFIG, not hardcoded in Keeper logic (the keyed entry defaults it). */
  readonly model: string;
}

/** The Keeper's user message: a one-line instruction + the rendered package (orchestrator
 *  renderNarrativePackage -- lossless; absent mechanics never appear). */
export function buildKeeperUser(pkg: NarrativePackage): string {
  return `Входной пакет хода — единственный источник фактов. Напиши прозу сцены.\n\n${renderNarrativePackage(pkg)}`;
}

/**
 * The real narrative model behind the Keeper seam -- provider-agnostic: it never constructs
 * `new Anthropic()`; the model call is the injected LlmClient only (the mock offline in
 * `npm test`; AnthropicLlmClient only in keyed scripts Ivan runs), symmetric with LlmJudge.
 * `system` is `input.systemPrompt` passed through unchanged (the caller assembles it via
 * buildKeeperSystem); `user` is buildKeeperUser(input.package). The whole reply is the prose,
 * trimmed; the output is prose-only `{ prose }` with NO `questions` key (RECONCILE 2 stays
 * OPEN). An empty/whitespace-only reply throws `AnthropicKeeper: empty prose` -- KeeperOutput
 * has no error slot (unlike Verdict), so the plumbing fails loudly rather than handing the
 * judge nothing. Errors from llm.complete propagate (nothing is caught).
 */
export class AnthropicKeeper implements Keeper {
  constructor(private readonly cfg: AnthropicKeeperConfig) {}

  async run(input: KeeperInput): Promise<KeeperOutput> {
    const raw = await this.cfg.llm.complete({
      model: this.cfg.model,
      system: input.systemPrompt,
      user: buildKeeperUser(input.package),
    });
    const prose = raw.trim();
    if (prose.length === 0) throw new Error('AnthropicKeeper: empty prose');
    return { prose };
  }
}
