// node-postgres adapter for the SqlExecutor port, plus ONE lazy pool from DATABASE_URL.
// The connection string is never logged and never put into an error message.
import 'server-only';

import pg from 'pg';

import type { SqlExecutor } from './sql';

/** The slice of pg.Pool / pg.PoolClient the adapter uses (a fake satisfies it in tests). */
export interface PoolClientLike {
  query(text: string): Promise<unknown>;
  release(err?: Error | boolean): void;
}
export interface PoolLike {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  connect(): Promise<PoolClientLike>;
}

export function pgExecutor(pool: PoolLike): SqlExecutor {
  return {
    async query<R extends object>(text: string, params: readonly unknown[] = []) {
      const res = await pool.query(text, [...params]);
      return { rows: res.rows as R[] };
    },
    async exec(script: string) {
      const client = await pool.connect();
      let broken = false;
      try {
        await client.query(script);
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {
          broken = true; // the connection is unusable: discard it instead of returning it
        }
        throw err;
      } finally {
        client.release(broken);
      }
    },
  };
}

export class DatabaseNotConfiguredError extends Error {
  readonly code = 'database_not_configured' as const;
  constructor() {
    super('DATABASE_URL is not set');
    this.name = 'DatabaseNotConfiguredError';
  }
}

let poolMemo: pg.Pool | undefined;

/** The process-wide pool, created on first use from DATABASE_URL. Does not connect. */
export function getPool(): pg.Pool {
  if (poolMemo === undefined) {
    const url = process.env['DATABASE_URL'];
    if (url === undefined || url === '') throw new DatabaseNotConfiguredError();
    const pool = new pg.Pool({ connectionString: url });
    // An idle client error is emitted on the pool; unhandled it would crash the process.
    pool.on('error', (err: Error & { code?: string }) => {
      console.error(`pg pool: idle client error${err.code === undefined ? '' : ` (${err.code})`}`);
    });
    poolMemo = pool;
  }
  return poolMemo;
}

/** End the pool (if any) and forget it; the next getPool() creates a new one. */
export async function closePool(): Promise<void> {
  const pool = poolMemo;
  poolMemo = undefined;
  if (pool !== undefined) await pool.end();
}
