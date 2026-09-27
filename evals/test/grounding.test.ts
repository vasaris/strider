// NF1 grounding (grounding.ts): sentence boundaries, morphology-tolerant grounding, candidate
// selection, the relative-backstory warn, and the no-package identity with scanProse. Offline.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NarrativePackage } from '@brodyazhnik/orchestrator';
import { describe, expect, it } from 'vitest';
import { scanProse } from '../src/antislop.js';
import {
  groundingWords,
  isGrounded,
  isSentenceInitial,
  scanRelativeBackstory,
  scanTurnProse,
  scanUngroundedNames,
} from '../src/grounding.js';
import { CALIBRATION_CASES } from '../src/harness/cases.js';
import { loadVkAddendumFromPack } from '../src/lt1gate.js';

const packRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'content-packs/kv');

const PKG: NarrativePackage = { intent: 'journey', scene: 'journey', length_target: { min_chars: 400, max_chars: 800 } };
const PKG_WITH_JOURNAL: NarrativePackage = { ...PKG, journal_facts: [{ kind: 'place', text: 'Ночь у брода' }] };

/** isSentenceInitial at the first occurrence of `word` in `text`. */
function initialAt(text: string, word: string): boolean {
  const i = text.indexOf(word);
  if (i < 0) throw new Error(`fixture: ${word} not in ${text}`);
  return isSentenceInitial(text, i);
}

describe('NF1 isSentenceInitial', () => {
  it.each([
    ['text start', 'Бри спит.'],
    ['after \\n', 'Шли долго.\nБри спит.'],
    ['after U+2028', 'Шли долго\u2028Бри спит.'],
    ["after '. '", 'Шли долго. Бри спит.'],
    ["after '! '", 'Шли долго! Бри спит.'],
    ["after '? '", 'Шли долго? Бри спит.'],
    ["after '… '", 'Шли долго… Бри спит.'],
    ["after '— '", 'Шли долго — Бри спит.'],
    ["after '– '", 'Шли долго – Бри спит.'],
  ])('initial: %s', (_label, text) => {
    expect(initialAt(text, 'Бри')).toBe(true);
  });

  it('an opening quote at text start -> initial', () => {
    expect(initialAt('«Держись левее», — буркнул он.', 'Держись')).toBe(true);
  });

  it("direct speech 'сказал: «Держись' -> initial (via the opening quote; there is no colon rule)", () => {
    expect(initialAt('Он сказал: «Держись левее».', 'Держись')).toBe(true);
  });

  it.each([
    ["after ', '", 'Шли долго, Бри спит.', 'Бри'],
    ["after '—' with no space ('—Бри')", 'Шли долго —Бри спит.', 'Бри'],
    ['a bare colon (no quote)', 'На камне знак: Око.', 'Око'],
    ['a colon then a CLOSING quote', 'знак: » Око', 'Око'],
    ["an in-word hyphen ('Дол-Гулдур')", 'Шли к Дол-Гулдур.', 'Гулдур'],
  ])('NOT initial: %s', (_label, text, word) => {
    expect(initialAt(text, word)).toBe(false);
  });
});

// Code points built at runtime so no invisible/decomposed literal sits in this source.
const THIN_SPACE = String.fromCodePoint(0x2009);
const COMBINING_BREVE = String.fromCodePoint(0x0306);
const COMBINING_DIAERESIS = String.fromCodePoint(0x0308);

describe('NF1 F1: closing punctuation, any \\p{Zs} and markdown emphasis are transparent', () => {
  it.each([
    ['closing » after ?', '«Кто там?» Тишина в ответ.', 'Тишина'],
    ['closing » after !', '«Тише!» Ветер стих.', 'Ветер'],
    ['closing ) after .', 'Шли долго. (Так бывает.) Потом стало легче.', 'Потом'],
    ['thin space after .', `Шли долго.${THIN_SPACE}Ветер стих.`, 'Ветер'],
    ['markdown emphasis .**', '**Шли долго.** Ветер стих.', 'Ветер'],
    ['markdown emphasis ._', '_Шли долго._ Ветер стих.', 'Ветер'],
  ])('%s -> sentence-initial, no nf1_name', (_label, prose, word) => {
    expect(initialAt(prose, word)).toBe(true);
    expect(scanUngroundedNames(prose, 'row.scene: пусто')).toEqual([]);
  });

  it('control: a closing quote after a word is not a boundary -- в трактире «Пони» Бри still checks Бри', () => {
    const prose = 'Ночевали в трактире «Пони» Бри, а утром ушли.';
    expect(initialAt(prose, 'Бри')).toBe(false);
    expect(scanUngroundedNames(prose, 'text: Пони').map((v) => v.term)).toEqual(['Бри']);
  });

});

