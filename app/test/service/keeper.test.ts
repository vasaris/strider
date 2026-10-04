// The app's Keeper wiring: model default + KEEPER_MODEL override, the transport bounds forwarded
// to the SDK constructor (API-RES1 (2); a fake constructor, no network), the one-line call log
// (3.2-K5.2), and the recorded error text.
import { APIConnectionTimeoutError, type AnthropicClientOptions, type MessagesClient } from '@brodyazhnik/orchestrator/anthropic';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { productionDeps } from '../../src/server/service/deps';
import {
  DEFAULT_KEEPER_MODEL,
  KEEPER_MAX_RETRIES,
  KEEPER_PROMPT,
  KEEPER_CALL_LOG_PREFIX,
  KEEPER_TIMEOUT_MS,
  keeperErrorText,
  keeperLlmClient,
  keeperModel,
} from '../../src/server/service/keeper';

describe('keeperModel', () => {
  it('defaults to claude-sonnet-5; KEEPER_MODEL wins when non-empty after trim', () => {
    expect(DEFAULT_KEEPER_MODEL).toBe('claude-sonnet-5');
    expect(KEEPER_PROMPT).toBe('prompts/keeper.system.v0.3.md');
    expect(keeperModel(undefined)).toBe('claude-sonnet-5');
    expect(keeperModel('')).toBe('claude-sonnet-5');
    expect(keeperModel('   ')).toBe('claude-sonnet-5');
    expect(keeperModel('  claude-opus-x \n')).toBe('claude-opus-x');
  });
});

describe('keeperLlmClient (API-RES1 (2))', () => {
  it('timeout 90 s and 1 retry reach the SDK constructor; the request goes through the same client', async () => {
    expect(KEEPER_TIMEOUT_MS).toBe(90_000);
    expect(KEEPER_MAX_RETRIES).toBe(1);
    const seen: (AnthropicClientOptions | undefined)[] = [];
    const created: unknown[] = [];
    const fake: MessagesClient = {
      messages: {
        create: (params) => {
          created.push(params);
          return Promise.resolve({ content: [{ type: 'text', text: 'prose' }] });
        },
      },
    };
    const client = keeperLlmClient(
      (o) => {
        seen.push(o);
        return fake;
      },
      () => {},
    );
    expect(seen).toStrictEqual([{ timeout: 90_000, maxRetries: 1 }]);
    expect(await client.complete({ model: 'm', system: 's', user: 'u' })).toBe('prose');
    expect(Object.keys(created[0] as object).sort()).toEqual(['max_tokens', 'messages', 'model', 'system']); // no transport keys in the body
  });
});

describe('keeper call log (3.2-K5.2)', () => {
  const FAKE_KEY = 'sk-ant-FAKE-telemetry-0123456789';
  const MARKER = 'PROSE-MARKER-7f3c1';
  const REQ = { model: 'model-t', system: 'SYSTEM-MARKER', user: 'USER-MARKER' };
  const USAGE = { input_tokens: 2100, output_tokens: 610, cache_creation_input_tokens: 0, cache_read_input_tokens: 1900 };
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const parse = (line: string): Record<string, unknown> => {
    expect(line.startsWith(KEEPER_CALL_LOG_PREFIX)).toBe(true);
    return JSON.parse(line.slice(KEEPER_CALL_LOG_PREFIX.length)) as Record<string, unknown>;
  };

  it('success: one line per call with model, duration, usage and stop_reason; no prose, no key, no request text', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', FAKE_KEY);
    const lines: string[] = [];
    const fake: MessagesClient = {
      messages: { create: () => Promise.resolve({ content: [{ type: 'text', text: `${MARKER} ${FAKE_KEY}` }], usage: USAGE, stop_reason: 'end_turn' }) },
    };
    const client = keeperLlmClient(() => fake, (l) => lines.push(l));
    await client.complete(REQ);
    await client.complete(REQ);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).not.toContain('\n');
      const rec = parse(line);
      expect(Object.keys(rec).sort()).toEqual(['duration_ms', 'model', 'ok', 'stop_reason', 'usage']);
      expect(rec).toMatchObject({ model: 'model-t', ok: true, usage: USAGE, stop_reason: 'end_turn' });
      expect(Number.isInteger(rec['duration_ms'])).toBe(true);
      for (const secret of [MARKER, FAKE_KEY, 'SYSTEM-MARKER', 'USER-MARKER']) expect(line).not.toContain(secret);
    }
  });

  it('failure: one line with ok:false, the error name and status; neither the message nor the key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', FAKE_KEY);
    const lines: string[] = [];
    const boom = Object.assign(new Error(`invalid x-api-key ${FAKE_KEY}`), { name: 'AuthenticationError', status: 401 });
    const client = keeperLlmClient(() => ({ messages: { create: () => Promise.reject(boom) } }), (l) => lines.push(l));
    await expect(client.complete(REQ)).rejects.toBe(boom);
    expect(lines).toHaveLength(1);
    const line = lines[0] as string;
    expect(parse(line)).toMatchObject({ model: 'model-t', ok: false, error: { name: 'AuthenticationError', status: 401 } });
    expect(Object.keys(parse(line)).sort()).toEqual(['duration_ms', 'error', 'model', 'ok']);
    expect(line).not.toContain(FAKE_KEY);
    expect(line).not.toContain('invalid x-api-key');
  });

  it('a real SDK timeout logs its fixed class name, not "Error", and never the message or the key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', FAKE_KEY);
    const lines: string[] = [];
    const timeout = new APIConnectionTimeoutError({ message: `Request timed out ${FAKE_KEY}` });
    const client = keeperLlmClient(() => ({ messages: { create: () => Promise.reject(timeout) } }), (l) => lines.push(l));
    await expect(client.complete(REQ)).rejects.toBe(timeout);
    expect(lines).toHaveLength(1);
    const line = lines[0] as string;
    expect(parse(line)).toStrictEqual({ model: 'model-t', duration_ms: parse(line)['duration_ms'], ok: false, error: { name: 'APIConnectionTimeoutError' } });
    expect(line).not.toContain(FAKE_KEY);
    expect(line).not.toContain('timed out');
  });

  it('the default sink is console.info, one call per Keeper call', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const fake: MessagesClient = { messages: { create: () => Promise.resolve({ content: [{ type: 'text', text: MARKER }] }) } };
    await keeperLlmClient(() => fake).complete(REQ);
    expect(info).toHaveBeenCalledTimes(1);
    const line = info.mock.calls[0]?.[0] as string;
    expect(parse(line)).toMatchObject({ ok: true, usage: null, stop_reason: null });
  });
});

