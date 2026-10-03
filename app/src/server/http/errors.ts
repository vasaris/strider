// API errors (3.1-C7, C7-1): ONE table code -> { status, message }. The public message is FIXED
// per code; an internal error's .message never reaches a response (store errors echo inputs,
// InvalidRecordError carries raw Postgres text, a pool error may name the host). Every API
// response is JSON with Cache-Control: no-store.
//   body: { error: { code, message } } plus the documented extras of a code:
//     turn_conflict -> nextTurnIndex; keeper_failed -> turnIndex, nextTurnIndex, journeyComplete,
//     pkg (regeneration: turnIndex only).
import 'server-only';

export const API_ERRORS = {
  invalid_request: { status: 400, message: 'The request is malformed.' },
  forbidden_host: { status: 403, message: 'This host is not allowed.' },
  forbidden_origin: { status: 403, message: 'This origin is not allowed.' },
  not_found: { status: 404, message: 'Not found.' },
  session_not_found: { status: 404, message: 'Session not found.' },
  turn_not_found: { status: 404, message: 'Turn not found.' },
  pack_mismatch: { status: 409, message: 'The session was started on a different content pack version.' },
  journey_complete: { status: 409, message: 'The journey is complete; there is no next turn.' },
  turn_conflict: { status: 409, message: 'The turn index is not the next turn of this session.' },
  payload_too_large: { status: 413, message: 'The request body is too large.' },
  unsupported_media_type: { status: 415, message: 'The request body must be application/json.' },
  unsupported_route: { status: 422, message: 'Routes with danger zones are not supported yet.' },
  internal_error: { status: 500, message: 'Internal error.' },
  keeper_failed: { status: 502, message: 'The Keeper failed; the turn is saved without prose.' },
  keeper_not_configured: { status: 503, message: 'The Keeper is not configured.' },
  database_not_configured: { status: 503, message: 'The database is not configured.' },
  database_unavailable: { status: 503, message: 'The database is unavailable.' },
  database_misconfigured: { status: 503, message: 'The database is misconfigured (role or schema; run db:migrate).' },
} as const satisfies Record<string, { readonly status: number; readonly message: string }>;

export type ApiErrorCode = keyof typeof API_ERRORS;

/** A response-ready error: a code from the table plus documented extra fields. */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly extras: Readonly<Record<string, unknown>> = {},
  ) {
    super(code);
    this.name = 'ApiError';
  }

  get status(): number {
    return API_ERRORS[this.code].status;
  }
}

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function jsonResponse(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function errorResponse(err: ApiError): Response {
  const { status, message } = API_ERRORS[err.code];
  return jsonResponse(status, { error: { code: err.code, message }, ...err.extras });
}