const HYPHEN_MINUS = '-';
const HORIZONTAL_BAR = String.fromCodePoint(0x2015);
const FIGURE_DASH = String.fromCodePoint(0x2012);
const ZWSP = String.fromCodePoint(0x200b);
const LEFT_SINGLE_QUOTE = String.fromCodePoint(0x2018);
const RIGHT_SINGLE_QUOTE = String.fromCodePoint(0x2019);

describe('NF1 R1: any \\p{Pd} dash followed by whitespace is a dialogue boundary', () => {
  it.each([
    ['hyphen-minus', HYPHEN_MINUS],
    ['U+2015 horizontal bar', HORIZONTAL_BAR],
    ['U+2012 figure dash', FIGURE_DASH],
  ])('%s dialogue line -> no nf1_name', (_label, dash) => {
    const prose = `Шли долго.\n${dash} Молчи, ${dash} сказал он.`;
    expect(initialAt(prose, 'Молчи')).toBe(true);
    expect(scanUngroundedNames(prose, 'row.scene: пусто')).toEqual([]);
  });

  it("an in-word hyphen stays a non-boundary: 'Дол-Гулдур' checks 'Гулдур'", () => {
    const prose = 'Тропа вела к Дол-Гулдур, и там пахло дымом.';
    expect(scanUngroundedNames(prose, 'row.scene: пусто').map((v) => v.term)).toEqual(['Дол', 'Гулдур']);
  });
});

describe('NF1 R2: an opening quote is a boundary (embedded quotation)', () => {
  it.each([
    ['Он ответил коротким «Нет».', 'Нет'],
    ['Из темноты донеслось «Кто идёт?», и хоббит замер.', 'Кто'],
    ['Сказал он: «Нет». И «Ладно».', 'Ладно'],
  ])('%s -> no nf1_name', (prose, word) => {
    expect(initialAt(prose, word)).toBe(true);
    expect(scanUngroundedNames(prose, 'row.scene: пусто')).toEqual([]);
  });

  it("a bare colon is not a boundary: 'Шли долго: Ветер' still blocks 'Ветер'", () => {
    expect(scanUngroundedNames('Шли долго: Ветер стих.', 'row.scene: пусто').map((v) => v.term)).toEqual(['Ветер']);
  });

  it('KNOWN LIMIT (g): a quoted invented title right after an opening quote is NOT blocked (a documented miss)', () => {
    expect(scanUngroundedNames('Ночевали в трактире «Гарцующий пони» у тракта.', 'row.scene: пусто')).toEqual([]);
  });

  it('KNOWN LIMIT (h): a capitalized word opening a mid-sentence parenthesis IS blocked', () => {
    const prose = 'Он крикнул (Молчи!) и пригнулся.';
    expect(scanUngroundedNames(prose, 'row.scene: пусто').map((v) => v.term)).toEqual(['Молчи']);
  });
});

describe('NF1 nits: zero-width chars, single quotes, markdown heading', () => {
  it.each([
    ['zero-width space after a period', `Шли долго.${ZWSP}Ветер стих.`, 'Ветер'],
    ['‘Ветер’ after a period', `Шли долго. ${LEFT_SINGLE_QUOTE}Ветер${RIGHT_SINGLE_QUOTE} стих.`, 'Ветер'],
    ['‘ opening quote mid-sentence', `Он шепнул ${LEFT_SINGLE_QUOTE}Ветер${RIGHT_SINGLE_QUOTE} и умолк.`, 'Ветер'],
    ['# heading line', 'Шли долго.\n# Дорога\nПыль.', 'Дорога'],
  ])('%s -> no nf1_name', (_label, prose, word) => {
    expect(initialAt(prose, word)).toBe(true);
    expect(scanUngroundedNames(prose, 'row.scene: пусто')).toEqual([]);
  });
});

describe('NF1 NFC normalization', () => {
  it('a decomposed Й is still a candidate (checked, not skipped); offset is the original one', () => {
    const name = `И${COMBINING_BREVE}орк`; // decomposed 'Йорк'
    const prose = `Тропа вела к ${name}, и там пахло дымом.`;
    expect(scanUngroundedNames(prose, 'row.scene: пусто').map((v) => [v.term, v.index])).toEqual([
      [name, prose.indexOf(name)],
    ]);
    expect(scanUngroundedNames(prose, 'text: Йорк')).toEqual([]);
  });

  it('a decomposed ё in the prose grounds against the package (no false block)', () => {
    const prose = `Тропа вела мимо Те${COMBINING_DIAERESIS}много Леса.`;
    expect(scanUngroundedNames(prose, 'place: Тёмный Лес')).toEqual([]);
  });
});

