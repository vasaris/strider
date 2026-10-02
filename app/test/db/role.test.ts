// Role guard with a FAKE executor: a superuser or BYPASSRLS role -- the session / current user
// itself or any role it is a member of -- and an unknown role are refused; an ordinary role with
// ordinary memberships passes; anything but an explicit false fails closed. Then the real catalog
// query on PGlite (which runs as the superuser postgres).
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

import { assertOrdinaryRole, ROLE_QUERY, UnsafeRoleError } from '../../src/server/db/role';
import type { SqlExecutor } from '../../src/server/db/sql';
import { pgliteExecutor } from '../support/pglite';

function fake(rows: object[]): SqlExecutor & { texts: string[] } {
  const texts: string[] = [];
  return {
    texts,
    async query<R extends object>(text: string) {
      texts.push(text);
      return { rows: rows as R[] };
    },
    async exec() {
      throw new Error('exec is not used');
    },
  };
}

const SELF = { self: true, rolsuper: false, rolbypassrls: false };
const OTHER = { self: false, rolsuper: false, rolbypassrls: false };

describe('assertOrdinaryRole', () => {
  it('passes an ordinary role with ordinary memberships, asking the membership query', async () => {
    const sql = fake([SELF]);
    await expect(assertOrdinaryRole(sql)).resolves.toBeUndefined();
    await expect(assertOrdinaryRole(fake([OTHER, SELF, OTHER]))).resolves.toBeUndefined();
    expect(sql.texts).toEqual([ROLE_QUERY]);
    expect(ROLE_QUERY).toMatch(/pg_has_role\(session_user, r\.oid, 'MEMBER'\) or pg_catalog\.pg_has_role\(current_user, r\.oid, 'MEMBER'\)/);
  });

  it.each([
    ['a superuser', [{ ...SELF, rolsuper: true }], /refusing to run as a superuser role; connect as the dedicated owner role \(app\/supabase\/README\.md\)/],
    ['a BYPASSRLS role', [{ ...SELF, rolbypassrls: true }], /refusing to run as a BYPASSRLS role/],
    ['a superuser login behind SET ROLE', [SELF, { ...SELF, rolsuper: true, rolbypassrls: true }], /as a superuser role/],
    ['a member of a superuser role', [SELF, { ...OTHER, rolsuper: true }], /as a member of a superuser role/],
    ['a member of a BYPASSRLS role', [{ ...OTHER, rolbypassrls: true }, SELF], /as a member of a BYPASSRLS role/],
    ['a superuser seen through its memberships first', [{ ...OTHER, rolsuper: true }, { ...SELF, rolsuper: true }], /as a superuser role/],
    ['no row', [], /a role that is not in pg_roles/],
    ['memberships but no own row', [OTHER], /a role that is not in pg_roles/],
    ['a non-boolean flag', [{ ...SELF, rolsuper: 'f' }], /a superuser role/],
    ['a missing flag', [{ self: true, rolsuper: false }], /a BYPASSRLS role/],
  ])('refuses %s', async (_, rows, message) => {
    const err = await assertOrdinaryRole(fake(rows)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnsafeRoleError);
    expect(err).toMatchObject({ code: 'unsafe_database_role', message: expect.stringMatching(message) });
  });
});

describe('assertOrdinaryRole on a real catalog (PGlite)', () => {
  it('refuses the superuser (also behind SET ROLE), BYPASSRLS and members of either; passes an ordinary role', async () => {
    const db = new PGlite();
    const sql = pgliteExecutor(db);
    await db.exec(`
      create role probe_app login nosuperuser nobypassrls;
      create role probe_byp login nosuperuser bypassrls;
      create role probe_mid nologin nosuperuser nobypassrls;
      create role probe_member login nosuperuser nobypassrls;
      grant probe_byp to probe_mid;
      grant probe_mid to probe_member;
      create role probe_sumember login nosuperuser nobypassrls;
      grant postgres to probe_sumember;
      create role probe_plain nologin;
      grant probe_plain to probe_app;
    `);
    const as = async (user: string) => {
      await db.exec(`reset session authorization; set session authorization ${user}`);
      return assertOrdinaryRole(sql);
    };
    await expect(assertOrdinaryRole(sql)).rejects.toThrow(/as a superuser role/);
    await db.exec('set role probe_app');
    await expect(assertOrdinaryRole(sql)).rejects.toThrow(/as a superuser role/); // session_user is still postgres
    await db.exec('reset role');
    await expect(as('probe_byp')).rejects.toThrow(/as a BYPASSRLS role/);
    await expect(as('probe_member')).rejects.toThrow(/as a member of a BYPASSRLS role/); // indirect, via probe_mid
    await expect(as('probe_sumember')).rejects.toThrow(/as a member of a superuser role/);
    await expect(as('probe_app')).resolves.toBeUndefined(); // an ordinary membership is fine
    await db.close();
  });
});
