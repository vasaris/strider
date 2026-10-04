// The API handlers with Request objects and test deps: the guard matrix (Host, Origin,
// Content-Type, body cap, JSON shape), path/body validation, the fixed error bodies (no internal
// message ever leaks), no-store headers, and one success response per endpoint.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_ERRORS, ApiError, errorResponse, type ApiErrorCode } from '../../src/server/http/errors';
import { BODY_LIMIT_BYTES } from '../../src/server/http/guard';
import { handleCreateSession, handleGetSession, handleListSessions, handlePlayTurn, handleRegenerate } from '../../src/server/http/handlers';
import type { ServiceDeps } from '../../src/server/service/ports';
import { MemorySessionStore } from '../../src/server/store/memory';
import { InvalidRecordError, type SessionStore } from '../../src/server/store/types';
import { BLOCKED_PROSE, FAKE_SECRET, testDeps } from '../support/service';

const HOST = '127.0.0.1:3000';
const BASE = `http://${HOST}`;
const ABSENT = '00000000-0000-4000-8000-000000000000';
const SECRET_URL = 'postgres://owner:hunter2-pw@db.internal:5432/brodyazhnik';

afterEach(() => vi.restoreAllMocks());

function post(path: string, body: BodyInit | null, headers: Record<string, string> = {}): Request {
  const init: RequestInit & { duplex?: 'half' } = {
    method: 'POST',
    headers: { host: HOST, 'content-type': 'application/json', ...headers },
    body,
  };
  if (body instanceof ReadableStream) init.duplex = 'half';
  return new Request(BASE + path, init);
}
const get = (path: string, headers: Record<string, string> = {}) => new Request(BASE + path, { headers: { host: HOST, ...headers } });
const json = (v: unknown) => JSON.stringify(v);

async function expectError(res: Response, code: ApiErrorCode, extras: Record<string, unknown> = {}): Promise<void> {
  expect(res.status).toBe(API_ERRORS[code].status);
  expect(res.headers.get('cache-control')).toBe('no-store');
  expect(res.headers.get('content-type')).toMatch(/^application\/json/);
  expect(await res.json()).toEqual({ error: { code, message: API_ERRORS[code].message }, ...extras });
}

/** One call of each handler with the given request decorations. */
function allHandlers(deps: ServiceDeps, headers: Record<string, string>) {
  return [
    () => handleCreateSession(post('/api/sessions', json({ region: 'dark_lands' }), headers), deps),
    () => handleGetSession(get(`/api/sessions/${ABSENT}`, headers), ABSENT, deps),
    () => handlePlayTurn(post(`/api/sessions/${ABSENT}/turns`, json({ turnIndex: 0 }), headers), ABSENT, deps),
    () => handleRegenerate(post(`/api/sessions/${ABSENT}/turns/0/prose`, null, headers), ABSENT, '0', deps),
    () => handleListSessions(get('/api/sessions', headers), deps),
  ];
}

describe('error table', () => {
  it('every code renders exactly { error: { code, message } } with its fixed status and message', async () => {
    for (const code of Object.keys(API_ERRORS) as ApiErrorCode[]) {
      await expectError(errorResponse(new ApiError(code)), code);
    }
    expect(Object.keys(API_ERRORS).sort()).toEqual(
      [
        'invalid_request', 'forbidden_host', 'forbidden_origin', 'not_found', 'session_not_found', 'turn_not_found',
        'pack_mismatch', 'journey_complete', 'turn_conflict', 'generation_in_progress', 'payload_too_large', 'unsupported_media_type',
        'unsupported_route', 'internal_error', 'keeper_failed', 'keeper_not_configured', 'database_not_configured',
        'database_unavailable', 'database_misconfigured',
      ].sort(),
    );
  });
});

describe('Host (every route, DNS rebinding)', () => {
  it.each(['evil.example', 'evil.example:3000', '127.0.0.1.evil.example', 'localhost.evil', '127.0.0.2:3000', '[::1]x', '0.0.0.0:3000', ''])(
    'foreign Host %j -> 403 forbidden_host on all five handlers',
    async (host) => {
      const deps = testDeps(new MemorySessionStore());
      for (const call of allHandlers(deps, { host })) await expectError(await call(), 'forbidden_host');
      expect(deps.llm.calls).toEqual([]);
    },
  );

  it('a missing Host -> 403', async () => {
    const deps = testDeps(new MemorySessionStore());
    const req = new Request(`${BASE}/api/sessions/${ABSENT}`);
    expect(req.headers.get('host')).toBeNull();
    await expectError(await handleGetSession(req, ABSENT, deps), 'forbidden_host');
  });

  it.each(['127.0.0.1', '127.0.0.1:3000', 'localhost', 'localhost:49152', 'LOCALHOST:3000', '[::1]', '[::1]:3000'])(
    'loopback Host %j is allowed',
    async (host) => {
      const deps = testDeps(new MemorySessionStore());
      const res = await handleCreateSession(post('/api/sessions', json({ region: 'dark_lands' }), { host }), deps);
      expect(res.status).toBe(201);
      await expectError(await handleGetSession(get(`/api/sessions/${ABSENT}`, { host }), ABSENT, deps), 'session_not_found');
    },
  );
});

