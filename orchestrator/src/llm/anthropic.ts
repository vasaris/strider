// The Anthropic SDK binding (3.1-C4; moved here from evals/src/harness/anthropicLlmClient.ts).
//
// Reached ONLY through the package subpath `@brodyazhnik/orchestrator/anthropic`; src/index.ts
// never re-exports it, so the offline surface (and `npm test`) never pulls in the SDK
// (orchestrator/test/surface.test.ts pins that). buildMessageParams is THE single place the call
// parameters are defined -- the evals keyed scripts now, the server route later.

import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, LlmRequest } from '../keeper/seam.js';

/** Calibration parameter (named, NOT a literal), shared by the Keeper and the judge: the judge
 *  returns 6 axes each with a Russian `notes` string; 1024 truncated the richest replies
 *  mid-JSON. If rawSample on an error-verdict still shows truncation on the most verbose cases,
 *  raise this one knob -- cleaner than hunting a literal. Billed only for tokens actually
 *  generated. */
export const LLM_MAX_TOKENS = 4096;

/** The messages.create parameters for one request. No temperature key: the API default stands. */
export function buildMessageParams(req: LlmRequest) {
  return {
    model: req.model, // config, passed through from the caller
    max_tokens: LLM_MAX_TOKENS,
    // Cache the stable system prefix (prompt + tone.md) -- shared across every call of a run.
    system: [{ type: 'text' as const, text: req.system, cache_control: { type: 'ephemeral' as const } }],
    messages: [{ role: 'user' as const, content: req.user }],
  };
}

export type MessageParams = ReturnType<typeof buildMessageParams>;

/** The minimal slice of the SDK client this class uses (injectable for offline tests). */
export interface MessagesClient {
  readonly messages: {
    create(params: MessageParams): Promise<{ readonly content: ReadonlyArray<{ readonly type: string; readonly text?: string }> }>;
  };
}

/** Transport options forwarded to `new Anthropic({ timeout, maxRetries })` (SDK semantics: timeout
 *  in milliseconds per attempt, maxRetries = retries after the first attempt). Only the keys given
 *  are forwarded; with no options at all the SDK client is built exactly as `new Anthropic()`. */
export interface AnthropicClientOptions {
  readonly timeout?: number;
  readonly maxRetries?: number;
}

/** Builds the SDK client from the options (undefined: none given). Injectable for offline tests. */
export type MessagesClientFactory = (options: AnthropicClientOptions | undefined) => MessagesClient;

const sdkClient: MessagesClientFactory = (options) =>
  options === undefined ? new Anthropic() : new Anthropic({ ...options }); // reads ANTHROPIC_API_KEY from process.env

/**
 * Real LlmClient. The default client is `new Anthropic()`, which reads ANTHROPIC_API_KEY from
 * process.env (the keyed scripts guard its presence first and error with an instruction if
 * missing -- the key is NEVER read from anywhere else, written, logged, or printed). `model`
 * comes from the request. Returns the model's concatenated text blocks; interpretation (the
 * judge's JSON + Zod gate, the Keeper's trim) belongs to the caller.
 *
 * `options` (optional; the app's Keeper passes timeout / maxRetries) apply only to the default
 * SDK client -- an injected `client` is used as given. `options.sdk` replaces the SDK
 * constructor (tests record the forwarded options with it; no network).
 */
export class AnthropicLlmClient implements LlmClient {
  private readonly client: MessagesClient;

  constructor(client?: MessagesClient, options?: AnthropicClientOptions & { readonly sdk?: MessagesClientFactory }) {
    if (client !== undefined) {
      this.client = client;
    } else {
      const build = options?.sdk ?? sdkClient;
      const forwarded: { timeout?: number; maxRetries?: number } = {};
      if (options?.timeout !== undefined) forwarded.timeout = options.timeout;
      if (options?.maxRetries !== undefined) forwarded.maxRetries = options.maxRetries;
      this.client = build(Object.keys(forwarded).length === 0 ? undefined : forwarded);
    }
  }

  async complete(req: LlmRequest): Promise<string> {
    const m = await this.client.messages.create(buildMessageParams(req));
    const parts: string[] = [];
    for (const block of m.content) {
      if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
    }
    return parts.join('');
  }
}
