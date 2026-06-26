// LT1 deterministic gate scaffold (evals).
//
// ENABLER — built FIRST in chat 2.2: the lore anti-slop scan consumes the VK addendum
// (= the pack tone stop-list, tone.stoplist.json). The lore gate does not work without
// it, so the stop-list loader + the gate land before tone.md / lore drafts.
//
// What this gates (the deterministic slice of the LT1 verified gate; arch sec 2.5):
//  - lore chunk text: anti-slop (seed calques/cliches + VK addendum) must be block-clean;
//    length within the per-chunk budget.
//  - tone.md dogfood: the culture-voice example lines declared IN tone.md must pass the
//    same stop-list tone.md itself defines (the canon passes its own gate).
//
// NOT here (process/human gates): tone.md register/voice human review, lore fidelity vs
// the licensed TOR 2e books (Ivan), legal originality check. Those are recorded reviews.
//
// Cyrillic is allowed in this file (evals/ is outside engine/); identifiers stay English.

import { scanProse, type StopEntry, type Violation } from './antislop.js';

// ---- tone stop-list -> VK addendum loader ----

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

// ---- length budget via a deterministic char proxy ----
//
// Ivan's rule: do NOT store a token_estimate in the data (drifts by tokenizer =
// unverifiable "number in data"). The chunk stores only its text; the budget is a GATE
// concern computed from the text. Tokens are approximated from char length with a
// documented, tunable proxy ratio. The CHAR COUNT is the deterministic input; the token
// figure is an estimate calibrated against a real tokenizer in chat 2.3.

/** arch sec 3: RAG lore chunks are 300-600 tokens. */
export const TOKEN_MIN = 300;
export const TOKEN_MAX = 600;
/** PROVISIONAL: calibrate in 2.3 vs the NARRATIVE MODEL's tokenizer (Anthropic/Claude) --
 *  the chunk goes into ITS RAG context, so a generic tokenizer is the wrong yardstick.
 *  Chars-per-token proxy for Russian prose: Cyrillic tokenizes denser than Latin, so 3 is
 *  conservative (4 would let oversize chunks slip through). Until calibrated, the budget
 *  is a WARN, not a block. */
export const CHARS_PER_TOKEN = 3;

export interface BudgetVerdict {
  readonly chars: number;
  readonly tokensEstimated: number;
  readonly withinBudget: boolean;
}

export function estimateTokens(text: string): number {
  return Math.round(text.length / CHARS_PER_TOKEN);
}

export function checkBudget(text: string): BudgetVerdict {
  const chars = text.length;
  const tokensEstimated = estimateTokens(text);
  return { chars, tokensEstimated, withinBudget: tokensEstimated >= TOKEN_MIN && tokensEstimated <= TOKEN_MAX };
}

// ---- lore chunk gate ----

export interface LoreGateVerdict {
  readonly antiSlop: readonly Violation[];
  readonly blocking: boolean; // any block-severity anti-slop violation -> HARD gate
  readonly budget: BudgetVerdict;
  readonly budgetWarn: boolean; // out of budget -> WARN only (proxy provisional; 2.3)
  readonly pass: boolean; // HARD pass = anti-slop block-clean. Budget does NOT block.
}

/** Run the deterministic lore-chunk gate over its text. `vkAddendum` is the loaded
 *  pack tone stop-list (the dependency that makes this the enabler).
 *
 *  Budget is a WARN, not a block, until CHARS_PER_TOKEN is calibrated against a real
 *  tokenizer (2.3): blocking on a knowingly-imprecise proxy would risk rejecting good
 *  prose. The anti-slop block-clean check stays the hard gate -- it does not depend on
 *  the proxy. */
export function gateLoreChunkText(text: string, vkAddendum: readonly StopEntry[]): LoreGateVerdict {
  const antiSlop = scanProse(text, vkAddendum);
  const blocking = antiSlop.some((v) => v.severity === 'block');
  const budget = checkBudget(text);
  return { antiSlop, blocking, budget, budgetWarn: !budget.withinBudget, pass: !blocking };
}

// ---- tone.md dogfood ----

export interface ToneExampleVerdict {
  readonly line: string;
  readonly violations: readonly Violation[];
  readonly clean: boolean;
}

/** Dogfood: every culture-voice example line declared in tone.md must itself pass the
 *  stop-list tone.md defines. A canon that violates its own stop-list is a bug. */
export function gateToneExamples(
  lines: readonly string[],
  vkAddendum: readonly StopEntry[],
): readonly ToneExampleVerdict[] {
  return lines.map((line) => {
    const violations = scanProse(line, vkAddendum);
    return { line, violations, clean: violations.length === 0 };
  });
}
