import { describe, expect, it } from 'vitest';
import {
  hasBlockingSlop,
  scanMixedScript,
  scanProse,
  type StopEntry,
} from '../src/antislop.js';
import { CALIBRATION_CASES } from '../src/harness/cases.js';
import { DeterministicJudge } from '../src/harness/judge.js';
import { LlmJudge } from '../src/harness/llmJudge.js';
import type { LlmClient } from '../src/harness/types.js';
import { gateLoreChunkText } from '../src/lt1gate.js';

describe('anti-slop seed', () => {
  it('flags wrong-system calques as blocking', () => {
    const bad = 'Герой потерял все хиты и сделал спасбросок.';
    const v = scanProse(bad);
    const terms = v.map((x) => x.term);
    expect(terms).toContain('хиты');
    expect(terms).toContain('спасбросок');
    expect(v.every((x) => (x.term === 'хиты' || x.term === 'спасбросок' ? x.severity === 'block' : true))).toBe(true);
    expect(hasBlockingSlop(bad)).toBe(true);
  });

  it('flags generic prose cliches as warnings', () => {
    const bad = 'Время словно остановилось, и по спине пробежал холодок.';
    const v = scanProse(bad);
    expect(v.length).toBeGreaterThanOrEqual(2);
    expect(v.every((x) => x.severity === 'warn')).toBe(true);
    expect(hasBlockingSlop(bad)).toBe(false);
  });

  it('passes a clean sensory Tolkien-register sentence', () => {
    const good =
      'Дорога ныряла в орешник; под сапогами хрустел иней, и где-то впереди пахло дымом и мокрой шерстью.';
    expect(scanProse(good)).toEqual([]);
    expect(hasBlockingSlop(good)).toBe(false);
  });

  it('does not glue-match inside longer words (boundary check)', () => {
    // 'мана' must not fire inside 'кармана'; 'хиты' must not fire inside 'архитекторы'.
    const safe = 'Из кармана архитекторы достали карту.';
    expect(scanProse(safe)).toEqual([]);
  });

  it('folds the VK-addendum list (LT1) when provided, under its own list id', () => {
    // Simulates the pack-loaded tone.md stop-list arriving in chat 2.2/2.3.
    const vk: StopEntry[] = [
      { term: 'древнее зло пробуждается', reason: 'Middle-earth pastiche cliche' },
    ];
    const bad = 'И вот древнее зло пробуждается на востоке.';
    expect(scanProse(bad)).toEqual([]); // seed alone does not know VK pastiche
    const withVk = scanProse(bad, vk);
    expect(withVk).toHaveLength(1);
    expect(withVk[0]?.list).toBe('vk_addendum');
    expect(withVk[0]?.severity).toBe('block'); // no per-entry severity -> list default (block)
    expect(hasBlockingSlop(bad, vk)).toBe(true);
  });

  it('flags purple "abstract-mood" phrases as blocking (per-entry severity in SLOP_RU)', () => {
    const bad = 'Тишина давит, и атмосфера пронизана ожиданием.';
    const blocks = scanProse(bad).filter((x) => x.severity === 'block');
    expect(blocks.map((x) => x.term)).toEqual(
      expect.arrayContaining(['тишина давит', 'атмосфера пронизана']),
    );
    expect(hasBlockingSlop(bad)).toBe(true);
  });

  it('flags register parasites as WARN in their own bucket (never block)', () => {
    const bad = 'Данный путник, безусловно, является вестником.';
    const parasites = scanProse(bad).filter((x) => x.list === 'register_parasite');
    expect(parasites.map((x) => x.term)).toEqual(expect.arrayContaining(['данный', 'безусловно']));
    expect(parasites.some((x) => x.term === 'является')).toBe(false); // copula dropped: too frequent as warn
    expect(parasites.every((x) => x.severity === 'warn')).toBe(true);
    expect(hasBlockingSlop(bad)).toBe(false); // parasites are noisy/contextual -> never block
  });

  it('distinguishes purple "воздух наполнен напряжением" (block) from "воздух наполнился" (warn) by phrase', () => {
    const purple = scanProse('Воздух наполнен напряжением.');
    expect(purple.some((x) => x.term === 'воздух наполнен напряжением' && x.severity === 'block')).toBe(true);
    expect(purple.some((x) => x.term === 'воздух наполнился')).toBe(false); // not a substring

    const plain = scanProse('Воздух наполнился запахом хвои.');
    expect(plain.some((x) => x.term === 'воздух наполнился' && x.severity === 'warn')).toBe(true);
    expect(plain.some((x) => x.term === 'воздух наполнен напряжением')).toBe(false);
  });
});

