// Pack labels (K4): every label shown for a package id is pack data. Expected names are read from
// the pack JSON files here (an independent path from loadPack), never written as literals; a stub
// pack with other names proves the labels are pack-sourced; unknown ids fall back to the id.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isJourneyOver, journeyTurn, startJourney, type NarrativePackage } from '@brodyazhnik/orchestrator';
import { describe, expect, it } from 'vitest';

import { LABEL_CATEGORIES, labelsFor, packageIds, packLabels, type LabelPack } from '../../src/server/service/labels';
import { ENV, LABELS, PACK_DIR } from '../support/service';

const card = (rel: string) => JSON.parse(readFileSync(join(PACK_DIR, rel), 'utf8')) as { title: string; payload: { parameters: Record<string, unknown> } };
const SCENES = card('mechanics/journey.razygryvanie_stsen_puteshestviya.json').payload.parameters['journey_scene_table'] as {
  rows: Record<string, { name_ru: string }>;
};
const SKILLS = card('mechanics/traits.spisok_navykov.json').payload.parameters['skills'] as Record<string, { name_ru: string }>;
const TIERS = card('mechanics/checks.degree_of_success.json').payload.parameters['tiers'] as { label: string }[];
const WOUNDED = card('mechanics/conditions.wounded.json').title;

/** Every package of a few full journeys (all regions). */
function journeyPackages(): NarrativePackage[] {
  const out: NarrativePackage[] = [];
  for (const region of ['border_lands', 'wild_lands', 'dark_lands'] as const) {
    for (const rngSeed of ['a3-1', 'a3-3', 'a3-7', 'k4-labels']) {
      let s = startJourney(ENV.cfg, { rngSeed, region });
      while (!isJourneyOver(s)) {
        const t = journeyTurn(s, ENV.cfg);
        out.push(t.pkg);
        s = t.next;
      }
    }
  }
  return out;
}

describe('packLabels over the real pack', () => {
  it('scene types and skills are the pack name_ru', () => {
    for (const [id, row] of Object.entries(SCENES.rows)) expect(LABELS.scenes[id]).toBe(row.name_ru);
    for (const [id, s] of Object.entries(SKILLS)) expect(LABELS.skills[id]).toBe(s.name_ru);
    expect(Object.keys(LABELS.skills)).toHaveLength(Object.keys(SKILLS).length);
  });

  it('degrees: tier i of checks.degree_of_success -> weak / strong / extraordinary; failure has no pack label', () => {
    expect(TIERS).toHaveLength(3);
    expect(LABELS.outcomes).toEqual({ weak: TIERS[0]?.label, strong: TIERS[1]?.label, extraordinary: TIERS[2]?.label });
    expect(Object.hasOwn(LABELS.outcomes, 'failure')).toBe(false);
  });

  it('conditions: the title of the condition rule card', () => {
    expect(LABELS.conditions['wounded']).toBe(WOUNDED);
  });
});

describe('labelsFor', () => {
  it('known id -> pack label; unknown id -> the id itself; only ids the packages show', () => {
    const pkg = {
      intent: 'journey',
      scene: 'journey',
      length_target: { min_chars: 1, max_chars: 2 },
      dice: { outcome: 'weak' },
      oracle: {
        table: 'journey_scenes',
        result_ref: 'mishap',
        detail: { table: 'scene_details.mishap', result_ref: 'x', row: { face: 1, scene: 's', prompt: 'p', skill: 'no_such_skill', significantEncounter: false } },
      },
      patch: { conditions_gained: ['wounded'], conditions_cleared: ['dying'] },
      journey: { days_delta: 0, travel_check: { outcome: 'failure' } },
    } as NarrativePackage;
    expect(labelsFor(LABELS, [pkg])).toEqual({
      scenes: { mishap: SCENES.rows['mishap']?.name_ru },
      skills: { no_such_skill: 'no_such_skill' },
      conditions: { wounded: WOUNDED, dying: 'dying' },
      outcomes: { weak: TIERS[0]?.label, failure: 'failure' },
    });
    expect(labelsFor(LABELS, [])).toEqual({ scenes: {}, skills: {}, conditions: {}, outcomes: {} });
  });

  it('a non-journey oracle table is not read as a scene type', () => {
    const pkg = { intent: 'open_question', scene: 'free', length_target: { min_chars: 1, max_chars: 2 }, oracle: { table: 'lore', result_ref: 'mishap' } } as NarrativePackage;
    expect(packageIds(pkg).scenes).toEqual([]);
  });

  it('every id in real journey packages gets a label; scene types and skills all resolve to pack names', () => {
    const pkgs = journeyPackages();
    const labels = labelsFor(LABELS, pkgs);
    for (const pkg of pkgs) {
      const ids = packageIds(pkg);
      for (const c of LABEL_CATEGORIES) for (const id of ids[c]) expect(labels[c][id], `${c}:${id}`).toBeDefined();
    }
    expect(Object.keys(labels.scenes).length).toBeGreaterThan(3);
    for (const [id, name] of Object.entries(labels.scenes)) expect(name).toBe(SCENES.rows[id]?.name_ru);
    for (const [id, name] of Object.entries(labels.skills)) expect(name).toBe(SKILLS[id]?.name_ru);
  });
});

describe('pack-sourcing (stub pack)', () => {
  const entries: Record<string, unknown> = {
    'kv.mechanics.journey.razygryvanie_stsen_puteshestviya': { payload: { parameters: { journey_scene_table: { rows: { mishap: { name_ru: 'STUB-SCENE' }, bare: {} } } } } },
    'kv.mechanics.traits.spisok_navykov': { payload: { parameters: { skills: { hunting: { name_ru: 'STUB-SKILL' } } } } },
    'kv.mechanics.checks.degree_of_success': { payload: { parameters: { tiers: [{ label: 'T0' }, { label: 'T1' }, { label: 'T2' }, { label: 'T3' }] } } },
    'kv.mechanics.conditions.wounded': { title: 'STUB-WOUNDED' },
    'kv.mechanics.other': { title: 'not a condition' },
  };
  const stub = (drop?: string): LabelPack => ({
    getById: (id) => (id === drop || !(id in entries) ? undefined : { id, raw: entries[id] }),
    listByType: (type) => (type === 'rule_card' ? Object.entries(entries).filter(([id]) => id !== drop).map(([id, raw]) => ({ id, raw })) : []),
  });

  it('labels follow the pack, not the code', () => {
    expect(packLabels(stub())).toEqual({
      scenes: { mishap: 'STUB-SCENE' },
      skills: { hunting: 'STUB-SKILL' },
      conditions: { wounded: 'STUB-WOUNDED' },
      outcomes: { weak: 'T0', strong: 'T1', extraordinary: 'T2' },
    });
  });

  it('a missing source card fails loudly', () => {
    expect(() => packLabels(stub('kv.mechanics.traits.spisok_navykov'))).toThrow(/packLabels: missing kv\.mechanics\.traits\.spisok_navykov/);
  });
});