describe('Origin and Content-Type (mutating routes)', () => {
  it('Origin absent or same-origin -> allowed', async () => {
    const deps = testDeps(new MemorySessionStore());
    expect((await handleCreateSession(post('/api/sessions', json({ region: 'dark_lands' })), deps)).status).toBe(201);
    const same = { origin: `http://${HOST}` };
    expect((await handleCreateSession(post('/api/sessions', json({ region: 'dark_lands' }), same), deps)).status).toBe(201);
    const v6 = { host: '[::1]:3000', origin: 'http://[::1]:3000' };
    expect((await handleCreateSession(post('/api/sessions', json({ region: 'dark_lands' }), v6), deps)).status).toBe(201);
  });

  it.each(['null', 'https://evil.example', 'http://localhost:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1', 'file://', 'http://127.0.0.1:3000/x'])(
    'Origin %j with Host 127.0.0.1:3000 -> 403 forbidden_origin on every POST',
    async (origin) => {
      const deps = testDeps(new MemorySessionStore());
      const [create, , play, regen] = allHandlers(deps, { origin });
      for (const call of [create, play, regen]) await expectError(await call!(), 'forbidden_origin');
    },
  );

  it.each([undefined, 'text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/jsonx', 'text/json'])(
    'Content-Type %j -> 415 on every POST',
    async (type) => {
      const deps = testDeps(new MemorySessionStore());
      const headers: Record<string, string> = type === undefined ? {} : { 'content-type': type };
      const reqs = [
        post('/api/sessions', json({ region: 'dark_lands' }), headers),
        post(`/api/sessions/${ABSENT}/turns`, json({ turnIndex: 0 }), headers),
        post(`/api/sessions/${ABSENT}/turns/0/prose`, null, headers),
      ];
      if (type === undefined) for (const r of reqs) r.headers.delete('content-type');
      await expectError(await handleCreateSession(reqs[0]!, deps), 'unsupported_media_type');
      await expectError(await handlePlayTurn(reqs[1]!, ABSENT, deps), 'unsupported_media_type');
      await expectError(await handleRegenerate(reqs[2]!, ABSENT, '0', deps), 'unsupported_media_type');
    },
  );

  it('application/json with parameters is accepted', async () => {
    const deps = testDeps(new MemorySessionStore());
    const res = await handleCreateSession(post('/api/sessions', json({ region: 'wild_lands' }), { 'content-type': 'Application/JSON; charset=utf-8' }), deps);
    expect(res.status).toBe(201);
  });

  it('order: Host before Origin before Content-Type', async () => {
    const deps = testDeps(new MemorySessionStore());
    const bad = { host: 'evil.example', origin: 'null', 'content-type': 'text/plain' };
    await expectError(await handleCreateSession(post('/api/sessions', 'x', bad), deps), 'forbidden_host');
    await expectError(await handleCreateSession(post('/api/sessions', 'x', { origin: 'null', 'content-type': 'text/plain' }), deps), 'forbidden_origin');
  });
});

