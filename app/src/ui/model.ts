// Pure view-models of the session feed (K5): turn prose state, the dice panel, gate reasons, error
// messages, labels and small Russian formatting helpers. No React, no fetch, no server imports --
// unit-tested in test/ui/model.test.ts and shared by the client components.
//
// Labels: every setting name comes from the server's labels (pack name_ru); an id without a label
// is shown as the id itself. The Russian sentences below are our own UI text, never setting terms.

import type {
  ApiErrorCode,
  CheckOutcome,
  DiceDto,
  GateFindingDto,
  LabelGroup,
  LabelsDto,
  PackageDto,
  PatchDto,
  SessionDetailDto,
  TurnDto,
} from '../shared/api';

// ---- labels ----

/** The server label for an id in a group, else the id itself. */
export function labelOf(labels: LabelsDto | null, group: LabelGroup, id: string): string {
  const map = labels?.[group];
  return map !== undefined && Object.hasOwn(map, id) ? (map[id] as string) : id;
}

// ---- turn prose state ----

export type TurnUi =
  | { readonly kind: 'ready'; readonly paragraphs: readonly string[]; readonly rewriting: boolean; readonly warnings: readonly GateFindingDto[] }
  | { readonly kind: 'generating' }
  | { readonly kind: 'blocked'; readonly reasons: readonly GateReason[] }
  | { readonly kind: 'failed' }
  | { readonly kind: 'missing' };

/**
 * The prose area of one turn. Precedence:
 *   1. an accepted text is always shown ('ready'); a generation in flight for that turn (the
 *      server's lock, or this client's own request) only marks it `rewriting`;
 *   2. else a generation in flight -> 'generating' (it supersedes blocked / failed / missing);
 *   3. else the server's proseState (blocked with the reasons of its block findings).
 * `canRewrite` (below) is true only for blocked / failed / missing.
 */
export function turnUi(turn: TurnDto, pending = false): TurnUi {
  const busy = turn.generating || pending;
  if (turn.proseState === 'ready' && turn.prose !== null) {
    return { kind: 'ready', paragraphs: paragraphs(turn.prose), rewriting: busy, warnings: turn.gate.filter((g) => g.severity === 'warn') };
  }
  if (busy) return { kind: 'generating' };
  switch (turn.proseState) {
    case 'blocked':
      return { kind: 'blocked', reasons: blockReasons(turn.gate) };
    case 'failed':
      return { kind: 'failed' };
    default:
      // 'missing', or 'ready' without text (not sent by the server; treated as missing)
      return { kind: 'missing' };
  }
}

export const canRewrite = (ui: TurnUi): boolean => ui.kind === 'blocked' || ui.kind === 'failed' || ui.kind === 'missing';

/** Prose split into paragraphs on line breaks; blank runs collapsed. */
export function paragraphs(prose: string): string[] {
  return prose
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
}

// ---- gate reasons ----

/** One plain Russian sentence per prose-gate list (our wording, not setting terms). */
export const GATE_REASONS: Readonly<Record<string, string>> = {
  calque: 'Термин чужой игровой системы или калька.',
  slop_ru: 'Затёртый штамп русской прозы.',
  slop_en: 'Английский штамп или канцелярская калька.',
  register_parasite: 'Слово-паразит, которое сбивает регистр.',
  vk_addendum: 'Слово из стоп-листа тона в пакете контента.',
  mixed_script: 'Смешение латиницы и кириллицы в одном слове.',
  nf1_name: 'Имя, которого нет в пакете хода.',
  nf1_backstory: 'Родня или предыстория героя, которых нет в пакете хода.',
  sa1_plural: 'Обращение к герою во множественном числе.',
};

export const GATE_REASON_UNKNOWN = 'Текст не прошёл автоматическую проверку.';

export const gateReason = (list: string): string => (Object.hasOwn(GATE_REASONS, list) ? (GATE_REASONS[list] as string) : GATE_REASON_UNKNOWN);

export interface GateReason {
  readonly sentence: string;
  readonly terms: readonly string[];
}

/** The reasons of the block findings, one per list in first-seen order, with their matched terms
 *  (deduplicated). No block finding (should not happen for 'blocked') -> one generic reason. */
export function blockReasons(gate: readonly GateFindingDto[]): GateReason[] {
  const order: string[] = [];
  const terms = new Map<string, string[]>();
  for (const f of gate) {
    if (f.severity !== 'block') continue;
    if (!terms.has(f.list)) {
      order.push(f.list);
      terms.set(f.list, []);
    }
    const t = terms.get(f.list) as string[];
    if (f.term !== '' && !t.includes(f.term)) t.push(f.term);
  }
  if (order.length === 0) return [{ sentence: GATE_REASON_UNKNOWN, terms: [] }];
  return order.map((list) => ({ sentence: gateReason(list), terms: terms.get(list) ?? [] }));
}

// ---- dice panel ----

