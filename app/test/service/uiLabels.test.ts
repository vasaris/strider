// The pack's UI labels sidecar (K5.1): the loader (uiLabels.ts), the runtime evidence gate and the
// label priority (labels.ts), over the REAL sidecar and pack and over stubs. Expected names are read
// from the sidecar / pack files, never written as literals; stub packs prove pack-sourcing.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getPackLabels } from '../../src/server/env';
import { CATEGORY_OF_GROUP, labelsFor, packLabels, type LabelPack } from '../../src/server/service/labels';
import { loadUiLabels, loadUiLabelsFromPack, UI_LABEL_GROUPS, type UiLabelEntry } from '../../src/server/service/uiLabels';
import { REGION_IDS, TRACKER_IDS, type CheckOutcome } from '../../src/shared/api';
import { LABELS, PACK, PACK_DIR, REPO, UI_LABELS } from '../support/service';

type Json = Record<string, unknown>;

const SIDECAR_DOC = JSON.parse(readFileSync(join(PACK_DIR, 'ui_labels.json'), 'utf8')) as Json & { payload: { entries: Json[] } };
const ENTRIES = SIDECAR_DOC.payload.entries as unknown as UiLabelEntry[];

/** Every .json file under a directory, recursively. */
function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return jsonFiles(p);
    return name.endsWith('.json') ? [p] : [];
  });
}

/** The pack's JSON documents indexed by id, read from disk independently of loadPack. */
const CARDS = new Map<string, Json>();
for (const f of jsonFiles(PACK_DIR)) {
  const doc = JSON.parse(readFileSync(f, 'utf8')) as unknown;
  if (typeof doc === 'object' && doc !== null && typeof (doc as Json)['id'] === 'string') CARDS.set((doc as Json)['id'] as string, doc as Json);
}

describe('A: sidecar evidence over the real files', () => {
  it('every entry: the source card is verified and the evidence is verbatim in its title or source_text', () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
    for (const e of ENTRIES) {
      const card = CARDS.get(e.source_card);
      expect(card, e.source_card).toBeDefined();
      expect(card?.['verified'], e.source_card).toBe(true);
      const st = (card?.['payload'] as Json | undefined)?.['source_text'];
      const texts = [card?.['title'], ...(Array.isArray(st) ? st : [])].filter((t): t is string => typeof t === 'string');
      expect(texts.some((t) => t.includes(e.evidence)), `${e.group}:${e.id} evidence in ${e.source_card}`).toBe(true);
    }
  });

  it('the sidecar is verified, outside the manifest content, and loads as is', () => {
    expect(SIDECAR_DOC['verified']).toBe(true);
    const manifest = readFileSync(join(PACK_DIR, 'manifest.json'), 'utf8');
    expect(manifest).not.toContain('ui_labels');
    expect(UI_LABELS).toEqual(ENTRIES);
  });
});

describe('B: loader negatives', () => {
  const entry = (): Json => ({ ...(ENTRIES[0] as unknown as Json) });
  const doc = (over: Json = {}, entries: unknown[] = [entry()]): Json => ({ ...SIDECAR_DOC, payload: { entries }, ...over });

  it('a valid document loads', () => {
    expect(loadUiLabels(doc())).toEqual([ENTRIES[0]]);
  });

  it('verified false or missing refuses to load', () => {
    expect(() => loadUiLabels(doc({ verified: false }))).toThrow(/ui labels: verified must be true/);
    const { verified: _drop, ...noVerified } = doc();
    expect(() => loadUiLabels(noVerified)).toThrow(/ui labels: verified must be true/);
    expect(() => loadUiLabels(doc({ verified: 'true' }))).toThrow(/verified must be true/);
  });

  it('wrong type, not an object, empty or missing entries', () => {
    expect(() => loadUiLabels(doc({ type: 'tone_stoplist' }))).toThrow(/ui labels: type must be "ui_labels"/);
    expect(() => loadUiLabels(null)).toThrow(/ui labels: not an object/);
    expect(() => loadUiLabels([])).toThrow(/ui labels: not an object/);
    expect(() => loadUiLabels(doc({}, []))).toThrow(/payload\.entries must be a non-empty array/);
    expect(() => loadUiLabels(doc({ payload: {} }))).toThrow(/payload\.entries must be a non-empty array/);
  });

  it('unknown group', () => {
    expect(() => loadUiLabels(doc({}, [{ ...entry(), group: 'skill' }]))).toThrow(/entries\[0\]\.group "skill" is not one of/);
  });

  it('missing, empty, non-string or extra field', () => {
    for (const k of ['group', 'id', 'name_ru', 'source_card', 'evidence']) {
      const missing = entry();
      delete missing[k];
      expect(() => loadUiLabels(doc({}, [missing])), k).toThrow(new RegExp(`entries\\[0\\]\\.${k} must be a non-empty string`));
      expect(() => loadUiLabels(doc({}, [{ ...entry(), [k]: '' }])), k).toThrow(new RegExp(`entries\\[0\\]\\.${k} must be a non-empty string`));
      expect(() => loadUiLabels(doc({}, [{ ...entry(), [k]: 1 }])), k).toThrow(new RegExp(`entries\\[0\\]\\.${k} must be a non-empty string`));
    }
    expect(() => loadUiLabels(doc({}, [{ ...entry(), note: 'x' }]))).toThrow(/entries\[0\] has unknown field\(s\) note/);
    expect(() => loadUiLabels(doc({}, ['x']))).toThrow(/entries\[0\] is not an object/);
  });

  it('duplicate (group, id); the same id in another group is fine', () => {
    const e = entry();
    expect(() => loadUiLabels(doc({}, [e, { ...e, name_ru: 'other' }]))).toThrow(new RegExp(`entries\\[1\\] duplicates ${e['group']}:${e['id']}`));
    const otherGroup = UI_LABEL_GROUPS.find((g) => g !== e['group']) as string;
    expect(loadUiLabels(doc({}, [e, { ...e, group: otherGroup }]))).toHaveLength(2);
  });
});

