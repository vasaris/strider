// K5 view-models (src/ui/model.ts) and the wire-type sync (src/shared/api.ts): the turn prose
// state with its precedence, the dice panel model, the Russian gate reasons, the error messages
// and the polling / action rules. Pure functions, no browser.
import type { ListId } from '@brodyazhnik/prose-gate';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { API_ERRORS } from '../../src/server/http/errors';
import { REGIONS } from '../../src/server/service/sessions';
import { LABEL_CATEGORIES } from '../../src/server/service/labels';
import { errorCodeOf } from '../../src/ui/api-client';
import {
  API_ERROR_CODES,
  GATE_LIST_IDS,
  LABEL_GROUPS,
  REGION_IDS,
  TRACKER_IDS,
  type DiceDto,
  type GateFindingDto,
  type GateListId,
  type LabelsDto,
  type SessionDetailDto,
  type TurnDto,
} from '../../src/shared/api';
import {
  blockReasons,
  canAdvance,
  daysLine,
  deltaRows,
  diceModel,
  ERROR_MESSAGES,
  errorMessage,
  featGlyph,
  GATE_REASON_UNKNOWN,
  GATE_REASONS,
  gateReason,
  isQuietConflict,
  journeyDaysTotal,
  labelOf,
  paragraphs,
  plural,
  pollDelay,
  POLL_MS,
  REWRITE_NOTICES,
  rewriteControl,
  rewriteNotice,
  sceneOf,
  shouldPoll,
  signed,
  turnUi,
  type TurnUi,
} from '../../src/ui/model';

const LABELS: LabelsDto = {
  scenes: { mishap: 'SCENE-MISHAP' },
  skills: { hunting: 'SKILL-HUNTING' },
  conditions: { weary: 'COND-WEARY' },
  outcomes: { weak: 'OUT-WEAK', strong: 'OUT-STRONG', failure: 'failure' },
  regions: { wild_lands: 'REGION-WILD' },
  trackers: { fatigue: 'TRACKER-FATIGUE' },
};

function turn(over: Partial<TurnDto> = {}): TurnDto {
  return {
    turnIndex: 0,
    createdAt: '2026-10-04T09:00:00.000Z',
    pkg: {},
    prose: null,
    proseState: 'missing',
    gate: [],
    generating: false,
    generations: 0,
    ...over,
  };
}

const block = (list: GateListId, term: string): GateFindingDto => ({ list, term, severity: 'block' });
const warn = (list: GateListId, term: string): GateFindingDto => ({ list, term, severity: 'warn' });

describe('wire types stay in step with the server', () => {
  it('error codes: the same set as API_ERRORS', () => {
    expect([...API_ERROR_CODES].sort()).toEqual(Object.keys(API_ERRORS).sort());
    expectTypeOf<keyof typeof API_ERRORS>().toEqualTypeOf<(typeof API_ERROR_CODES)[number]>();
  });

  it('gate list ids: the same set as prose-gate ListId', () => {
    expectTypeOf<GateListId>().toEqualTypeOf<ListId>();
    expect(new Set(GATE_LIST_IDS).size).toBe(GATE_LIST_IDS.length);
  });

  it('regions and label groups match the server', () => {
    expect([...REGION_IDS]).toEqual([...REGIONS]);
    expect([...LABEL_GROUPS]).toEqual([...LABEL_CATEGORIES]);
  });
});

