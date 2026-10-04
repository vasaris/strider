// The SDK binding (3.1-C4): buildMessageParams is THE single definition of the call parameters,
// and AnthropicLlmClient forwards them and joins the text blocks. An injected fake client only --
// no network, no API key (the default `new Anthropic()` is never constructed here; the options
// tests inject a fake SDK constructor).
import { describe, expect, it } from 'vitest';
import {
  AnthropicLlmClient,
  LLM_MAX_TOKENS,
  buildMessageParams,
  type AnthropicClientOptions,
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
