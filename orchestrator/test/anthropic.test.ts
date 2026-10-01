// The SDK binding (3.1-C4): buildMessageParams is THE single definition of the call parameters,
// and AnthropicLlmClient forwards them and joins the text blocks. An injected fake client only --
// no network, no API key (the default `new Anthropic()` is never constructed here).
import { describe, expect, it } from 'vitest';
import { AnthropicLlmClient, LLM_MAX_TOKENS, buildMessageParams, type MessageParams, type MessagesClient } from '../src/llm/anthropic.js';
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
