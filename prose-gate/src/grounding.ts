// NF1 (DEFERRED NF1; first eval commit of Stage 3): a deterministic, PACKAGE-AWARE grounding
// check on the Keeper prose. The Keeper may name only what the package it saw names; relative
// backstory ("вчера", "второй день") needs journal facts to stand on. Evidence: the L4 records
// (evals/l4-records/full-cycle-report.v0.{1,3}.claude-opus-4-8.json) -- the opus Keeper invented
// "Пригорье" twice with lore_chunks: [] and journal_facts: [], and the LLM judge scored accuracy
// 90/92 on both. This module is the cheap exact floor under that axis.
//
// RULE:
//  - Tokens are maximal runs of /[\p{L}\p{M}]+/u (digits, hyphens, apostrophes and punctuation
//    split tokens). A CANDIDATE name is a Titlecase token (/^\p{Lu}\p{Ll}/u): ALL-CAPS tokens
//    ('XIX', skill names like 'БДИТЕЛЬНОСТЬ') and single letters are never candidates.
//    Tokens are NFC-normalized before the candidate test (a decomposed 'Й' or 'ё' is neither
//    skipped nor mis-grounded); reported offsets stay those of the ORIGINAL prose.
//  - A candidate at a SENTENCE START is skipped (capitalized for grammar, not as a name): see
//    isSentenceInitial for the exact boundary set (text start, a line terminator, . ! ? …, any
//    \p{Pd} dash followed by whitespace, an OPENING quote « „ “ ‘ ‚ " ' -- the word after it
//    starts an utterance). The walk-back is transparent to horizontal space (tab or any \p{Zs}),
//    zero-width characters, opening brackets, closing quotes/brackets, and markdown * _ #, so
//    «Кто там?» Тишина / (Так бывает.) Потом / .** Ветер / "# Дорога" all count as sentence
//    starts. A bare ':' is NOT a boundary ("Шли долго: Ветер" checks 'Ветер').
//  - Every other candidate must be GROUNDED in the rendered package -- the exact bytes the
//    Keeper saw (orchestrator renderNarrativePackage: oracle rows, lore, journal). Grounding is
//    a bounded common-prefix match against any package word (see isGrounded): the common prefix
//    is >= 3 and each side has at most 3 letters past it (Russian nominal/adjectival endings are
//    at most 3 letters on either side), so inflection ('Пригорье' -> 'Пригорья', 'Том' -> 'Тома',
//    'Старого' -> 'Старый') is tolerated without a stemmer.
//  - An ungrounded candidate is list 'nf1_name', severity BLOCK.
//  - Relative backstory (list 'nf1_backstory', severity WARN) is a small lexicon -- вчера,
//    позавчера, накануне, ordinal + day unit ("второй день", "третьи сутки"), "<дни|недели|
//    месяцы> назад" -- fired ONLY when the package carries no journal facts. Cardinal durations
//    ("восемь дней", "пять суток") are EXCLUDED BY CONSTRUCTION: an arrival total is legitimate
//    package-sourced prose, and every ordinal stem requires an explicit ordinal ending
//    (-ый/-ой/-ая/..., третий/третьи/...), so 'пять/шесть/девять/десять' never match. On an
//    arrival step (`journey.days_total` a number, TP1 3.1-C3) an ordinal DAY phrase (never a week)
//    is exempted ONLY when its number equals days_total exactly -- an 8-day arrival exempts
//    "восьмой день" but still warns on "третий день" or "вторую неделю".
//
// DIVISION OF LABOUR: this is the exact, high-confidence floor. The LLM judge keeps the nuance
// (accuracy axis): whether a grounded name is used correctly, whether a phrase is backstory at
// all. NF1 runs only where a package exists (scanTurnProse with a non-null package); calibration
// cases and the LT1 lore gate (which call scanProse without a package) never apply it.
//
// KNOWN LIMITS (documented on purpose; not fixed without a real corpus):
//  (a) Fleeting vowels: 'Орёл' in the package vs 'Орла' in the prose share only 'ор' (below the
//      3-letter prefix floor) -> a FALSE BLOCK. Reviewer decision: documented, not fixed without
//      corpus evidence (a looser prefix rule would ground real L4 inventions, e.g. 'Пригорья'
//      against 'приют'). Likewise two-letter names are below the floor and cannot inflect-ground
//      (package 'Ли' vs prose 'Лием') -> a FALSE BLOCK, documented, not fixed without a corpus.
//  (b) A Titlecase word right after a mid-sentence dash + space ("— ", "- ") counts as
//      sentence-initial -> a MISS (an aside dash is indistinguishable from a dialogue dash here).
//  (c) Polite 'Вы' and canon terms absent from the package (Око, Враг, ...) BLOCK. An allowlist
//      is added only if a real corpus requires it, and then SOURCED FROM THE PACK -- never as
//      literals in prose-gate/src.
//  (d) WARN false positives: comparisons ("будто дождь тут шёл вчера") and NPC speech about the
//      past trip the backstory lexicon -- hence warn, not block.
//  (e) A name AT a sentence start is never checked -- inherent to the rule (a sentence-initial
//      capital is grammatical and indistinguishable from a name without a lexicon). A MISS.
//  (f) Different words sharing a stem within the 3-letter bound ground each other -- a MISS, not
//      a block (e.g. package 'пригорком' grounds prose 'Пригорье'). The LLM judge's accuracy
//      axis covers misses; NF1 is tuned against false blocks.
//  (g) A word right after an opening quote is never checked: an embedded quotation starts an
//      utterance, so a quoted invented title (в трактире «Гарцующий пони») is a MISS. The
//      converse is deliberate: unquoted speech after a bare colon ("Он сказал: Молчи.") is
//      checked and BLOCKS -- Russian marks direct speech with quotes or a dialogue dash.
//  (h) A capitalized word opening a mid-sentence parenthesis ("крикнул (Молчи!) и") still
//      BLOCKS: rare punctuation, and brackets stay transparent so parenthesised names are checked.