describe('turnUi', () => {
  it('ready: paragraphs and warn findings only', () => {
    const ui = turnUi(turn({ proseState: 'ready', prose: 'One.\n\n  Two.  \nThree.', gate: [warn('slop_ru', 'x')] }));
    expect(ui).toEqual({ kind: 'ready', paragraphs: ['One.', 'Two.', 'Three.'], rewriting: false, warnings: [warn('slop_ru', 'x')] });
    expect(rewriteControl(ui, false)).toBeNull();
  });

  it('ready wins over generating: the accepted text stays, marked rewriting', () => {
    expect(turnUi(turn({ proseState: 'ready', prose: 'A.', generating: true }))).toMatchObject({ kind: 'ready', rewriting: true });
    expect(turnUi(turn({ proseState: 'ready', prose: 'A.' }), true)).toMatchObject({ kind: 'ready', rewriting: true });
  });

  it('generating supersedes blocked / failed / missing (server lock or own request)', () => {
    for (const proseState of ['blocked', 'failed', 'missing'] as const) {
      expect(turnUi(turn({ proseState, generating: true })).kind).toBe('generating');
      expect(turnUi(turn({ proseState }), true).kind).toBe('generating');
    }
    expect(rewriteControl({ kind: 'generating' }, true)).toBeNull();
  });

  it('blocked: reasons from the block findings; never any text', () => {
    const ui = turnUi(turn({ proseState: 'blocked', gate: [warn('slop_en', 'w'), block('calque', 'k')] }));
    expect(ui).toEqual({ kind: 'blocked', reasons: [{ sentence: GATE_REASONS['calque'], terms: ['k'] }] });
    expect(rewriteControl(ui, false)).toBe('recover');
  });

  it('failed and missing offer a rewrite', () => {
    expect(turnUi(turn({ proseState: 'failed' }))).toEqual({ kind: 'failed' });
    expect(turnUi(turn({ proseState: 'missing' }))).toEqual({ kind: 'missing' });
    expect(rewriteControl({ kind: 'failed' }, false)).toBe('recover');
    expect(rewriteControl({ kind: 'missing' }, false)).toBe('recover');
  });

  it('rewriteControl matrix: quiet only for ready prose of the latest turn not being rewritten', () => {
    const ready = (rewriting: boolean): TurnUi => ({ kind: 'ready', paragraphs: ['A.'], rewriting, warnings: [] });
    expect(rewriteControl(ready(false), true)).toBe('quiet');
    expect(rewriteControl(ready(false), false)).toBeNull();
    expect(rewriteControl(ready(true), true)).toBeNull();
    expect(rewriteControl(ready(true), false)).toBeNull();
    for (const latest of [true, false]) {
      expect(rewriteControl({ kind: 'blocked', reasons: [] }, latest)).toBe('recover');
      expect(rewriteControl({ kind: 'failed' }, latest)).toBe('recover');
      expect(rewriteControl({ kind: 'missing' }, latest)).toBe('recover');
      expect(rewriteControl({ kind: 'generating' }, latest)).toBeNull();
    }
    // through turnUi: a ready turn whose rewrite is in flight (server lock or own request)
    expect(rewriteControl(turnUi(turn({ proseState: 'ready', prose: 'A.' })), true)).toBe('quiet');
    expect(rewriteControl(turnUi(turn({ proseState: 'ready', prose: 'A.', generating: true })), true)).toBeNull();
    expect(rewriteControl(turnUi(turn({ proseState: 'ready', prose: 'A.' }), true), true)).toBeNull();
  });

  it('rewriteNotice: only a rewrite of ready prose whose new generation was not accepted', () => {
    expect(rewriteNotice(true, 'blocked')).toBe(REWRITE_NOTICES.blocked);
    expect(rewriteNotice(true, 'missing')).toBe(REWRITE_NOTICES.missing);
    expect(rewriteNotice(true, 'ready')).toBeNull();
    for (const outcome of ['ready', 'blocked', 'missing'] as const) expect(rewriteNotice(false, outcome)).toBeNull();
    expect(REWRITE_NOTICES.blocked).not.toBe(REWRITE_NOTICES.missing);
    for (const s of Object.values(REWRITE_NOTICES)) expect(s).toMatch(/\p{Script=Cyrillic}.*\.$/u);
  });

  it('ready without text is treated as missing', () => {
    expect(turnUi(turn({ proseState: 'ready', prose: null })).kind).toBe('missing');
  });

  it('paragraphs drop blank lines', () => {
    expect(paragraphs('\n\n a \n\n\n b\n')).toEqual(['a', 'b']);
    expect(paragraphs('   ')).toEqual([]);
  });
});

