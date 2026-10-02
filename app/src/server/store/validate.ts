// Input rules shared by both SessionStores, checked before any write, where the database alone
// would diverge from the memory store:
// - a text field holds a string (pg would serialize a number or an object into text and accept
//   it); null / undefined are left to the not-null and XOR rules both stores enforce, except
//   prose and error: each is a string or null, never undefined (pg would write undefined as
//   NULL and satisfy the XOR with the other field);
// - no lone UTF-16 surrogate in a text field, nor in any string or object key of a json field:
//   pg encodes text as UTF-8 and silently turns one into U+FFFD, and jsonb rejects the \udXXX
//   escape (22P02).
import 'server-only';

import { InvalidRecordError, type NewGeneration, type NewSession, type NewTurn } from './types';

// A high surrogate not followed by a low one, or a low surrogate not preceded by a high one.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function wellFormed(field: string, s: string): void {
  if (LONE_SURROGATE.test(s)) throw new InvalidRecordError(`${field} contains a lone surrogate`);
}

export function checkText(field: string, v: unknown): void {
  if (v === null || v === undefined) return;
  if (typeof v !== 'string') throw new InvalidRecordError(`${field} must be a string`);
  wellFormed(field, v);
}

/** Every string and object key of v as JSON.stringify serializes it (what jsonb receives). */
export function checkJson(field: string, v: unknown): void {
  const json = v === undefined ? undefined : JSON.stringify(v);
  if (json === undefined) return;
  const walk = (x: unknown): void => {
    if (typeof x === 'string') wellFormed(field, x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x !== null && typeof x === 'object') {
      for (const [k, val] of Object.entries(x)) {
        wellFormed(`${field} key`, k);
        walk(val);
      }
    }
  };
  walk(JSON.parse(json));
}

export function checkSession(input: NewSession): void {
  for (const f of ['rngSeed', 'heroRef', 'packId', 'packVersion'] as const) checkText(f, input[f]);
  checkJson('initialState', input.initialState);
}

export function checkTurn(input: NewTurn): void {
  checkJson('state', input.state);
  checkJson('pkg', input.pkg);
  checkText('packVersion', input.packVersion);
}

export function checkGeneration(input: NewGeneration): void {
  for (const f of ['prose', 'error'] as const) {
    if (input[f] === undefined) throw new InvalidRecordError(`${f} must be a string or null`);
  }
  for (const f of ['prose', 'error', 'model', 'keeperPromptPath', 'keeperPromptSha256', 'toneSha256', 'assemblySha256'] as const) {
    checkText(f, input[f]);
  }
}
