// Sentence release behind the gate (release.ts, 3.3a-K3): segmentation rules, the gate (stop for
// good on the first block), the monotonicity guard, and corpus properties over the 58 recorded
// Keeper proses with their recorded packages (read as data via ./corpus.ts). Offline.
import type { NarrativePackage } from '@brodyazhnik/orchestrator';
import { describe, expect, it } from 'vitest';
import type { ListId, Violation } from '../src/antislop.js';
import { scanTurnProse } from '../src/grounding.js';
import { LIST_MONOTONE, assertBlockListsMonotone, createSentenceRelease, splitSentences } from '../src/release.js';
import { loadVkAddendumFromPack } from '../src/vkAddendum.js';
import { loadCorpus, packRoot } from './corpus.js';

const PKG: NarrativePackage = { intent: 'journey', scene: 'journey', length_target: { min_chars: 400, max_chars: 800 } };
const hasBlock = (v: readonly Violation[]): boolean => v.some((x) => x.severity === 'block');

/** Feed `chunks` through a release. `emitted`: the units each push() returned; `flat`: every
 *  released unit in order -- the push() units plus the tail finish() released (finish() returns
 *  the result only; the tail is what `released` holds beyond the pushed units). */
function run(chunks: readonly string[], vk: Parameters<typeof createSentenceRelease>[0] = null, pkg: NarrativePackage | null = null) {
  const r = createSentenceRelease(vk, pkg);
  const emitted: string[][] = chunks.map((c) => [...r.push(c)]);
  const result = r.finish();
  const pushed = emitted.flat();
  const pushedLen = pushed.join('').length;
  expect(result.released.startsWith(pushed.join(''))).toBe(true);
  const flat = result.released.length > pushedLen ? [...pushed, result.released.slice(pushedLen)] : pushed;
  return { emitted, flat, result };
}

describe('segmentation rules', () => {
  it.each<[string, string, string[]]>([
    ['rule 1: . ! ? followed by a space', 'Ветер стих. Ты идёшь! Куда?', ['Ветер стих.', ' Ты идёшь!', ' Куда?']],
    ['rule 1: a run ?! is one boundary', 'Кто там?! Тишина.', ['Кто там?!', ' Тишина.']],
    ['rule 1: closing guillemet after !', '«Стой!» Он замер.', ['«Стой!»', ' Он замер.']],
    ['rule 1: !», does not split', '«Стой!», — сказал он. Ты ждёшь.', ['«Стой!», — сказал он.', ' Ты ждёшь.']],
    ['rule 1: closing bracket and straight quote', '(Так бывает.) Потом "тишина." Ветер.', ['(Так бывает.)', ' Потом "тишина."', ' Ветер.']],
    ['rule 1: the ellipsis char and "..."', 'Тишина… Ты ждёшь... Ничего.', ['Тишина…', ' Ты ждёшь...', ' Ничего.']],
    ['rule 1: 3.5 and т.е. without a following space', 'Шли 3.5 версты, т.е.долго. Ты устал.', ['Шли 3.5 версты, т.е.долго.', ' Ты устал.']],
    ['rule 1: a mid-sentence dash is not a dialogue line', 'Ты стоишь — ветер. Тишина.', ['Ты стоишь — ветер.', ' Тишина.']],
    ['rule 2: a newline without a terminator', 'Ветер стих\nТы идёшь', ['Ветер стих', '\nТы идёшь']],
    ['rule 2: blank lines and CRLF belong to the next unit', 'Ветер.\r\n\r\nТишина', ['Ветер.', '\r\n\r\nТишина']],
    ['rule 2: U+2028 is a line terminator', 'Ветер Тишина', ['Ветер', ' Тишина']],
    [
      'rule 3: a dialogue line with several sentences is one unit',
      'Ты ждёшь.\n— Стой! Кто идёт? Назовись.\nТишина. Ветер.',
      ['Ты ждёшь.', '\n— Стой! Кто идёт? Назовись.', '\nТишина.', ' Ветер.'],
    ],
    ['rule 3: en dash and hyphen after leading spaces, at the end of text', 'Ты ждёшь.\n  – А. Б.\n\t- В? Г.', ['Ты ждёшь.', '\n  – А. Б.', '\n\t- В? Г.']],
    ['rule 3: the whole text a dialogue line', '— Стой. Кто идёт?', ['— Стой. Кто идёт?']],
    ['rule 4: leading and trailing whitespace dropped', '  \n Ветер. Тишина.  \n ', ['Ветер.', ' Тишина.']],
    ['rule 4: a tail without a terminator is the last unit', 'Ветер. Тишина', ['Ветер.', ' Тишина']],
    ['empty and whitespace-only text: no unit', ' \n\t ', []],
  ])('%s', (_label, text, units) => {
    expect(splitSentences(text)).toEqual(units);
    const { flat, result } = run([text]);
    expect(flat).toEqual(units);
    expect(result.released).toBe(text.trim());
    expect(result.stoppedAt).toBeNull();
  });

  it('a punctuation run at the buffer end waits for the next delta', () => {
    const r = createSentenceRelease(null, null);
    expect(r.push('  Ветер стих.')).toEqual([]);
    expect(r.push('»')).toEqual([]);
    expect(r.push(' Ты')).toEqual(['Ветер стих.»']);
    expect(r.push(' идёшь.')).toEqual([]);
    expect(r.push(',')).toEqual([]); // `.,` -- no boundary after all
    expect(r.push(' да. ')).toEqual([' Ты идёшь., да.']);
    expect(r.finish()).toEqual({ verdict: [], released: 'Ветер стих.» Ты идёшь., да.', stoppedAt: null });
  });

  it('the units do not depend on chunking (one char per delta)', () => {
    const text = '«Стой!», — сказал он.\n— Кто? Где.\nТы ждёшь... Тишина…  ';
    expect(run([...text]).flat).toEqual(splitSentences(text));
  });

  it('push after finish and a second finish throw', () => {
    const r = createSentenceRelease(null, null);
    r.finish();
    expect(() => r.push('x')).toThrow('push() after finish()');
    expect(() => r.finish()).toThrow('finish() called twice');
  });
});

