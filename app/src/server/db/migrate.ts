// Migration runner (P11): applies app/supabase/migrations/*.sql in name order.
//
// OWN runner, never mixed with the Supabase CLI on one database: the CLI keeps its own accounting
// (supabase_migrations.schema_migrations) and would re-apply everything. Ours is
// brodyazhnik.schema_migrations, bootstrapped here with RLS on and zero policies.
//
// Per-file transactions, enforced by Postgres: each pending file runs as ONE script on one
// connection,
//   begin; do $T_o$ begin execute $T_s$<file>$T_s$; end $T_o$; <accounting insert>; commit;
// with a fresh random tag T per file. PL/pgSQL EXECUTE rejects every transaction command (COMMIT,
// ROLLBACK, SAVEPOINT, BEGIN, ...) with 0A000, so a file cannot end or split the runner's
// transaction however its text is quoted: a failing file -- including one with transaction
// control -- leaves neither objects nor an accounting row. Migrations must not contain transaction
// control, nor statements that cannot run inside a transaction or a function (CREATE INDEX
// CONCURRENTLY, VACUUM, ...). A file containing the tag prefix ($brodyazhnik_mig_) is refused
// before execution, so it cannot close the wrapper's dollar quotes.
//
// Bytes: a file is printable ASCII (0x20-0x7E) plus LF and tab -- the project's ASCII rule for
// SQL, and no client-encoding ambiguity in what the server receives.
//
// Checksums: an applied file is immutable. Its sha256 is recorded; an edited applied file, a
// renamed one, or a recorded version whose file is gone stops the run before anything is applied
// (the database would silently diverge from the files otherwise). A pending file older than the
// latest applied one (a late-merged branch) stops the run too: it was written against an older
// schema. Idempotent: a second run applies nothing.
import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SqlExecutor } from './sql';

const FILE_RE = /^(\d{14})_([a-z0-9_]+)\.sql$/;
const IGNORED = new Set(['.DS_Store']); // Finder litter, never part of a git tree
export const TAG_PREFIX = 'brodyazhnik_mig_';

const BOOTSTRAP = `
create schema if not exists brodyazhnik;
create table if not exists brodyazhnik.schema_migrations (
  version text primary key,
  name text not null,
  sha256 text not null,
  applied_at timestamptz not null default now()
);
alter table brodyazhnik.schema_migrations enable row level security;
`;

export class MigrationError extends Error {
  readonly code = 'migration_error' as const;
  constructor(message: string) {
    super(`migrate: ${message}`);
    this.name = 'MigrationError';
  }
}

export interface MigrationFile {
  readonly version: string;
  readonly name: string;
  readonly file: string;
  readonly sql: string;
  readonly sha256: string;
}

/** Every file in dir, validated and sorted by name; anything that is not a migration is an error. */
export function readMigrations(dir: string): MigrationFile[] {
  const names = readdirSync(dir).filter((n) => !IGNORED.has(n)).sort();
  const out: MigrationFile[] = [];
  for (const file of names) {
    const m = FILE_RE.exec(file);
    if (m === null) throw new MigrationError(`unexpected file ${file} (expected <YYYYMMDDHHMMSS>_<name>.sql, name [a-z0-9_]+)`);
    const bytes = readFileSync(join(dir, file));
    const bad = bytes.findIndex((b) => b !== 0x0a && b !== 0x09 && (b < 0x20 || b > 0x7e));
    if (bad !== -1) {
      const hex = (bytes[bad] ?? 0).toString(16).padStart(2, '0');
      throw new MigrationError(`${file} has byte 0x${hex} at offset ${bad}; migrations are printable ASCII with LF line ends and tabs`);
    }
    const version = m[1] ?? '';
    if (out.some((f) => f.version === version)) throw new MigrationError(`duplicate version ${version}`);
    const sql = bytes.toString('utf8');
    if (sql.includes(`$${TAG_PREFIX}`)) throw new MigrationError(`${file} contains the runner's dollar-quote tag prefix $${TAG_PREFIX}`);
    out.push({ version, name: m[2] ?? '', file, sql, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  return out;
}

/** The literals inlined into the accounting insert: safe only because they match these shapes. */
function assertInlinable(f: MigrationFile): void {
  if (!/^\d{14}$/.test(f.version) || !/^[a-z0-9_]+$/.test(f.name) || !/^[0-9a-f]{64}$/.test(f.sha256)) {
    throw new MigrationError(`refusing to inline unvalidated values for ${f.file}`);
  }
}

/** The one script that applies f and records it, atomically (see the header). */
export function applyScript(f: MigrationFile, tag = TAG_PREFIX + randomBytes(8).toString('hex')): string {
  assertInlinable(f);
  if (!/^[a-z0-9_]+$/.test(tag) || f.sql.includes(`$${tag}`)) throw new MigrationError(`unusable dollar-quote tag for ${f.file}`);
  return (
    `begin;\ndo $${tag}_o$ begin execute $${tag}_s$${f.sql}\n$${tag}_s$; end $${tag}_o$;\n` +
    `insert into brodyazhnik.schema_migrations (version, name, sha256) values ('${f.version}', '${f.name}', '${f.sha256}');\n` +
    'commit;'
  );
}

export async function migrate(sql: SqlExecutor, dir: string): Promise<{ applied: string[]; skipped: string[] }> {
  const files = readMigrations(dir);
  await sql.exec(BOOTSTRAP);
  const { rows } = await sql.query<{ version: string; name: string; sha256: string }>(
    'select version, name, sha256 from brodyazhnik.schema_migrations order by version',
  );
  const byVersion = new Map(files.map((f) => [f.version, f]));
  for (const r of rows) {
    const f = byVersion.get(r.version);
    if (f === undefined) throw new MigrationError(`applied migration ${r.version}_${r.name} has no file`);
    if (f.name !== r.name) throw new MigrationError(`applied migration ${r.version} was renamed (${r.name} -> ${f.name})`);
    if (f.sha256 !== r.sha256) throw new MigrationError(`applied migration was edited: ${f.file}`);
  }
  const recorded = new Set(rows.map((r) => r.version));
  const latest = rows.reduce((max, r) => (r.version > max ? r.version : max), '');
  const stale = files.find((f) => !recorded.has(f.version) && f.version < latest);
  if (stale !== undefined) {
    throw new MigrationError(`pending ${stale.file} is older than the latest applied migration ${latest}; rename it with a newer timestamp`);
  }
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    if (recorded.has(f.version)) {
      skipped.push(f.version);
      continue;
    }
    await sql.exec(applyScript(f));
    applied.push(f.version);
  }
  return { applied, skipped };
}
