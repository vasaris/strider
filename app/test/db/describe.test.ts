// describeDbError, every branch offline: our errors by message, pg DatabaseError with the message
// only for SQL-describing classes, everything else by class and code -- never a URL, user or host.
import pg from 'pg';
import { describe, expect, it } from 'vitest';

import { describeDbError } from '../../src/server/db/describe';
import { MigrationError } from '../../src/server/db/migrate';
import { DatabaseNotConfiguredError } from '../../src/server/db/pg';
import { UnsafeRoleError } from '../../src/server/db/role';

const SECRET = /dummyuser|dummysecret|10\.0\.0\.5|5432|db\.example/;

function dbError(code: string | undefined, message: string): pg.DatabaseError {
  const err = new pg.DatabaseError(message, message.length, 'error');
  if (code !== undefined) err.code = code;
  return err;
}

const netError = (code: string, message: string) => Object.assign(new Error(message), { code });

describe('describeDbError', () => {
  it('prints our own errors as they are', () => {
    expect(describeDbError(new DatabaseNotConfiguredError())).toBe('DATABASE_URL is not set');
    expect(describeDbError(new MigrationError('duplicate version 1'))).toBe('migrate: duplicate version 1');
    expect(describeDbError(new UnsafeRoleError('a superuser'))).toMatch(/^refusing to run as a superuser; /);
  });

  it.each(['0A000', '22P02', '23505', '25P02', '2BP01', '40001', '42P01', '42501', 'P0001', 'BRD01', 'BRD02'])(
    'prints the server message for %s (it describes the SQL being run)',
    (code) => {
      expect(describeDbError(dbError(code, 'relation "brodyazhnik.nope" does not exist'))).toBe(
        `SQL error ${code}: relation "brodyazhnik.nope" does not exist`,
      );
    },
  );

  it.each([
    ['28P01', 'password authentication failed for user "dummyuser"'],
    ['28000', 'no pg_hba.conf entry for host "10.0.0.5", user "dummyuser", database "db", no encryption'],
    ['3D000', 'database "db.example" does not exist'],
    ['08P01', 'invalid startup packet layout'],
    ['53300', 'too many connections for role "dummyuser"'],
    ['57P03', 'the database system is starting up'],
    ['58030', 'could not open file'],
    ['XX000', 'internal error at db.example'],
    ['BRDX1', 'not one of ours: dummyuser'],
  ])('prints only the code for %s', (code, message) => {
    const line = describeDbError(dbError(code, message));
    expect(line).toBe(`SQL error ${code}`);
    expect(line).not.toMatch(SECRET);
  });

  it('a DatabaseError without a code', () => {
    expect(describeDbError(dbError(undefined, 'role "dummyuser" x'))).toBe('SQL error (no SQLSTATE)');
  });

  it.each([
    [netError('EPERM', 'connect EPERM 10.0.0.5:5432 - Local (0.0.0.0:0)'), 'database error (Error EPERM)'],
    [netError('EPIPE', 'write EPIPE 10.0.0.5:5432'), 'database error (Error EPIPE)'],
    [netError('42P01', 'a 5-character code on a non-DatabaseError: dummysecret'), 'database error (Error 42P01)'],
    [netError('ECONNREFUSED', 'connect ECONNREFUSED 10.0.0.5:5432'), 'database error (Error ECONNREFUSED)'],
    [netError('postgres://dummyuser:dummysecret@db.example:5432/x', 'a code that is not a code'), 'database error (Error)'],
    [new TypeError('Invalid URL'), 'database error (TypeError)'],
    ['a string', 'database error (string)'],
    [undefined, 'database error (undefined)'],
  ])('prints class and code only for a non-DatabaseError (%#)', (err, line) => {
    expect(describeDbError(err)).toBe(line);
  });
});