describe('the gate', () => {
  it('a block in the middle stops the release for good; later clean units are withheld', () => {
    const text = 'Ты идёшь. Вокруг хиты. Ты ждёшь. Тишина.';
    const { emitted, flat, result } = run(['Ты идёшь. Вок', 'руг хиты. Ты ждёшь.', ' Тишина.']);
    expect(emitted).toHaveLength(3);
    expect(emitted).toEqual([['Ты идёшь.'], [], []]);
    expect(flat).toEqual(['Ты идёшь.']);
    expect(result.released).toBe('Ты идёшь.');
    expect(result.stoppedAt).toBe('Ты идёшь.'.length);
    expect(text.slice(result.stoppedAt ?? 0)).toBe(' Вокруг хиты. Ты ждёшь. Тишина.');
    expect(result.verdict).toEqual(scanTurnProse(text, null, null));
    expect(result.verdict).toEqual([expect.objectContaining({ list: 'calque', term: 'хиты', severity: 'block' })]);
  });

  it('the gate is cumulative: a second SA1 pronoun in a later unit stops there', () => {
    const text = 'Вы идёте. Ветер стих. Ветер толкает вас. Тишина.';
    const { flat, result } = run([text], null, PKG);
    expect(flat).toEqual(['Вы идёте.', ' Ветер стих.']);
    expect(result.stoppedAt).toBe('Вы идёте. Ветер стих.'.length);
    expect(result.verdict).toEqual([expect.objectContaining({ list: 'sa1_plural', severity: 'block' })]);
  });

  it('a warn never stops the release', () => {
    const text = 'Ты идёшь. Между вами и рекой камыш.';
    const { flat, result } = run([text], null, PKG);
    expect(flat.join('')).toBe(text);
    expect(result.stoppedAt).toBeNull();
    expect(result.verdict.map((v) => v.severity)).toEqual(['warn']);
  });

  it('a block in the first unit releases nothing (stoppedAt 0)', () => {
    const { flat, result } = run(['  Хиты кончились. Ты идёшь.'], null, null);
    expect(flat).toEqual([]);
    expect(result).toMatchObject({ released: '', stoppedAt: 0 });
  });
});

