// Rendered markup of the dice panel and a turn card (K5.2): the favoured / ill-favoured roll shows
// the pack name (labels group 'rolls') with our explanation beside it and never the raw id; the
// failed-prose head names the keeper from the labels (group 'roles'), else the id. Static server
// rendering (react-dom/server), no DOM.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { LabelsDto, TurnDto } from '../../src/shared/api';
import { DicePanel } from '../../src/ui/Dice';
import { diceModel, MODIFIER_NOTES } from '../../src/ui/model';
import { TurnCard } from '../../src/ui/TurnCard';

const LABELS: LabelsDto = {
  scenes: {},
  skills: {},
  conditions: {},
  outcomes: {},
  regions: {},
  trackers: {},
  rolls: { favoured: 'ROLL-FAVOURED', ill_favoured: 'ROLL-ILL' },
  roles: { keeper: 'ROLE-KEEPER' },
};

const panel = (labels: LabelsDto | null, mod: 'favoured' | 'ill_favoured'): string =>
  renderToStaticMarkup(
    createElement(DicePanel, { model: diceModel({ feat_die: 7, feat_candidates: [7, 2], feat_modifier: mod, outcome: 'weak' }, labels), title: 'T' }),
  );

describe('dice panel markup', () => {
  it('shows the pack name and our note, never the raw id', () => {
    for (const [mod, name] of [
      ['favoured', 'ROLL-FAVOURED'],
      ['ill_favoured', 'ROLL-ILL'],
    ] as const) {
      const html = panel(LABELS, mod);
      expect(html).toContain(name);
      expect(html).toContain(MODIFIER_NOTES[mod]);
      expect(html).not.toMatch(/favoured/); // neither id, nor in a title / attribute
    }
  });
});

function failedTurn(): TurnDto {
  return { turnIndex: 0, createdAt: '2026-10-04T09:00:00.000Z', pkg: {}, prose: null, proseState: 'failed', gate: [], generating: false, generations: 1 };
}

const card = (labels: LabelsDto | null): string =>
  renderToStaticMarkup(
    createElement(TurnCard, { turn: failedTurn(), labels, latest: true, pending: false, actionsDisabled: false, animate: false, onRewrite: () => {} }),
  );

describe('failed prose head', () => {
  it('names the keeper from the labels', () => {
    expect(card(LABELS)).toContain('ROLE-KEEPER не ответил.');
  });

  it('falls back to the id without labels', () => {
    expect(card(null)).toContain('keeper не ответил.');
  });
});
