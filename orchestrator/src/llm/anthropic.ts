// The Anthropic SDK binding (3.1-C4; moved here from evals/src/harness/anthropicLlmClient.ts).
//
// Reached ONLY through the package subpath `@brodyazhnik/orchestrator/anthropic`; src/index.ts
// never re-exports it, so the offline surface (and `npm test`) never pulls in the SDK
// (orchestrator/test/surface.test.ts pins that). buildMessageParams is THE single place the call
// parameters are defined -- the evals keyed scripts now, the server route later.
//
// Telemetry (3.2-K5.2): an optional `onCall` hook receives one LlmCallTelemetry record per
// complete() -- model, wall time on a monotonic clock, token usage and stop reason, or on failure
// the error's name and HTTP status (never its message). It carries no request or response text.
// Without the hook complete() runs exactly as before.
//
// Streaming (3.3a-K3, DEFERRED LAT1): stream() sends the SAME buildMessageParams(req) through
// `messages.stream`, forwards every non-empty text delta (thinking and other deltas ignored) and
// resolves the final message's concatenated text blocks. Its telemetry record additionally carries
// `ttft_ms` (call start -> first text delta, same monotonic clock; null when no text arrived).

import Anthropic, { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from '@anthropic-ai/sdk';
import type { LlmClient, LlmRequest } from '../keeper/seam.js';

/** The SDK error classes telemetry classifies (errorOf), re-exported so consumers without their
 *  own SDK dependency (the app's tests) can construct real instances. */
export { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError };

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

/** Token usage as the SDK reports it (only the fields telemetry reads; absent / null tolerated). */
export interface MessageUsage {
  readonly input_tokens?: number | null;
  readonly output_tokens?: number | null;
  readonly cache_creation_input_tokens?: number | null;
  readonly cache_read_input_tokens?: number | null;
}

/** The slice of a messages.create response this class reads. */
export interface MessageResult {
  readonly content: ReadonlyArray<{ readonly type: string; readonly text?: string }>;
  readonly usage?: MessageUsage | null;
  readonly stop_reason?: string | null;
}

/** The slice of one streamed event this class reads: text arrives as `content_block_delta` with
 *  `delta.type === 'text_delta'` and a string `delta.text`; every other event (and every other
 *  delta type, e.g. `thinking_delta`) is ignored. `delta` is `unknown` on purpose: the SDK's delta
 *  shapes differ per event (`message_delta` has no `type`), so textDeltaOf narrows at runtime. */
export interface MessageStreamEventLike {
  readonly type: string;
  readonly delta?: unknown;
}

/** The slice of the SDK's MessageStream this class uses: async-iterable over events, and
 *  finalMessage() resolving the complete message (the SDK handles completion/error/abort). */
export interface MessageStreamLike extends AsyncIterable<MessageStreamEventLike> {
  finalMessage(): Promise<MessageResult>;
}

/** The minimal slice of the SDK client this class uses (injectable for offline tests). `stream` is
 *  optional so injected fakes written before streaming keep compiling; stream() then throws. */
export interface MessagesClient {
  readonly messages: {
    create(params: MessageParams): Promise<MessageResult>;
    stream?(params: MessageParams): MessageStreamLike;
  };
}

/** The four usage counters of one call; null where the SDK gave none. */
export interface LlmCallUsage {
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly cache_creation_input_tokens: number | null;
  readonly cache_read_input_tokens: number | null;
}

/** One record per complete() / stream(): no request content, no response text, no error message.
 *  `ttft_ms` is present ONLY on streamed calls: integer ms from the call start to the first
 *  non-empty text delta, null when no text arrived. */
export type LlmCallTelemetry =
  | {
      readonly model: string;
      readonly duration_ms: number; // integer, monotonic clock
      readonly ok: true;
      readonly usage: LlmCallUsage | null; // null: the response carried no usage
      readonly stop_reason: string | null;
      readonly ttft_ms?: number | null; // stream() only
    }
  | {
      readonly model: string;
      readonly duration_ms: number;
      readonly ok: false;
      readonly error: { readonly name: string; readonly status?: number }; // status: an HTTP status, when the error has one
      readonly ttft_ms?: number | null; // stream() only
    };

export type LlmCallHook = (t: LlmCallTelemetry) => void;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function usageOf(u: MessageUsage | null | undefined): LlmCallUsage | null {
  if (u === undefined || u === null) return null;
  return {
    input_tokens: num(u.input_tokens),
    output_tokens: num(u.output_tokens),
    cache_creation_input_tokens: num(u.cache_creation_input_tokens),
    cache_read_input_tokens: num(u.cache_read_input_tokens),
  };
}

/**
 * The error's class and, when it has an integer one, its HTTP status -- never the message. SDK
 * errors do not set `name` (it stays "Error") and a minified bundle may mangle constructor names,
 * so SDK errors are classified by instanceof, most specific first, into FIXED literals; any other
 * Error keeps its own `name`, a non-Error value its typeof.
 */
function errorOf(err: unknown): { readonly name: string; readonly status?: number } {
  const name =
    err instanceof APIConnectionTimeoutError
      ? 'APIConnectionTimeoutError'
      : err instanceof APIConnectionError
        ? 'APIConnectionError'
        : err instanceof APIUserAbortError
          ? 'APIUserAbortError'
          : err instanceof APIError
            ? 'APIError'
            : err instanceof Error
              ? err.name
              : typeof err;
  const status = typeof err === 'object' && err !== null ? (err as { readonly status?: unknown }).status : undefined;
  return typeof status === 'number' && Number.isInteger(status) ? { name, status } : { name };
}

/** Call the hook; a throwing hook is swallowed (telemetry never changes a call's outcome). */
function emit(hook: LlmCallHook, t: LlmCallTelemetry): void {
  try {
    hook(t);
  } catch {
    // ignored by design
  }
}

/** The text of a `content_block_delta` / `text_delta` event; '' for any other event. */
function textDeltaOf(ev: MessageStreamEventLike): string {
  if (ev.type !== 'content_block_delta' || typeof ev.delta !== 'object' || ev.delta === null) return '';
  const d = ev.delta as { readonly type?: unknown; readonly text?: unknown };
  return d.type === 'text_delta' && typeof d.text === 'string' ? d.text : '';
}

/** The model's concatenated text blocks (non-text blocks skipped). */
function textOf(m: MessageResult): string {
  const parts: string[] = [];
  for (const block of m.content) {
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
  }
  return parts.join('');
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
 * constructor (tests record the forwarded options with it; no network). `options.onCall`
 * (telemetry, see the module header) applies to an injected client and to the default one alike;
 * a hook that throws is ignored -- it never changes the call's result or error.
 */
export class AnthropicLlmClient implements LlmClient {
  private readonly client: MessagesClient;
  private readonly onCall: LlmCallHook | undefined;

  constructor(
    client?: MessagesClient,
    options?: AnthropicClientOptions & { readonly sdk?: MessagesClientFactory; readonly onCall?: LlmCallHook },
  ) {
    this.onCall = options?.onCall;
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
    const hook = this.onCall;
    if (hook === undefined) return textOf(await this.client.messages.create(buildMessageParams(req)));
    const started = performance.now();
    const elapsed = (): number => Math.max(0, Math.round(performance.now() - started));
    let m: MessageResult;
    try {
      m = await this.client.messages.create(buildMessageParams(req));
    } catch (err) {
      emit(hook, { model: req.model, duration_ms: elapsed(), ok: false, error: errorOf(err) });
      throw err;
    }
    emit(hook, { model: req.model, duration_ms: elapsed(), ok: true, usage: usageOf(m.usage), stop_reason: m.stop_reason ?? null });
    return textOf(m);
  }

  /**
   * Streamed call: `messages.stream(buildMessageParams(req))`, every non-empty text delta forwarded
   * to `onText` in order, then `finalMessage()`; returns the final message's text blocks joined
   * (the same textOf as complete()). duration_ms runs until finalMessage resolves or the call
   * fails. On failure (including an `onText` that throws) the failure record carries ttft_ms when
   * text had started, and the original error is rethrown.
   */
  async stream(req: LlmRequest, onText: (delta: string) => void): Promise<string> {
    const messages = this.client.messages;
    if (messages.stream === undefined) {
      throw new Error('AnthropicLlmClient: the injected client has no messages.stream (streaming unsupported)');
    }
    const hook = this.onCall;
    const started = performance.now();
    const elapsed = (): number => Math.max(0, Math.round(performance.now() - started));
    let ttft: number | null = null;
    let m: MessageResult;
    try {
      const s = messages.stream(buildMessageParams(req));
      for await (const ev of s) {
        const text = textDeltaOf(ev);
        if (text.length === 0) continue;
        if (ttft === null) ttft = elapsed();
        onText(text);
      }
      m = await s.finalMessage();
    } catch (err) {
      if (hook !== undefined) emit(hook, { model: req.model, duration_ms: elapsed(), ok: false, error: errorOf(err), ttft_ms: ttft });
      throw err;
    }
    if (hook !== undefined) {
      emit(hook, { model: req.model, duration_ms: elapsed(), ok: true, usage: usageOf(m.usage), stop_reason: m.stop_reason ?? null, ttft_ms: ttft });
    }
    return textOf(m);
  }
}