describe('body cap and JSON', () => {
  it('Content-Length over 4096 -> 413 without reading the body', async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(c) {
          pulls++;
          c.enqueue(new TextEncoder().encode('{}'));
          c.close();
        },
      },
      { highWaterMark: 0 },
    );
    const deps = testDeps(new MemorySessionStore());
    const res = await handleCreateSession(post('/api/sessions', stream, { 'content-length': String(BODY_LIMIT_BYTES + 1) }), deps);
    await expectError(res, 'payload_too_large');
    expect(pulls).toBe(0);
  });

  it('a chunked body over the cap -> 413 and the stream is cancelled', async () => {
    let sent = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(c) {
          sent++;
          c.enqueue(new Uint8Array(2000).fill(0x20));
          if (sent > 50) c.close();
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const deps = testDeps(new MemorySessionStore());
    const res = await handleCreateSession(post('/api/sessions', stream), deps);
    await expectError(res, 'payload_too_large');
    expect(sent).toBeLessThanOrEqual(4);
    expect(cancelled).toBe(true);
  });

  it('exactly 4096 bytes is read (and then judged on its shape); 4097 is refused', async () => {
    const deps = testDeps(new MemorySessionStore());
    const at = (n: number) => {
      const head = '{"region":"dark_lands","pad":"';
      return head + 'x'.repeat(n - head.length - 2) + '"}';
    };
    expect(new TextEncoder().encode(at(4096)).byteLength).toBe(4096);
    await expectError(await handleCreateSession(post('/api/sessions', at(4096)), deps), 'invalid_request'); // extra key
    await expectError(await handleCreateSession(post('/api/sessions', at(4097)), deps), 'payload_too_large');
  });

  it.each([
    ['empty', ''],
    ['invalid JSON', '{region:'],
    ['array', '[]'],
    ['string', '"dark_lands"'],
    ['number', '1'],
    ['null', 'null'],
    ['extra key', json({ region: 'dark_lands', state: {} })],
    ['missing key', json({})],
    ['bad region', json({ region: 'mordor' })],
    ['proto key', '{"region":"dark_lands","__proto__":{}}'],
  ])('POST /api/sessions with %s -> 400 invalid_request', async (_name, body) => {
    const deps = testDeps(new MemorySessionStore());
    await expectError(await handleCreateSession(post('/api/sessions', body), deps), 'invalid_request');
  });

  it('invalid UTF-8 -> 400', async () => {
    const deps = testDeps(new MemorySessionStore());
    const bytes = new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d]);
    await expectError(await handleCreateSession(post('/api/sessions', bytes), deps), 'invalid_request');
  });

  it.each([[-1], [1.5], ['0'], [2 ** 31], [null], [true]])('turnIndex %j -> 400', async (turnIndex) => {
    const deps = testDeps(new MemorySessionStore());
    await expectError(await handlePlayTurn(post(`/api/sessions/${ABSENT}/turns`, json({ turnIndex })), ABSENT, deps), 'invalid_request');
  });

  it('turns body with an extra field (client state / pkg) -> 400; nothing is persisted from the client', async () => {
    const deps = testDeps(new MemorySessionStore());
    for (const extra of [{ state: {} }, { pkg: {} }, { provenance: {} }]) {
      const res = await handlePlayTurn(post(`/api/sessions/${ABSENT}/turns`, json({ turnIndex: 0, ...extra })), ABSENT, deps);
      await expectError(res, 'invalid_request');
    }
    await expectError(await handleRegenerate(post(`/api/sessions/${ABSENT}/turns/0/prose`, json({ prose: 'x' })), ABSENT, '0', deps), 'invalid_request');
  });
});

describe('path params', () => {
  it('a non-uuid id -> 404 session_not_found (get, play, regenerate)', async () => {
    const deps = testDeps(new MemorySessionStore());
    await expectError(await handleGetSession(get('/api/sessions/x'), 'x', deps), 'session_not_found');
    await expectError(await handlePlayTurn(post('/api/sessions/x/turns', json({ turnIndex: 0 })), 'x', deps), 'session_not_found');
    await expectError(await handleRegenerate(post('/api/sessions/x/turns/0/prose', '{}'), 'x', '0', deps), 'session_not_found');
  });

  it.each(['-1', '01', '1.0', 'abc', '', '2147483648', '1e3', ' 1'])('n %j -> 400 invalid_request', async (n) => {
    const deps = testDeps(new MemorySessionStore());
    await expectError(await handleRegenerate(post(`/api/sessions/${ABSENT}/turns/${encodeURIComponent(n)}/prose`, null), ABSENT, n, deps), 'invalid_request');
  });
});

