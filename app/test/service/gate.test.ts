// K4 (LG1, API-RES1) through the service over the Memory store with the real pack and the app's
// Keeper factory over a fake LlmClient: the live prose gate at write and read time (F3, R3), the
// proseState precedence, the blocked text never leaving the server, U+0000 stripping, a generation
// row that cannot be written, the in-process generation lock, the generating flag, labels, and the
// session list.
import { describe, expect, it, vi } from 'vitest';

import { ApiError, type ApiErrorCode } from '../../src/server/http/errors';
import { InProcessGenerationLock } from '../../src/server/service/lock';
import { RECENT_SESSIONS_LIMIT, SessionService } from '../../src/server/service/sessions';
import { MemorySessionStore } from '../../src/server/store/memory';
import { InvalidRecordError, type KeeperProvenance, type SessionStore } from '../../src/server/store/types';
import { BLOCKED_PROSE, FAKE_SECRET, LABELS, testDeps, VK, WARN_PROSE } from '../support/service';

const PROV: KeeperProvenance = {
  model: 'claude-test-model',
  keeperPromptPath: 'prompts/keeper.system.v0.3.md',
  keeperPromptSha256: '0'.repeat(64),
  toneSha256: '1'.repeat(64),
  assemblySha256: '2'.repeat(64),
};
const OK_TEXT = 'The wind smelled of rain.';
const BLOCK_TERM = BLOCKED_PROSE.slice(BLOCKED_PROSE.lastIndexOf(' ') + 1, -1);

async function rejection(p: Promise<unknown>, code: ApiErrorCode): Promise<ApiError> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, `expected ApiError ${code}`).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
  return err as ApiError;
}

/** A session with turn 0 played (prose from the default fake reply). */
async function played(store: SessionStore = new MemorySessionStore()) {
  const deps = testDeps(store);
  const svc = new SessionService(deps);
  const { session } = await svc.createSession('dark_lands');
  return { store, deps, svc, id: session.id };
}

/** A session with turn 0 saved and NO generation; generations appended straight to the store. */
async function bare(...gens: ({ prose: string } | { error: string })[]) {
  const store = new MemorySessionStore();
  const deps = testDeps(store);
  const svc = new SessionService(deps);
  const { session } = await svc.createSession('dark_lands');
  const env = deps.env();
  const t = deps.step((await store.getSession(session.id))!.initialState, env.cfg);
  await store.appendTurn({ sessionId: session.id, turnIndex: 0, state: t.next, pkg: t.pkg, packVersion: env.packVersion });
  for (const g of gens) {
    await store.appendGeneration(
      'prose' in g
        ? { sessionId: session.id, turnIndex: 0, ...PROV, prose: g.prose, error: null }
        : { sessionId: session.id, turnIndex: 0, ...PROV, prose: null, error: g.error },
    );
  }
  return { store, deps, svc, id: session.id };
}

const turn0 = async (svc: SessionService, id: string) => (await svc.getSession(id)).turns[0]!;