/** A stub pack with the structured label cards plus `extra` cards (raw JSON by id). */
function stubPack(extra: Record<string, unknown>): LabelPack {
  const entries: Record<string, unknown> = {
    'kv.mechanics.journey.razygryvanie_stsen_puteshestviya': { payload: { parameters: { journey_scene_table: { rows: { mishap: { name_ru: 'STUB-SCENE' } } } } } },
    'kv.mechanics.traits.spisok_navykov': { payload: { parameters: { skills: { hunting: { name_ru: 'STUB-SKILL' } } } } },
    'kv.mechanics.checks.degree_of_success': { payload: { parameters: { tiers: [{ label: 'T0' }, { label: 'T1' }, { label: 'T2' }] } } },
    'kv.mechanics.conditions.wounded': { verified: true, title: 'STUB-WOUNDED card' },
    ...extra,
  };
  return {
    getById: (id) => (Object.hasOwn(entries, id) ? { id, raw: entries[id] } : undefined),
    listByType: (type) => (type === 'rule_card' ? Object.entries(entries).map(([id, raw]) => ({ id, raw })) : []),
  };
}

const EVIDENCE_CARD = 'kv.stub.evidence';
const evidenceCard = { verified: true, title: 'Заголовок карты', notes: 'только в заметках', payload: { source_text: ['Первая строка.', 'Ещё ёлка и Тень.'] } };
const sidecar = (over: Partial<UiLabelEntry> = {}): UiLabelEntry => ({
  group: 'tracker',
  id: 'shadow',
  name_ru: 'SIDE-SHADOW',
  source_card: EVIDENCE_CARD,
  evidence: 'ёлка и Тень',
  ...over,
});

describe('C: the runtime evidence gate (stub pack)', () => {
  const pack = stubPack({ [EVIDENCE_CARD]: evidenceCard });

  it('evidence in source_text or in the title passes', () => {
    expect(packLabels(pack, [sidecar()]).trackers).toEqual({ shadow: 'SIDE-SHADOW' });
    expect(packLabels(pack, [sidecar({ evidence: 'Заголовок' })]).trackers).toEqual({ shadow: 'SIDE-SHADOW' });
  });

  it('a single source_text string is tolerated', () => {
    const p = stubPack({ [EVIDENCE_CARD]: { ...evidenceCard, payload: { source_text: 'Ещё ёлка и Тень.' } } });
    expect(packLabels(p, [sidecar()]).trackers).toEqual({ shadow: 'SIDE-SHADOW' });
  });

  it('a missing source card throws, naming the entry', () => {
    expect(() => packLabels(pack, [sidecar({ source_card: 'kv.no.such' })])).toThrow(/packLabels: sidecar tracker:shadow: source card kv\.no\.such is not in the pack/);
  });

  it('a source card that is not verified:true throws', () => {
    for (const verified of [false, undefined, 'true']) {
      const p = stubPack({ [EVIDENCE_CARD]: { ...evidenceCard, verified } });
      expect(() => packLabels(p, [sidecar()])).toThrow(/packLabels: sidecar tracker:shadow: source card kv\.stub\.evidence is not verified/);
    }
  });

  it('altered evidence (case, ё -> е), evidence only in notes, or across elements throws', () => {
    for (const evidence of ['ёлка и тень', 'елка и Тень', 'только в заметках', 'Первая строка. Ещё', 'Заголовок карты Первая']) {
      expect(() => packLabels(pack, [sidecar({ evidence })]), evidence).toThrow(
        /packLabels: sidecar tracker:shadow: evidence is not a verbatim substring of the title or payload\.source_text of kv\.stub\.evidence/,
      );
    }
  });

  it('the gate runs for an entry shadowed by a structured name too', () => {
    expect(() => packLabels(pack, [sidecar({ group: 'condition', id: 'wounded', evidence: 'nowhere' })])).toThrow(/sidecar condition:wounded: evidence/);
  });
});

