// Anti-slop deterministic seed (arch v1 sec 2.5: stop-lists as regex/dictionary
// tests; terminology control).
//
// This is the MACHINE-CHECKABLE core of the anti-slop checklist (chat 2.1.c). It is a
// SEED STUB on purpose: a tight, real set that chat 2.3 expands in place (alongside the
// LLM judge and golden transcripts). The human-readable checklist lives in
// docs/ANTISLOP_CHECKLIST.md and references this module.
//
// SCOPE / LEGAL CONTOUR:
//  - `calque`  : wrong-system terminology that must NEVER appear (TOR is not D&D).
//                Concrete and system-position-specific -> safe to seed here.
//  - `slop_ru` / `slop_en` : generic LLM prose cliches in both languages
//                (arch sec 0.2.1 "both languages"). System-agnostic. Phrase-cliches.
//  - `register_parasite` : high-frequency officialese filler words (данный, является, ...).
//                A SEPARATE bucket from phrase-cliches so chat 2.3 can tune or suppress this
//                noisy, context-dependent class independently (e.g. a frequency threshold).
//  - VK-ADDENDUM stop-list (Middle-earth pastiche, e.g. genre cliches of the setting)
//                is NOT embedded here. It is pack-side content under its own gates
//                (content-packs/kv/tone.md) -- DEFERRED LT1 -- and is loaded as data,
//                never hardcoded in this source. See VK_ADDENDUM_SLOT below.
//
// SEVERITY is per-entry (StopEntry.severity), falling back to the list default. Severity is
// thus a property of the term along the WHOLE path -- including the VK addendum loaded from
// tone.md, whose curated per-entry severity (e.g. избранный=warn) is honored, not flattened.

export type Severity = 'block' | 'warn';
export type ListId = 'calque' | 'slop_ru' | 'slop_en' | 'register_parasite' | 'vk_addendum';

export interface StopEntry {
  readonly term: string;
  readonly reason: string;
  /** Per-entry severity. Falls back to the list default when absent. */
  readonly severity?: Severity;
}

export interface Violation {
  readonly list: ListId;
  readonly term: string;
  readonly reason: string;
  readonly severity: Severity;
  readonly index: number; // char offset of the matched term
}

/**
 * Wrong-system terminology. TOR 2e uses Endurance/Hope/Shadow, not hit points or
 * saving throws; the Pandora Box edition is the terminology canon. Any of these is a
 * hard block -- it proves the narrative layer leaked a foreign rules vocabulary.
 * Seed includes the common inflections that actually surface; 2.3 adds morphology.
 */
export const CALQUE_TERMS: readonly StopEntry[] = [
  { term: 'хиты', reason: 'D&D calque; TOR uses Выносливость/Изнурение' },
  { term: 'хитов', reason: 'D&D calque; TOR uses Выносливость/Изнурение' },
  { term: 'хит-поинты', reason: 'D&D calque (hit points)' },
  { term: 'хит-пойнты', reason: 'D&D calque (hit points)' },
  { term: 'очки жизни', reason: 'HP calque; TOR has no hit points' },
  { term: 'спасбросок', reason: 'D&D calque (saving throw); TOR uses checks' },
  { term: 'спас-бросок', reason: 'D&D calque (saving throw)' },
  { term: 'класс брони', reason: 'AC calque; TOR has no armour class' },
  { term: 'класс доспеха', reason: 'AC calque; TOR has no armour class' },
  { term: 'мана', reason: 'wrong-system resource; TOR has no mana' },
  { term: 'прокачка', reason: 'video-game leveling slang; off-register' },
];

/**
 * Generic Russian prose-slop cliches (seed). Register-agnostic LLM tics, not
 * setting-specific. Multi-word phrases are matched as a whole. Mixed severity: plain
 * cliches WARN; purple "abstract-mood" phrases BLOCK (they replace percept with vapour).
 */
export const SLOP_RU: readonly StopEntry[] = [
  { term: 'время словно остановилось', reason: 'cliche; stops the scene dead' },
  { term: 'по спине пробежал холодок', reason: 'cliche; describes feeling, see sec 0.9' },
  { term: 'сердце ёкнуло', reason: 'cliche; names emotion instead of percept' },
  { term: 'не передать словами', reason: 'evasion; refuses the concrete' },
  { term: 'воздух наполнился', reason: 'filler opener' },
  { term: 'словно сама природа', reason: 'pathetic-fallacy cliche' },
  // Purple "abstract-mood" phrases -> block (concrete percept, not vapour).
  { term: 'атмосфера пронизана', reason: 'purple; abstract mood, not percept', severity: 'block' },
  { term: 'воздух наполнен напряжением', reason: 'purple; abstract tension (cf. warn "воздух наполнился")', severity: 'block' },
  { term: 'тишина давит', reason: 'purple; abstract menace, not a sound/percept', severity: 'block' },
  { term: 'незримая угроза витает', reason: 'purple; invisible-threat filler', severity: 'block' },
];