describe('gate reasons', () => {
  it('every list id the gate can emit has its own Russian sentence', () => {
    for (const id of GATE_LIST_IDS) {
      const s = gateReason(id);
      expect(s, id).not.toBe(GATE_REASON_UNKNOWN);
      expect(s, id).toMatch(/\p{Script=Cyrillic}/u);
      expect(s, id).toMatch(/\.$/);
    }
    expect(Object.keys(GATE_REASONS).sort()).toEqual([...GATE_LIST_IDS].sort());
    expect(new Set(Object.values(GATE_REASONS)).size).toBe(GATE_LIST_IDS.length);
  });

  it('the required wording for mixed script, NF1 names and SA1 plural address', () => {
    expect(gateReason('mixed_script')).toMatch(/латиниц.*кириллиц/);
    expect(gateReason('nf1_name')).toMatch(/нет в пакете хода/);
    expect(gateReason('sa1_plural')).toMatch(/множественном числе/);
  });

  it('unknown id -> the generic sentence', () => {
    expect(gateReason('some_future_list')).toBe(GATE_REASON_UNKNOWN);
    expect(gateReason('constructor')).toBe(GATE_REASON_UNKNOWN);
  });

  it('blockReasons: one per list in first-seen order, terms deduplicated, warns ignored', () => {
    const r = blockReasons([
      block('nf1_name', 'Bob'),
      warn('slop_ru', 'w'),
      block('sa1_plural', 'вы'),
      block('nf1_name', 'Bob'),
      block('nf1_name', 'Ann'),
      { list: 'future' as GateListId, term: 't', severity: 'block' },
    ]);
    expect(r).toEqual([
      { sentence: GATE_REASONS['nf1_name'], terms: ['Bob', 'Ann'] },
      { sentence: GATE_REASONS['sa1_plural'], terms: ['вы'] },
      { sentence: GATE_REASON_UNKNOWN, terms: ['t'] },
    ]);
  });

  it('blockReasons without any block finding -> one generic reason', () => {
    expect(blockReasons([warn('slop_ru', 'w')])).toEqual([{ sentence: GATE_REASON_UNKNOWN, terms: [] }]);
  });
});

describe('diceModel', () => {
  it('glyph kinds for every d12 face', () => {
    for (let f = 1; f <= 10; f++) expect(featGlyph(f)).toEqual({ kind: 'number', face: f });
    expect(featGlyph(11)).toEqual({ kind: 'eye', face: 11 });
    expect(featGlyph(12)).toEqual({ kind: 'rune', face: 12 });
  });

  it('a plain roll: kept face, d6 pool with icons, TN / total / outcome label', () => {
    const d: DiceDto = {
      feat_die: 7,
      feat_symbol: null,
      success_dice: [6, 2],
      success_icons: 1,
      success_counted: [true, true],
      total: 15,
      target_number: 14,
      outcome: 'strong',
    };
    const m = diceModel(d, LABELS);
    expect(m.hasFaces).toBe(true);
    expect(m.feat).toEqual({ kind: 'number', face: 7 });
    expect(m.candidates).toEqual([]);
    expect(m.modifier).toBeNull();
    expect(m.success).toEqual([
      { face: 6, icon: true, counted: true },
      { face: 2, icon: false, counted: true },
    ]);
    expect(m.successIcons).toBe(1);
    expect([m.tn, m.total]).toEqual([14, 15]);
    expect(m.outcome).toEqual({ id: 'strong', label: 'OUT-STRONG' });
    expect(m.tone).toBe('success');
  });

  it('favoured: both candidates, the kept one marked, the modifier labelled', () => {
    const m = diceModel({ feat_die: 12, feat_candidates: [3, 12], feat_modifier: 'favoured', outcome: 'weak' }, LABELS);
    expect(m.candidates).toEqual([
      { glyph: { kind: 'number', face: 3 }, kept: false },
      { glyph: { kind: 'rune', face: 12 }, kept: true },
    ]);
    expect(m.modifier).toEqual({ id: 'favoured', label: 'лучшая из двух' });
    expect(m.feat).toEqual({ kind: 'rune', face: 12 });
  });

  it('ill-favoured with equal faces: exactly one marked kept', () => {
    const m = diceModel({ feat_die: 11, feat_candidates: [11, 11], feat_modifier: 'ill_favoured' }, LABELS);
    expect(m.candidates.map((c) => c.kept)).toEqual([true, false]);
    expect(m.candidates.every((c) => c.glyph.kind === 'eye')).toBe(true);
    expect(m.modifier?.label).toBe('худшая из двух');
  });

  it('voided d6 faces are not counted', () => {
    const m = diceModel({ feat_die: 4, success_dice: [1, 3, 6], success_counted: [false, false, true], outcome: 'failure' }, LABELS);
    expect(m.success.map((s) => s.counted)).toEqual([false, false, true]);
    expect(m.success.map((s) => s.icon)).toEqual([false, false, true]);
    expect(m.tone).toBe('failure');
  });

  it('a label missing from the server -> the id', () => {
    expect(diceModel({ outcome: 'extraordinary' }, LABELS).outcome).toEqual({ id: 'extraordinary', label: 'extraordinary' });
    expect(diceModel({ outcome: 'failure' }, null).outcome).toEqual({ id: 'failure', label: 'failure' });
  });

  it('a package stored before raw faces (K1): symbol / icons / TN / total / outcome only', () => {
    const m = diceModel({ feat_symbol: 'eye', success_icons: 2, total: 9, target_number: 14, outcome: 'failure' }, LABELS);
    expect(m.hasFaces).toBe(false);
    expect(m.feat).toEqual({ kind: 'eye', face: 11 });
    expect(m.candidates).toEqual([]);
    expect(m.success).toEqual([]);
    expect([m.successIcons, m.total, m.tn]).toEqual([2, 9, 14]);
    expect(diceModel({ feat_symbol: 'gandalf' }, null).feat).toEqual({ kind: 'rune', face: 12 });
    expect(diceModel({ feat_symbol: null, total: 3 }, null).feat).toBeNull();
    expect(diceModel({}, null).tone).toBe('neutral');
  });
});

