// API checks against a running `next dev` (3.1-C7), called from test/dev-agent-files.test.ts so
// that ONE dev-server start covers P14 and the API: Next's dev lock forbids a second `next dev`
// in app/, and vitest runs test files in parallel. The server runs with an allowlisted env (no
// model key, no DATABASE_URL), so this proves the real webpack bundle of pg + the service +
// the guards: the key guard comes first, the database guard next, Host / Content-Type / body
// cap before either.
import { request } from 'node:http';

import { expect } from 'vitest';

const ABSENT = '00000000-0000-4000-8000-000000000000';

interface Reply {
  readonly status: number;
  readonly cacheControl: string | undefined;
  readonly body: unknown;
}

/** node:http, so the Host header can be set (fetch forbids it). */
function call(port: number, method: string, path: string, headers: Record<string, string>, body?: string | Buffer): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed: unknown = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // keep the text for the failure message
        }
        const cc = res.headers['cache-control'];
        resolve({ status: res.statusCode ?? 0, cacheControl: Array.isArray(cc) ? cc.join(',') : cc, body: parsed });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

const errorCode = (r: Reply) => (r.body as { error?: { code?: unknown } }).error?.code;

export async function devApiChecks(port: number, output: () => string): Promise<void> {
  const host = `127.0.0.1:${port}`;
  const jsonHeaders = { host, 'content-type': 'application/json' };
  const checks: [string, () => Promise<Reply>, number, string][] = [
    ['POST /api/sessions', () => call(port, 'POST', '/api/sessions', jsonHeaders, '{"region":"dark_lands"}'), 503, 'database_not_configured'],
    ['GET /api/sessions/:id', () => call(port, 'GET', `/api/sessions/${ABSENT}`, { host }), 503, 'database_not_configured'],
    ['POST turns (key guard first)', () => call(port, 'POST', `/api/sessions/${ABSENT}/turns`, jsonHeaders, '{"turnIndex":0}'), 503, 'keeper_not_configured'],
    ['POST prose (key guard first)', () => call(port, 'POST', `/api/sessions/${ABSENT}/turns/0/prose`, jsonHeaders, '{}'), 503, 'keeper_not_configured'],
    ['foreign Host on GET', () => call(port, 'GET', `/api/sessions/${ABSENT}`, { host: 'evil.example' }), 403, 'forbidden_host'],
    ['foreign Host on POST', () => call(port, 'POST', '/api/sessions', { ...jsonHeaders, host: `evil.example:${port}` }, '{"region":"dark_lands"}'), 403, 'forbidden_host'],
    ['foreign Host on health', () => call(port, 'GET', '/api/health', { host: 'evil.example' }), 403, 'forbidden_host'],
    ['cross Origin', () => call(port, 'POST', '/api/sessions', { ...jsonHeaders, origin: 'https://evil.example' }, '{"region":"dark_lands"}'), 403, 'forbidden_origin'],
    ['text/plain', () => call(port, 'POST', '/api/sessions', { host, 'content-type': 'text/plain' }, '{"region":"dark_lands"}'), 415, 'unsupported_media_type'],
    ['oversize', () => call(port, 'POST', '/api/sessions', jsonHeaders, Buffer.alloc(5000, 0x20)), 413, 'payload_too_large'],
  ];
  for (const [name, run, status, code] of checks) {
    const r = await run();
    const ctx = `${name}: ${JSON.stringify(r.body)}\n${output()}`;
    expect(r.status, ctx).toBe(status);
    expect(errorCode(r), ctx).toBe(code);
    expect(r.cacheControl, ctx).toBe('no-store');
  }
}
