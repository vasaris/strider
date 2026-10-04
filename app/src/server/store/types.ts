// SessionStore: the persistence port for journeys (3.1-C6). Append-only (P12): there are no
// update or delete methods; rolling history back comes later as a head pointer / branch.
// Records are JSON-friendly: ids are strings, createdAt is an ISO-8601 UTC string. Both
// implementations (memory, postgres) enforce the same rules and raise the same typed errors;
// one contract suite (test/store/contract.ts) runs against both.
import 'server-only';

import type { JourneyState } from '@brodyazhnik/engine';
import type { NarrativePackage } from '@brodyazhnik/orchestrator';

export interface NewSession {
  readonly rngSeed: string; // P10: 1..128 characters
  readonly heroRef: string; // 1..128 characters
  readonly packId: string;
  readonly packVersion: string;
  readonly initialState: JourneyState;
}
export interface SessionRecord extends NewSession {
  readonly id: string;
  readonly createdAt: string;
}

/** Turn n stores the FULL state after turn n; the state before it is turn n-1's (or initialState). */
export interface NewTurn {
  readonly sessionId: string;
  readonly turnIndex: number; // 0-based, contiguous per session
  readonly state: JourneyState;
  readonly pkg: NarrativePackage; // immutable: the source of every (re)generation of this turn
  readonly packVersion: string;
}
export interface TurnRecord extends NewTurn {
  readonly createdAt: string;
}

export interface KeeperProvenance {
  readonly model: string;
  readonly keeperPromptPath: string;
  readonly keeperPromptSha256: string; // 64 lowercase hex
  readonly toneSha256: string;
  readonly assemblySha256: string;
}
export type GenerationOutcome = { readonly prose: string; readonly error: null } | { readonly prose: null; readonly error: string };
export type NewGeneration = { readonly sessionId: string; readonly turnIndex: number } & KeeperProvenance & GenerationOutcome;
export type GenerationRecord = { readonly id: string; readonly createdAt: string } & NewGeneration;

/** A session with its latest turn (null: no turn yet), for the session list. */
export interface RecentSession {
  readonly session: SessionRecord;
  readonly latestTurn: TurnRecord | null;
}

export interface SessionStore {
  createSession(input: NewSession): Promise<SessionRecord>;
  /** null when absent (including an id that is not a uuid). */
  getSession(id: string): Promise<SessionRecord | null>;
  /** The `limit` most recent sessions (createdAt desc, then id desc), each with its latest turn.
   *  @throws InvalidRecordError for a limit that is not an int32 >= 0 */
  listRecentSessions(limit: number): Promise<RecentSession[]>;
  /** @throws SessionNotFoundError, TurnConflictError (not the next contiguous index), InvalidRecordError */
  appendTurn(input: NewTurn): Promise<TurnRecord>;
  getTurn(sessionId: string, turnIndex: number): Promise<TurnRecord | null>;
  /** Ordered by turnIndex; [] for an unknown session. */
  listTurns(sessionId: string): Promise<TurnRecord[]>;
  latestTurn(sessionId: string): Promise<TurnRecord | null>;
  /** @throws TurnNotFoundError, InvalidRecordError */
  appendGeneration(input: NewGeneration): Promise<GenerationRecord>;
  /** Ordered by creation (id). */
  listGenerations(sessionId: string, turnIndex: number): Promise<GenerationRecord[]>;
  latestGeneration(sessionId: string, turnIndex: number): Promise<GenerationRecord | null>;
}

export class SessionNotFoundError extends Error {
  readonly code = 'session_not_found' as const;
  constructor(sessionId: string) {
    super(`session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

export class TurnNotFoundError extends Error {
  readonly code = 'turn_not_found' as const;
  constructor(sessionId: string, turnIndex: number) {
    super(`turn not found: ${sessionId}#${turnIndex}`);
    this.name = 'TurnNotFoundError';
  }
}

/** The turn index is not the next contiguous one (a duplicate, a gap, a negative index). */
export class TurnConflictError extends Error {
  readonly code = 'turn_conflict' as const;
  constructor(sessionId: string, turnIndex: number) {
    super(`turn ${turnIndex} is not the next turn of session ${sessionId}`);
    this.name = 'TurnConflictError';
  }
}

/** A record that violates a schema rule (P10 bounds, prose XOR error, sha format, empty text, non-object json). */
export class InvalidRecordError extends Error {
  readonly code = 'invalid_record' as const;
  constructor(detail: string) {
    super(`invalid record: ${detail}`);
    this.name = 'InvalidRecordError';
  }
}

// Shapes Postgres cannot take as parameters without a cast error; both stores check them up front
// so that an opaque id from a URL reads as "absent" rather than as a driver error.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s);
export const isInt32 = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= -2147483648 && (n as number) <= 2147483647;
