// The service over PostgresSessionStore on PGlite (real jsonb): a full journey to arrival, a
// Keeper failure (turn saved, error generation) and a regeneration from the STORED package --
// the C6 jsonb chain proven inside the C7 service flow; K4: the gate over stored rows (blocked +
// accepted generations), U+0000 stripped before Postgres text, and the session list.
import { buildKeeperUser, loadKeeperSetup } from '@brodyazhnik/orchestrator';
import { beforeAll, describe, expect, it } from 'vitest';

import { ApiError } from '../../src/server/http/errors';
import { KEEPER_PROMPT } from '../../src/server/service/keeper';
import { SessionService } from '../../src/server/service/sessions';
import { PostgresSessionStore } from '../../src/server/store/postgres';
import { migratedDb } from '../support/pglite';
import { BLOCKED_PROSE, REPO, testDeps, type TestDeps } from '../support/service';

const setup = loadKeeperSetup({ repoRoot: REPO, keeperPrompt: KEEPER_PROMPT });

describe('service over PostgresSessionStore (PGlite)', () => {
  let store: PostgresSessionStore;
  let deps: TestDeps;
  let svc: SessionService;
  beforeAll(async () => {
    store = new PostgresSessionStore((await migratedDb()).sql);
    deps = testDeps(store);
    svc = new SessionService(deps);
  });

  it('a full journey to arrival, every state carried through jsonb', async () => {
    const { session } = await svc.createSession('dark_lands');
    let n = 0;
    for (;;) {
      const t = await svc.playTurn(session.id, n);
      expect(deps.llm.calls[deps.llm.calls.length - 1]?.user).toBe(buildKeeperUser(setup.assembly, t.pkg));
      n++;
      if (t.journeyComplete) break;
      expect(n).toBeLessThan(100);
    }
    const detail = await svc.getSession(session.id);
    expect(detail.journeyComplete).toBe(true);
    expect(detail.nextTurnIndex).toBe(n);
    expect(detail.turns.map((t) => t.turnIndex)).toEqual([...Array(n).keys()]);
    const err = await svc.playTurn(session.id, n).catch((e: unknown) => e);
    expect((err as ApiError).code).toBe('journey_complete');
  });

  it('a Keeper failure saves the turn; regeneration from the stored package appends prose', async () => {
    const { session } = await svc.createSession('border_lands');
    deps.llm.fail = new Error('overloaded');
    const err = (await svc.playTurn(session.id, 0).catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe('keeper_failed');
    const failedUser = deps.llm.calls[deps.llm.calls.length - 1]?.user;
    const stored = await store.getTurn(session.id, 0);
    expect(stored).not.toBeNull();
    expect(err.extras['pkg']).toEqual(stored?.pkg);
    expect((await store.listGenerations(session.id, 0)).map((g) => g.error)).toEqual(['Error: overloaded']);

    deps.llm.fail = null;
    const regen = await svc.regenerateProse(session.id, 0);
    expect(deps.llm.calls[deps.llm.calls.length - 1]?.user).toBe(failedUser); // stored pkg renders the same bytes
    const gens = await store.listGenerations(session.id, 0);
    expect(gens.map((g) => g.prose)).toEqual([null, regen.prose]);
    expect(gens[1]?.id).toBe(regen.generationId);
    const detail = await svc.getSession(session.id);
    expect(detail.turns[0]).toMatchObject({ prose: regen.prose, proseState: 'ready', generations: 2 });
    expect((await svc.playTurn(session.id, 1)).turnIndex).toBe(1);
  });

  it('a concurrent duplicate on the real store: one 201, one 409 generation_in_progress', async () => {
    const { session } = await svc.createSession('wild_lands');
    const before = deps.llm.calls.length;
    const rs = await Promise.allSettled([svc.playTurn(session.id, 0), svc.playTurn(session.id, 0)]);
    expect(rs.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rej = rs.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((rej.reason as ApiError).code).toBe('generation_in_progress');
    expect(deps.llm.calls.length - before).toBe(1);
  });

  it('K4: blocked then accepted generations, U+0000 stripped, the blocked text never returned; the session list', async () => {
    const { session } = await svc.createSession('dark_lands');
    deps.llm.replies.push(BLOCKED_PROSE);
    const t = await svc.playTurn(session.id, 0);
    expect(t).toMatchObject({ prose: null, proseState: 'blocked' });
    expect(t.gate.some((f) => f.severity === 'block')).toBe(true);
    expect((await svc.getSession(session.id)).turns[0]).toMatchObject({ prose: null, proseState: 'blocked', generations: 1 });

    deps.llm.replies.push('The ford\u0000 was cold.');
    const regen = await svc.regenerateProse(session.id, 0);
    expect(regen).toMatchObject({ prose: 'The ford was cold.', proseState: 'ready' });
    expect((await store.listGenerations(session.id, 0)).map((g) => g.prose)).toEqual([BLOCKED_PROSE, 'The ford was cold.']);

    deps.llm.replies.push(BLOCKED_PROSE);
    expect((await svc.regenerateProse(session.id, 0)).proseState).toBe('blocked');
    const detail = await svc.getSession(session.id);
    expect(detail.turns[0]).toMatchObject({ prose: 'The ford was cold.', proseState: 'ready', generations: 3 });
    expect(JSON.stringify(detail)).not.toContain(BLOCKED_PROSE);

    const list = await svc.listSessions();
    expect(list.sessions[0]).toEqual({ session: detail.session, nextTurnIndex: 1, journeyComplete: false });
    const done = list.sessions.find((s) => s.journeyComplete);
    expect(done).toBeDefined(); // the journey played to arrival in the first test
  });
});