describe('D: priority (stub pack)', () => {
  const pack = stubPack({ [EVIDENCE_CARD]: evidenceCard });
  const ui = [sidecar({ group: 'condition', id: 'wounded', name_ru: 'SIDE-WOUNDED' }), sidecar({ group: 'condition', id: 'dying', name_ru: 'SIDE-DYING' })];

  it('a structured name beats the sidecar; the sidecar fills a gap; neither -> the id', () => {
    const catalog = packLabels(pack, ui);
    expect(catalog.conditions).toEqual({ wounded: 'STUB-WOUNDED card', dying: 'SIDE-DYING' });
    const pkg = { intent: 'journey', scene: 'journey', length_target: { min_chars: 1, max_chars: 2 }, patch: { conditions_gained: ['wounded', 'dying', 'other'] } };
    expect(labelsFor(catalog, [pkg as never]).conditions).toEqual({ wounded: 'STUB-WOUNDED card', dying: 'SIDE-DYING', other: 'other' });
  });

  it('each sidecar group lands in its category', () => {
    const catalog = packLabels(
      pack,
      UI_LABEL_GROUPS.map((group) => sidecar({ group, id: 'x', name_ru: `SIDE-${group}` })),
    );
    for (const group of UI_LABEL_GROUPS) expect(catalog[CATEGORY_OF_GROUP[group]]['x']).toBe(`SIDE-${group}`);
  });
});

describe('E: every sidecar entry fills a real gap of the real pack', () => {
  it('the catalog without the sidecar has no label for any sidecar (category, id)', () => {
    const bare = packLabels(PACK, []);
    for (const e of UI_LABELS) {
      expect(Object.hasOwn(bare[CATEGORY_OF_GROUP[e.group]], e.id), `${e.group}:${e.id} has a structured pack name; drop the sidecar entry`).toBe(false);
    }
  });

  it('with the sidecar, each entry is the label of its (category, id)', () => {
    for (const e of UI_LABELS) expect(LABELS[CATEGORY_OF_GROUP[e.group]][e.id]).toBe(e.name_ru);
  });
});

describe('F: coverage over the real pack', () => {
  const OUTCOMES = ['failure', 'weak', 'strong', 'extraordinary'] as const satisfies readonly CheckOutcome[];
  // the conditions the orchestrator emits (diffHeroState), read from its source
  const provider = readFileSync(join(REPO, 'orchestrator', 'src', 'provider.ts'), 'utf8');
  const EMITTED = [...new Set([...provider.matchAll(/(?:gained|cleared)\.push\('([a-z_]+)'\)/g)].map((m) => m[1] as string))];

  it('regions, trackers, outcomes and emitted conditions all have a label that is not the id', () => {
    expect(EMITTED.sort()).toEqual(['dying', 'wounded']);
    const want: [keyof typeof LABELS, readonly string[]][] = [
      ['regions', REGION_IDS],
      ['trackers', TRACKER_IDS],
      ['outcomes', OUTCOMES],
      ['conditions', EMITTED],
    ];
    for (const [c, ids] of want) {
      for (const id of ids) {
        const label = LABELS[c][id];
        expect(label, `${c}:${id}`).toBeTypeOf('string');
        expect(label, `${c}:${id}`).not.toBe(id);
        expect(label, `${c}:${id}`).toMatch(/\p{Script=Cyrillic}/u);
      }
    }
  });

  it('the server env builds the same catalog (pack + sidecar)', () => {
    expect(getPackLabels()).toEqual(LABELS);
  });

  it('loadUiLabelsFromPack reads <packRoot>/ui_labels.json', () => {
    expect(loadUiLabelsFromPack(PACK_DIR)).toEqual(ENTRIES);
  });
});

describe('G: no setting name is written in app source', () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? files(p) : [p];
    });
  }

  it('no sidecar name_ru occurs in any file under app/src', () => {
    const src = files(join(REPO, 'app', 'src'));
    expect(src.length).toBeGreaterThan(10);
    for (const f of src) {
      const text = readFileSync(f, 'utf8');
      for (const e of UI_LABELS) expect(text.includes(e.name_ru), `${f} contains ${e.group}:${e.id}`).toBe(false);
    }
  });
});
