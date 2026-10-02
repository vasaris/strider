// Postgres SessionStore over the SqlExecutor port (pg in production, PGlite in tests).
// Serialization is ours, identical for both drivers: jsonb goes in as $n::jsonb from
// JSON.stringify and comes out as ::text through JSON.parse (jsonb normalizes key order -- the
// round-trip test proves it); bigint ids come out as ::text; timestamps as ISO-8601 UTC text
// formatted in SQL. The rules live in the migration, plus validate.ts (checked first, shared
// with the memory store); SQLSTATEs map to the typed errors:
//   turns:        23503 -> SessionNotFoundError; 23505, BRD01 -> TurnConflictError
//   generations:  23503 -> TurnNotFoundError
//   all inserts:  23514, 23502, 22021, 22P05, 22P02 -> InvalidRecordError (22P02: a backstop;
//                 lone surrogates in json, its one known cause, are rejected up front by validate.ts)
// Anything else propagates unchanged.
import 'server-only';

import { sqlState, type SqlExecutor } from '../db/sql';
import {
  InvalidRecordError,
  isInt32,
  isUuid,
  SessionNotFoundError,
  TurnConflictError,
  TurnNotFoundError,
  type GenerationRecord,
  type NewGeneration,
  type NewSession,
  type NewTurn,
  type SessionRecord,
  type SessionStore,
  type TurnRecord,
} from './types';
import { checkGeneration, checkSession, checkTurn } from './validate';

