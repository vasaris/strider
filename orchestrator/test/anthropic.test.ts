// The SDK binding (3.1-C4): buildMessageParams is THE single definition of the call parameters,
// and AnthropicLlmClient forwards them and joins the text blocks. An injected fake client only --
// no network, no API key (the default `new Anthropic()` is never constructed here; the options
// tests inject a fake SDK constructor).
import { APIConnectionTimeoutError, APIUserAbortError, APIConnectionError, NotFoundError } from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import {
  AnthropicLlmClient,
  LLM_MAX_TOKENS,
  buildMessageParams,
  type AnthropicClientOptions,
  type LlmCallTelemetry,
  type MessageParams,
  type MessagesClient,
  type MessagesClientFactory,
} from '../src/llm/anthropic.js';
import type { LlmRequest } from '../src/keeper/seam.js';

const REQ: LlmRequest = { model: 'model-x', system: 'SYS\n', user: 'USER' };

describe('buildMessageParams', () => {
  it('has exactly the agreed shape: model passthrough, max_tokens 4096, ephemeral cache on system, one user turn', () => {
    expect(LLM_MAX_TOKENS).toBe(4096);
    expect(buildMessageParams(REQ)).toStrictEqual({
      model: 'model-x',
      max_tokens: 4096,
      system: [{ type: 'text', text: 'SYS\n', cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: 'USER' }],
    });
  });

  it('carries NO temperature key (the API default stands)', () => {
    const p = buildMessageParams(REQ) as Record<string, unknown>;
    expect('temperature' in p).toBe(false);
    expect(Object.keys(p).sort()).toEqual(['max_tokens', 'messages', 'model', 'system']);
  });
});

describe('AnthropicLlmClient (injected fake client)', () => {
  it('forwards buildMessageParams(req) and joins the text blocks, skipping non-text blocks', async () => {
    const seen: MessageParams[] = [];
    const fake: MessagesClient = {
      messages: {
        create: (params) => {
          seen.push(params);
          return Promise.resolve({
            content: [
              { type: 'text', text: 'one ' },
              { type: 'thinking' },
              { type: 'text', text: 'two' },
            ],
          });
        },
      },
    };
    const out = await new AnthropicLlmClient(fake).complete(REQ);
    expect(out).toBe('one two');
    expect(seen).toEqual([buildMessageParams(REQ)]);
  });

  it('propagates a client rejection unchanged', async () => {
    const boom = new Error('boom');
    const fake: MessagesClient = { messages: { create: () => Promise.reject(boom) } };
    await expect(new AnthropicLlmClient(fake).complete(REQ)).rejects.toBe(boom);
  });
});

describe('AnthropicLlmClient options (injected fake SDK constructor; K4 API-RES1 (2))', () => {
  const ok: MessagesClient = { messages: { create: () => Promise.resolve({ content: [{ type: 'text', text: 'ok' }] }) } };

  function recorder() {
    const seen: (AnthropicClientOptions | undefined)[] = [];
    const sdk: MessagesClientFactory = (o) => {
      seen.push(o);
      return ok;
    };
    return { seen, sdk };
  }

  it('forwards timeout and maxRetries to the SDK constructor', async () => {
    const { seen, sdk } = recorder();
    const c = new AnthropicLlmClient(undefined, { timeout: 90_000, maxRetries: 1, sdk });
    expect(seen).toStrictEqual([{ timeout: 90_000, maxRetries: 1 }]);
    expect(await c.complete(REQ)).toBe('ok');
  });

  it('forwards only the keys given (maxRetries 0 is a value, not absence)', () => {
    const { seen, sdk } = recorder();
    new AnthropicLlmClient(undefined, { maxRetries: 0, sdk });
    new AnthropicLlmClient(undefined, { timeout: 5, sdk });
    expect(seen).toStrictEqual([{ maxRetries: 0 }, { timeout: 5 }]);
  });

  it('no transport options: the SDK constructor gets undefined (i.e. `new Anthropic()` as before)', () => {
    const { seen, sdk } = recorder();
    new AnthropicLlmClient(undefined, { sdk });
    expect(seen).toStrictEqual([undefined]);
  });

  it('an injected client wins; the SDK constructor is never called', () => {
    const { seen, sdk } = recorder();
    new AnthropicLlmClient(ok, { timeout: 1, maxRetries: 1, sdk });
    expect(seen).toEqual([]);
  });
});