describe('monotonicity guard', () => {
  it('every current list is marked monotone, so the guard passes', () => {
    expect(Object.values(LIST_MONOTONE).every((m) => m)).toBe(true);
    expect(() => assertBlockListsMonotone(LIST_MONOTONE)).not.toThrow();
  });

  it('a table with a false entry makes the guard throw, naming the list', () => {
    const table: Readonly<Record<ListId, boolean>> = { ...LIST_MONOTONE, nf1_name: false, sa1_plural: false };
    expect(() => assertBlockListsMonotone(table)).toThrow(/refused.*nf1_name, sa1_plural/);
  });
});

/** mulberry32 -- a tiny seeded PRNG local to this test (no engine import). */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random split of `text` into 1..24 chunks (cut points uniform over the code units). */
function randomSplit(text: string, rnd: () => number): string[] {
  const cuts = new Set<number>();
  const n = 1 + Math.floor(rnd() * 24);
  for (let k = 0; k < n; k++) cuts.add(Math.floor(rnd() * (text.length + 1)));
  const sorted = [...cuts].sort((x, y) => x - y);
  const out: string[] = [];
  let prev = 0;
  for (const c of [...sorted, text.length]) {
    out.push(text.slice(prev, c));
    prev = c;
  }
  return out;
}

describe('corpus (58 recorded proses with their packages)', () => {
  const corpus = loadCorpus();
  const vk = loadVkAddendumFromPack(packRoot);
  const SPLITS = 20;

  it('monotonicity: a block in a prefix ending at any boundary => a block in the full prose', () => {
    expect(corpus).toHaveLength(58);
    let boundaries = 0;
    let blockedPrefixes = 0;
    const violations: string[] = [];
    for (const c of corpus) {
      const full = c.prose.trim();
      const units = splitSentences(c.prose);
      expect(units.join('')).toBe(full);
      const fullBlocked = hasBlock(scanTurnProse(full, vk, c.pkg));
      let prefix = '';
      for (const u of units.slice(0, -1)) {
        prefix += u;
        boundaries++;
        if (hasBlock(scanTurnProse(prefix, vk, c.pkg))) {
          blockedPrefixes++;
          if (!fullBlocked) violations.push(`${c.id} @${prefix.length}`);
        }
      }
    }
    console.info(`release monotonicity: ${corpus.length} proses, ${boundaries} boundaries checked, ${blockedPrefixes} blocked prefixes`);
    expect(violations).toEqual([]);
    expect({ boundaries, blockedPrefixes }).toEqual({ boundaries: 532, blockedPrefixes: 38 }); // pinned: a segmentation change shows here
  });

  it(`properties over ${SPLITS} seeded random splits + one char-per-delta split of each prose`, () => {
    let runs = 0;
    let stopped = 0;
    for (const [n, c] of corpus.entries()) {
      const full = c.prose.trim();
      const verdict = scanTurnProse(full, vk, c.pkg);
      const rnd = prng(0x5eed + n);
      const splits = [...Array.from({ length: SPLITS }, () => randomSplit(c.prose, rnd)), [...c.prose]];
      let units: string[] | null = null;
      for (const chunks of splits) {
        expect(chunks.join('')).toBe(c.prose);
        const { flat, result } = run(chunks, vk, c.pkg);
        runs++;
        expect(flat.join('')).toBe(result.released);
        expect(full.startsWith(result.released)).toBe(true);
        expect(hasBlock(scanTurnProse(result.released, vk, c.pkg))).toBe(false);
        expect(result.verdict).toStrictEqual(verdict);
        expect(result.stoppedAt !== null).toBe(hasBlock(verdict));
        if (result.stoppedAt === null) expect(result.released).toBe(full);
        else expect(result.stoppedAt).toBe(result.released.length);
        if (units === null) units = flat;
        else expect(flat).toStrictEqual(units);
      }
      if (hasBlock(verdict)) stopped++;
    }
    console.info(`release properties: ${runs} runs over ${corpus.length} proses, ${stopped} proses stopped`);
    expect(stopped).toBe(5);
  }, 120_000);
});