export type FeatGlyph = { readonly kind: 'number'; readonly face: number } | { readonly kind: 'eye'; readonly face: 11 } | { readonly kind: 'rune'; readonly face: 12 };

/** d12 face -> glyph: 1..10 numbers, 11 the eye, 12 the rune (contract DiceResult). */
export function featGlyph(face: number): FeatGlyph {
  if (face === 11) return { kind: 'eye', face: 11 };
  if (face === 12) return { kind: 'rune', face: 12 };
  return { kind: 'number', face };
}

export interface FeatCandidate {
  readonly glyph: FeatGlyph;
  readonly kept: boolean;
}

export interface SuccessDie {
  readonly face: number;
  readonly icon: boolean; // a 6
  readonly counted: boolean; // false: voided (weariness), not in the total
}

export type DiceTone = 'success' | 'failure' | 'neutral';

export interface DiceModel {
  /** False for a package stored before raw faces (K1): render outcome / symbol / TN / total only. */
  readonly hasFaces: boolean;
  /** The kept d12 face (hasFaces), else a symbol-only glyph (eye / rune) or null. */
  readonly feat: FeatGlyph | null;
  /** Favoured / ill-favoured rolls: every d12 rolled, the kept one marked; [] otherwise. */
  readonly candidates: readonly FeatCandidate[];
  readonly modifier: { readonly id: 'favoured' | 'ill_favoured'; readonly label: string } | null;
  readonly success: readonly SuccessDie[];
  readonly successIcons: number | null;
  readonly tn: number | null;
  readonly total: number | null;
  readonly outcome: { readonly id: CheckOutcome; readonly label: string } | null;
  readonly tone: DiceTone;
}

/** Our descriptions of the two-d12 modifiers (not setting terms; the id is kept for a tooltip). */
export const MODIFIER_LABELS: Readonly<Record<'favoured' | 'ill_favoured', string>> = {
  favoured: 'лучшая из двух',
  ill_favoured: 'худшая из двух',
};

export function diceModel(d: DiceDto, labels: LabelsDto | null): DiceModel {
  const hasFaces = typeof d.feat_die === 'number';
  const feat: FeatGlyph | null = hasFaces
    ? featGlyph(d.feat_die as number)
    : d.feat_symbol === 'eye'
      ? featGlyph(11)
      : d.feat_symbol === 'gandalf'
        ? featGlyph(12)
        : null;

  let candidates: FeatCandidate[] = [];
  if (hasFaces && d.feat_candidates !== undefined && d.feat_candidates.length > 1) {
    const keptAt = d.feat_candidates.indexOf(d.feat_die as number); // first equal face; -1 marks none
    candidates = d.feat_candidates.map((face, i) => ({ glyph: featGlyph(face), kept: i === keptAt }));
  }
  const modifier = d.feat_modifier !== undefined ? { id: d.feat_modifier, label: MODIFIER_LABELS[d.feat_modifier] } : null;

  const success: SuccessDie[] = (d.success_dice ?? []).map((face, i) => ({
    face,
    icon: face === 6,
    counted: d.success_counted?.[i] ?? true,
  }));

  const outcome = d.outcome !== undefined ? { id: d.outcome, label: labelOf(labels, 'outcomes', d.outcome) } : null;
  const tone: DiceTone = outcome === null ? 'neutral' : outcome.id === 'failure' ? 'failure' : 'success';

  return {
    hasFaces,
    feat,
    candidates,
    modifier,
    success,
    successIcons: d.success_icons ?? null,
    tn: d.target_number ?? null,
    total: d.total ?? null,
    outcome,
    tone,
  };
}

/** Screen-reader name of a d12 face (our words). */
export function featAria(g: FeatGlyph): string {
  return g.kind === 'eye' ? 'd12: грань 11, глаз' : g.kind === 'rune' ? 'd12: грань 12, руна' : `d12: ${g.face}`;
}

export function successAria(s: SuccessDie): string {
  return `d6: ${s.face}${s.icon ? ', значок успеха' : ''}${s.counted ? '' : ', не засчитана'}`;
}

// ---- turn mechanics ----

export interface DeltaRow {
  readonly id: string; // tracker id without the _delta suffix (no pack label exists for these)
  readonly value: number;
}

const DELTA_KEYS = ['endurance_delta', 'fatigue_delta', 'hope_delta', 'shadow_delta', 'eye_delta'] as const;

/** Non-zero tracker deltas, in a fixed order. */
export function deltaRows(patch: PatchDto | null | undefined): DeltaRow[] {
  if (patch == null) return [];
  return DELTA_KEYS.flatMap((k) => {
    const v = patch[k];
    return typeof v === 'number' && v !== 0 ? [{ id: k.replace(/_delta$/, ''), value: v }] : [];
  });
}

export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** Russian plural of a count: forms for 1 / 2-4 / 5+. */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

