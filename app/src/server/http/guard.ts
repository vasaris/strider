// Request guards for the API (3.1-C7, C7-3 + C7-2). The app is a localhost-only prototype until
// AUTH1 (3.4.b); route handlers get no Server Action origin check from Next, so we do our own.
//
// Host (every API route, GET included): hostname 127.0.0.1, localhost or [::1], any port --
//   else 403 forbidden_host. This is the DNS-rebinding defence: a rebound attacker name reaches
//   our socket with ITS name in Host.
// Mutating routes (POST), in this order:
//   Origin: if PRESENT it must be http(s)://<allowed host>[:port] and equal the request's Host
//     (same origin) -- else 403 forbidden_origin ('null' included). If ABSENT the request is
//     allowed: non-browser clients (curl, tests) send none, browsers always send Origin on POST,
//     and a cross-site browser request cannot carry application/json without a CORS preflight,
//     which we never approve (no OPTIONS handler, no CORS headers).
//   Content-Type: application/json (parameters such as charset allowed) -- else 415.
//   Body: Content-Length over the cap -> 413 before reading; the stream is read with a byte cap
//     (a chunked body without Content-Length) -> 413; invalid UTF-8 / JSON, or JSON that is not
//     an object -> 400. The cap is 4 KiB: the only client inputs are a region, a turn index and
//     path ids (C7-2) -- the server never accepts state, packages or provenance from a client.
import 'server-only';

import { ApiError } from './errors';

export const BODY_LIMIT_BYTES = 4096;

const HOST_RE = /^(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?$/i;
const ORIGIN_RE = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?$/i;
const JSON_TYPE_RE = /^application\/json\s*(;|$)/i;

/** 403 forbidden_host unless Host names the loopback interface. Returns the Host value. */
export function checkHost(req: Request): string {
  const host = req.headers.get('host');
  if (host === null || !HOST_RE.test(host)) throw new ApiError('forbidden_host');
  return host;
}

/** Host, then Origin, then Content-Type (see the header). */
export function checkMutation(req: Request): void {
  const host = checkHost(req);
  const origin = req.headers.get('origin');
  if (origin !== null) {
    if (!ORIGIN_RE.test(origin)) throw new ApiError('forbidden_origin');
    const originHost = origin.replace(/^https?:\/\//i, '');
    if (originHost.toLowerCase() !== host.toLowerCase()) throw new ApiError('forbidden_origin');
  }
  if (!JSON_TYPE_RE.test(req.headers.get('content-type') ?? '')) throw new ApiError('unsupported_media_type');
}

/** The body bytes, at most `limit` (413 beyond it); an absent body is empty. */
async function readCapped(req: Request, limit: number): Promise<Uint8Array> {
  const declared = req.headers.get('content-length');
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared.trim()) > limit) {
    throw new ApiError('payload_too_large');
  }
  if (req.body === null) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new ApiError('payload_too_large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/**
 * The JSON object body (after checkMutation). `allowEmpty`: an absent/empty body reads as {}.
 * @throws ApiError payload_too_large | invalid_request
 */
export async function readJsonObject(
  req: Request,
  opts: { readonly allowEmpty?: boolean; readonly limit?: number } = {},
): Promise<Record<string, unknown>> {
  const bytes = await readCapped(req, opts.limit ?? BODY_LIMIT_BYTES);
  if (bytes.byteLength === 0 && opts.allowEmpty === true) return {};
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new ApiError('invalid_request');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('invalid_request');
  return value as Record<string, unknown>;
}

/** True when obj has exactly the given keys (no extra client fields are accepted). */
export function hasExactKeys(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(obj);
  return own.length === keys.length && keys.every((k) => Object.hasOwn(obj, k));
}