// check, not null, NUL in text, NUL in jsonb, invalid json text
const INVALID = new Set(['23514', '23502', '22021', '22P05', '22P02']);
const TS = `to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const SESSION_COLS = `id::text as id, ${TS} as created_at, rng_seed, hero_ref, pack_id, pack_version, initial_state::text as initial_state`;
const TURN_COLS = `session_id::text as session_id, turn_index, ${TS} as created_at, state::text as state, pkg::text as pkg, pack_version`;
const GENERATION_COLS =
  `id::text as id, ${TS} as created_at, session_id::text as session_id, turn_index, prose, error, model, ` +
  'keeper_prompt_path, keeper_prompt_sha256, tone_sha256, assembly_sha256';

interface SessionRow {
  id: string;
  created_at: string;
  rng_seed: string;
  hero_ref: string;
  pack_id: string;
  pack_version: string;
  initial_state: string;
}
interface TurnRow {
  session_id: string;
  turn_index: number;
  created_at: string;
  state: string;
  pkg: string;
  pack_version: string;
}
interface GenerationRow {
  id: string;
  created_at: string;
  session_id: string;
  turn_index: number;
  prose: string | null;
  error: string | null;
  model: string;
  keeper_prompt_path: string;
  keeper_prompt_sha256: string;
  tone_sha256: string;
  assembly_sha256: string;
}

const toSession = (r: SessionRow): SessionRecord => ({
  id: r.id,
  createdAt: r.created_at,
  rngSeed: r.rng_seed,
  heroRef: r.hero_ref,
  packId: r.pack_id,
  packVersion: r.pack_version,
  initialState: JSON.parse(r.initial_state) as SessionRecord['initialState'],
});

const toTurn = (r: TurnRow): TurnRecord => ({
  sessionId: r.session_id,
  turnIndex: r.turn_index,
  createdAt: r.created_at,
  state: JSON.parse(r.state) as TurnRecord['state'],
  pkg: JSON.parse(r.pkg) as TurnRecord['pkg'],
  packVersion: r.pack_version,
});

function toGeneration(r: GenerationRow): GenerationRecord {
  const base = {
    id: r.id,
    createdAt: r.created_at,
    sessionId: r.session_id,
    turnIndex: r.turn_index,
    model: r.model,
    keeperPromptPath: r.keeper_prompt_path,
    keeperPromptSha256: r.keeper_prompt_sha256,
    toneSha256: r.tone_sha256,
    assemblySha256: r.assembly_sha256,
  };
  if (r.prose !== null && r.error === null) return { ...base, prose: r.prose, error: null };
  if (r.prose === null && r.error !== null) return { ...base, prose: null, error: r.error };
  throw new Error(`generation ${r.id}: prose XOR error violated in storage`); // the check makes this unreachable
}

/** undefined -> SQL null (the not-null / check constraints then reject it). */
const json = (v: unknown): string | null => (v === undefined ? null : (JSON.stringify(v) ?? null));

function invalid(err: unknown): never {
  if (INVALID.has(sqlState(err) ?? '')) throw new InvalidRecordError(err instanceof Error ? err.message : String(err));
  throw err;
}

export class PostgresSessionStore implements SessionStore {
  constructor(private readonly sql: SqlExecutor) {}

  async createSession(input: NewSession): Promise<SessionRecord> {
    checkSession(input);
    try {
      const { rows } = await this.sql.query<SessionRow>(
        'insert into brodyazhnik.sessions (rng_seed, hero_ref, pack_id, pack_version, initial_state) ' +
          `values ($1, $2, $3, $4, $5::jsonb) returning ${SESSION_COLS}`,
        [input.rngSeed, input.heroRef, input.packId, input.packVersion, json(input.initialState)],
      );
      return toSession(one(rows));
    } catch (err) {
      return invalid(err);
    }
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    if (!isUuid(id)) return null;
    const { rows } = await this.sql.query<SessionRow>(`select ${SESSION_COLS} from brodyazhnik.sessions where id = $1::uuid`, [id]);
    return rows[0] === undefined ? null : toSession(rows[0]);
  }

  async appendTurn(input: NewTurn): Promise<TurnRecord> {
    const { sessionId, turnIndex } = input;
    if (!isInt32(turnIndex)) throw new InvalidRecordError('turnIndex must be a 32-bit integer');
    if (!isUuid(sessionId)) throw new SessionNotFoundError(sessionId);
    checkTurn(input);
    try {
      const { rows } = await this.sql.query<TurnRow>(
        'insert into brodyazhnik.turns (session_id, turn_index, state, pkg, pack_version) ' +
          `values ($1::uuid, $2::integer, $3::jsonb, $4::jsonb, $5) returning ${TURN_COLS}`,
        [sessionId, turnIndex, json(input.state), json(input.pkg), input.packVersion],
      );
      return toTurn(one(rows));
    } catch (err) {
      const code = sqlState(err);
      if (code === '23503') throw new SessionNotFoundError(sessionId);
      if (code === '23505' || code === 'BRD01') throw new TurnConflictError(sessionId, turnIndex);
      return invalid(err);
    }
  }

  async getTurn(sessionId: string, turnIndex: number): Promise<TurnRecord | null> {
    if (!isUuid(sessionId) || !isInt32(turnIndex)) return null;
    const { rows } = await this.sql.query<TurnRow>(
      `select ${TURN_COLS} from brodyazhnik.turns where session_id = $1::uuid and turn_index = $2::integer`,
      [sessionId, turnIndex],
    );
    return rows[0] === undefined ? null : toTurn(rows[0]);
  }

  async listTurns(sessionId: string): Promise<TurnRecord[]> {
    if (!isUuid(sessionId)) return [];
    const { rows } = await this.sql.query<TurnRow>(
      `select ${TURN_COLS} from brodyazhnik.turns where session_id = $1::uuid order by turn_index`,
      [sessionId],
    );
    return rows.map(toTurn);
  }

  async latestTurn(sessionId: string): Promise<TurnRecord | null> {
    if (!isUuid(sessionId)) return null;
    const { rows } = await this.sql.query<TurnRow>(
      `select ${TURN_COLS} from brodyazhnik.turns where session_id = $1::uuid order by turn_index desc limit 1`,
      [sessionId],
    );
    return rows[0] === undefined ? null : toTurn(rows[0]);
  }

  async appendGeneration(input: NewGeneration): Promise<GenerationRecord> {
    const { sessionId, turnIndex } = input;
    if (!isUuid(sessionId) || !isInt32(turnIndex)) throw new TurnNotFoundError(String(sessionId), turnIndex);
    checkGeneration(input);
    try {
      const { rows } = await this.sql.query<GenerationRow>(
        'insert into brodyazhnik.generations (session_id, turn_index, prose, error, model, keeper_prompt_path, ' +
          'keeper_prompt_sha256, tone_sha256, assembly_sha256) ' +
          `values ($1::uuid, $2::integer, $3, $4, $5, $6, $7, $8, $9) returning ${GENERATION_COLS}`,
        [
          sessionId,
          turnIndex,
          input.prose,
          input.error,
          input.model,
          input.keeperPromptPath,
          input.keeperPromptSha256,
          input.toneSha256,
          input.assemblySha256,
        ],
      );
      return toGeneration(one(rows));
    } catch (err) {
      if (sqlState(err) === '23503') throw new TurnNotFoundError(sessionId, turnIndex);
      return invalid(err);
    }
  }

  async listGenerations(sessionId: string, turnIndex: number): Promise<GenerationRecord[]> {
    if (!isUuid(sessionId) || !isInt32(turnIndex)) return [];
    const { rows } = await this.sql.query<GenerationRow>(
      `select ${GENERATION_COLS} from brodyazhnik.generations where session_id = $1::uuid and turn_index = $2::integer order by id`,
      [sessionId, turnIndex],
    );
    return rows.map(toGeneration);
  }

  async latestGeneration(sessionId: string, turnIndex: number): Promise<GenerationRecord | null> {
    if (!isUuid(sessionId) || !isInt32(turnIndex)) return null;
    const { rows } = await this.sql.query<GenerationRow>(
      `select ${GENERATION_COLS} from brodyazhnik.generations where session_id = $1::uuid and turn_index = $2::integer ` +
        'order by id desc limit 1',
      [sessionId, turnIndex],
    );
    return rows[0] === undefined ? null : toGeneration(rows[0]);
  }
}

function one<R>(rows: R[]): R {
  const row = rows[0];
  if (row === undefined || rows.length !== 1) throw new Error(`expected one returned row, got ${rows.length}`);
  return row;
}
