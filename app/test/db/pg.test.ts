// pg adapter with a FAKE pool/client (no network), and the lazy DATABASE_URL pool.
import pg from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { closePool, DatabaseNotConfiguredError, getPool, pgExecutor, type PoolClientLike, type PoolLike } from '../../src/server/db/pg';

function fakePool(opts: { failOn?: string; failRollback?: boolean } = {}) {
  const log: string[] = [];
  const released: (Error | boolean | undefined)[] = [];
  let connects = 0;
  const client: PoolClientLike = {
    async query(text: string) {
      log.push(text);
      if (text === 'ROLLBACK' && opts.failRollback === true) throw new Error('connection lost');
      if (text === opts.failOn) throw Object.assign(new Error('boom'), { code: '42P01' });
      return {};
    },
    release(err?: Error | boolean) {
      released.push(err);
    },
  };
  const pool: PoolLike & { calls: [string, unknown[] | undefined][] } = {
    calls: [],
    async query(text: string, params?: unknown[]) {
      pool.calls.push([text, params]);
      return { rows: [{ ok: 1 }] };
    },
    async connect() {
      connects++;
      return client;
    },
  };
  return { pool, log, released, connects: () => connects };
}

describe('pgExecutor', () => {
  it('query passes text and params through and returns rows', async () => {
    const { pool } = fakePool();
    const params = [1, 'a', null];
    expect(await pgExecutor(pool).query('select $1, $2, $3', params)).toEqual({ rows: [{ ok: 1 }] });
    expect(pool.calls).toEqual([['select $1, $2, $3', [1, 'a', null]]]);
    expect(await pgExecutor(pool).query('select 1')).toEqual({ rows: [{ ok: 1 }] });
    expect(pool.calls[1]).toEqual(['select 1', []]);
  });

  it('exec runs the script on one client and releases it', async () => {
    const f = fakePool();
    await pgExecutor(f.pool).exec('begin; select 1; commit;');
    expect(f.connects()).toBe(1);
    expect(f.log).toEqual(['begin; select 1; commit;']);
    expect(f.released).toEqual([false]);
  });

  it('exec on error sends ROLLBACK on the same client, rethrows, releases', async () => {
    const f = fakePool({ failOn: 'bad;' });
    await expect(pgExecutor(f.pool).exec('bad;')).rejects.toMatchObject({ message: 'boom', code: '42P01' });
    expect(f.connects()).toBe(1);
    expect(f.log).toEqual(['bad;', 'ROLLBACK']);
    expect(f.released).toEqual([false]);
  });

  it('exec discards the client when ROLLBACK fails too, and rethrows the original error', async () => {
    const f = fakePool({ failOn: 'bad;', failRollback: true });
    await expect(pgExecutor(f.pool).exec('bad;')).rejects.toMatchObject({ message: 'boom' });
    expect(f.released).toEqual([true]);
  });
});

describe('getPool', () => {
  const saved = process.env['DATABASE_URL'];
  afterEach(async () => {
    vi.restoreAllMocks();
    await closePool();
    if (saved === undefined) delete process.env['DATABASE_URL'];
    else process.env['DATABASE_URL'] = saved;
  });

  it.each([undefined, ''])('throws DatabaseNotConfiguredError when DATABASE_URL is %j', (value) => {
    if (value === undefined) delete process.env['DATABASE_URL'];
    else process.env['DATABASE_URL'] = value;
    let err: unknown;
    try {
      getPool();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DatabaseNotConfiguredError);
    expect(err).toMatchObject({ code: 'database_not_configured', message: 'DATABASE_URL is not set' });
    expect((err as Error).message).not.toMatch(/:\/\//);
  });

  it('creates one Pool lazily from DATABASE_URL, without connecting', () => {
    const url = 'postgres://user:secret@127.0.0.1:1/none';
    process.env['DATABASE_URL'] = url;
    const OriginalPool = pg.Pool;
    // vitest's class spy does not keep the prototype: construct the real Pool through it
    const ctor = vi.spyOn(pg, 'Pool').mockImplementation(function (cfg?: pg.PoolConfig) {
      return new OriginalPool(cfg);
    } as never);
    expect(ctor).not.toHaveBeenCalled();
    const a = getPool();
    const b = getPool();
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(OriginalPool);
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor).toHaveBeenCalledWith({ connectionString: url });
    expect(a.totalCount).toBe(0); // no client was ever opened
  });

  it('closePool forgets the pool: the next getPool creates a new one', async () => {
    process.env['DATABASE_URL'] = 'postgres://u@127.0.0.1:1/x';
    const a = getPool();
    await closePool();
    expect(getPool()).not.toBe(a);
  });
});