describe('no internal message leaks (C7-1)', () => {
  const failing = (err: unknown): SessionStore =>
    new Proxy(new MemorySessionStore(), {
      get(target, prop, recv) {
        if (prop === 'getSession' || prop === 'createSession') return () => Promise.reject(err);
        return Reflect.get(target, prop, recv) as unknown;
      },
    });

  it.each([
    ['an unknown store error', Object.assign(new Error(`relation failure at ${SECRET_URL}`), { code: 'XX000' }), 'internal_error'],
    ['an InvalidRecordError', new InvalidRecordError(`value ${SECRET_URL} violates check`), 'internal_error'],
    ['a connection error', Object.assign(new Error(`connect ECONNREFUSED ${SECRET_URL}`), { code: 'ECONNREFUSED' }), 'database_unavailable'],
    ['an unmigrated schema', Object.assign(new Error(`relation "brodyazhnik.sessions" does not exist ${SECRET_URL}`), { code: '42P01' }), 'database_misconfigured'],
    ['a non-Error', `thrown string ${SECRET_URL}`, 'internal_error'],
  ] as const)('%s -> fixed %s body; neither the body nor the log carries the message', async (_n, err, code) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps = testDeps(failing(err));
    for (const res of [
      await handleGetSession(get(`/api/sessions/${ABSENT}`), ABSENT, deps),
      await handleCreateSession(post('/api/sessions', json({ region: 'dark_lands' })), deps),
    ]) {
      const text = await res.clone().text();
      expect(text).not.toContain('hunter2');
      expect(text).not.toContain('db.internal');
      await expectError(res, code);
    }
    const logged = log.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).not.toContain('hunter2');
    expect(logged).not.toContain('db.internal');
    expect(logged).toContain(code);
  });

  it('a Keeper error message reaches neither the 502 body nor the log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = new MemorySessionStore();
    const deps = testDeps(store);
    const created = (await (await handleCreateSession(post('/api/sessions', json({ region: 'dark_lands' })), deps)).json()) as { session: { id: string } };
    const id = created.session.id;
    deps.llm.fail = new Error(`upstream said ${FAKE_SECRET}`);
    const res = await handlePlayTurn(post(`/api/sessions/${id}/turns`, json({ turnIndex: 0 })), id, deps);
    const turn = await store.getTurn(id, 0);
    await expectError(res, 'keeper_failed', { turnIndex: 0, nextTurnIndex: 1, journeyComplete: false, pkg: turn?.pkg });
    const logged = log.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).toBe('turn: keeper_failed (Error)');
    const regen = await handleRegenerate(post(`/api/sessions/${id}/turns/0/prose`, null), id, '0', deps);
    await expectError(regen, 'keeper_failed', { turnIndex: 0 });
  });
});

describe('success responses', () => {
  it('create 201 -> get 200 -> play 201 -> regenerate 201 (JSON, no-store)', async () => {
    const deps = testDeps(new MemorySessionStore());
    const c = await handleCreateSession(post('/api/sessions', json({ region: 'border_lands' })), deps);
    expect(c.status).toBe(201);
    expect(c.headers.get('cache-control')).toBe('no-store');
    const created = (await c.json()) as { session: { id: string; region: string }; nextTurnIndex: number; journeyComplete: boolean };
    expect(created.nextTurnIndex).toBe(0);
    expect(created.journeyComplete).toBe(false);
    expect(created.session.region).toBe('border_lands');
    const id = created.session.id;

    const p = await handlePlayTurn(post(`/api/sessions/${id}/turns`, json({ turnIndex: 0 })), id, deps);
    expect(p.status).toBe(201);
    expect(p.headers.get('cache-control')).toBe('no-store');
    const played = (await p.json()) as Record<string, unknown>;
    expect(Object.keys(played).sort()).toEqual([
      'gate', 'generationId', 'journeyComplete', 'labels', 'nextTurnIndex', 'pkg', 'prose', 'proseState', 'turnIndex',
    ]);
    expect(played['proseState']).toBe('ready');
    expect(played['nextTurnIndex']).toBe(1);

    const r = await handleRegenerate(post(`/api/sessions/${id}/turns/0/prose`, '{}'), id, '0', deps);
    expect(r.status).toBe(201);
    expect(Object.keys((await r.json()) as object).sort()).toEqual(['gate', 'generationId', 'prose', 'proseState', 'turnIndex']);

    const g = await handleGetSession(get(`/api/sessions/${id}`), id, deps);
    expect(g.status).toBe(200);
    expect(g.headers.get('cache-control')).toBe('no-store');
    const detail = (await g.json()) as { turns: { generations: number }[]; nextTurnIndex: number; packCurrent: boolean };
    expect(detail.nextTurnIndex).toBe(1);
    expect(detail.packCurrent).toBe(true);
    expect(detail.turns[0]?.generations).toBe(2);

    await expectError(await handlePlayTurn(post(`/api/sessions/${id}/turns`, json({ turnIndex: 3 })), id, deps), 'turn_conflict', { nextTurnIndex: 1 });
  });

  it('key missing -> 503 keeper_not_configured from the turn and prose routes', async () => {
    const deps = testDeps(new MemorySessionStore(), { keyPresent: () => false });
    await expectError(await handlePlayTurn(post(`/api/sessions/${ABSENT}/turns`, json({ turnIndex: 0 })), ABSENT, deps), 'keeper_not_configured');
    await expectError(await handleRegenerate(post(`/api/sessions/${ABSENT}/turns/0/prose`, null), ABSENT, '0', deps), 'keeper_not_configured');
  });
});

