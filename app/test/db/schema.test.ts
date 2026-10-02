// The init migration on PGlite: tables, RLS with zero policies (catalog and behaviour), P12
// append-only incl. TRUNCATE, P10 seed bounds, prose XOR error, sha format, contiguity, jsonb shape.
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

import { migratedDb } from '../support/pglite';

const SHA = 'a'.repeat(64);
let db: PGlite;

beforeAll(async () => {
  ({ db } = await migratedDb());
});

async function session(seed = 'a3-1', initialState = '{}'): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into brodyazhnik.sessions (rng_seed, hero_ref, pack_id, pack_version, initial_state) values ($1, 'h', 'kv', '0.1.0', $2::jsonb) returning id::text as id",
    [seed, initialState],
  );
  return rows[0]?.id ?? '';
}

const turn = (sid: string, n: number, state = '{}', pkg = '{}') =>
  db.query(
    "insert into brodyazhnik.turns (session_id, turn_index, state, pkg, pack_version) values ($1::uuid, $2, $3::jsonb, $4::jsonb, '0.1.0')",
    [sid, n, state, pkg],
  );

const generation = (sid: string, n: number, prose: string | null, error: string | null, sha = SHA) =>
  db.query(
    'insert into brodyazhnik.generations (session_id, turn_index, prose, error, model, keeper_prompt_path, keeper_prompt_sha256, tone_sha256, assembly_sha256) ' +
      "values ($1::uuid, $2, $3, $4, 'm', 'prompts/k.md', $5, $6, $7)",
    [sid, n, prose, error, sha, SHA, SHA],
  );

const CHECK = { code: '23514' };

describe('catalog', () => {
  const TABLES = ['generations', 'schema_migrations', 'sessions', 'turns'];

  it('has the three tables and the accounting table in schema brodyazhnik', async () => {
    const { rows } = await db.query<{ t: string }>(
      "select table_name as t from information_schema.tables where table_schema = 'brodyazhnik' order by 1",
    );
    expect(rows.map((r) => r.t)).toEqual(TABLES);
  });

  it('enables RLS on all four, without FORCE', async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      "select relname, relrowsecurity, relforcerowsecurity from pg_class where relnamespace = 'brodyazhnik'::regnamespace and relkind = 'r' order by 1",
    );
    expect(rows).toEqual(TABLES.map((relname) => ({ relname, relrowsecurity: true, relforcerowsecurity: false })));
  });

  it('has zero policies in the schema', async () => {
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from pg_policies where schemaname = 'brodyazhnik'");
    expect(rows).toEqual([{ n: 0 }]);
  });

  it('revokes schema privileges from public', async () => {
    const { rows } = await db.query<{ usage: boolean }>("select has_schema_privilege('public', 'brodyazhnik', 'usage') as usage");
    expect(rows).toEqual([{ usage: false }]);
  });

  it('has an update/delete row trigger and a truncate statement trigger on each data table', async () => {
    const { rows } = await db.query<{ tbl: string; tgname: string }>(
      "select c.relname as tbl, t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'brodyazhnik'::regnamespace and not t.tgisinternal order by 1, 2",
    );
    expect(rows.map((r) => `${r.tbl}.${r.tgname}`)).toEqual([
      'generations.generations_append_only',
      'generations.generations_no_truncate',
      'sessions.sessions_append_only',
      'sessions.sessions_no_truncate',
      'turns.turns_append_only',
      'turns.turns_contiguous',
      'turns.turns_no_truncate',
    ]);
  });
});

describe('RLS behaviour', () => {
  it('a non-owner role granted select sees zero rows; the owner sees them', async () => {
    const sid = await session();
    await turn(sid, 0);
    await generation(sid, 0, 'p', null);
    await db.exec(
      'create role rls_probe nologin; grant usage on schema brodyazhnik to rls_probe; grant select on all tables in schema brodyazhnik to rls_probe;',
    );
    const count = async (t: string) => (await db.query<{ n: number }>(`select count(*)::int as n from brodyazhnik.${t}`)).rows[0]?.n;
    const owner = [await count('sessions'), await count('turns'), await count('generations'), await count('schema_migrations')];
    await db.exec('set role rls_probe');
    try {
      expect(await count('sessions')).toBe(0);
      expect(await count('turns')).toBe(0);
      expect(await count('generations')).toBe(0);
      expect(await count('schema_migrations')).toBe(0);
    } finally {
      await db.exec('reset role');
    }
    for (const n of owner) expect(n).toBeGreaterThan(0);
  });
});

