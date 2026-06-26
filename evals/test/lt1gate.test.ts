import { describe, expect, it } from 'vitest';
import {
  CHARS_PER_TOKEN,
  TOKEN_MAX,
  TOKEN_MIN,
  checkBudget,
  gateLoreChunkText,
  gateToneExamples,
  loadVkAddendum,
} from '../src/lt1gate.js';
import type { StopEntry } from '../src/antislop.js';

// Fixture VK addendum standing in for the loaded tone.stoplist.json. Tests stay
// decoupled from the (verified:false) draft content on purpose.
const VK_FIXTURE_DOC = {
  schema_version: '1.0',
  id: 'kv.tone.stoplist',
  type: 'tone_stoplist',
  verified: false,
  locale: 'ru',
  terminology: 'pandora_box',
  payload: {
    entries: [
      { term: 'древнее зло пробуждается', reason: 'Middle-earth pastiche cliche', severity: 'block' },
      { term: 'Воистину', reason: 'mock-archaic register tic', severity: 'block' },
    ],
  },
};

// Helper: build text of a given char length (in-budget lore body).
function body(chars: number): string {
  const unit = 'Под ногами хрустит палый лист, и пахнет сырой землёй. ';
  return unit.repeat(Math.ceil(chars / unit.length)).slice(0, chars);
}

describe('LT1 gate: VK addendum loader', () => {
  it('parses a tone.stoplist doc into StopEntry[]', () => {
    const addendum = loadVkAddendum(VK_FIXTURE_DOC);
    expect(addendum).toHaveLength(2);
    expect(addendum[0]?.term).toBe('древнее зло пробуждается');
  });

  it('throws loudly on the wrong type', () => {
    expect(() => loadVkAddendum({ ...VK_FIXTURE_DOC, type: 'rule_card' })).toThrow();
  });
});

describe('LT1 gate: lore chunk text', () => {
  const vk: StopEntry[] = loadVkAddendum(VK_FIXTURE_DOC);

  it('blocks a chunk with a calque or VK pastiche', () => {
    const bad = body(1300) + ' Так древнее зло пробуждается на востоке.';
    const v = gateLoreChunkText(bad, vk);
    expect(v.blocking).toBe(true);
    expect(v.pass).toBe(false);
  });

  it('passes a clean, in-budget chunk', () => {
    const text = body(TOKEN_MIN * CHARS_PER_TOKEN + 200); // comfortably in 300..600 tokens
    const v = gateLoreChunkText(text, vk);
    expect(v.blocking).toBe(false);
    expect(v.budget.withinBudget).toBe(true);
    expect(v.budgetWarn).toBe(false);
    expect(v.pass).toBe(true);
  });

  it('treats budget as WARN, not block (proxy provisional until 2.3)', () => {
    const tooShort = body((TOKEN_MIN - 50) * CHARS_PER_TOKEN);
    const tooLong = body((TOKEN_MAX + 100) * CHARS_PER_TOKEN);
    const s = gateLoreChunkText(tooShort, vk);
    const l = gateLoreChunkText(tooLong, vk);
    expect(s.budget.withinBudget).toBe(false);
    expect(s.budgetWarn).toBe(true);
    expect(s.pass).toBe(true); // anti-slop clean -> still passes; budget is a warning only
    expect(l.budgetWarn).toBe(true);
    expect(l.pass).toBe(true);
  });
});

describe('LT1 gate: budget proxy', () => {
  it('estimates tokens from chars deterministically', () => {
    const b = checkBudget(body(TOKEN_MIN * CHARS_PER_TOKEN));
    expect(b.chars).toBe(TOKEN_MIN * CHARS_PER_TOKEN);
    expect(b.tokensEstimated).toBe(TOKEN_MIN);
    expect(b.withinBudget).toBe(true);
  });
});

describe('LT1 gate: tone.md dogfood', () => {
  const vk: StopEntry[] = loadVkAddendum(VK_FIXTURE_DOC);

  it('flags a culture-voice example that violates the stop-list it ships with', () => {
    const examples = [
      'Дороги нынче неспокойные, дальше Пригорья не загадываю.', // clean hobbit-ish line
      'Воистину, тьма грядёт.', // trips the pack stop-list -> canon must not ship this
    ];
    const verdicts = gateToneExamples(examples, vk);
    expect(verdicts[0]?.clean).toBe(true);
    expect(verdicts[1]?.clean).toBe(false);
  });
});