describe('the gate at write time (POST turn / regeneration)', () => {
  it('accepted prose: ready, the text, its warn findings as { list, term, severity }', async () => {
    const { deps, svc, id } = await played();
    deps.llm.replies.push(WARN_PROSE);
    const t = await svc.playTurn(id, 0);
    expect(t).toMatchObject({ prose: WARN_PROSE, proseState: 'ready', generationId: expect.any(String) });
    expect(t.gate).toEqual([{ list: 'slop_en', term: 'in that moment', severity: 'warn' }]);
    for (const f of t.gate) expect(Object.keys(f).sort()).toEqual(['list', 'severity', 'term']);
  });

  it('blocked prose: 201 with prose null, proseState blocked, block + warn findings; the row is stored', async () => {
    const { store, deps, svc, id } = await played();
    deps.llm.replies.push(BLOCKED_PROSE);
    const t = await svc.playTurn(id, 0);
    expect(t).toMatchObject({ turnIndex: 0, prose: null, proseState: 'blocked', nextTurnIndex: 1, generationId: expect.any(String) });
    expect(t.gate).toEqual([
      { list: 'calque', term: BLOCK_TERM, severity: 'block' },
      { list: 'slop_en', term: 'in that moment', severity: 'warn' },
    ]);
    expect(JSON.stringify(t)).not.toContain(BLOCKED_PROSE);
    expect((await store.listGenerations(id, 0)).map((g) => g.prose)).toEqual([BLOCKED_PROSE]); // stored, never returned
    expect(await turn0(svc, id)).toMatchObject({ prose: null, proseState: 'blocked', gate: t.gate, generations: 1 });
  });

  it('a blocked regeneration after an accepted one keeps the accepted text (GET); its own response is blocked', async () => {
    const { store, deps, svc, id } = await played();
    const first = await svc.playTurn(id, 0);
    deps.llm.replies.push(BLOCKED_PROSE);
    const regen = await svc.regenerateProse(id, 0);
    expect(regen).toEqual({ turnIndex: 0, prose: null, proseState: 'blocked', gate: expect.any(Array), generationId: expect.any(String) });
    const view = await turn0(svc, id);
    expect(view).toMatchObject({ prose: first.prose, proseState: 'ready', gate: [], generations: 2 });
    expect(JSON.stringify(regen)).not.toContain(BLOCKED_PROSE);
    expect(JSON.stringify(await svc.getSession(id))).not.toContain(BLOCKED_PROSE);
    expect((await store.listGenerations(id, 0))).toHaveLength(2);
  });

  it('a failed regeneration after an accepted one keeps the accepted text', async () => {
    const { deps, svc, id } = await played();
    const first = await svc.playTurn(id, 0);
    deps.llm.fail = new Error('overloaded');
    await rejection(svc.regenerateProse(id, 0), 'keeper_failed');
    expect(await turn0(svc, id)).toMatchObject({ prose: first.prose, proseState: 'ready', generations: 2 });
  });
});

describe('TurnView precedence (GET)', () => {
  const A = { prose: OK_TEXT };
  const A2 = { prose: WARN_PROSE };
  const B = { prose: BLOCKED_PROSE };
  const F = { error: 'Error: overloaded' };
  const blockedGate = [
    { list: 'calque', term: BLOCK_TERM, severity: 'block' },
    { list: 'slop_en', term: 'in that moment', severity: 'warn' },
  ];

  it.each([
    ['no generation', [], { prose: null, proseState: 'missing', gate: [] }],
    ['accepted', [A], { prose: OK_TEXT, proseState: 'ready', gate: [] }],
    ['failed', [F], { prose: null, proseState: 'failed', gate: [] }],
    ['blocked', [B], { prose: null, proseState: 'blocked', gate: blockedGate }],
    ['accepted, blocked', [A, B], { prose: OK_TEXT, proseState: 'ready', gate: [] }],
    ['accepted, failed', [A, F], { prose: OK_TEXT, proseState: 'ready', gate: [] }],
    ['accepted, accepted (latest wins)', [A, A2], { prose: WARN_PROSE, proseState: 'ready', gate: [{ list: 'slop_en', term: 'in that moment', severity: 'warn' }] }],
    ['accepted (warn), failed, blocked', [A2, F, B], { prose: WARN_PROSE, proseState: 'ready' }],
    ['blocked, accepted', [B, A], { prose: OK_TEXT, proseState: 'ready', gate: [] }],
    ['blocked, failed: failed, gate of the blocked one', [B, F], { prose: null, proseState: 'failed', gate: blockedGate }],
    ['failed, blocked', [F, B], { prose: null, proseState: 'blocked', gate: blockedGate }],
  ] as const)('%s', async (_name, gens, expected) => {
    const { svc, id } = await bare(...gens);
    const view = await turn0(svc, id);
    expect(view).toMatchObject({ ...expected, generations: gens.length, generating: false });
    expect(JSON.stringify(await svc.getSession(id))).not.toContain(BLOCKED_PROSE);
  });

  it('R3: the verdict is computed at read time -- a stricter gate later re-hides stored prose', async () => {
    const { store, svc, id } = await bare({ prose: OK_TEXT });
    expect((await turn0(svc, id)).proseState).toBe('ready');
    const stricter = new SessionService(testDeps(store, { vk: () => [...VK, { term: 'rain', reason: 'test-only stricter entry', severity: 'block' }] }));
    const view = await turn0(stricter, id);
    expect(view).toMatchObject({ prose: null, proseState: 'blocked', gate: [{ list: 'vk_addendum', term: 'rain', severity: 'block' }] });
    expect(JSON.stringify(await stricter.getSession(id))).not.toContain(OK_TEXT);
  });
});