describe('AnthropicLlmClient onCall telemetry (3.2-K5.2)', () => {
  const USAGE = { input_tokens: 1200, output_tokens: 340, cache_creation_input_tokens: 0, cache_read_input_tokens: 1100 };

  function fakeOk(extra: Record<string, unknown> = { usage: USAGE, stop_reason: 'end_turn' }) {
    const seen: MessageParams[] = [];
    const client: MessagesClient = {
      messages: {
        create: (params) => {
          seen.push(params);
          return Promise.resolve({ content: [{ type: 'text', text: 'PROSE-MARKER' }], ...extra });
        },
      },
    };
    return { seen, client };
  }

  it('success: exactly one record with model, integer duration, the four usage counters and stop_reason', async () => {
    const records: LlmCallTelemetry[] = [];
    const { seen, client } = fakeOk({ usage: { ...USAGE, service_tier: 'standard' }, stop_reason: 'end_turn' });
    const out = await new AnthropicLlmClient(client, { onCall: (t) => records.push(t) }).complete(REQ);
    expect(out).toBe('PROSE-MARKER');
    expect(seen).toEqual([buildMessageParams(REQ)]); // request params unchanged
    expect(records).toHaveLength(1);
    const r = records[0] as Extract<LlmCallTelemetry, { ok: true }>;
    expect(Object.keys(r).sort()).toEqual(['duration_ms', 'model', 'ok', 'stop_reason', 'usage']);
    expect(r).toMatchObject({ model: 'model-x', ok: true, usage: USAGE, stop_reason: 'end_turn' });
    expect(Number.isInteger(r.duration_ms) && r.duration_ms >= 0).toBe(true);
    expect(JSON.stringify(r)).not.toContain('PROSE-MARKER');
  });

  it('success without usage / stop_reason: nulls', async () => {
    const records: LlmCallTelemetry[] = [];
    await new AnthropicLlmClient(fakeOk({}).client, { onCall: (t) => records.push(t) }).complete(REQ);
    expect(records).toMatchObject([{ ok: true, usage: null, stop_reason: null }]);
    records.length = 0;
    await new AnthropicLlmClient(fakeOk({ usage: { input_tokens: 5, cache_read_input_tokens: null } }).client, { onCall: (t) => records.push(t) }).complete(REQ);
    expect(records).toMatchObject([
      { ok: true, usage: { input_tokens: 5, output_tokens: null, cache_creation_input_tokens: null, cache_read_input_tokens: null }, stop_reason: null },
    ]);
  });

  it('failure: one record with the error name and HTTP status, never the message; the error is rethrown unchanged', async () => {
    const records: LlmCallTelemetry[] = [];
    const boom = Object.assign(new Error('secret-in-message sk-XYZ'), { name: 'RateLimitError', status: 429 });
    const client: MessagesClient = { messages: { create: () => Promise.reject(boom) } };
    await expect(new AnthropicLlmClient(client, { onCall: (t) => records.push(t) }).complete(REQ)).rejects.toBe(boom);
    expect(records).toHaveLength(1);
    const r = records[0] as Extract<LlmCallTelemetry, { ok: false }>;
    expect(Object.keys(r).sort()).toEqual(['duration_ms', 'error', 'model', 'ok']);
    expect(r).toMatchObject({ model: 'model-x', ok: false, error: { name: 'RateLimitError', status: 429 } });
    expect(Number.isInteger(r.duration_ms)).toBe(true);
    expect(JSON.stringify(r)).not.toContain('secret-in-message');
  });

  it('real SDK errors: fixed class names (SDK errors leave name "Error"), the HTTP status, never the message', async () => {
    const FAKE_KEY = 'sk-ant-FAKE-orch-0123456789';
    const records: LlmCallTelemetry[] = [];
    const hook = (t: LlmCallTelemetry) => records.push(t);
    const reject = (e: unknown): MessagesClient => ({ messages: { create: () => Promise.reject(e) } });
    const notFound = new NotFoundError(404, { type: 'error', error: { type: 'not_found_error', message: `model gone ${FAKE_KEY}` } }, `404 ${FAKE_KEY}`, new Headers());
    const timeout = new APIConnectionTimeoutError({ message: `timed out ${FAKE_KEY}` });
    const conn = new APIConnectionError({ message: `refused ${FAKE_KEY}` });
    const abort = new APIUserAbortError({ message: `aborted ${FAKE_KEY}` });
    expect([notFound.name, timeout.name]).toEqual(['Error', 'Error']); // why the classification exists
    for (const e of [notFound, timeout, conn, abort]) {
      await expect(new AnthropicLlmClient(reject(e), { onCall: hook }).complete(REQ)).rejects.toBe(e);
    }
    expect(records.map((r) => (r.ok ? null : r.error))).toStrictEqual([
      { name: 'APIError', status: 404 },
      { name: 'APIConnectionTimeoutError' },
      { name: 'APIConnectionError' },
      { name: 'APIUserAbortError' },
    ]);
    for (const r of records) {
      const json = JSON.stringify(r);
      expect(json).not.toContain(FAKE_KEY);
      expect(json).not.toMatch(/model gone|timed out|refused|aborted/);
    }
  });

  it('failure without a status, or with a non-Error value: the name only', async () => {
    const records: LlmCallTelemetry[] = [];
    const hook = (t: LlmCallTelemetry) => records.push(t);
    await expect(new AnthropicLlmClient({ messages: { create: () => Promise.reject(new TypeError('x')) } }, { onCall: hook }).complete(REQ)).rejects.toThrow(TypeError);
    await expect(new AnthropicLlmClient({ messages: { create: () => Promise.reject('raw') } }, { onCall: hook }).complete(REQ)).rejects.toBe('raw');
    expect(records.map((r) => (r.ok ? null : r.error))).toStrictEqual([{ name: 'TypeError' }, { name: 'string' }]);
  });

  it('a throwing hook changes neither the result nor the error', async () => {
    const throwing = () => {
      throw new Error('hook failed');
    };
    expect(await new AnthropicLlmClient(fakeOk().client, { onCall: throwing }).complete(REQ)).toBe('PROSE-MARKER');
    const boom = new Error('boom');
    await expect(new AnthropicLlmClient({ messages: { create: () => Promise.reject(boom) } }, { onCall: throwing }).complete(REQ)).rejects.toBe(boom);
  });

  it('no hook: the same output and params as with one', async () => {
    const a = fakeOk();
    const b = fakeOk();
    const plain = await new AnthropicLlmClient(a.client).complete(REQ);
    const hooked = await new AnthropicLlmClient(b.client, { onCall: () => {} }).complete(REQ);
    expect(plain).toBe(hooked);
    expect(a.seen).toEqual(b.seen);
  });

  it('the hook applies to a client built from options too', async () => {
    const records: LlmCallTelemetry[] = [];
    const { client } = fakeOk();
    const c = new AnthropicLlmClient(undefined, { timeout: 1, sdk: () => client, onCall: (t) => records.push(t) });
    await c.complete(REQ);
    expect(records).toHaveLength(1);
  });
});