import { renderNarrativePackage, type NarrativePackage } from '@brodyazhnik/orchestrator';
import { scanProse, type StopEntry, type Violation } from './antislop.js';

const WORD = /[\p{L}\p{M}]+/gu;
const CANDIDATE = /^\p{Lu}\p{Ll}/u;

// Horizontal whitespace skipped when walking back: tab or any space separator (\p{Zs}: space,
// NBSP, U+202F, U+2009 thin space, U+3000, ...), plus the zero-width characters below.
const HSPACE = /^[\t\p{Zs}]$/u;
// Zero-width space / non-joiner / joiner, word joiner, BOM: transparent like spaces. Built from
// code points so no invisible character sits in this source.
const ZERO_WIDTH = new Set([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff].map((c) => String.fromCodePoint(c)));
// Opening quotes are a BOUNDARY: the word right after one starts an utterance (direct speech
// after a colon, or an embedded quotation: коротким «Нет»). '"' and "'" are ambiguous (they also
// close), so a word after a closing straight quote is not checked either -- a miss, never a block.
const OPEN_QUOTES = new Set(['«', '„', '“', '‘', '‚', '"', "'"]);
// Transparent in the walk-back (neither boundary nor stop): opening brackets, closing quotes and
// brackets (a sentence may end inside them: «Тише!» Ветер, (Так бывает.) Потом), and markdown
// emphasis/heading markers.
const TRANSPARENT = new Set(['(', '[', '»', '”', '’', ')', ']', '*', '_', '#']);
// The 7 single-char line terminators of orchestrator render.ts LINE_TERMINATOR (its \r\n
// alternative is covered here by \n).
const LINE_TERMINATORS = new Set(['\n', '\r', '\v', '\f', '\u0085', '\u2028', '\u2029']);
const SENTENCE_END = new Set(['.', '!', '?', '…']);
// Any dash punctuation (\p{Pd}: hyphen-minus, U+2010, U+2012, en/em dash, U+2015, ...). A dash
// is a boundary only when WHITESPACE follows it (a dialogue/sentence dash); an in-word hyphen
// ('Дол-Гулдур') is not.
const DASH = /^\p{Pd}$/u;

/**
 * True iff the token starting at `index` begins a sentence or an utterance. Walking back over
 * horizontal/zero-width space and TRANSPARENT marks (opening brackets, closing quotes/brackets,
 * markdown * _ #), we hit: an OPENING quote (« „ “ ‘ ‚ " ') -> true (an utterance starts: `сказал:
 * «Держись`, `коротким «Нет»`); the text start, a line terminator, or one of `. ! ? …` -> true; a
 * \p{Pd} dash followed by whitespace -> true; anything else (a word, a comma, a bare `:`) -> false.
 */
