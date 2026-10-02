// Role guard: the app and the migration CLI connect as a dedicated ordinary role that owns the
// schema (app/supabase/README.md). A superuser or BYPASSRLS login defeats the access model --
// RLS no longer separates roles, and a superuser can switch the P12 triggers off with
// session_replication_role -- so it is refused before anything runs. Checked for the session
// user and the current user and for every role either is a member of, directly or indirectly
// (pg_has_role MEMBER, which includes the role itself): SET ROLE can neither hide a superuser
// login nor escalate to a superuser / BYPASSRLS role. Not part of migrate(): PGlite runs the
// offline tests as a superuser.
import 'server-only';

import type { SqlExecutor } from './sql';

export class UnsafeRoleError extends Error {
  readonly code = 'unsafe_database_role' as const;
  constructor(what: string) {
    super(`refusing to run as ${what}; connect as the dedicated owner role (app/supabase/README.md)`);
    this.name = 'UnsafeRoleError';
  }
}

export const ROLE_QUERY =
  'select r.rolname in (session_user, current_user) as self, r.rolsuper, r.rolbypassrls from pg_catalog.pg_roles r ' +
  "where pg_catalog.pg_has_role(session_user, r.oid, 'MEMBER') or pg_catalog.pg_has_role(current_user, r.oid, 'MEMBER')";

interface RoleRow {
  self: unknown;
  rolsuper: unknown;
  rolbypassrls: unknown;
}

export async function assertOrdinaryRole(sql: SqlExecutor): Promise<void> {
  const { rows: all } = await sql.query<RoleRow>(ROLE_QUERY);
  const rows = [...all.filter((r) => r.self === true), ...all.filter((r) => r.self !== true)]; // own flags first
  if (!rows.some((r) => r.self === true)) throw new UnsafeRoleError('a role that is not in pg_roles');
  // fail closed: anything but an explicit false is refused
  const who = (r: RoleRow) => (r.self === true ? 'a' : 'a member of a');
  const su = rows.find((r) => r.rolsuper !== false);
  if (su !== undefined) throw new UnsafeRoleError(`${who(su)} superuser role`);
  const byp = rows.find((r) => r.rolbypassrls !== false);
  if (byp !== undefined) throw new UnsafeRoleError(`${who(byp)} BYPASSRLS role`);
}
