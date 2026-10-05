// Sentence release behind the gate (3.3a-K3, DEFERRED LAT1; decision R3). The Keeper's prose
// streams in; only text that passed the deterministic gate may reach the player. The release
// cuts the stream into COMPLETE sentences (units) and, for each new unit u in order, runs
// scanTurnProse(released + u): a block stops the release for good (u and every later unit are
// withheld); otherwise u is released. finish() computes the final verdict on the full text.
//
// SEGMENTATION (on the accumulated text, leading whitespace dropped; a unit is the text between
// two consecutive boundaries; the whitespace after a boundary belongs to the NEXT unit):
//  1. A run of . ! ? … (U+2026; "..." is a run of dots), optionally followed by closing quotes /
//     brackets » ” ’ " ' ) ], is a boundary at the end of that run when the NEXT character is
//     whitespace (\s or a line terminator). A run at the current end of the buffer waits for the
//     next delta (at finish() the end of text is a boundary anyway). `«Стой!» Он` splits after »;
//     `«Стой!», — сказал`, `3.5`, `т.е.` (no following space) do not.
//  2. A line terminator (\n \r \v \f U+0085 U+2028 U+2029) ends the current unit if the unit
//     holds any non-whitespace (the boundary sits before the terminator).
//  3. A dialogue line -- first non-whitespace character a dialogue dash — – - (the set SA1 treats
//     as dialogue lines) -- is ONE unit: no rule-1 boundaries inside; it ends at its line
//     terminator (rule 2) or at the end of text.
//  4. finish(): the remaining text, trailing whitespace dropped, is the final unit. With nothing
//     withheld, released === fullProse (= all pushed text, trimmed) exactly.
// Every decision depends on the text only (a run at the buffer end waits), never on how the
// stream was chunked: the units are the same for every split of the same text.
//
// MONOTONICITY: releasing a prefix is safe only if a block found in a prefix that ends at a
// release boundary is still found in the full text (otherwise the release could stop on text the
// final verdict clears -- harmless -- or, worse, the reasoning "the prefix is clean" would be
// unsound for some future rule). LIST_MONOTONE records that property per list; the release
// refuses to start unless every list is marked monotone (assertBlockListsMonotone), so a future
// non-monotone rule must be decided explicitly before it can reach the stream.

import type { ListId, StopEntry, Violation } from './antislop.js';
import type { NarrativePackage } from '@brodyazhnik/orchestrator';
import { scanTurnProse } from './grounding.js';

/**
 * Per list: `true` = a block this list finds in a prefix ending at a release boundary is still
 * found in every extension of that prefix. A total record over ListId, so a new list cannot
 * compile without a decision here. Boundaries are always followed (in the full text) by
 * whitespace, a line terminator or the end of text, so no word or token straddles one.
 */
export const LIST_MONOTONE: Readonly<Record<ListId, boolean>> = {
  calque: true, // term list: a local match whose word boundaries are fixed at a unit boundary
  slop_ru: true, // term list: same
  slop_en: true, // term list: same
  register_parasite: true, // term list (warn-only): same
  vk_addendum: true, // term list: same
  mixed_script: true, // per-token check; a token never straddles a unit boundary
  nf1_name: true, // sentence-initial status walks backward only; grounding depends on the package only
  nf1_backstory: true, // warn-only, local lexicon match
  sa1_plural: true, // the authorial pronoun count of a prefix never exceeds the full text's (guillemet depth left to right, dialogue lines at their line start)
};

/** Throws when any list in `table` is not marked monotone (the release must refuse). */
export function assertBlockListsMonotone(table: Readonly<Record<ListId, boolean>>): void {
  const bad = Object.entries(table)
    .filter(([, monotone]) => !monotone)
    .map(([list]) => list);
  if (bad.length > 0) {
    throw new Error(`sentence release refused: list(s) not marked monotone: ${bad.join(', ')}`);
  }
}

export interface ReleaseResult {
  /** scanTurnProse(fullProse, vk, pkg); fullProse = all pushed text, trimmed. */
  readonly verdict: readonly Violation[];
  /** Concatenation of every released unit -- always a prefix of fullProse. */
  readonly released: string;
  /** Offset in fullProse where the first withheld unit starts; null when everything was released. */
  readonly stoppedAt: number | null;
}

export interface SentenceRelease {
  /** The units newly released by this delta, in order. */
  push(delta: string): readonly string[];
  /** End of stream: the tail becomes the last unit, then the final verdict. */
  finish(): ReleaseResult;
}