export function isSentenceInitial(text: string, index: number): boolean {
  let j = index - 1;
  while (j >= 0) {
    const ch = text[j] as string;
    if (HSPACE.test(ch) || ZERO_WIDTH.has(ch) || TRANSPARENT.has(ch)) j--;
    else break;
  }
  if (j < 0) return true;
  const ch = text[j] as string;
  if (OPEN_QUOTES.has(ch) || LINE_TERMINATORS.has(ch) || SENTENCE_END.has(ch)) return true;
  if (DASH.test(ch)) return /\s/u.test(text[j + 1] ?? '');
  return false;
}

function normalize(s: string): string {
  return s.normalize('NFC').toLowerCase().replaceAll('ё', 'е');
}

/** The normalized (NFC, lowercase, ё->е) letter runs of the rendered package. */
export function groundingWords(renderedPackage: string): ReadonlySet<string> {
  const out = new Set<string>();
  for (const m of renderedPackage.matchAll(WORD)) out.add(normalize(m[0]));
  return out;
}

function commonPrefix(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/**
 * True iff `token` matches some package word exactly (normalized), or shares a common prefix L
 * with it such that L >= 3 and each side has at most 3 chars past it (L >= w.length - 3 and
 * L >= t.length - 3) -- a symmetric, inflection-sized difference ('Старого' <-> 'Старый').
 */
export function isGrounded(token: string, words: ReadonlySet<string>): boolean {
  const t = normalize(token);
  if (words.has(t)) return true;
  for (const w of words) {
    const l = commonPrefix(t, w);
    if (l >= 3 && l >= w.length - 3 && l >= t.length - 3) return true;
  }
  return false;
}

/** NF1 block: every non-sentence-initial Titlecase token absent from the package, by offset. */
export function scanUngroundedNames(prose: string, renderedPackage: string): Violation[] {
  const words = groundingWords(renderedPackage);
  const out: Violation[] = [];
  for (const m of prose.matchAll(WORD)) {
    const token = m[0];
    if (!CANDIDATE.test(token.normalize('NFC')) || isSentenceInitial(prose, m.index) || isGrounded(token, words)) continue;
    out.push({
      list: 'nf1_name',
      term: token,
      reason: 'capitalized name not grounded in the rendered package',
      severity: 'block',
      index: m.index,
    });
  }
  return out;
}

// One row per Russian ordinal stem (Russian morphology, not rules content): its regex fragment,
// its normalized lookup key ('ё' -> 'е', so 'четвёрт'/'четверт' share 'четверт'), its number, and
// whether it takes the soft ending set ('третий/третья...') instead of the regular one.
interface OrdinalStem {
  readonly pattern: string;
  readonly key: string;
  readonly n: number;
  readonly soft: boolean;
}
const ORDINAL_STEMS: readonly OrdinalStem[] = [
  { pattern: 'перв', key: 'перв', n: 1, soft: false },
  { pattern: 'втор', key: 'втор', n: 2, soft: false },
  { pattern: 'трет', key: 'трет', n: 3, soft: true },
  { pattern: 'четв[её]рт', key: 'четверт', n: 4, soft: false },
  { pattern: 'пят', key: 'пят', n: 5, soft: false },
  { pattern: 'шест', key: 'шест', n: 6, soft: false },
  { pattern: 'седьм', key: 'седьм', n: 7, soft: false },
  { pattern: 'восьм', key: 'восьм', n: 8, soft: false },
  { pattern: 'девят', key: 'девят', n: 9, soft: false },
  { pattern: 'десят', key: 'десят', n: 10, soft: false },
];
const stemPatterns = (soft: boolean): string =>
  ORDINAL_STEMS.filter((r) => r.soft === soft)
    .map((r) => r.pattern)
    .join('|');
// Explicit ordinal endings (never \p{L}*): cardinals пять/шесть/девять/десять cannot match.
const ORDINAL_STEM = `(?:${stemPatterns(false)}|${stemPatterns(true)})`;
const ORDINAL =
  `(?:(?:${stemPatterns(false)})(?:ый|ой|ая|ое|ые|ого|ому|ым|ом|ую|ых|ыми)` +
  `|${stemPatterns(true)}(?:ий|ья|ье|ьи|ьего|ьему|ьим|ьем|ью|ьих|ьими))`;
const DAY_UNIT = '(?:день|дня|дню|днём|днем|сутки|суток|недел\\p{L}*)';
const ORDINAL_DAY = `${ORDINAL}\\s+${DAY_UNIT}`;
const BACKSTORY = new RegExp(
  '(^|[^\\p{L}])(' +
    [
      'вчера',
      'вчерашн\\p{L}*',
      'позавчера',
      'накануне',
      ORDINAL_DAY,
      '(?:дн\\p{L}*|недел\\p{L}*|месяц\\p{L}*)\\s+назад',
    ].join('|') +
    ')(?=$|[^\\p{L}])',
  'giu',
);
// Normalized stem key -> its cardinal number. Endings are stripped by ORDINAL_DAY_PARSE below.
const ORDINAL_NUMBERS: Readonly<Record<string, number>> = Object.fromEntries(
  ORDINAL_STEMS.map((r) => [r.key, r.n]),
);
// DAY units only -- excludes недел* (a week is never exempted, whatever days_total is).
const DAY_ONLY_UNIT = '(?:день|дня|дню|днём|днем|сутки|суток)';
const ORDINAL_DAY_PARSE = new RegExp(`^(${ORDINAL_STEM})\\p{L}*\\s+(${DAY_ONLY_UNIT})$`, 'iu');

/** True iff `term` is an ordinal DAY phrase (never a week) whose number equals `daysTotal` exactly
 *  -- e.g. days_total 8 exempts "восьмой день"/"восьмые сутки" but not "третий день" or "вторую
 *  неделю". Used only on an arrival step, where days_total is the package-sourced day count. */
function isOrdinalDayMatchingTotal(term: string, daysTotal: number): boolean {
  const m = ORDINAL_DAY_PARSE.exec(term);
  if (m === null) return false;
  const stem = (m[1] as string).toLowerCase().replace(/ё/g, 'е');
  return ORDINAL_NUMBERS[stem] === daysTotal;
}

/** NF1 warn: relative-backstory phrases, only when the package has no journal facts. On an
 *  ARRIVAL step (`journey.days_total` a number -- TP1, 3.1-C3), an ordinal DAY phrase is exempted
 *  ONLY when its number matches days_total exactly ("восьмой день" on an 8-day arrival has a
 *  package source; "третий день" on the same arrival does not and still warns). Week phrases
 *  ("вторую неделю") always warn -- days_total counts days, not weeks. Every other phrase, and
 *  ordinal-day phrases on a non-arrival step (days_delta alone does not say which day it is),
 *  also still warn. */
export function scanRelativeBackstory(prose: string, pkg: NarrativePackage): Violation[] {
  if ((pkg.journal_facts ?? []).length > 0) return [];
  const daysTotal = pkg.journey?.days_total;
  const arrived = typeof daysTotal === 'number';
  const out: Violation[] = [];
  for (const m of prose.matchAll(BACKSTORY)) {
    const term = m[2] as string;
    if (arrived && isOrdinalDayMatchingTotal(term, daysTotal)) continue;
    out.push({
      list: 'nf1_backstory',
      term,
      reason: 'relative backstory without journal facts in the package',
      severity: 'warn',
      index: m.index + (m[1]?.length ?? 0),
    });
  }
  return out;
}

/**
 * The per-turn deterministic scan the judges run: scanProse (stop-lists + mixed_script) and,
 * ONLY when a package is given, NF1 on top -- ungrounded names against the rendered package,
 * then relative backstory. With `pkg === null` the result is exactly scanProse(prose, vkAddendum).
 */
export function scanTurnProse(
  prose: string,
  vkAddendum: readonly StopEntry[] | null,
  pkg: NarrativePackage | null,
): Violation[] {
  const violations = scanProse(prose, vkAddendum);
  if (pkg !== null) {
    violations.push(...scanUngroundedNames(prose, renderNarrativePackage(pkg)));
    violations.push(...scanRelativeBackstory(prose, pkg));
  }
  return violations;
}