describe('NF1 isGrounded (morphology table)', () => {
  it.each([
    ['text: Пригорье стоит на холме', 'Пригорья', true],
    ['row.scene: Одинокий охотник', 'Охотника', true],
    ['row.scene: Одинокий охотник', 'Одинокого', true],
    ['npc: Том Бомбадил', 'Тома', true],
    ['npc: Том Бомбадил', 'Бомбадила', true],
    ['place: Старый Лес', 'Старого', true],
    ['place: Мория', 'Морией', true],
    ['place: Озёрный край', 'Озерного', true],
    ['text: Бри', 'Бри', true],
    ['npc: Гэндальф', 'Гэндальфом', true],
    ['place: Пригорья', 'Пригорье', true],
    // F2: a 3-letter case ending on the PACKAGE side (symmetric bound).
    ['text: у Южного тракта', 'Южный', true],
    ['text: мимо Тёмного Леса', 'Тёмный', true],
    ['text: мимо Тёмного Леса', 'Тёмную', true],
    ['text: под Белыми Башнями', 'Белая', true],
    ['lore: опушка Старого Леса', 'Старый', true],
    ['row.scene: и в', 'Ивняк', false],
    ['text: Бриллиант', 'Бри', false],
    // A REAL L4 case (v0.3 j.wild.meeting): a looser prefix rule would ground this invention.
    ['row.scene: тёплый приют', 'Пригорья', false],
    ['text: Бри', 'Бриллианта', false],
  ] as const)('%s -> %s grounded=%s', (pkgText, token, expected) => {
    expect(isGrounded(token, groundingWords(pkgText))).toBe(expected);
  });

  it('KNOWN LIMIT (a): fleeting vowel -- npc: Орёл -> Орла is NOT grounded (a false block; documented, not fixed without corpus evidence)', () => {
    expect(isGrounded('Орла', groundingWords('npc: Орёл'))).toBe(false);
  });

  it('KNOWN LIMIT (f): row.scene: за пригорком ручей -> Пригорье IS grounded (shared stem within the bound; a miss, not a block)', () => {
    expect(isGrounded('Пригорье', groundingWords('row.scene: за пригорком ручей'))).toBe(true);
  });
});

describe('NF1 candidates (scanUngroundedNames)', () => {
  it('ALL-CAPS tokens and single letters are never candidates', () => {
    const prose = 'Шли всю ночь; в XIX главе бросок на БДИТЕЛЬНОСТЬ, а буква Ж стёрта.';
    expect(scanUngroundedNames(prose, 'row.scene: пусто')).toEqual([]);
  });

  it('a mid-sentence Titlecase Latin word is checked like any other', () => {
    const prose = 'Тропа вела к Bree, и там пахло дымом.';
    const v = scanUngroundedNames(prose, 'row.scene: пусто');
    expect(v).toEqual([
      {
        list: 'nf1_name',
        term: 'Bree',
        reason: 'capitalized name not grounded in the rendered package',
        severity: 'block',
        index: prose.indexOf('Bree'),
      },
    ]);
    expect(scanUngroundedNames(prose, 'text: Bree')).toEqual([]);
  });

  it('flags every ungrounded mid-sentence name, in offset order; sentence-initial ones are skipped', () => {
    const prose = 'Дорога от Пригорья тянулась. Мимо Бри и Тарбада.';
    expect(scanUngroundedNames(prose, 'text: Бри').map((v) => [v.term, v.index])).toEqual([
      ['Пригорья', prose.indexOf('Пригорья')],
      ['Тарбада', prose.indexOf('Тарбада')],
    ]);
  });
});

