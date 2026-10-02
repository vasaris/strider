// One short line for a failure of the database CLI (and, later, server logs): never the URL,
// password, host or port. Our own errors print their message. A server error prints its message
// only for SQLSTATE classes that describe the SQL being run -- such a message may name database
// objects, including a database or role name (e.g. a 42 'permission denied' or 'must be owner');
// every other class (08 connection, 28 auth -- names the user and host, 3D catalog, 53
// resources, 57 operator, 58 system, ...) prints the code alone. Anything else (network errors
// carry host:port in the message) prints its class and code only.
import 'server-only';

import pg from 'pg';

import { MigrationError } from './migrate';
import { DatabaseNotConfiguredError } from './pg';
import { UnsafeRoleError } from './role';

// feature not supported, data, integrity, transaction state, routine, rollback, syntax/access,
// plpgsql raise
const MESSAGE_CLASSES = new Set(['0A', '22', '23', '25', '2B', '40', '42', 'P0']);
const OWN_CODE = /^BRD\d{2}$/; // raised by our migrations
const PRINTABLE_CODE = /^[A-Za-z0-9_]{1,40}$/;

export function describeDbError(err: unknown): string {
  if (err instanceof DatabaseNotConfiguredError) return 'DATABASE_URL is not set';
  if (err instanceof MigrationError || err instanceof UnsafeRoleError) return err.message;
  const raw = typeof err === 'object' && err !== null && 'code' in err ? (err as { code: unknown }).code : undefined;
  const code = typeof raw === 'string' && PRINTABLE_CODE.test(raw) ? raw : undefined;
  if (err instanceof pg.DatabaseError) {
    if (code === undefined) return 'SQL error (no SQLSTATE)';
    return MESSAGE_CLASSES.has(code.slice(0, 2)) || OWN_CODE.test(code) ? `SQL error ${code}: ${err.message}` : `SQL error ${code}`;
  }
  const kind = err instanceof Error ? err.name : typeof err;
  return `database error (${kind}${code === undefined ? '' : ` ${code}`})`;
}
