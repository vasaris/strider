// The server's SessionStore over the process pool (3.1-C7), and the database error -> API code
// mapping. Fail closed:
//   DATABASE_URL unset -> 503 database_not_configured;
//   first use runs assertOrdinaryRole (role.ts) once per process -- only SUCCESS is memoized, a
//   failure is retried on the next request: an unsafe role -> 503 database_misconfigured;
//   connection / auth / server-state errors -> 503 database_unavailable;
//   schema not migrated (42P01 undefined table, 3F000 undefined schema) -> 503
//   database_misconfigured.
// Logs carry the API code and the SQLSTATE / errno code at most -- never the error object, its
// message or the pool (pool.options.connectionString holds the password).
import 'server-only';

import { ApiError, type ApiErrorCode } from '../http/errors';
import { PostgresSessionStore } from '../store/postgres';
import type { SessionStore } from '../store/types';
import { DatabaseNotConfiguredError, getPool, pgExecutor } from './pg';
import { assertOrdinaryRole, UnsafeRoleError } from './role';
import type { SqlExecutor } from './sql';

const MISCONFIGURED_SQLSTATES = new Set(['42P01', '3F000']);
// connection exception, invalid authorization, invalid catalog (database) name, insufficient
// resources, operator intervention (shutdown, cannot connect now)
const UNAVAILABLE_CLASSES = new Set(['08', '28', '3D', '53', '57']);
const NET_ERRNO = /^E[A-Z0-9_]{2,40}$/; // ECONNREFUSED, ENOTFOUND, ETIMEDOUT, ECONNRESET, EAI_AGAIN, ...
const PRINTABLE_CODE = /^[A-Za-z0-9_]{1,40}$/;

function rawCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) return undefined;
  const c = (err as { code: unknown }).code;
  return typeof c === 'string' && PRINTABLE_CODE.test(c) ? c : undefined;
}

/** The API code for a database-side failure, or null when err is not one we recognize. */
export function dbErrorCode(err: unknown): ApiErrorCode | null {
  if (err instanceof DatabaseNotConfiguredError) return 'database_not_configured';
  if (err instanceof UnsafeRoleError) return 'database_misconfigured';
  const code = rawCode(err);
  if (code === undefined) {
    // pg reports a connect timeout / terminated connection as a plain Error without a code
    if (err instanceof Error && /^(Connection terminated|timeout expired)/.test(err.message)) return 'database_unavailable';
    return null;
  }
  if (MISCONFIGURED_SQLSTATES.has(code)) return 'database_misconfigured';
  if (UNAVAILABLE_CLASSES.has(code.slice(0, 2)) && /^[0-9A-Z]{5}$/.test(code)) return 'database_unavailable';
  if (NET_ERRNO.test(code)) return 'database_unavailable';
  return null;
}

/** One log line for a database failure: the API code plus the driver code (SQLSTATE / errno). */
export function logDbError(where: string, apiCode: ApiErrorCode, err: unknown): void {
  const code = rawCode(err);
  console.error(`${where}: ${apiCode}${code === undefined ? '' : ` (${code})`}`);
}

/**
 * A store factory over an executor source, with the role check memoized on success.
 * Exported for tests; the server uses getStore().
 */
export function storeProvider(executor: () => SqlExecutor): () => Promise<SessionStore> {
  let ready: SessionStore | undefined;
  return async () => {
    if (ready !== undefined) return ready;
    try {
      const sql = executor();
      await assertOrdinaryRole(sql);
      ready = new PostgresSessionStore(sql);
      return ready;
    } catch (err) {
      const code = dbErrorCode(err) ?? 'database_unavailable';
      logDbError('db', code, err);
      throw new ApiError(code);
    }
  };
}

/** The process-wide store over getPool() (DATABASE_URL). */
export const getStore: () => Promise<SessionStore> = storeProvider(() => pgExecutor(getPool()));
