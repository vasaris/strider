// API handlers (3.1-C7): guard -> parse/validate -> service -> JSON. Route files call these with
// productionDeps(); tests call them with their own deps. Every response is JSON + no-store.
// Errors: an ApiError renders its fixed message; a known store / orchestrator / database error is
// mapped by type or code; anything else is 500 internal_error. Logs carry the code (and the
// error's class name or driver code) -- never the error object, its message, or env values.
//
// Client inputs (C7-2), the only ones accepted:
//   path id    a uuid (anything else: 404 session_not_found)
//   path n     a canonical int32 >= 0 (anything else: 400 invalid_request)
//   bodies     POST /api/sessions {region}; POST .../turns {turnIndex: int32 >= 0}; POST
//              .../prose empty or {} -- exactly these keys, else 400 invalid_request.
import 'server-only';

import { JourneyOverError, UnsupportedRouteError } from '@brodyazhnik/orchestrator';

import { dbErrorCode, logDbError } from '../db/ready';
import { SessionService } from '../service/sessions';
import type { ServiceDeps } from '../service/ports';
import {
  InvalidRecordError,
  isInt32,
  isUuid,
  SessionNotFoundError,
  TurnConflictError,
  TurnNotFoundError,
} from '../store/types';
import { ApiError, errorResponse, jsonResponse } from './errors';
import { checkHost, checkMutation, hasExactKeys, readJsonObject } from './guard';

const INDEX_RE = /^(0|[1-9]\d{0,9})$/;

const isTurnIndex = (v: unknown): v is number => isInt32(v) && (v as number) >= 0;

function sessionId(id: string): string {
  if (!isUuid(id)) throw new ApiError('session_not_found');
  return id;
}

function pathIndex(n: string): number {
  const v = INDEX_RE.test(n) ? Number(n) : NaN;
  if (!isTurnIndex(v)) throw new ApiError('invalid_request');
  return v;
}

/** Any thrown value -> the ApiError the client sees (logged for 5xx; see the header). */
export function toApiError(err: unknown, where: string): ApiError {
  if (err instanceof ApiError) {
    if (err.status >= 500 && err.code !== 'keeper_failed') console.error(`${where}: ${err.code}`);
    return err;
  }
  const db = dbErrorCode(err);
  if (db !== null) {
    logDbError(where, db, err);
    return new ApiError(db);
  }
  if (err instanceof SessionNotFoundError) return new ApiError('session_not_found');
  if (err instanceof TurnNotFoundError) return new ApiError('turn_not_found');
  if (err instanceof TurnConflictError) return new ApiError('turn_conflict');
  if (err instanceof UnsupportedRouteError) return new ApiError('unsupported_route');
  if (err instanceof JourneyOverError) return new ApiError('journey_complete');
  // InvalidRecordError: our own data broke a schema rule -- an internal error, never echoed.
  const kind = err instanceof InvalidRecordError ? 'invalid_record' : err instanceof Error ? err.name : typeof err;
  console.error(`${where}: internal_error (${kind})`);
  return new ApiError('internal_error');
}

async function respond(where: string, run: () => Promise<{ status: number; body: unknown }>): Promise<Response> {
  try {
    const { status, body } = await run();
    return jsonResponse(status, body);
  } catch (err) {
    return errorResponse(toApiError(err, where));
  }
}

/** POST /api/sessions {region} -> 201 { session, nextTurnIndex: 0, journeyComplete: false } */
export function handleCreateSession(req: Request, deps: ServiceDeps): Promise<Response> {
  return respond('POST /api/sessions', async () => {
    checkMutation(req);
    const body = await readJsonObject(req);
    if (!hasExactKeys(body, ['region'])) throw new ApiError('invalid_request');
    return { status: 201, body: await new SessionService(deps).createSession(body['region']) };
  });
}

/** GET /api/sessions -> 200 { sessions: [{ session, nextTurnIndex, journeyComplete }] } (20 most recent) */
export function handleListSessions(req: Request, deps: ServiceDeps): Promise<Response> {
  return respond('GET /api/sessions', async () => {
    checkHost(req);
    return { status: 200, body: await new SessionService(deps).listSessions() };
  });
}

/** GET /api/sessions/:id -> 200 { session, turns, labels, nextTurnIndex, journeyComplete, packCurrent } */
export function handleGetSession(req: Request, id: string, deps: ServiceDeps): Promise<Response> {
  return respond('GET /api/sessions/:id', async () => {
    checkHost(req);
    return { status: 200, body: await new SessionService(deps).getSession(sessionId(id)) };
  });
}

/** POST /api/sessions/:id/turns {turnIndex} -> 201 { turnIndex, pkg, labels, prose, proseState, gate, generationId,
 *  nextTurnIndex, journeyComplete } */
export function handlePlayTurn(req: Request, id: string, deps: ServiceDeps): Promise<Response> {
  return respond('POST /api/sessions/:id/turns', async () => {
    checkMutation(req);
    const body = await readJsonObject(req);
    const turnIndex = body['turnIndex'];
    if (!hasExactKeys(body, ['turnIndex']) || !isTurnIndex(turnIndex)) throw new ApiError('invalid_request');
    return { status: 201, body: await new SessionService(deps).playTurn(sessionId(id), turnIndex) };
  });
}

/** POST /api/sessions/:id/turns/:n/prose -> 201 { turnIndex, prose, proseState, gate, generationId } */
export function handleRegenerate(req: Request, id: string, n: string, deps: ServiceDeps): Promise<Response> {
  return respond('POST /api/sessions/:id/turns/:n/prose', async () => {
    checkMutation(req);
    const body = await readJsonObject(req, { allowEmpty: true });
    if (!hasExactKeys(body, [])) throw new ApiError('invalid_request');
    const turnIndex = pathIndex(n);
    return { status: 201, body: await new SessionService(deps).regenerateProse(sessionId(id), turnIndex) };
  });
}