describe('mechanics helpers', () => {
  it('labelOf: the server label, else the id; own keys only', () => {
    expect(labelOf(LABELS, 'skills', 'hunting')).toBe('SKILL-HUNTING');
    expect(labelOf(LABELS, 'skills', 'travel')).toBe('travel');
    expect(labelOf(LABELS, 'skills', 'toString')).toBe('toString');
    expect(labelOf(null, 'scenes', 'mishap')).toBe('mishap');
  });

  it('sceneOf: scene label, detail row text, skill label', () => {
    const pkg = {
      oracle: {
        table: 'journey_scenes',
        result_ref: 'mishap',
        detail: { table: 'x', result_ref: 'y', row: { face: 1, scene: 'S', prompt: 'P', skill: 'hunting', significantEncounter: false } },
      },
    };
    expect(sceneOf(pkg, LABELS)).toEqual({ scene: 'SCENE-MISHAP', detail: 'S', prompt: 'P', skill: 'SKILL-HUNTING' });
    expect(sceneOf({}, LABELS)).toEqual({ scene: null, detail: null, prompt: null, skill: null });
  });

  it('deltaRows: non-zero tracker deltas in a fixed order, ids without the suffix', () => {
    expect(deltaRows({ eye_delta: 1, fatigue_delta: 3, hope_delta: 0 })).toEqual([
      { id: 'fatigue', value: 3 },
      { id: 'eye', value: 1 },
    ]);
    expect(deltaRows(null)).toEqual([]);
    expect(deltaRows({ endurance_delta: -1, fatigue_delta: 1, hope_delta: 1, shadow_delta: 1, eye_delta: 1 }).map((r) => r.id)).toEqual([...TRACKER_IDS]);
  });

  it('labelOf: tracker and region labels from the server, else the id', () => {
    expect(labelOf(LABELS, 'trackers', 'fatigue')).toBe('TRACKER-FATIGUE');
    expect(labelOf(LABELS, 'trackers', 'eye')).toBe('eye');
    expect(labelOf(LABELS, 'regions', 'wild_lands')).toBe('REGION-WILD');
    expect(labelOf(null, 'regions', 'wild_lands')).toBe('wild_lands');
  });

  it('days and arrival lines; plurals', () => {
    expect(daysLine({ days_delta: 0 })).toBe('Срок пути не изменился.');
    expect(daysLine({ days_delta: 1 })).toBe('Срок пути +1 день.');
    expect(daysLine({ days_delta: -2 })).toBe('Срок пути −2 дня.');
    expect(daysLine({ days_delta: 0, arrived: true, days_total: 11 })).toBe('Прибытие. Всего в пути: 11 дней.');
    expect([1, 2, 5, 11, 21, 22, 25, 111].map((n) => plural(n, 'a', 'b', 'c')).join('')).toBe('abccabcc');
    expect(signed(3) + signed(-3) + signed(0)).toBe('+3−30');
  });

  it('journeyDaysTotal: the arrival step', () => {
    const t = (days_total?: number) => turn({ pkg: { journey: { days_delta: 0, travel_check: {}, ...(days_total === undefined ? {} : { arrived: true, days_total }) } } });
    expect(journeyDaysTotal([t(), t(10)])).toBe(10);
    expect(journeyDaysTotal([t()])).toBeNull();
  });
});