describe('mixed_script: Latin + Cyrillic letters in one token (A4.1)', () => {
  // The live-transcript glitch: 'papo' in Latin letters glued to Cyrillic 'ротнике'.
  const GLITCH = 'papo' + 'ротнике'; // 'papo' is Latin (U+0070 U+0061 U+0070 U+006F)
  const PROSE = `Тропа нырнула в сырой ${GLITCH}, и под сапогом чавкнула глина.`;
  const OK_JSON = JSON.stringify({
    specificity: { score: 90, notes: 'x' },
    accuracy: { score: 90, notes: 'x' },
    playability: { score: 90, notes: 'x' },
    agency: { score: 90, notes: 'x' },
    tone: { score: 90, notes: 'x' },
    anti_slop: { score: 90, notes: 'x' },
  });

  it('flags the glitch token as exactly one block violation with its term and offset', () => {
    const v = scanProse(PROSE).filter((x) => x.list === 'mixed_script');
    expect(v).toEqual([
      {
        list: 'mixed_script',
        term: GLITCH,
        reason: 'Latin and Cyrillic letters in one token',
        severity: 'block',
        index: PROSE.indexOf(GLITCH),
      },
    ]);
    expect(hasBlockingSlop(PROSE)).toBe(true);
  });

  it('pure Cyrillic and Latin words standing alone among Cyrillic are fine', () => {
    for (const text of [
      'Под сапогом хрустнул ледок.',
      'XIX век',
      'PvP',
      'IT-специалист',
      'Бри/Bree',
      'Bree,Бри',
    ]) {
      expect(scanMixedScript(text), text).toEqual([]);
    }
  });

  it('digits belong to the token but count as neither script', () => {
    expect(scanMixedScript('d12')).toEqual([]);
    expect(scanMixedScript('к12')).toEqual([]);
    expect(scanMixedScript('бросок d12к')).toEqual([
      { list: 'mixed_script', term: 'd12к', reason: 'Latin and Cyrillic letters in one token', severity: 'block', index: 7 },
    ]);
  });

  it('a decomposed ё (е + combining diaeresis) inside a Cyrillic word is fine', () => {
    const decomposed = 'е\u0308';
    expect(decomposed.length).toBe(2);
    expect(scanMixedScript(`ещ${decomposed} тёмный`)).toEqual([]);
  });

  it('only LETTERS count toward a script: number forms and combining marks are neutral', () => {
    // U+216B ROMAN NUMERAL TWELVE is Script=Latin but a number (Nl), not a letter.
    expect(scanMixedScript('\u216Bвек')).toEqual([]);
    // U+0483 COMBINING CYRILLIC TITLO is Script=Cyrillic but a mark (Mn), not a letter.
    expect(scanMixedScript('ab' + '\u0483')).toEqual([]);
  });

  it('non-ASCII Latin letters count as Latin (precomposed and decomposed)', () => {
    const pre = '\u00E9льфов'; // e-acute precomposed (U+00E9) + Cyrillic
    expect(scanMixedScript(`Мир ${pre}`)).toEqual([
      { list: 'mixed_script', term: pre, reason: 'Latin and Cyrillic letters in one token', severity: 'block', index: 4 },
    ]);
    const dec = 'e\u0301льфов'; // e + combining acute (U+0301) + Cyrillic
    expect(scanMixedScript(`Мир ${dec}`)).toEqual([
      { list: 'mixed_script', term: dec, reason: 'Latin and Cyrillic letters in one token', severity: 'block', index: 4 },
    ]);
  });

  it('order pin: mixed_script is appended after every phrase list in scanProse', () => {
    const text = `Герой потерял все хиты в сыром ${GLITCH}.`;
    expect(scanProse(text).map((v) => v.list)).toEqual(['calque', 'mixed_script']);
  });

  it('two mixed tokens -> two violations in offset order', () => {
    const text = 'С\u006Fсна и берёз\u0061'; // Latin o (U+006F) and Latin a (U+0061) inside Cyrillic words
    const v = scanMixedScript(text);
    expect(v.map((x) => [x.term, x.index])).toEqual([
      ['С\u006Fсна', 0],
      ['берёз\u0061', 8],
    ]);
  });

  it('no calibration case trips mixed_script (the gate does not flip calibration)', () => {
    for (const c of CALIBRATION_CASES) {
      expect(scanMixedScript(c.prose), c.id).toEqual([]);
    }
  });

  it('integration: both judges fail the hard gate on the glitch', async () => {
    const det = await new DeterministicJudge().score(PROSE, {});
    expect(det.pass).toBe(false);
    expect(det.antiSlop.blocking).toBe(true);
    expect(det.axes.anti_slop.score).toBe(0);

    const llm: LlmClient = { complete: () => Promise.resolve(OK_JSON) };
    const judged = await new LlmJudge({ llm, model: 'm', systemPrompt: 's' }).score(PROSE, {});
    expect(judged.pass).toBe(false);
    expect(judged.antiSlop.blocking).toBe(true);
  });

  it('LT1: the lore gate blocks a chunk with the glitch (through scanProse)', () => {
    const v = gateLoreChunkText(PROSE, []);
    expect(v.blocking).toBe(true);
    expect(v.pass).toBe(false);
    expect(v.antiSlop.some((x) => x.list === 'mixed_script' && x.term === GLITCH)).toBe(true);
  });
});