describe('NF1 relative backstory (warn)', () => {
  it('fires only with empty journal_facts', () => {
    const prose = 'Второй день шли без огня; накануне ели хлеб, а неделю назад был дождь.';
    const v = scanRelativeBackstory(prose, PKG);
    expect(v.map((x) => [x.term, x.index, x.severity, x.list])).toEqual([
      ['Второй день', 0, 'warn', 'nf1_backstory'],
      ['накануне', prose.indexOf('накануне'), 'warn', 'nf1_backstory'],
      ['неделю назад', prose.indexOf('неделю назад'), 'warn', 'nf1_backstory'],
    ]);
    expect(scanRelativeBackstory(prose, PKG_WITH_JOURNAL)).toEqual([]);
  });

  it('a comparison IS a warn (documented false class); a non-empty journal silences it', () => {
    const prose = 'Земля сырая, будто дождь тут шёл вчера.';
    expect(scanRelativeBackstory(prose, PKG).map((x) => x.term)).toEqual(['вчера']);
    expect(scanRelativeBackstory(prose, PKG_WITH_JOURNAL)).toEqual([]);
  });

  it('word-bounded; cardinal durations are not listed', () => {
    expect(scanRelativeBackstory('Позавчерашний хлеб; вчерашний след.', PKG).map((x) => x.term)).toEqual(['вчерашний']);
    expect(scanRelativeBackstory('Шли восемь дней, семь суток и две недели.', PKG)).toEqual([]);
  });

  it.each(['пять суток', 'шесть недель', 'девять суток', 'десять недель'])(
    'cardinals are excluded by construction: no warn for "%s"',
    (phrase) => {
      expect(scanRelativeBackstory(`Шли ${phrase} без огня.`, PKG)).toEqual([]);
    },
  );

  it.each(['пятые сутки', 'шестую неделю', 'третьи сутки', 'первый день', 'второго дня'])(
    'ordinals warn: "%s"',
    (phrase) => {
      expect(scanRelativeBackstory(`Шли ${phrase} без огня.`, PKG).map((x) => x.term)).toEqual([phrase]);
    },
  );

  const arrivalPkg = (daysTotal: number): NarrativePackage => ({
    ...PKG,
    journey: { days_delta: 0, arrived: true, days_total: daysTotal, travel_check: { outcome: 'weak' } },
  });
  const PKG_ARRIVAL = arrivalPkg(8);
  const PKG_MIDJOURNEY: NarrativePackage = { ...PKG, journey: { days_delta: 1, travel_check: { outcome: 'weak' } } };

  it('3.1-C3: an ordinal DAY phrase matching days_total is exempt on arrival (day or "сутки")', () => {
    expect(scanRelativeBackstory('Восьмой день пути остался позади.', PKG_ARRIVAL)).toEqual([]);
    expect(scanRelativeBackstory('Восьмые сутки пути остались позади.', PKG_ARRIVAL)).toEqual([]);
  });

  it('3.1-C3: an ordinal DAY phrase NOT matching days_total still warns on arrival', () => {
    expect(scanRelativeBackstory('Третий день пути.', PKG_ARRIVAL).map((x) => x.term)).toEqual(['Третий день']);
    expect(scanRelativeBackstory('Третьи сутки.', PKG_ARRIVAL).map((x) => x.term)).toEqual(['Третьи сутки']);
  });

  it('3.1-C3: a week phrase always warns on arrival, whatever days_total is', () => {
    expect(scanRelativeBackstory('Вторую неделю идём.', PKG_ARRIVAL).map((x) => x.term)).toEqual(['Вторую неделю']);
  });

  it('3.1-C3: the exemption tracks days_total exactly (arrival with days_total 3)', () => {
    expect(scanRelativeBackstory('Третий день пути.', arrivalPkg(3))).toEqual([]);
    expect(scanRelativeBackstory('Восьмой день пути.', arrivalPkg(3)).map((x) => x.term)).toEqual(['Восьмой день']);
  });

  it('3.1-C3: the same ordinal day phrase still warns without journey.days_total', () => {
    expect(scanRelativeBackstory('Восьмой день пути остался позади.', PKG).map((x) => x.term)).toEqual(['Восьмой день']);
    expect(scanRelativeBackstory('Второй день дорога шла под гору.', PKG_MIDJOURNEY).map((x) => x.term)).toEqual(['Второй день']);
  });

  it('3.1-C3: arrival exempts ONLY a matching ordinal-day phrase, not other backstory terms', () => {
    expect(scanRelativeBackstory('Накануне был дождь, а вчера — снег.', PKG_ARRIVAL).map((x) => x.term)).toEqual(['Накануне', 'вчера']);
  });

  it('3.1-C3: a cardinal day count never warns, arrival or not', () => {
    expect(scanRelativeBackstory('Восемь дней пути остались позади.', PKG_ARRIVAL)).toEqual([]);
    expect(scanRelativeBackstory('Восемь дней пути остались позади.', PKG)).toEqual([]);
  });
});

describe('NF1 scanTurnProse', () => {
  const vk = loadVkAddendumFromPack(packRoot);

  it('without a package it deep-equals scanProse for every calibration case (live VK addendum)', () => {
    for (const c of CALIBRATION_CASES) {
      expect(scanTurnProse(c.prose, vk, null)).toEqual(scanProse(c.prose, vk));
    }
  });

  it('with a package: scanProse first, then nf1_name, then nf1_backstory', () => {
    const prose = 'Второй день от Пригорья; герой теряет хиты.';
    const lists = scanTurnProse(prose, vk, PKG).map((v) => v.list);
    expect(lists).toEqual(['calque', 'nf1_name', 'nf1_backstory']);
  });
});
