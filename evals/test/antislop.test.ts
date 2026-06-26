import { describe, expect, it } from 'vitest';
import {
  hasBlockingSlop,
  scanProse,
  type StopEntry,
} from '../src/antislop.js';

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
    expect(withVk[0]?.severity).toBe('block');
    expect(hasBlockingSlop(bad, vk)).toBe(true);
  });
});