const SENTENCE_PUNCT = new Set(['.', '!', '?', '…']);
const CLOSERS = new Set(['»', '”', '’', '"', "'", ')', ']']);
const LINE_TERMINATORS = new Set(['\n', '\r', '\v', '\f', '\u0085', ' ', ' ']);
const DIALOGUE_DASHES = new Set(['—', '–', '-']);
const LINE_LEADING_SPACE = /^[\t\p{Zs}]$/u; // the horizontal space SA1 skips before a dialogue dash
const isSpace = (ch: string): boolean => /\s/u.test(ch) || LINE_TERMINATORS.has(ch);

/** Incremental segmenter over the leading-trimmed text (rules 1-3); finish() applies rule 4. */
class Segmenter {
  private text = ''; // accumulated text from the first non-whitespace character on
  private started = false;
  private pos = 0; // scan cursor
  private unitStart = 0;
  private unitHasContent = false;
  private lineFirstSeen = false; // the current line's first non-whitespace character was seen
  private inDialogue = false;

  push(delta: string): string[] {
    if (!this.started) {
      const k = delta.search(/\S/u);
      if (k < 0) return [];
      this.started = true;
      delta = delta.slice(k);
    }
    this.text += delta;
    return this.scan();
  }

  finish(): string[] {
    const tail = this.text.slice(this.unitStart).trimEnd();
    this.unitStart = this.pos = this.text.length;
    return tail.length > 0 ? [tail] : [];
  }

  private cut(at: number, out: string[]): void {
    out.push(this.text.slice(this.unitStart, at));
    this.unitStart = at;
    this.unitHasContent = false;
  }

  private scan(): string[] {
    const out: string[] = [];
    const t = this.text;
    let i = this.pos;
    while (i < t.length) {
      const ch = t[i] as string;
      if (LINE_TERMINATORS.has(ch)) {
        if (this.unitHasContent) this.cut(i, out); // rule 2
        this.lineFirstSeen = false;
        this.inDialogue = false;
        i++;
        continue;
      }
      if (!this.lineFirstSeen) {
        if (LINE_LEADING_SPACE.test(ch)) {
          i++;
          continue;
        }
        this.lineFirstSeen = true;
        this.inDialogue = DIALOGUE_DASHES.has(ch); // rule 3
      }
      if (!isSpace(ch)) this.unitHasContent = true;
      if (this.inDialogue || !SENTENCE_PUNCT.has(ch)) {
        i++;
        continue;
      }
      // rule 1: the run of sentence punctuation, then closing quotes / brackets.
      let j = i;
      while (j < t.length && SENTENCE_PUNCT.has(t[j] as string)) j++;
      while (j < t.length && CLOSERS.has(t[j] as string)) j++;
      if (j === t.length) break; // the next delta decides (finish(): end of text is a boundary)
      if (isSpace(t[j] as string)) this.cut(j, out);
      i = j;
    }
    this.pos = i;
    return out;
  }
}

/** The units of a complete text (rules 1-4) -- exactly what a release that is never stopped
 *  emits for it, however the text is chunked. Used to inspect the boundaries (tests, corpus). */
export function splitSentences(text: string): string[] {
  const seg = new Segmenter();
  return [...seg.push(text), ...seg.finish()];
}

/**
 * The gated sentence release over one streamed Keeper reply (see the module header). `vk` and
 * `pkg` are what the final gate uses (scanTurnProse(prose, vk, pkg)). Refuses (throws) when a
 * list is not marked monotone in LIST_MONOTONE.
 */
export function createSentenceRelease(vk: readonly StopEntry[] | null, pkg: NarrativePackage | null): SentenceRelease {
  assertBlockListsMonotone(LIST_MONOTONE);
  const seg = new Segmenter();
  let pushed = '';
  let released = '';
  let stoppedAt: number | null = null;
  let finished = false;

  const gate = (units: readonly string[]): string[] => {
    const out: string[] = [];
    for (const u of units) {
      if (stoppedAt !== null) continue;
      if (scanTurnProse(released + u, vk, pkg).some((v) => v.severity === 'block')) {
        stoppedAt = released.length;
        continue;
      }
      released += u;
      out.push(u);
    }
    return out;
  };

  return {
    push(delta: string): readonly string[] {
      if (finished) throw new Error('sentence release: push() after finish()');
      pushed += delta;
      return gate(seg.push(delta));
    },
    finish(): ReleaseResult {
      if (finished) throw new Error('sentence release: finish() called twice');
      finished = true;
      gate(seg.finish());
      return { verdict: scanTurnProse(pushed.trim(), vk, pkg), released, stoppedAt };
    },
  };
}