/**
 * Register parasites: high-frequency officialese / filler words off-register for narrative
 * prose. WARN, not block -- they have legitimate uses, so this is a noisy, context-dependent
 * class.
 *
 * CALIBRATION INTENT (chat 2.3): kept in its OWN bucket (list = 'register_parasite') so it
 * is a candidate for a per-text frequency threshold / suppression in the judge calibration,
 * tuned INDEPENDENTLY of the phrase-cliche tiers. The bucket separation exists for exactly
 * this -- do not merge it back into slop_ru.
 */
export const REGISTER_PARASITE: readonly StopEntry[] = [
  { term: 'данный', reason: 'officialese filler; prefer этот or the concrete noun' },
  { term: 'является', reason: 'bureaucratic copula; flatten to a verb' },
  { term: 'поистине', reason: 'empty intensifier (distinct from VK addendum воистину)' },
  { term: 'безусловно', reason: 'empty intensifier' },
  { term: 'стоит отметить', reason: 'essayistic filler; breaks the scene' },
];

/**
 * Generic English prose-slop cliches (seed). Present because the judge prompt and a
 * few imported references may be English; the canon narrative output is Russian.
 */
export const SLOP_EN: readonly StopEntry[] = [
  { term: 'a chill ran down', reason: 'cliche; describes feeling, see sec 0.9' },
  { term: 'little did', reason: 'omniscient-narrator tell' },
  { term: 'in that moment', reason: 'filler' },
  { term: 'sent shivers', reason: 'cliche feeling-tell' },
];

/**
 * VK-addendum stop-list slot. Stays null in source. Populated at runtime from the pack
 * tone contract (content-packs/kv/tone.md) once LT1 lands in chat 2.2/2.3. Passing the
 * loaded entries to scanProse(text, vkAddendum) folds them into the scan under
 * list = 'vk_addendum' without touching this file.
 */
export const VK_ADDENDUM_SLOT: readonly StopEntry[] | null = null;

const LIST_DEFAULT_SEVERITY: Readonly<Record<ListId, Severity>> = {
  calque: 'block',
  slop_ru: 'warn',
  slop_en: 'warn',
  register_parasite: 'warn',
  vk_addendum: 'block',
};

/** Unicode-aware loose word boundary: term not glued to another letter either side. */
function findTerm(haystack: string, term: string): number {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^\\p{L}])(${esc})(?=$|[^\\p{L}])`, 'iu');
  const m = re.exec(haystack);
  // Group 1 (the leading boundary char) always matches but may be empty at string start.
  return m ? m.index + (m[1]?.length ?? 0) : -1;
}

function scanList(text: string, list: ListId, entries: readonly StopEntry[]): Violation[] {
  const out: Violation[] = [];
  for (const e of entries) {
    const index = findTerm(text, e.term);
    if (index >= 0) {
      out.push({ list, term: e.term, reason: e.reason, severity: e.severity ?? LIST_DEFAULT_SEVERITY[list], index });
    }
  }
  return out;
}

/**
 * Scan prose against the seed stop-lists. `vkAddendum` is the pack-loaded VK list
 * (LT1); pass it through once tone.md exists. Returns every match found, ordered by
 * list then offset. An empty array means the seed found nothing -- NOT that the prose
 * is clean (the LLM judge in 2.3 covers what regex cannot).
 */
export function scanProse(
  text: string,
  vkAddendum: readonly StopEntry[] | null = VK_ADDENDUM_SLOT,
): Violation[] {
  const violations = [
    ...scanList(text, 'calque', CALQUE_TERMS),
    ...scanList(text, 'slop_ru', SLOP_RU),
    ...scanList(text, 'slop_en', SLOP_EN),
    ...scanList(text, 'register_parasite', REGISTER_PARASITE),
  ];
  if (vkAddendum) {
    violations.push(...scanList(text, 'vk_addendum', vkAddendum));
  }
  return violations;
}

/** True iff the prose trips any 'block'-severity entry (a calque, a block-tagged purple
 *  phrase, or a block VK-addendum term). Severity is per-entry, read off each match. */
export function hasBlockingSlop(
  text: string,
  vkAddendum: readonly StopEntry[] | null = VK_ADDENDUM_SLOT,
): boolean {
  return scanProse(text, vkAddendum).some((v) => v.severity === 'block');
}
