// Test-only: PGlite (in-process WASM Postgres) behind the SqlExecutor port, and a freshly
// migrated database. PGlite has a single connection; exec runs the script with the simple
// protocol and, on error, issues ROLLBACK (an explicit BEGIN would otherwise stay aborted).
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

import { migrate } from '../../src/server/db/migrate';
import type { SqlExecutor } from '../../src/server/db/sql';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../supabase/migrations', import.meta.url));

export function pgliteExecutor(db: PGlite): SqlExecutor {
  return {
    async query<R extends object>(text: string, params: readonly unknown[] = []) {
      const res = await db.query<R>(text, [...params]);
      return { rows: res.rows };
    },
    async exec(script: string) {
      try {
        await db.exec(script);
      } catch (err) {
        await db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

/** A new in-memory PGlite with the app's migrations applied. */
export async function migratedDb(): Promise<{ db: PGlite; sql: SqlExecutor }> {
  const db = new PGlite();
  const sql = pgliteExecutor(db);
  await migrate(sql, MIGRATIONS_DIR);
  return { db, sql };
}
