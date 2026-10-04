// test:pg (OPTIONAL, outside test:all): against a REAL Postgres at TEST_DATABASE_URL (*_test).
// assertOrdinaryRole -> drop schema brodyazhnik cascade (DDL; the append-only triggers do not
// block it) -> the migration runner -> the C6 SessionStore contract on PostgresSessionStore over
// pgExecutor(pool) -> one suite seed round trip to arrival -> the C7 service flow with a fake
// Keeper -> drop the schema again. The URL is never printed.
import { journeyTurn, isJourneyOver, PREGEN_HERO_REF } from '@brodyazhnik/orchestrator';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import { migrate } from '../../src/server/db/migrate';
import { pgExecutor } from '../../src/server/db/pg';
import { assertOrdinaryRole } from '../../src/server/db/role';
import type { ApiError } from '../../src/server/http/errors';
import { SessionService } from '../../src/server/service/sessions';
import { PostgresSessionStore } from '../../src/server/store/postgres';
import { runSessionStoreContract } from '../store/contract';
import { MIGRATIONS_DIR } from '../support/pglite';
import { BLOCKED_PROSE, ENV, testDeps } from '../support/service';
import { SEEDS, seedInitialState } from '../support/suiteSeeds';
import { testDatabaseUrl } from './target';

const pool = new pg.Pool({ connectionString: testDatabaseUrl() });
pool.on('error', () => undefined); // idle-client errors: the next query fails the test
const sql = pgExecutor(pool);
const DROP = 'drop schema if exists brodyazhnik cascade;';

await assertOrdinaryRole(sql);
await sql.exec(DROP);
await migrate(sql, MIGRATIONS_DIR);

afterAll(async () => {
  try {
    await sql.exec(DROP);
  } finally {
    await pool.end();
  }
});

runSessionStoreContract('postgres (TEST_DATABASE_URL)', async () => new PostgresSessionStore(sql), { isolated: false });

describe('one suite seed to arrival through pg', () => {
  it('j.dark.detection: every stored state continues the journey', async () => {
    const seed = SEEDS.find((s) => s.id === 'j.dark.detection')!;
    const store = new PostgresSessionStore(sql);
    const start = seedInitialState(ENV, seed);
    const s = await store.createSession({ rngSeed: seed.rngSeed, heroRef: PREGEN_HERO_REF, packId: ENV.packId, packVersion: ENV.packVersion, initialState: start });
    let state = (await store.getSession(s.id))!.initialState;
    let orig = start;
    let n = 0;
    while (!isJourneyOver(orig)) {
      const a = journeyTurn(orig, ENV.cfg);
      const b = journeyTurn(state, ENV.cfg);
      expect(b.next).toStrictEqual(a.next);
      await store.appendTurn({ sessionId: s.id, turnIndex: n, state: a.next, pkg: a.pkg, packVersion: ENV.packVersion });
      state = (await store.getTurn(s.id, n))!.state;
      orig = a.next;
      n++;
      expect(n).toBeLessThan(100);
    }
    expect(isJourneyOver(state)).toBe(true);
  });
});

describe('service flow through pg (fake Keeper)', () => {
  it('journey to arrival, a Keeper failure, a regeneration', async () => {
    const deps = testDeps(new PostgresSessionStore(sql));
    const svc = new SessionService(deps);
    const { session } = await svc.createSession('border_lands');
    deps.llm.fail = new Error('overloaded');
    expect(((await svc.playTurn(session.id, 0).catch((e: unknown) => e)) as ApiError).code).toBe('keeper_failed');
    deps.llm.fail = null;
    await svc.regenerateProse(session.id, 0);
    let n = 1;
    for (;;) {
      const t = await svc.playTurn(session.id, n++);
      if (t.journeyComplete) break;
      expect(n).toBeLessThan(100);
    }
    let detail = await svc.getSession(session.id);
    expect(detail.journeyComplete).toBe(true);
    expect(detail.turns[0]).toMatchObject({ proseState: 'ready', generations: 2 });

    // K4: a blocked regeneration keeps the accepted text; NUL stripped; the session list
    deps.llm.replies.push(BLOCKED_PROSE);
    expect((await svc.regenerateProse(session.id, 0)).proseState).toBe('blocked');
    deps.llm.replies.push('The ford\u0000 was cold.');
    expect((await svc.regenerateProse(session.id, 1)).prose).toBe('The ford was cold.');
    detail = await svc.getSession(session.id);
    expect(detail.turns[0]).toMatchObject({ proseState: 'ready', generations: 3 });
    expect(JSON.stringify(detail)).not.toContain(BLOCKED_PROSE);
    const list = await svc.listSessions();
    expect(list.sessions[0]).toEqual({ session: detail.session, nextTurnIndex: detail.nextTurnIndex, journeyComplete: true });
  });
});