describe('K4: session list, generation lock, the gate in response bodies', () => {
  it('GET /api/sessions -> 200 { sessions } (JSON, no-store), most recent first', async () => {
    const deps = testDeps(new MemorySessionStore());
    const empty = await handleListSessions(get('/api/sessions'), deps);
    expect(empty.status).toBe(200);
    expect(empty.headers.get('cache-control')).toBe('no-store');
    expect(await empty.json()).toEqual({ sessions: [] });
    const created = (await (await handleCreateSession(post('/api/sessions', json({ region: 'wild_lands' })), deps)).json()) as { session: { id: string } };
    await handlePlayTurn(post(`/api/sessions/${created.session.id}/turns`, json({ turnIndex: 0 })), created.session.id, deps);
    const list = (await (await handleListSessions(get('/api/sessions'), deps)).json()) as { sessions: Record<string, unknown>[] };
    expect(list.sessions).toEqual([{ session: created.session, nextTurnIndex: 1, journeyComplete: false }]);
  });

  it('GET /api/sessions maps store errors to fixed bodies', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps = testDeps(async () => {
      throw new ApiError('database_not_configured');
    });
    await expectError(await handleListSessions(get('/api/sessions'), deps), 'database_not_configured');
    const failing = new Proxy(new MemorySessionStore(), {
      get(target, prop, recv) {
        if (prop === 'listRecentSessions') return () => Promise.reject(new Error(`boom ${SECRET_URL}`));
        return Reflect.get(target, prop, recv) as unknown;
      },
    });
    const res = await handleListSessions(get('/api/sessions'), testDeps(failing));
    expect(await res.clone().text()).not.toContain('hunter2');
    await expectError(res, 'internal_error');
    expect(log.mock.calls.map((c) => String(c[0]))).toEqual(['GET /api/sessions: database_not_configured', 'GET /api/sessions: internal_error (Error)']);
    log.mockRestore();
  });

  it('409 generation_in_progress: the fixed body, no extras', async () => {
    const deps = testDeps(new MemorySessionStore());
    const created = (await (await handleCreateSession(post('/api/sessions', json({ region: 'dark_lands' })), deps)).json()) as { session: { id: string } };
    const id = created.session.id;
    await handlePlayTurn(post(`/api/sessions/${id}/turns`, json({ turnIndex: 0 })), id, deps);
    deps.lock.tryAcquire(id, 0);
    await expectError(await handleRegenerate(post(`/api/sessions/${id}/turns/0/prose`, null), id, '0', deps), 'generation_in_progress');
    deps.lock.tryAcquire(id, 1);
    await expectError(await handlePlayTurn(post(`/api/sessions/${id}/turns`, json({ turnIndex: 1 })), id, deps), 'generation_in_progress');
    const g = (await (await handleGetSession(get(`/api/sessions/${id}`), id, deps)).json()) as { turns: { generating: boolean }[] };
    expect(g.turns[0]?.generating).toBe(true);
  });

  it('a blocked prose never appears in any response body (play, regenerate, get); its findings do', async () => {
    const deps = testDeps(new MemorySessionStore());
    const created = (await (await handleCreateSession(post('/api/sessions', json({ region: 'dark_lands' })), deps)).json()) as { session: { id: string } };
    const id = created.session.id;
    deps.llm.replies.push(BLOCKED_PROSE, BLOCKED_PROSE);
    const bodies = [
      await (await handlePlayTurn(post(`/api/sessions/${id}/turns`, json({ turnIndex: 0 })), id, deps)).text(),
      await (await handleRegenerate(post(`/api/sessions/${id}/turns/0/prose`, null), id, '0', deps)).text(),
      await (await handleGetSession(get(`/api/sessions/${id}`), id, deps)).text(),
      await (await handleListSessions(get('/api/sessions'), deps)).text(),
    ];
    for (const b of bodies) expect(b).not.toContain(BLOCKED_PROSE);
    const played = JSON.parse(bodies[0]!) as { prose: unknown; proseState: string; gate: { severity: string }[] };
    expect(played.prose).toBeNull();
    expect(played.proseState).toBe('blocked');
    expect(played.gate.some((f) => f.severity === 'block')).toBe(true);
    const detail = JSON.parse(bodies[2]!) as { turns: { proseState: string; prose: unknown }[]; labels: Record<string, unknown> };
    expect(detail.turns[0]).toMatchObject({ proseState: 'blocked', prose: null });
    expect(Object.keys(detail.labels).sort()).toEqual(['conditions', 'outcomes', 'regions', 'roles', 'rolls', 'scenes', 'skills', 'trackers']);
  });
});
