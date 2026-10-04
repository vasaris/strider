// The session service over the Memory store with the real pack, journeyTurn and the app's Keeper
// factory over a fake LlmClient: a full journey, every error branch and the documented order of
// checks, keeper failure + regeneration, P13, DZ1, concurrency, provenance per generation (N1).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { JourneyState } from '@brodyazhnik/engine';
import { buildKeeperUser, loadKeeperSetup, PREGEN_HERO_REF, pregenRoute, startJourney } from '@brodyazhnik/orchestrator';
import { describe, expect, it } from 'vitest';

import { ApiError, type ApiErrorCode } from '../../src/server/http/errors';
import { KEEPER_PROMPT, keeperFactory } from '../../src/server/service/keeper';
import type { KeeperRunner } from '../../src/server/service/ports';
import { SessionService } from '../../src/server/service/sessions';
import { MemorySessionStore } from '../../src/server/store/memory';
import type { SessionStore } from '../../src/server/store/types';
import { ENV, FAKE_SECRET, REPO, TEST_MODEL, testDeps } from '../support/service';

const ABSENT = '00000000-0000-4000-8000-000000000000';
const setup = loadKeeperSetup({ repoRoot: REPO, keeperPrompt: KEEPER_PROMPT });
const sha = (rel: string) => createHash('sha256').update(readFileSync(join(REPO, rel))).digest('hex');

async function expectApi(p: Promise<unknown>, code: ApiErrorCode, extras?: Record<string, unknown>): Promise<ApiError> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, `expected ApiError ${code}`).toBeInstanceOf(ApiError);
  const api = err as ApiError;
  expect(api.code).toBe(code);
  if (extras !== undefined) expect(api.extras).toEqual(extras);
  return api;
}