describe('session flow rules', () => {
  const detail = (over: Partial<SessionDetailDto> = {}): SessionDetailDto => ({
    session: { id: 'i', createdAt: '', rngSeed: 's', heroRef: 'h', packId: 'kv', packVersion: '0.1.0', region: 'wild_lands' },
    turns: [turn()],
    labels: LABELS,
    nextTurnIndex: 1,
    journeyComplete: false,
    packCurrent: true,
    ...over,
  });

  it('shouldPoll: while any turn is generating or a POST is in flight', () => {
    expect(shouldPoll(detail(), false)).toBe(false);
    expect(shouldPoll(detail({ turns: [turn(), turn({ turnIndex: 1, generating: true })] }), false)).toBe(true);
    expect(shouldPoll(detail(), true)).toBe(true);
    expect(shouldPoll(null, false)).toBe(false);
  });

  it('pollDelay: POLL_MS while polling is needed, else null', () => {
    expect(POLL_MS).toBe(3000);
    expect(pollDelay(detail({ turns: [turn({ generating: true })] }), false)).toBe(POLL_MS);
    expect(pollDelay(detail(), true)).toBe(POLL_MS);
    expect(pollDelay(detail(), false)).toBeNull();
    expect(pollDelay(null, false)).toBeNull();
  });

  it('a failed GET does not end the chain: the decision uses the last GOOD detail', () => {
    // The chain as SessionScreen runs it: after every attempt, keep the last good detail on
    // failure and schedule the next GET from pollDelay(lastGood, inFlight).
    type Attempt = { ok: true; detail: SessionDetailDto } | { ok: false };
    const generating = detail({ turns: [turn({ generating: true })] });
    const settled = detail({ turns: [turn({ proseState: 'ready', prose: 'A.' })] });
    const attempts: Attempt[] = [{ ok: true, detail: generating }, { ok: false }, { ok: false }, { ok: true, detail: settled }];
    let lastGood: SessionDetailDto | null = null;
    const scheduled: (number | null)[] = [];
    for (const a of attempts) {
      if (a.ok) lastGood = a.detail;
      scheduled.push(pollDelay(lastGood, false));
    }
    expect(scheduled).toEqual([POLL_MS, POLL_MS, POLL_MS, null]);
    // a first load that fails has no good detail: nothing to poll for
    expect(pollDelay(null, false)).toBeNull();
  });

  it('canAdvance: pack current, journey open, nothing in flight or generating', () => {
    expect(canAdvance(detail(), false)).toBe(true);
    expect(canAdvance(detail(), true)).toBe(false);
    expect(canAdvance(detail({ packCurrent: false }), false)).toBe(false);
    expect(canAdvance(detail({ journeyComplete: true }), false)).toBe(false);
    expect(canAdvance(detail({ turns: [turn({ generating: true })] }), false)).toBe(false);
    expect(canAdvance(null, false)).toBe(false);
  });
});

describe('error messages', () => {
  it('every API code and the two client codes has a Russian message', () => {
    for (const code of [...API_ERROR_CODES, 'network', 'bad_response'] as const) {
      expect(errorMessage(code), code).toMatch(/\p{Script=Cyrillic}/u);
    }
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual([...API_ERROR_CODES, 'network', 'bad_response'].sort());
  });

  it('quiet conflicts: turn_conflict and generation_in_progress only', () => {
    expect(API_ERROR_CODES.filter(isQuietConflict).sort()).toEqual(['generation_in_progress', 'turn_conflict']);
  });

  it('errorCodeOf: a known code, else bad_response', () => {
    expect(errorCodeOf({ error: { code: 'pack_mismatch', message: 'x' } })).toBe('pack_mismatch');
    expect(errorCodeOf({ error: { code: 'nope' } })).toBe('bad_response');
    expect(errorCodeOf(null)).toBe('bad_response');
    expect(errorCodeOf('x')).toBe('bad_response');
  });
});