describe('keeperErrorText', () => {
  it('name: message, secrets redacted, whitespace/control runs collapsed, lone surrogates replaced', () => {
    const err = Object.assign(new Error('bad key sk-secret-1234\r\nat host\u0000 \uD800!'), { name: 'APIError' });
    expect(keeperErrorText(err, ['sk-secret-1234'])).toBe('APIError: bad key [redacted] at host �!');
  });

  it('caps at 500 characters (code points) and handles non-Error values', () => {
    expect([...keeperErrorText(new Error('\u{1F600}'.repeat(600)), [])].length).toBe(500);
    expect(keeperErrorText('boom', [])).toBe('string: boom');
    expect(keeperErrorText(new Error(''), [])).toBe('Error:');
  });

  it('ignores secrets shorter than 4 characters (no shredding of ordinary text)', () => {
    expect(keeperErrorText(new Error('a b c'), ['a', ''])).toBe('Error: a b c');
  });
});

// MF-1 (3.1-C7 security review): the production secrets() list against the recorded error text.
// Dummy values only; no request is sent (the Headers error is raised locally, as in the SDK).
describe('productionDeps().secrets() in keeperErrorText', () => {
  const SECRET_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'DATABASE_URL', 'TEST_DATABASE_URL'] as const;
  const only = (vars: Partial<Record<(typeof SECRET_VARS)[number], string>>) => {
    for (const k of SECRET_VARS) vi.stubEnv(k, vars[k] ?? '');
  };
  afterEach(() => vi.unstubAllEnvs());

  it('a key with edge whitespace and an inner invalid char: the TRIMMED form quoted by the error is redacted', () => {
    const raw = ' sk-ant-dummy-EDGE\nINNER-0123456789 \n';
    only({ ANTHROPIC_API_KEY: raw });
    let err: unknown;
    try {
      new Headers({ 'x-api-key': raw.trim() }); // the SDK sends readEnv(...) = the trimmed value
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(TypeError);
    expect((err as Error).message).toContain(raw.trim()); // precondition: the error quotes the trimmed key
    const text = keeperErrorText(err, productionDeps().secrets());
    expect(text).toContain('[redacted]');
    expect(text).not.toMatch(/EDGE|INNER/);
  });

  it('ANTHROPIC_AUTH_TOKEN is redacted', () => {
    only({ ANTHROPIC_AUTH_TOKEN: 'sk-ant-dummy-authtoken-0123456789' });
    const text = keeperErrorText(new Error('bad bearer sk-ant-dummy-authtoken-0123456789'), productionDeps().secrets());
    expect(text).toBe('Error: bad bearer [redacted]');
  });

  it('a DATABASE_URL password with a malformed escape (%zz): the raw password is still redacted', () => {
    only({ DATABASE_URL: 'postgres://owner:dummy%zzPW-0123@127.0.0.1:5432/x' });
    expect(productionDeps().secrets()).toContain('dummy%zzPW-0123');
    const text = keeperErrorText(new Error('auth failed with dummy%zzPW-0123'), productionDeps().secrets());
    expect(text).toBe('Error: auth failed with [redacted]');
  });

  it('raw and trimmed values, deduped, no empties; a decodable password adds its decoded form', () => {
    only({ ANTHROPIC_API_KEY: ' sk-ant-dummy-k ', DATABASE_URL: 'postgres://owner:p%40ss-dummy@127.0.0.1/x' });
    expect(productionDeps().secrets()).toEqual([
      ' sk-ant-dummy-k ',
      'sk-ant-dummy-k',
      'postgres://owner:p%40ss-dummy@127.0.0.1/x',
      'p%40ss-dummy',
      'p@ss-dummy',
    ]);
  });
});
