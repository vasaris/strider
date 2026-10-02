// P11 runner on PGlite: fresh apply, idempotent rerun, checksum, order, byte and file-set guards,
// and per-file transactions enforced by the server: a failing file -- also one with transaction
// control, however quoted -- leaves no objects and no accounting row (DO + EXECUTE, 0A000).
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { afterAll, describe, expect, it } from 'vitest';

import { applyScript, migrate, TAG_PREFIX } from '../../src/server/db/migrate';
import { MIGRATIONS_DIR, pgliteExecutor } from '../support/pglite';

const INIT = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
const INIT_VERSION = (INIT[0] ?? '').slice(0, 14);

const tmpRoot = mkdtempSync(join(tmpdir(), 'brodyazhnik-migrate-'));
afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));

/** A temp migrations dir holding a copy of the init file plus the given extra files. */
function tempDir(extra: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpRoot, 'm-'));
  for (const f of INIT) copyFileSync(join(MIGRATIONS_DIR, f), join(dir, f));
  for (const [name, body] of Object.entries(extra)) writeFileSync(join(dir, name), body);
  return dir;
}

async function fresh() {
  const db = new PGlite();
  return { db, sql: pgliteExecutor(db) };
}

async function tables(db: PGlite): Promise<string[]> {
  const { rows } = await db.query<{ t: string }>(
    "select table_schema || '.' || table_name as t from information_schema.tables where table_schema in ('public', 'brodyazhnik') order by 1",
  );
  return rows.map((r) => r.t);
}

async function accounting(db: PGlite): Promise<string[]> {
  const { rows } = await db.query<{ version: string }>('select version from brodyazhnik.schema_migrations order by version');
  return rows.map((r) => r.version);
}

