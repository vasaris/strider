// Browser fetch helpers (K5): relative /api URLs only (same host as the page), JSON in and out.
// A failed call resolves to a fixed error code -- the server's code when the body names a known
// one, else 'bad_response' / 'network'; server messages are never shown (the UI maps codes).
import { API_ERROR_CODES, type ApiErrorCode } from '../shared/api';
import type { ClientErrorCode } from './model';

export type ApiResult<T> =
  | { readonly ok: true; readonly status: number; readonly data: T }
  | { readonly ok: false; readonly status: number; readonly code: ClientErrorCode };

const isCode = (v: unknown): v is ApiErrorCode => typeof v === 'string' && (API_ERROR_CODES as readonly string[]).includes(v);

/** The error code of a non-2xx JSON body, else 'bad_response'. */
export function errorCodeOf(body: unknown): ClientErrorCode {
  const err = typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : undefined;
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  return isCode(code) ? code : 'bad_response';
}

async function call<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, cache: 'no-store', headers: { Accept: 'application/json', ...init.headers } });
  } catch {
    return { ok: false, status: 0, code: 'network' };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, status: res.status, code: 'bad_response' };
  }
  return res.ok ? { ok: true, status: res.status, data: body as T } : { ok: false, status: res.status, code: errorCodeOf(body) };
}

export const apiGet = <T>(path: string): Promise<ApiResult<T>> => call<T>(path, { method: 'GET' });

export const apiPost = <T>(path: string, body: Readonly<Record<string, unknown>>): Promise<ApiResult<T>> =>
  call<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
