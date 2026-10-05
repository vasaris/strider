// SA1 (DEFERRED SA1, DUE 3.2.c; decision R2): a deterministic check that the Keeper narrates in
// the second person SINGULAR. Source: content-packs/kv/tone.md section 1 ("ты" address to the
// hero). Evidence: live runs where the Keeper addressed the solo hero in the plural ("вы") or
// invented a companion (evals/records, keeper v0.3 opus j.wild.mishap).
//
// RULE:
//  - AUTHORIAL TEXT = the prose minus (1) everything inside «…» guillemets, nested and multiline
//    (a depth counter: the outermost « opens, its matching » closes; a stray » is ignored; an
//    unclosed « hides the rest of the prose -- a miss, never a false block), minus (2) every LINE
//    whose first non-whitespace character is a dialogue dash — – or - . Stripped characters are
//    replaced by spaces, so offsets stay those of the original prose and no two words glue.
//  - PRONOUNS: вы | вас | вам | вами | ваш* (case-insensitive), with no word character
//    immediately before, and none after except the ваш* ending. A word character is a letter or
//    a combining mark ([\p{L}\p{M}], the token convention of NF1's grounding.ts -- SA2, 3.3a-K3):
//    'выход', 'вывод', 'вязь', 'увы' never match, nor do the same words written with a
//    combining acute (U+0301) right after 'вы' ('выход') or right before it ('увы');
//    'Вас', 'вашего', 'ваша' do.
//  - COUNT in the authorial text: >= 2 -> one BLOCK finding; exactly 1 -> one WARN finding (list
//    'sa1_plural'; term = the first pronoun, index = its offset, the reason carries the count).
//  - SCOPE: runs only inside scanTurnProse with a package (pkg !== null), exactly like NF1. The
//    no-package calibration path and the LT1 lore gate never apply it.
//
// LIMITS (documented on purpose):
//  (a) Authorial text embedded inside a dialogue line ("— Стой, — говорит он вам.") is not
//      seen: the whole dash line is stripped -- a MISS.
//  (b) With NPC companions (Stage 4) "вы с …" / "между вами" can be legitimate plural address;
//      the rule must be revisited then (today it already warns on "Между вами" in the corpus).
//  (c) Dialogue in straight or other quotes ("…", „…“) is not stripped -- only «…» and dash
//      lines are dialogue markers here, matching Russian typesetting in the Keeper's prose.
//  (d) A stress mark INSIDE a pronoun (a combining acute after the 'ы' of 'вы' or the 'а' of
//      'вас') breaks the token -- a MISS (the Keeper does not mark stress; the decomposed form
//      is not normalized away here).

import type { Violation } from './antislop.js';

const LINE_TERMINATORS = new Set(['\n', '\r', '\v', '\f', '\u0085', ' ', ' ']);
const DIALOGUE_DASHES = new Set(['—', '–', '-']);
const LEADING_SPACE = /^[\t\p{Zs}]$/u;
const PLURAL_ADDRESS = /(?<![\p{L}\p{M}])(?:вы|вас|вам|вами|ваш[\p{L}\p{M}]*)(?![\p{L}\p{M}])/giu;

/**
 * The authorial text of `prose`, same UTF-16 length (offsets carry over): «…» spans (nested,
 * multiline) and dialogue lines (first non-whitespace char — – -) are blanked to spaces; line
 * terminators are kept.
 */
export function authorialText(prose: string): string {
  const orig = [...prose];
  const keep = orig.map(() => true);
  // (1) guillemets, depth-counted.
  let depth = 0;
  orig.forEach((ch, i) => {
    if (ch === '«') {
      depth++;
      keep[i] = false;
    } else if (ch === '»') {
      if (depth > 0) depth--;
      keep[i] = false;
    } else if (depth > 0 && !LINE_TERMINATORS.has(ch)) {
      keep[i] = false;
    }
  });
  // (2) dialogue lines, judged on the ORIGINAL line start.
  let lineStart = 0;
  for (let i = 0; i <= orig.length; i++) {
    if (i < orig.length && !LINE_TERMINATORS.has(orig[i] as string)) continue;
    let k = lineStart;
    while (k < i && LEADING_SPACE.test(orig[k] as string)) k++;
    if (k < i && DIALOGUE_DASHES.has(orig[k] as string)) keep.fill(false, lineStart, i);
    lineStart = i + 1;
  }
  return orig.map((ch, i) => (keep[i] ? ch : ' '.repeat(ch.length))).join('');
}

/** SA1: plural-address pronouns in the authorial text -> [] (none), one WARN (1) or one BLOCK (>= 2). */
export function scanPluralAddress(prose: string): Violation[] {
  const matches = [...authorialText(prose).matchAll(PLURAL_ADDRESS)];
  const first = matches[0];
  if (first === undefined) return [];
  return [
    {
      list: 'sa1_plural',
      term: first[0],
      reason: `${matches.length} plural-address pronoun(s) in authorial text (tone.md 1: second person singular)`,
      severity: matches.length >= 2 ? 'block' : 'warn',
      index: first.index,
    },
  ];
}