describe('migrate', () => {
  it('has exactly one migration, the init', () => {
    expect(INIT).toHaveLength(1);
    expect(INIT[0]).toMatch(/^\d{14}_brodyazhnik_init\.sql$/);
  });

  it('applies the init on a fresh database, then skips it on a rerun', async () => {
    const { db, sql } = await fresh();
    expect(await migrate(sql, MIGRATIONS_DIR)).toEqual({ applied: [INIT_VERSION], skipped: [] });
    expect(await migrate(sql, MIGRATIONS_DIR)).toEqual({ applied: [], skipped: [INIT_VERSION] });
    expect(await accounting(db)).toEqual([INIT_VERSION]);
    const { rows } = await db.query<{ name: string; sha256: string }>('select name, sha256 from brodyazhnik.schema_migrations');
    expect(rows[0]?.name).toBe('brodyazhnik_init');
    expect(rows[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses an edited applied file and applies nothing', async () => {
    const { db, sql } = await fresh();
    const dir = tempDir();
    await migrate(sql, dir);
    const file = join(dir, INIT[0] ?? '');
    writeFileSync(file, readFileSync(file, 'utf8') + ' ');
    writeFileSync(join(dir, '29990101000000_later.sql'), 'create table brodyazhnik.later (x int);');
    await expect(migrate(sql, dir)).rejects.toThrow(/applied migration was edited/);
    expect(await accounting(db)).toEqual([INIT_VERSION]);
    expect((await db.query("select to_regclass('brodyazhnik.later') as r")).rows).toEqual([{ r: null }]);
  });

  it('rolls a failing file back whole: no partial objects, no accounting row', async () => {
    const { db, sql } = await fresh();
    const dir = tempDir({
      '29990101000000_broken.sql': 'create table brodyazhnik.partial (x int);\ninsert into brodyazhnik.nope values (1);\n',
    });
    await expect(migrate(sql, dir)).rejects.toMatchObject({ code: '42P01' });
    expect(await accounting(db)).toEqual([INIT_VERSION]);
    expect((await db.query("select to_regclass('brodyazhnik.partial') as r")).rows).toEqual([{ r: null }]);
    // the connection is usable afterwards (the aborted transaction was rolled back)
    expect((await db.query<{ one: number }>('select 1 as one')).rows).toEqual([{ one: 1 }]);
  });

  it('rejects a stray file in the directory', async () => {
    const { db, sql } = await fresh();
    await expect(migrate(sql, tempDir({ 'notes.txt': 'x' }))).rejects.toThrow(/unexpected file notes\.txt/);
    await expect(migrate(sql, tempDir({ '2026_short.sql': 'select 1;' }))).rejects.toThrow(/unexpected file/);
    await expect(migrate(sql, tempDir({ '29990101000000_Upper.sql': 'select 1;' }))).rejects.toThrow(/unexpected file/);
    expect((await db.query("select to_regnamespace('brodyazhnik') as r")).rows).toEqual([{ r: null }]);
  });

  it('rejects a recorded version whose file is missing', async () => {
    const { sql } = await fresh();
    const dir = tempDir({ '29990101000000_extra.sql': 'create table brodyazhnik.extra (x int);' });
    expect((await migrate(sql, dir)).applied).toEqual([INIT_VERSION, '29990101000000']);
    rmSync(join(dir, '29990101000000_extra.sql'));
    await expect(migrate(sql, dir)).rejects.toThrow(/applied migration 29990101000000_extra has no file/);
  });

  it.each([
    ['a CR (Postgres ends a -- comment there)', 'create table brodyazhnik.p1 (a int);\n-- note\rcommit;\rcreate table brodyazhnik.p1 (a int);\n', '0d', 44],
    ['CRLF line ends', 'select 1;\r\n', '0d', 9],
    ['a non-ASCII dollar tag', "select $\u00e9$ ' $\u00e9$;\ncommit;\nselect ' ';", 'c3', 8],
    ['a non-ASCII comment', '-- \u0436\nselect 1;\n', 'd0', 3],
    ['a form feed', 'select 1;\f\n', '0c', 9],
    ['a NUL', 'select 1;\u0000\n', '00', 9],
    ['a DEL', 'select 1;\u007f\n', '7f', 9],
  ])('rejects a file with %s before executing anything', async (_, body, hex, offset) => {
    const { db, sql } = await fresh();
    const dir = tempDir({ '29990101000000_bytes.sql': body });
    await expect(migrate(sql, dir)).rejects.toThrow(
      new RegExp(`29990101000000_bytes\\.sql has byte 0x${hex} at offset ${offset}; migrations are printable ASCII with LF line ends and tabs`),
    );
    expect((await db.query("select to_regnamespace('brodyazhnik') as r")).rows).toEqual([{ r: null }]);
  });

  it('accepts tabs and LF, and the init migration is printable ASCII', async () => {
    const { sql } = await fresh();
    const dir = tempDir({ '29990101000000_tabs.sql': 'create table brodyazhnik.t (\n\ta int\n);\n' });
    expect((await migrate(sql, dir)).applied).toEqual([INIT_VERSION, '29990101000000']);
  });

  it('refuses a pending file older than the latest applied one and applies nothing', async () => {
    const { db, sql } = await fresh();
    const dir = tempDir({ '29990101000000_later.sql': 'create table brodyazhnik.later (x int);' });
    expect((await migrate(sql, dir)).applied).toEqual([INIT_VERSION, '29990101000000']);
    writeFileSync(join(dir, '29980101000000_late.sql'), 'create table brodyazhnik.late (x int);');
    writeFileSync(join(dir, '30000101000000_newer.sql'), 'create table brodyazhnik.newer (x int);');
    await expect(migrate(sql, dir)).rejects.toThrow(
      /pending 29980101000000_late\.sql is older than the latest applied migration 29990101000000; rename it with a newer timestamp/,
    );
    expect(await accounting(db)).toEqual([INIT_VERSION, '29990101000000']);
    for (const t of ['late', 'newer']) {
      expect((await db.query(`select to_regclass('brodyazhnik.${t}') as r`)).rows).toEqual([{ r: null }]);
    }
  });


  it.each([
    ['COMMIT', 'create table public.c1 (a int);\ncommit;\ncreate table public.c2 (a int);\n'],
    ['ROLLBACK', 'create table public.r1 (a int);\nrollback;\n'],
    ['SAVEPOINT', 'create table public.s1 (a int);\nsavepoint x;\ncreate table public.s2 (a int);\n'],
    ['a leading BEGIN', 'begin;\ncreate table public.b1 (a int);\n'],
    ['START TRANSACTION', 'start transaction;\ncreate table public.b2 (a int);\n'],
    // the lexer bypass that retired the client-side scanner: an E-string continued on the next line
    ['a COMMIT hidden by an E-string continuation', "create table public.p1 (a int);\nselect E'a'\n'\\'';\ncommit;\nselect 'x';\ncreate table public.p1 (a int);\n"],
  ])('a file with %s fails whole with 0A000: no objects, no accounting row', async (_, body) => {
    const { db, sql } = await fresh();
    await migrate(sql, MIGRATIONS_DIR);
    const before = await tables(db);
    const dir = tempDir({ '29990101000000_txn.sql': body });
    await expect(migrate(sql, dir)).rejects.toMatchObject({
      code: '0A000',
      message: expect.stringMatching(/EXECUTE of transaction commands is not implemented/),
    });
    expect(await tables(db)).toEqual(before);
    expect(await accounting(db)).toEqual([INIT_VERSION]);
    expect((await db.query<{ one: number }>('select 1 as one')).rows).toEqual([{ one: 1 }]); // connection usable
  });

  it('applies a SQL-standard BEGIN ATOMIC function body', async () => {
    const { db, sql } = await fresh();
    const dir = tempDir({
      '29990101000000_atomic.sql': 'create function brodyazhnik.one() returns int language sql\nbegin atomic\n  select 1;\nend;\n',
    });
    expect((await migrate(sql, dir)).applied).toEqual([INIT_VERSION, '29990101000000']);
    expect((await db.query<{ v: number }>('select brodyazhnik.one() as v')).rows).toEqual([{ v: 1 }]);
  });

  it('applies nested DO and $$ / $tag$ bodies with their own begin / end', async () => {
    const { db, sql } = await fresh();
    const body = [
      'create table brodyazhnik.n (x int);',
      'create function brodyazhnik.two() returns int language plpgsql as $$ begin return 2; end $$;',
      'do $outer$ begin',
      "  execute $inner$ insert into brodyazhnik.n values (1) $inner$;",
      '  perform brodyazhnik.two();',
      'end $outer$;',
      "-- a trailing comment without a newline is fine: the runner appends one",
    ].join('\n');
    const dir = tempDir({ '29990101000000_nested.sql': body });
    expect((await migrate(sql, dir)).applied).toEqual([INIT_VERSION, '29990101000000']);
    expect((await db.query<{ x: number }>('select x from brodyazhnik.n')).rows).toEqual([{ x: 1 }]);
    expect(await accounting(db)).toEqual([INIT_VERSION, '29990101000000']);
  });

  it(`refuses a file containing the tag prefix $${TAG_PREFIX} before executing anything`, async () => {
    const { db, sql } = await fresh();
    const dir = tempDir({ '29990101000000_tag.sql': `select $${TAG_PREFIX}x_s$ ; commit; $${TAG_PREFIX}x_s$;\n` });
    await expect(migrate(sql, dir)).rejects.toThrow(/29990101000000_tag\.sql contains the runner's dollar-quote tag prefix \$brodyazhnik_mig_/);
    expect((await db.query("select to_regnamespace('brodyazhnik') as r")).rows).toEqual([{ r: null }]);
  });

  it('applyScript: one transaction, the file inside DO + EXECUTE, then the accounting row', () => {
    const f = { version: '29990101000000', name: 'x', file: '29990101000000_x.sql', sql: 'select 1;', sha256: 'a'.repeat(64) };
    expect(applyScript(f, 'brodyazhnik_mig_0123456789abcdef')).toBe(
      'begin;\ndo $brodyazhnik_mig_0123456789abcdef_o$ begin execute $brodyazhnik_mig_0123456789abcdef_s$select 1;\n' +
        '$brodyazhnik_mig_0123456789abcdef_s$; end $brodyazhnik_mig_0123456789abcdef_o$;\n' +
        `insert into brodyazhnik.schema_migrations (version, name, sha256) values ('29990101000000', 'x', '${'a'.repeat(64)}');\ncommit;`,
    );
    expect(applyScript(f)).toMatch(/^begin;\ndo \$brodyazhnik_mig_[0-9a-f]{16}_o\$ /);
    expect(applyScript(f)).not.toBe(applyScript(f)); // a fresh tag per call
    expect(() => applyScript({ ...f, sql: 'select $t_s$;' }, 't')).toThrow(/unusable dollar-quote tag/);
    expect(() => applyScript({ ...f, name: "x'" })).toThrow(/refusing to inline unvalidated values/);
  });
});
