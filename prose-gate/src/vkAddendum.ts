// VK addendum loader (moved from evals/src/lt1gate.ts in chat 3.2, K2).
//
// The pack tone stop-list (tone.stoplist.json) is the VK addendum folded into scanProse.
// It lives here, next to the scanners, so the live app prose gate (DEFERRED LG1) can load it
// without depending on evals.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StopEntry } from './antislop.js';

/** Parse a loaded tone.stoplist.json document into StopEntry[] for the VK addendum.
 *  Structural validation only; throws loudly on shape error (a gate, not a guess). */
export function loadVkAddendum(doc: unknown): StopEntry[] {
  if (typeof doc !== 'object' || doc === null) throw new Error('tone stoplist: not an object');
  const o = doc as Record<string, unknown>;
  if (o['type'] !== 'tone_stoplist') throw new Error('tone stoplist: type must be "tone_stoplist"');
  const payload = o['payload'];
  if (typeof payload !== 'object' || payload === null) throw new Error('tone stoplist: missing payload');
  const entries = (payload as Record<string, unknown>)['entries'];
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('tone stoplist: payload.entries must be a non-empty array');
  return entries.map((e, i) => {
    if (typeof e !== 'object' || e === null) throw new Error(`tone stoplist: entries[${i}] not an object`);
    const eo = e as Record<string, unknown>;
    const term = eo['term'];
    const reason = eo['reason'];
    const severity = eo['severity'];
    if (typeof term !== 'string' || term.length === 0) throw new Error(`tone stoplist: entries[${i}].term`);
    if (typeof reason !== 'string' || reason.length === 0) throw new Error(`tone stoplist: entries[${i}].reason`);
    if (severity !== undefined && severity !== 'block' && severity !== 'warn') {
      throw new Error(`tone stoplist: entries[${i}].severity must be 'block' | 'warn'`);
    }
    // Preserve curated per-entry severity (e.g. избранный=warn) -- scanProse honors it.
    return severity === undefined ? { term, reason } : { term, reason, severity };
  });
}

/**
 * Load the VK addendum from the LIVE pack sidecar (`<packRoot>/tone.stoplist.json`),
 * activated in LT1. Path-based on purpose: the sidecar is NOT in manifest.content[], so
 * loadPack never indexes or gates it -- the gate reads it directly. This is the activated
 * source (the kv-pending draft is superseded once Ivan signs off and it moves to kv/).
 */
export function loadVkAddendumFromPack(packRoot: string): StopEntry[] {
  return loadVkAddendum(JSON.parse(readFileSync(join(packRoot, 'tone.stoplist.json'), 'utf8')));
}
