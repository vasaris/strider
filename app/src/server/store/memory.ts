// In-memory SessionStore: the same rules, errors and ordering as the Postgres store (validate.ts,
// then the migration's checks and triggers), so the contract suite holds for both. Everything is deep-copied through
// JSON on write and on read: a caller can never mutate stored data. Ids: random uuids for
// sessions, an increasing counter (as text) for generations, like the identity column.
import 'server-only';

import { randomUUID } from 'node:crypto';

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

const SHA_RE = /^[0-9a-f]{64}$/;

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const chars = (s: string) => [...s].length; // Postgres length(): characters, not UTF-16 units

/** text: a string, NUL-free (Postgres text cannot hold U+0000). */
function text(field: string, v: unknown, min: number, max = Infinity): string {
  if (typeof v !== 'string' || v.includes('\u0000')) throw new InvalidRecordError(`${field} must be a text value`);
  const n = chars(v);
  if (n < min || n > max) throw new InvalidRecordError(`${field} length ${n} is outside ${min}..${max}`);
  return v;
}

/** jsonb object: JSON.stringify must give an object, with no \u0000 (jsonb rejects it). */
function object(field: string, v: unknown): void {
  const json = v === undefined ? undefined : JSON.stringify(v);
  if (json === undefined || !json.startsWith('{')) throw new InvalidRecordError(`${field} must be a JSON object`);
  if (/(?:^|[^\\])(?:\\\\)*\\u0000/.test(json)) throw new InvalidRecordError(`${field} contains \\u0000`);
}

const now = () => new Date().toISOString();

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly turns = new Map<string, TurnRecord[]>();
  private readonly generations = new Map<string, GenerationRecord[]>();
  private nextGenerationId = 1;

  async createSession(input: NewSession): Promise<SessionRecord> {
    checkSession(input);
    text('rngSeed', input.rngSeed, 1, 128);
    text('heroRef', input.heroRef, 1, 128);
    text('packId', input.packId, 1);
    text('packVersion', input.packVersion, 1);
    object('initialState', input.initialState);
    const rec: SessionRecord = {
      id: randomUUID(),
      createdAt: now(),
      rngSeed: input.rngSeed,
      heroRef: input.heroRef,
      packId: input.packId,
      packVersion: input.packVersion,
      initialState: copy(input.initialState),
    };
    this.sessions.set(rec.id, rec);
    this.turns.set(rec.id, []);
    return copy(rec);
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    const rec = isUuid(id) ? this.sessions.get(id.toLowerCase()) : undefined;
    return rec === undefined ? null : copy(rec);
  }

  // Order as in the Postgres store: id shapes, shared input rules (validate.ts), then as in the
  // database: missing session, contiguity (trigger), checks.
  async appendTurn(input: NewTurn): Promise<TurnRecord> {
    const { sessionId, turnIndex } = input;
    if (!isInt32(turnIndex)) throw new InvalidRecordError('turnIndex must be a 32-bit integer');
    if (!isUuid(sessionId)) throw new SessionNotFoundError(sessionId);
    checkTurn(input);
    const list = this.turns.get(sessionId.toLowerCase());
    if (list === undefined) throw new SessionNotFoundError(sessionId);
    if (turnIndex !== list.length) throw new TurnConflictError(sessionId, turnIndex);
    object('state', input.state);
    object('pkg', input.pkg);
    text('packVersion', input.packVersion, 1);
    const rec: TurnRecord = {
      sessionId: sessionId.toLowerCase(),
      turnIndex,
      createdAt: now(),
      state: copy(input.state),
      pkg: copy(input.pkg),
      packVersion: input.packVersion,
    };
    list.push(rec);
    return copy(rec);
  }

  async getTurn(sessionId: string, turnIndex: number): Promise<TurnRecord | null> {
    const rec = this.turnList(sessionId).find((t) => t.turnIndex === turnIndex);
    return rec === undefined ? null : copy(rec);
  }

  async listTurns(sessionId: string): Promise<TurnRecord[]> {
    return copy([...this.turnList(sessionId)]);
  }

  async latestTurn(sessionId: string): Promise<TurnRecord | null> {
    const list = this.turnList(sessionId);
    const rec = list[list.length - 1];
    return rec === undefined ? null : copy(rec);
  }

  // Order as in the Postgres store: id shapes, shared input rules, then as in the database: check
  // constraints, the foreign key to the turn (an after-row check).
  async appendGeneration(input: NewGeneration): Promise<GenerationRecord> {
    const { sessionId, turnIndex } = input;
    if (!isUuid(sessionId) || !isInt32(turnIndex)) throw new TurnNotFoundError(String(sessionId), turnIndex);
    checkGeneration(input);
    const prose: unknown = input.prose;
    const error: unknown = input.error;
    if (prose !== null) text('prose', prose, 1);
    if (error !== null) text('error', error, 1);
    if ((prose === null) === (error === null)) throw new InvalidRecordError('exactly one of prose and error must be set');
    text('model', input.model, 1);
    text('keeperPromptPath', input.keeperPromptPath, 1);
    for (const f of ['keeperPromptSha256', 'toneSha256', 'assemblySha256'] as const) {
      const v: unknown = input[f];
      if (typeof v !== 'string' || !SHA_RE.test(v)) throw new InvalidRecordError(`${f} must be 64 lowercase hex characters`);
    }
    if (!this.turnList(sessionId).some((t) => t.turnIndex === turnIndex)) throw new TurnNotFoundError(sessionId, turnIndex);
    const base = {
      id: String(this.nextGenerationId++),
      createdAt: now(),
      sessionId: sessionId.toLowerCase(),
      turnIndex,
      model: input.model,
      keeperPromptPath: input.keeperPromptPath,
      keeperPromptSha256: input.keeperPromptSha256,
      toneSha256: input.toneSha256,
      assemblySha256: input.assemblySha256,
    };
    const rec: GenerationRecord =
      input.prose !== null ? { ...base, prose: input.prose, error: null } : { ...base, prose: null, error: input.error };
    const key = `${rec.sessionId}#${turnIndex}`;
    this.generations.set(key, [...(this.generations.get(key) ?? []), rec]);
    return copy(rec);
  }

  async listGenerations(sessionId: string, turnIndex: number): Promise<GenerationRecord[]> {
    return copy([...this.generationList(sessionId, turnIndex)]);
  }

  async latestGeneration(sessionId: string, turnIndex: number): Promise<GenerationRecord | null> {
    const list = this.generationList(sessionId, turnIndex);
    const rec = list[list.length - 1];
    return rec === undefined ? null : copy(rec);
  }

  private turnList(sessionId: string): readonly TurnRecord[] {
    return (isUuid(sessionId) ? this.turns.get(sessionId.toLowerCase()) : undefined) ?? [];
  }

  private generationList(sessionId: string, turnIndex: number): readonly GenerationRecord[] {
    return (isUuid(sessionId) ? this.generations.get(`${sessionId.toLowerCase()}#${turnIndex}`) : undefined) ?? [];
  }
}