/** A store whose every method call is counted (and can be made to throw). */
function spyStore(inner: SessionStore = new MemorySessionStore()): SessionStore & { calls: string[] } {
  const calls: string[] = [];
  return new Proxy(inner, {
    get(target, prop, recv) {
      if (prop === 'calls') return calls;
      const v = Reflect.get(target, prop, recv) as unknown;
      if (typeof v !== 'function') return v;
      return (...args: unknown[]) => {
        calls.push(String(prop));
        return (v as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as SessionStore & { calls: string[] };
}

const writes = (calls: string[]) => calls.filter((c) => c.startsWith('create') || c.startsWith('append'));

describe('createSession', () => {
  it('creates a session at turn 0 from the pregen hero and route; the seed comes from newSeed', async () => {
    const store = new MemorySessionStore();
    const deps = testDeps(store);
    const out = await new SessionService(deps).createSession('dark_lands');
    expect(out.nextTurnIndex).toBe(0);
    expect(out.journeyComplete).toBe(false);
    expect(out.session).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      createdAt: expect.any(String),
      rngSeed: 'a3-3',
      heroRef: PREGEN_HERO_REF,
      packId: ENV.packId,
      packVersion: ENV.packVersion,
      region: 'dark_lands',
    });
    const rec = await store.getSession(out.session.id);
    expect(rec?.initialState).toEqual(startJourney(ENV.cfg, { rngSeed: 'a3-3', region: 'dark_lands' }));
  });

  it.each([['shire'], [''], [42], [null], [undefined], [['dark_lands']]])('400 invalid_request for region %j, nothing written', async (region) => {
    const store = spyStore();
    await expectApi(new SessionService(testDeps(store)).createSession(region), 'invalid_request');
    expect(store.calls).toEqual([]);
  });

  it('DZ1: a route with entry danger zones -> 422 unsupported_route, nothing written', async () => {
    const store = spyStore();
    const deps = testDeps(store, { routeFor: (r) => ({ ...pregenRoute(r), dangerZones: [2] }) });
    await expectApi(new SessionService(deps).createSession('wild_lands'), 'unsupported_route');
    expect(store.calls).toEqual([]);
    expect(deps.seeds).toEqual([]);
  });
});

describe('a full journey through the service', () => {
  it('turns 0..n-1 contiguous, journeyComplete at arrival, then 409 journey_complete', async () => {
    const store = new MemorySessionStore();
    const deps = testDeps(store);
    const svc = new SessionService(deps);
    const { session } = await svc.createSession('dark_lands');
    let n = 0;
    let complete = false;
    while (!complete) {
      const t = await svc.playTurn(session.id, n);
      expect(t.turnIndex).toBe(n);
      expect(t.nextTurnIndex).toBe(n + 1);
      expect(t.prose).toBe(`The wind smelled of rain (${n + 1}).`); // trimmed by AnthropicKeeper
      const req = deps.llm.calls[n];
      expect(req?.system).toBe(setup.system);
      expect(req?.user).toBe(buildKeeperUser(setup.assembly, t.pkg));
      expect(req?.model).toBe(TEST_MODEL);
      complete = t.journeyComplete;
      n++;
      expect(n).toBeLessThan(100);
    }
    expect(n).toBeGreaterThan(1);
    expect(deps.llm.calls).toHaveLength(n);
    await expectApi(svc.playTurn(session.id, n), 'journey_complete');
    expect(deps.llm.calls).toHaveLength(n);

    const detail = await svc.getSession(session.id);
    expect(detail.nextTurnIndex).toBe(n);
    expect(detail.journeyComplete).toBe(true);
    expect(detail.packCurrent).toBe(true);
    expect(detail.turns.map((t) => t.turnIndex)).toEqual([...Array(n).keys()]);
    expect(detail.turns.every((t) => t.generations === 1 && t.proseState === 'ready' && t.prose !== null && !t.generating)).toBe(true);
    expect(detail.turns[detail.turns.length - 1]?.pkg.journey?.arrived).toBe(true);
  });

  it('getSession of a fresh session: no turns, nextTurnIndex 0', async () => {
    const svc = new SessionService(testDeps(new MemorySessionStore()));
    const { session } = await svc.createSession('border_lands');
    expect(await svc.getSession(session.id)).toEqual({
      session,
      turns: [],
      labels: { scenes: {}, skills: {}, conditions: {}, outcomes: {} },
      nextTurnIndex: 0,
      journeyComplete: false,
      packCurrent: true,
    });
  });
});

describe('order of checks', () => {
  it('key missing -> 503 keeper_not_configured before anything else (even for a missing session)', async () => {
    const store = spyStore();
    const deps = testDeps(store, { keyPresent: () => false });
    const svc = new SessionService(deps);
    await expectApi(svc.playTurn(ABSENT, 0), 'keeper_not_configured');
    await expectApi(svc.regenerateProse(ABSENT, 0), 'keeper_not_configured');
    expect(store.calls).toEqual([]);
    expect(deps.keeperLoads).toBe(0);
  });

  it('key missing does not block createSession / getSession', async () => {
    const svc = new SessionService(testDeps(new MemorySessionStore(), { keyPresent: () => false }));
    const { session } = await svc.createSession('wild_lands');
    expect((await svc.getSession(session.id)).nextTurnIndex).toBe(0);
  });

  it('a broken Keeper setup -> 503 keeper_not_configured before any store access or write', async () => {
    const inner = new MemorySessionStore();
    const { session } = await new SessionService(testDeps(inner)).createSession('dark_lands');
    const store = spyStore(inner);
    const llm = testDeps(inner).llm;
    const broken = keeperFactory({ repoRoot: () => join(REPO, 'no-such-dir'), llm: () => llm, model: () => TEST_MODEL });
    const svc = new SessionService(testDeps(store, { keeper: broken }));
    await expectApi(svc.playTurn(session.id, 0), 'keeper_not_configured');
    await expectApi(svc.regenerateProse(session.id, 0), 'keeper_not_configured');
    expect(store.calls).toEqual([]);
    expect(llm.calls).toEqual([]);
    expect(await inner.listTurns(session.id)).toEqual([]);
  });

  it('404 session_not_found for an absent or non-uuid id (play, regenerate, get)', async () => {
    const svc = new SessionService(testDeps(new MemorySessionStore()));
    for (const id of [ABSENT, 'not-a-uuid']) {
      await expectApi(svc.playTurn(id, 0), 'session_not_found');
      await expectApi(svc.regenerateProse(id, 0), 'session_not_found');
      await expectApi(svc.getSession(id), 'session_not_found');
    }
  });

  it('P13: another pack version or id -> 409 pack_mismatch on play AND regeneration; packCurrent false', async () => {
    const store = new MemorySessionStore();
    const deps = testDeps(store);
    const { session } = await new SessionService(deps).createSession('dark_lands');
    await new SessionService(deps).playTurn(session.id, 0);
    for (const env of [{ ...ENV, packVersion: `${ENV.packVersion}-next` }, { ...ENV, packId: 'other' }]) {
      const moved = testDeps(store, { env: () => env });
      const svc = new SessionService(moved);
      await expectApi(svc.playTurn(session.id, 1), 'pack_mismatch');
      await expectApi(svc.regenerateProse(session.id, 0), 'pack_mismatch');
      expect(moved.llm.calls).toEqual([]);
      expect((await svc.getSession(session.id)).packCurrent).toBe(false);
    }
    expect(await store.listTurns(session.id)).toHaveLength(1);
    expect(await store.listGenerations(session.id, 0)).toHaveLength(1);
  });

  it('P13 comes before journey_complete and the index check', async () => {
    const store = new MemorySessionStore();
    const { session } = await new SessionService(testDeps(store)).createSession('border_lands');
    const svc = new SessionService(testDeps(store, { env: () => ({ ...ENV, packVersion: 'x' }) }));
    await expectApi(svc.playTurn(session.id, 7), 'pack_mismatch');
  });

  it('wrong index -> 409 turn_conflict with nextTurnIndex; nothing written, no Keeper call', async () => {
    const store = new MemorySessionStore();
    const deps = testDeps(store);
    const svc = new SessionService(deps);
    const { session } = await svc.createSession('dark_lands');
    await expectApi(svc.playTurn(session.id, 1), 'turn_conflict', { nextTurnIndex: 0 });
    await svc.playTurn(session.id, 0);
    await expectApi(svc.playTurn(session.id, 0), 'turn_conflict', { nextTurnIndex: 1 });
    await expectApi(svc.playTurn(session.id, 5), 'turn_conflict', { nextTurnIndex: 1 });
    expect(await store.listTurns(session.id)).toHaveLength(1);
    expect(deps.llm.calls).toHaveLength(1);
  });

  it('a concurrent duplicate: exactly one 201 and one 409 generation_in_progress (the lock); the Keeper runs once', async () => {
    const store = new MemorySessionStore();
    const deps = testDeps(store);
    const svc = new SessionService(deps);
    const { session } = await svc.createSession('dark_lands');
    const results = await Promise.allSettled([svc.playTurn(session.id, 0), svc.playTurn(session.id, 0)]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.flatMap((r) => (r.status === 'rejected' ? [r.reason as unknown] : []));
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toBeInstanceOf(ApiError);
    expect((bad[0] as ApiError).code).toBe('generation_in_progress');
    expect((bad[0] as ApiError).extras).toEqual({});
    expect(deps.llm.calls).toHaveLength(1);
    expect(deps.lock.size).toBe(0);
    expect(await store.listTurns(session.id)).toHaveLength(1);
    expect(await store.listGenerations(session.id, 0)).toHaveLength(1);
  });

  it('DZ1 on a stored session whose route has danger zones -> 422, nothing written', async () => {
    const store = spyStore();
    const route = { ...pregenRoute('dark_lands'), dangerZones: [3] };
    const rec = await store.createSession({
      rngSeed: 'a3-1',
      heroRef: PREGEN_HERO_REF,
      packId: ENV.packId,
      packVersion: ENV.packVersion,
      initialState: startJourney(ENV.cfg, { rngSeed: 'a3-1', region: 'dark_lands', route }),
    });
    store.calls.length = 0;
    const deps = testDeps(store);
    await expectApi(new SessionService(deps).playTurn(rec.id, 0), 'unsupported_route');
    expect(writes(store.calls)).toEqual([]);
    expect(deps.llm.calls).toEqual([]);
  });

  it('store errors from the store port propagate (the handler maps them)', async () => {
    const deps = testDeps(async () => {
      throw new ApiError('database_unavailable');
    });
    await expectApi(new SessionService(deps).createSession('dark_lands'), 'database_unavailable');
    await expectApi(new SessionService(deps).playTurn(ABSENT, 0), 'database_unavailable');
  });
});

describe('Keeper failure and regeneration', () => {
  it('502 keeper_failed: the turn is saved, the generation holds the sanitized error; regeneration then appends prose', async () => {
    const store = new MemorySessionStore();
    const deps = testDeps(store);
    const svc = new SessionService(deps);
    const { session } = await svc.createSession('dark_lands');
    deps.llm.fail = Object.assign(new Error(`401 invalid x-api-key ${FAKE_SECRET}\n${'x'.repeat(900)}`), { name: 'AuthenticationError' });
    const err = await expectApi(svc.playTurn(session.id, 0), 'keeper_failed');
    const turn = await store.getTurn(session.id, 0);
    expect(turn).not.toBeNull();
    expect(err.extras).toEqual({ turnIndex: 0, nextTurnIndex: 1, journeyComplete: false, pkg: turn?.pkg });

    const [g1] = await store.listGenerations(session.id, 0);
    expect(g1?.prose).toBeNull();
    expect(g1?.error).toMatch(/^AuthenticationError: 401 invalid x-api-key \[redacted\] x+$/);
    expect(g1?.error).not.toContain(FAKE_SECRET);
    expect([...(g1?.error ?? '')].length).toBe(500);
    let detail = await svc.getSession(session.id);
    expect(detail.turns[0]).toMatchObject({ prose: null, proseState: 'failed', gate: [], generations: 1 });
    expect(detail.nextTurnIndex).toBe(1);

    // a failed regeneration appends another error row
    await expectApi(svc.regenerateProse(session.id, 0), 'keeper_failed', { turnIndex: 0 });

    deps.llm.fail = null;
    const regen = await svc.regenerateProse(session.id, 0);
    expect(regen).toEqual({ turnIndex: 0, prose: 'The wind smelled of rain (1).', proseState: 'ready', gate: [], generationId: expect.any(String) });
    const gens = await store.listGenerations(session.id, 0);
    expect(gens.map((g) => g.prose === null)).toEqual([true, true, false]);
    expect(gens[2]?.id).toBe(regen.generationId);
    detail = await svc.getSession(session.id);
    expect(detail.turns[0]).toMatchObject({ prose: regen.prose, proseState: 'ready', generations: 3 });

    // the journey continues from the saved turn
    expect((await svc.playTurn(session.id, 1)).turnIndex).toBe(1);
  });

  it('regeneration renders the STORED package and does not re-run the engine', async () => {
    const store = new MemorySessionStore();
    let steps = 0;
    const deps = testDeps(store);
    const counting = testDeps(store, {
      step: (s: JourneyState, cfg) => {
        steps++;
        return deps.step(s, cfg);
      },
    });
    const svc = new SessionService(counting);
    const { session } = await svc.createSession('wild_lands');
    await svc.playTurn(session.id, 0);
    await svc.playTurn(session.id, 1);
    expect(steps).toBe(2);
    const stored = await store.getTurn(session.id, 0);
    await svc.regenerateProse(session.id, 0);
    expect(steps).toBe(2);
    const last = counting.llm.calls[counting.llm.calls.length - 1];
    expect(last?.user).toBe(buildKeeperUser(setup.assembly, stored!.pkg));
    expect(last?.user).toBe(counting.llm.calls[0]?.user);
  });

  it('404 turn_not_found for a turn that was not played', async () => {
    const svc = new SessionService(testDeps(new MemorySessionStore()));
    const { session } = await svc.createSession('dark_lands');
    await expectApi(svc.regenerateProse(session.id, 0), 'turn_not_found');
    await svc.playTurn(session.id, 0);
    await expectApi(svc.regenerateProse(session.id, 1), 'turn_not_found');
  });
});

describe('provenance on every generation (N1)', () => {
  it('real setup: model + keeper path/sha256 + tone/assembly sha256 of the real files', async () => {
    const store = new MemorySessionStore();
    const svc = new SessionService(testDeps(store));
    const { session } = await svc.createSession('dark_lands');
    await svc.playTurn(session.id, 0);
    const [g] = await store.listGenerations(session.id, 0);
    expect(g).toMatchObject({
      model: TEST_MODEL,
      keeperPromptPath: KEEPER_PROMPT,
      keeperPromptSha256: sha(KEEPER_PROMPT),
      toneSha256: sha('content-packs/kv/tone.md'),
      assemblySha256: sha('prompts/assembly.v1.json'),
    });
  });

  it('each generation carries the provenance of the setup that built its request', async () => {
    const store = new MemorySessionStore();
    const base = testDeps(store);
    let k = 0;
    const served: { model: string; user: string }[] = [];
    const keeper = (): KeeperRunner => {
      k++;
      const real = base.keeper();
      const model = `model-${k}`;
      const hex = (k % 16).toString(16);
      return {
        provenance: { ...real.provenance, model, keeperPromptSha256: hex.repeat(64), toneSha256: hex.repeat(64) },
        run: async (pkg) => {
          served.push({ model, user: buildKeeperUser(setup.assembly, pkg) });
          return real.run(pkg);
        },
      };
    };
    const svc = new SessionService(testDeps(store, { keeper }));
    const { session } = await svc.createSession('dark_lands');
    await svc.playTurn(session.id, 0);
    await svc.regenerateProse(session.id, 0);
    await svc.playTurn(session.id, 1);
    const gens = [...(await store.listGenerations(session.id, 0)), ...(await store.listGenerations(session.id, 1))];
    expect(gens.map((g) => g.model)).toEqual(['model-1', 'model-2', 'model-3']);
    for (const g of gens) {
      const n = Number(g.model.slice(6));
      expect(g.keeperPromptSha256).toBe((n % 16).toString(16).repeat(64));
      expect(g.toneSha256).toBe(g.keeperPromptSha256);
    }
    expect(served.map((s) => s.model)).toEqual(['model-1', 'model-2', 'model-3']);
  });
});
