// The app's Keeper wiring: model default + KEEPER_MODEL override, and the recorded error text.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { productionDeps } from '../../src/server/service/deps';
import { DEFAULT_KEEPER_MODEL, KEEPER_PROMPT, keeperErrorText, keeperModel } from '../../src/server/service/keeper';

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