describe('API-RES1 (1): U+0000 and a generation row that cannot be written', () => {
  it('U+0000 is stripped from the Keeper prose before the gate and the write', async () => {
    const { store, deps, svc, id } = await played();
    deps.llm.replies.push('The wind\u0000 smelled\u0000 of rain.');
    const t = await svc.playTurn(id, 0);
    expect(t.prose).toBe('The wind smelled of rain.');
    expect((await store.listGenerations(id, 0))[0]?.prose).toBe('The wind smelled of rain.');
  });

  it('appendGeneration fails after a successful Keeper call: 201 missing, turn saved, code logged only; GET missing', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const inner = new MemorySessionStore();
      const store = new Proxy(inner, {
        get(target, prop, recv) {
          if (prop === 'appendGeneration') return () => Promise.reject(new InvalidRecordError(`prose rejected ${FAKE_SECRET}`));
          return Reflect.get(target, prop, recv) as unknown;
        },
      });
      const deps = testDeps(store);
      const svc = new SessionService(deps);
      const { session } = await svc.createSession('dark_lands');
      const t = await svc.playTurn(session.id, 0);
      expect(t).toMatchObject({ turnIndex: 0, prose: null, proseState: 'missing', gate: [], generationId: null, nextTurnIndex: 1 });
      expect(await inner.getTurn(session.id, 0)).not.toBeNull();
      expect(await turn0(svc, session.id)).toMatchObject({ prose: null, proseState: 'missing', generations: 0 });
      const regen = await svc.regenerateProse(session.id, 0);
      expect(regen).toEqual({ turnIndex: 0, prose: null, proseState: 'missing', gate: [], generationId: null });
      const logged = log.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
      expect(logged).toBe('turn: generation_not_saved (invalid_record)\nprose: generation_not_saved (invalid_record)');
      expect(deps.lock.size).toBe(0);
    } finally {
      log.mockRestore();
    }
  });

  it('a Keeper error whose error row cannot be written is still 502 keeper_failed (turn saved)', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const inner = new MemorySessionStore();
      const store = new Proxy(inner, {
        get(target, prop, recv) {
          if (prop === 'appendGeneration') return () => Promise.reject(Object.assign(new Error('down'), { code: 'ECONNREFUSED' }));
          return Reflect.get(target, prop, recv) as unknown;
        },
      });
      const deps = testDeps(store);
      const svc = new SessionService(deps);
      const { session } = await svc.createSession('dark_lands');
      deps.llm.fail = new Error('overloaded');
      await rejection(svc.playTurn(session.id, 0), 'keeper_failed');
      expect(log.mock.calls.map((c) => String(c[0]))).toEqual(['turn: keeper_failed (Error)', 'turn: generation_not_saved (ECONNREFUSED)']);
      expect(await turn0(svc, session.id)).toMatchObject({ proseState: 'missing' });
    } finally {
      log.mockRestore();
    }
  });
});

