// public/sw.js is install/activate only: no fetch listener, no Cache API (offline is chat 3.4.b).
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

const SRC = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

type Handler = (event: unknown) => void;

function loadWorker() {
  const types: string[] = []; // registration order; a duplicate listener shows up twice
  const handlers = new Map<string, Handler>();
  const calls: string[] = [];
  const self = {
    addEventListener: (type: string, fn: Handler) => {
      types.push(type);
      handlers.set(type, fn);
    },
    skipWaiting: () => {
      calls.push('skipWaiting');
      return Promise.resolve();
    },
    clients: {
      claim: () => {
        calls.push('claim');
        return Promise.resolve();
      },
    },
  };
  runInNewContext(SRC, { self });
  return { types, handlers, calls };
}

describe('service worker', () => {
  it('registers exactly one install and one activate listener, in that order', () => {
    expect(loadWorker().types).toEqual(['install', 'activate']);
  });

  it('runs both handlers against a fake event', () => {
    const { handlers, calls } = loadWorker();
    const waited: unknown[] = [];
    const event = { waitUntil: (p: unknown) => waited.push(p) };
    expect(() => handlers.get('install')?.(event)).not.toThrow();
    expect(() => handlers.get('activate')?.(event)).not.toThrow();
    expect(calls).toEqual(['skipWaiting', 'claim']);
    expect(waited).toHaveLength(1);
  });

  it('has no Cache API use and no fetch listener', () => {
    expect(SRC).not.toMatch(/\bcaches\b/);
    expect(SRC).not.toMatch(/addEventListener\(\s*['"]fetch['"]/);
    expect(SRC).not.toMatch(/\bonfetch\b/);
  });
});
