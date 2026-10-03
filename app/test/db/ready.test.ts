// db/ready.ts: database error -> API code, and the store provider's role check (fail closed,
// success memoized, failure retried), with logs that carry codes only.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatabaseNotConfiguredError } from '../../src/server/db/pg';
import { dbErrorCode, storeProvider } from '../../src/server/db/ready';
import { UnsafeRoleError } from '../../src/server/db/role';
import type { SqlExecutor } from '../../src/server/db/sql';
import { ApiError } from '../../src/server/http/errors';
import { PostgresSessionStore } from '../../src/server/store/postgres';
import { migratedDb, pgliteExecutor } from '../support/pglite';
import { PGlite } from '@electric-sql/pglite';

const coded = (code: string, message = 'x') => Object.assign(new Error(message), { code });
const SECRET_URL = 'postgres://owner:hunter2-pw@db.internal:5432/brodyazhnik';

afterEach(() => vi.restoreAllMocks());

describe('dbErrorCode', () => {
  it.each([
    [new DatabaseNotConfiguredError(), 'database_not_configured'],
    [new UnsafeRoleError('a superuser role'), 'database_misconfigured'],
    [coded('42P01'), 'database_misconfigured'],
    [coded('3F000'), 'database_misconfigured'],
    [coded('08006'), 'database_unavailable'],
    [coded('28P01'), 'database_unavailable'],
    [coded('3D000'), 'database_unavailable'],
    [coded('53300'), 'database_unavailable'],
    [coded('57P01'), 'database_unavailable'],
    [coded('ECONNREFUSED'), 'database_unavailable'],
    [coded('ENOTFOUND'), 'database_unavailable'],
    [new Error('Connection terminated unexpectedly'), 'database_unavailable'],
    [new Error('timeout expired'), 'database_unavailable'],
    [coded('23505'), null],
    [coded('42601'), null],
    [new Error('anything'), null],
    ['string', null],
  ])('%s -> %s', (err, code) => {
    expect(dbErrorCode(err)).toBe(code);
  });
});

describe('storeProvider', () => {
  it('a superuser connection (PGlite) -> 503 database_misconfigured, retried on the next call', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { sql } = await migratedDb();
    let built = 0;
    const get = storeProvider(() => {
      built++;
      return sql;
    });
    for (let i = 0; i < 2; i++) {
      const err = await get().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('database_misconfigured');
    }
    expect(built).toBe(2);
    expect(log.mock.calls.map((c) => c.join(' '))).toEqual(['db: database_misconfigured (unsafe_database_role)', 'db: database_misconfigured (unsafe_database_role)']);
  });

  it('an ordinary role: the store is built once and memoized', async () => {
    const db = await migratedDb();
    let roleQueries = 0;
    const sql: SqlExecutor = {
      async query<R extends object>(text: string, params?: readonly unknown[]) {
        if (text.includes('pg_has_role')) {
          roleQueries++;
          return { rows: [{ self: true, rolsuper: false, rolbypassrls: false }] as unknown as R[] };
        }
        return db.sql.query<R>(text, params);
      },
      exec: (s) => db.sql.exec(s),
    };
    const get = storeProvider(() => sql);
    const a = await get();
    const b = await get();
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(PostgresSessionStore);
    expect(roleQueries).toBe(1);
  });

  it('connection failure -> 503 database_unavailable; DATABASE_URL unset -> database_not_configured; logs never carry the message', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const down: SqlExecutor = {
      query: () => Promise.reject(coded('ECONNREFUSED', `connect ECONNREFUSED ${SECRET_URL}`)),
      exec: () => Promise.reject(new Error('unused')),
    };
    expect(((await storeProvider(() => down)().catch((e: unknown) => e)) as ApiError).code).toBe('database_unavailable');
    const unset = storeProvider(() => {
      throw new DatabaseNotConfiguredError();
    });
    expect(((await unset().catch((e: unknown) => e)) as ApiError).code).toBe('database_not_configured');
    const lines = log.mock.calls.map((c) => c.join(' '));
    expect(lines).toEqual(['db: database_unavailable (ECONNREFUSED)', 'db: database_not_configured (database_not_configured)']);
    expect(lines.join('\n')).not.toContain('hunter2');
  });

  it('an unmigrated database: a store call fails with 42P01 -> database_misconfigured', async () => {
    const sql = pgliteExecutor(new PGlite());
    const err = await new PostgresSessionStore(sql).getSession('00000000-0000-4000-8000-000000000000').catch((e: unknown) => e);
    expect(dbErrorCode(err)).toBe('database_misconfigured');
  });
});