describe('API-RES1 (3): the generation lock', () => {
  /** Hold every Keeper call until release() is called. */
  function hold(deps: ReturnType<typeof testDeps>) {
    let release!: () => void;
    deps.llm.gate = new Promise<void>((r) => {
      release = r;
    });
    return () => {
      deps.llm.gate = null;
      release();
    };
  }
  const until = async (cond: () => boolean) => {
    for (let i = 0; i < 1000 && !cond(); i++) await new Promise((r) => setTimeout(r, 1));
    expect(cond()).toBe(true);
  };

  it('concurrent regenerations: one proceeds, the other 409 generation_in_progress; the Keeper runs once', async () => {
    const { deps, svc, id } = await played();
    await svc.playTurn(id, 0);
    const before = deps.llm.calls.length;
    const rs = await Promise.allSettled([svc.regenerateProse(id, 0), svc.regenerateProse(id, 0)]);
    expect(rs.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rej = rs.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((rej.reason as ApiError).code).toBe('generation_in_progress');
    expect(deps.llm.calls.length - before).toBe(1);
    expect(deps.lock.size).toBe(0);
  });

  it('while turn 0 is being played: GET shows generating + missing; a regeneration of it is refused; then ready', async () => {
    const { deps, svc, id } = await played();
    const release = hold(deps);
    const play = svc.playTurn(id, 0);
    await until(() => deps.llm.calls.length === 1);
    expect(await turn0(svc, id)).toMatchObject({ generating: true, proseState: 'missing', prose: null, generations: 0 });
    await rejection(svc.regenerateProse(id, 0), 'generation_in_progress');
    await rejection(svc.playTurn(id, 0), 'generation_in_progress');
    expect(deps.llm.calls).toHaveLength(1);
    release();
    await play;
    expect(await turn0(svc, id)).toMatchObject({ generating: false, proseState: 'ready' });
    expect(deps.lock.size).toBe(0);
  });

  it('a regeneration of turn 0 does not block playing turn 1', async () => {
    const { deps, svc, id } = await played();
    await svc.playTurn(id, 0);
    const release = hold(deps);
    const regen = svc.regenerateProse(id, 0);
    await until(() => deps.lock.size === 1);
    const play = svc.playTurn(id, 1);
    release();
    expect((await play).turnIndex).toBe(1);
    expect((await regen).proseState).toBe('ready');
  });

  it('the lock is released after errors: Keeper failure, journey/index conflicts, a throwing store', async () => {
    const { deps, svc, id } = await played();
    deps.llm.fail = new Error('overloaded');
    await rejection(svc.playTurn(id, 0), 'keeper_failed');
    expect(deps.lock.size).toBe(0);
    await rejection(svc.regenerateProse(id, 0), 'keeper_failed');
    expect(deps.lock.size).toBe(0);
    await rejection(svc.playTurn(id, 5), 'turn_conflict');
    expect(deps.lock.size).toBe(0);
    deps.llm.fail = null;
    expect((await svc.regenerateProse(id, 0)).proseState).toBe('ready');

    const inner = new MemorySessionStore();
    const throwing = new Proxy(inner, {
      get(target, prop, recv) {
        if (prop === 'appendTurn') return () => Promise.reject(new Error('disk full'));
        return Reflect.get(target, prop, recv) as unknown;
      },
    });
    const lock = new InProcessGenerationLock();
    const d2 = testDeps(throwing, { lock });
    const s2 = new SessionService(d2);
    const { session } = await s2.createSession('wild_lands');
    await expect(s2.playTurn(session.id, 0)).rejects.toThrow('disk full');
    expect(lock.size).toBe(0);
  });
});

describe('labels in responses', () => {
  it('POST turn and GET carry labels for the ids of the packages', async () => {
    const { svc, id } = await played();
    const t0 = await svc.playTurn(id, 0);
    const t1 = await svc.playTurn(id, 1);
    const scene0 = t0.pkg.oracle?.result_ref as string;
    expect(t0.labels.scenes).toEqual({ [scene0]: LABELS.scenes[scene0] });
    const detail = await svc.getSession(id);
    for (const t of [t0, t1]) {
      for (const c of ['scenes', 'skills', 'conditions', 'outcomes'] as const) {
        for (const [k, v] of Object.entries(t.labels[c])) expect(detail.labels[c][k]).toBe(v);
      }
    }
  });
});

describe('listSessions', () => {
  it('most recent first, with nextTurnIndex and journeyComplete; capped at 20', async () => {
    const store = new MemorySessionStore();
    const deps = testDeps(store);
    const svc = new SessionService(deps);
    expect(await svc.listSessions()).toEqual({ sessions: [] });
    const a = (await svc.createSession('dark_lands')).session;
    await new Promise((r) => setTimeout(r, 3));
    const b = (await svc.createSession('border_lands')).session;
    await svc.playTurn(b.id, 0);
    await new Promise((r) => setTimeout(r, 3));
    const c = (await svc.createSession('wild_lands')).session;
    let n = 0;
    for (;;) if ((await svc.playTurn(c.id, n++)).journeyComplete) break;
    expect(await svc.listSessions()).toEqual({
      sessions: [
        { session: c, nextTurnIndex: n, journeyComplete: true },
        { session: b, nextTurnIndex: 1, journeyComplete: false },
        { session: a, nextTurnIndex: 0, journeyComplete: false },
      ],
    });
    expect(RECENT_SESSIONS_LIMIT).toBe(20);
    for (let i = 0; i < 20; i++) await svc.createSession('dark_lands');
    const list = await svc.listSessions();
    expect(list.sessions).toHaveLength(20);
    expect(list.sessions.map((s) => s.session.id)).not.toContain(a.id);
  });
});