export const days = (n: number): string => `${n} ${plural(n, 'день', 'дня', 'дней')}`;

export function daysLine(j: { readonly days_delta: number; readonly arrived?: true; readonly days_total?: number }): string {
  const delta = j.days_delta === 0 ? 'срок пути не изменился' : `срок пути ${signed(j.days_delta)} ${plural(j.days_delta, 'день', 'дня', 'дней')}`;
  if (j.arrived === true) return typeof j.days_total === 'number' ? `Прибытие. Всего в пути: ${days(j.days_total)}.` : 'Прибытие.';
  return `${delta[0]?.toUpperCase() ?? ''}${delta.slice(1)}.`;
}

/** Total days of a finished journey: the arrival step's days_total, if any turn carries it. */
export function journeyDaysTotal(turns: readonly TurnDto[]): number | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i]?.pkg.journey?.days_total;
    if (typeof t === 'number') return t;
  }
  return null;
}

/** The scene line of a package: scene label and the rolled detail row (opaque pack text). */
export function sceneOf(pkg: PackageDto, labels: LabelsDto | null): { scene: string | null; detail: string | null; prompt: string | null; skill: string | null } {
  const o = pkg.oracle;
  if (o == null) return { scene: null, detail: null, prompt: null, skill: null };
  const scene = o.table === 'journey_scenes' ? labelOf(labels, 'scenes', o.result_ref) : o.result_ref;
  const row = o.detail?.row ?? o.row ?? null;
  return {
    scene,
    detail: row?.scene ?? null,
    prompt: row?.prompt ?? null,
    skill: row?.skill != null ? labelOf(labels, 'skills', row.skill) : null,
  };
}

// ---- session flow ----

/** Poll GET while any turn is generating, or while this client's own POST is in flight (so the
 *  saved turn's mechanics show before its prose arrives). */
export function shouldPoll(detail: SessionDetailDto | null, inFlight: boolean): boolean {
  return inFlight || (detail?.turns.some((t) => t.generating) ?? false);
}

export const POLL_MS = 3000;

/** The delay before the next GET, decided after every attempt (success or failure) from the LAST
 *  SUCCESSFULLY loaded detail and whether this client's POST is in flight: POLL_MS, or null to stop. */
export const pollDelay = (lastDetail: SessionDetailDto | null, inFlight: boolean): number | null =>
  shouldPoll(lastDetail, inFlight) ? POLL_MS : null;

/** "Next turn" is possible: pack current, journey not over, nothing in flight or generating. */
export function canAdvance(detail: SessionDetailDto | null, inFlight: boolean): boolean {
  if (detail === null || inFlight) return false;
  return detail.packCurrent && !detail.journeyComplete && !detail.turns.some((t) => t.generating);
}

// ---- errors ----

export type ClientErrorCode = ApiErrorCode | 'network' | 'bad_response';

/** One short Russian message per API error code (and the client's own two). */
export const ERROR_MESSAGES: Readonly<Record<ClientErrorCode, string>> = {
  invalid_request: 'Запрос не принят: неверный формат.',
  forbidden_host: 'Доступ закрыт: приложение работает только на этом компьютере.',
  forbidden_origin: 'Доступ закрыт: запрос пришёл с чужой страницы.',
  not_found: 'Не найдено.',
  session_not_found: 'Такой сессии нет.',
  turn_not_found: 'Такого хода нет.',
  pack_mismatch: 'Сессия начата на другой версии пакета контента; продолжить её нельзя.',
  journey_complete: 'Путь уже окончен.',
  turn_conflict: 'Ход уже сделан в другом окне. Лента обновлена.',
  generation_in_progress: 'Текст для этого хода уже пишется. Лента обновлена.',
  payload_too_large: 'Запрос слишком велик.',
  unsupported_media_type: 'Запрос не принят: неверный тип данных.',
  unsupported_route: 'Этот маршрут пока не поддерживается.',
  internal_error: 'Внутренняя ошибка сервера.',
  keeper_failed: 'Рассказчик не ответил. Ход сохранён, текст можно переписать.',
  keeper_not_configured: 'Рассказчик не настроен на сервере.',
  database_not_configured: 'База данных не настроена.',
  database_unavailable: 'База данных недоступна.',
  database_misconfigured: 'База данных настроена неверно.',
  network: 'Сервер недоступен. Проверьте соединение.',
  bad_response: 'Сервер ответил непонятно.',
};

export const errorMessage = (code: ClientErrorCode): string => ERROR_MESSAGES[code];

/** Codes that mean "someone else is already on it": re-GET and show a quiet notice. */
export const isQuietConflict = (code: ClientErrorCode): boolean => code === 'turn_conflict' || code === 'generation_in_progress';

// ---- formatting ----

const DATE_FMT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : DATE_FMT.format(d);
}

export const turnsCount = (n: number): string => `${n} ${plural(n, 'ход', 'хода', 'ходов')}`;