describe('append-only (P12)', () => {
  let sid = '';
  beforeAll(async () => {
    sid = await session();
    await turn(sid, 0);
    await generation(sid, 0, 'p', null);
  });

  const msg = (op: string, t: string) => new RegExp(`${op} on brodyazhnik\\.${t} rejected: the table is append-only`);

  it.each([
    ['sessions', "update brodyazhnik.sessions set hero_ref = 'x'"],
    ['turns', "update brodyazhnik.turns set pack_version = 'x'"],
    ['generations', "update brodyazhnik.generations set model = 'x'"],
  ])('rejects UPDATE on %s', async (t, stmt) => {
    await expect(db.query(stmt)).rejects.toMatchObject({ code: 'BRD02', message: expect.stringMatching(msg('UPDATE', t)) });
  });

  it.each(['generations', 'turns', 'sessions'])('rejects DELETE on %s', async (t) => {
    await expect(db.query(`delete from brodyazhnik.${t}`)).rejects.toMatchObject({
      code: 'BRD02',
      message: expect.stringMatching(msg('DELETE', t)),
    });
  });

  // TRUNCATE checks foreign keys before firing triggers: a referenced table needs CASCADE to
  // reach them, and then the named (first) table's trigger fires.
  it.each([
    ['generations', 'truncate brodyazhnik.generations'],
    ['turns', 'truncate brodyazhnik.turns cascade'],
    ['sessions', 'truncate brodyazhnik.sessions cascade'],
  ])('rejects TRUNCATE on %s', async (t, stmt) => {
    await expect(db.query(stmt)).rejects.toMatchObject({ code: 'BRD02', message: expect.stringMatching(msg('TRUNCATE', t)) });
  });

  it('left every row in place', async () => {
    expect((await db.query('select 1 from brodyazhnik.sessions where id = $1::uuid', [sid])).rows).toHaveLength(1);
    expect((await db.query('select 1 from brodyazhnik.turns where session_id = $1::uuid', [sid])).rows).toHaveLength(1);
    expect((await db.query('select 1 from brodyazhnik.generations where session_id = $1::uuid', [sid])).rows).toHaveLength(1);
  });
});

describe('P10 rng_seed bounds', () => {
  it("rejects '' and 129 characters; accepts 'a3-1' and 128 characters", async () => {
    await expect(session('')).rejects.toMatchObject(CHECK);
    await expect(session('x'.repeat(129))).rejects.toMatchObject(CHECK);
    expect(await session('a3-1')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await session('x'.repeat(128))).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('counts characters, not bytes', async () => {
    expect(await session('\u00e9'.repeat(128))).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('generations', () => {
  let sid = '';
  beforeAll(async () => {
    sid = await session();
    await turn(sid, 0);
  });

  it('enforces prose XOR error both ways', async () => {
    await expect(generation(sid, 0, 'p', 'e')).rejects.toMatchObject(CHECK);
    await expect(generation(sid, 0, null, null)).rejects.toMatchObject(CHECK);
    await generation(sid, 0, 'p', null);
    await generation(sid, 0, null, 'e');
  });

  it('rejects empty prose / error', async () => {
    await expect(generation(sid, 0, '', null)).rejects.toMatchObject(CHECK);
    await expect(generation(sid, 0, null, '')).rejects.toMatchObject(CHECK);
  });

  it('enforces the sha256 format', async () => {
    for (const bad of ['A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), `${'a'.repeat(64)}\n`, 'g'.repeat(64)]) {
      await expect(generation(sid, 0, 'p', null, bad)).rejects.toMatchObject(CHECK);
    }
  });

  it('requires an existing turn', async () => {
    await expect(generation(sid, 1, 'p', null)).rejects.toMatchObject({ code: '23503' });
  });
});

describe('contiguity', () => {
  it('rejects index 1 before 0, a duplicate and a gap; accepts 0, 1, 2', async () => {
    const sid = await session();
    await expect(turn(sid, 1)).rejects.toMatchObject({ code: 'BRD01', message: expect.stringMatching(/not contiguous \(next is 0\)/) });
    await turn(sid, 0);
    await expect(turn(sid, 0)).rejects.toMatchObject({ code: 'BRD01' });
    await turn(sid, 1);
    await expect(turn(sid, 3)).rejects.toMatchObject({ code: 'BRD01' });
    await turn(sid, 2);
    const { rows } = await db.query<{ n: number }>('select turn_index as n from brodyazhnik.turns where session_id = $1::uuid order by 1', [sid]);
    expect(rows.map((r) => r.n)).toEqual([0, 1, 2]);
  });

  it('reports a missing session as a foreign key violation', async () => {
    await expect(turn('00000000-0000-4000-8000-000000000000', 0)).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects a negative index', async () => {
    await expect(turn(await session(), -1)).rejects.toMatchObject({ code: 'BRD01' });
  });
});

describe('jsonb shape', () => {
  it.each(['[]', '1', '"s"', 'null'])('rejects a non-object %s', async (v) => {
    await expect(session('s', v)).rejects.toMatchObject(CHECK);
    const sid = await session();
    await expect(turn(sid, 0, v, '{}')).rejects.toMatchObject(CHECK);
    await expect(turn(sid, 0, '{}', v)).rejects.toMatchObject(CHECK);
  });
});
