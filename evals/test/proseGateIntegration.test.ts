// prose-gate x evals integration (moved out of prose-gate's antislop/grounding tests in
// chat 3.2, K2): the cases that need the evals harness (calibration cases, judges, LT1 lore
// gate). prose-gate must not depend on evals, so they live here. Offline.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadVkAddendumFromPack, scanMixedScript, scanProse, scanTurnProse } from '@brodyazhnik/prose-gate';
import { CALIBRATION_CASES } from '../src/harness/cases.js';
import { DeterministicJudge } from '../src/harness/judge.js';
import { LlmJudge } from '../src/harness/llmJudge.js';
import type { LlmClient } from '../src/harness/types.js';
import { gateLoreChunkText } from '../src/lt1gate.js';

const packRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'content-packs/kv');

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

describe('NF1 scanTurnProse', () => {
  const vk = loadVkAddendumFromPack(packRoot);

  it('without a package it deep-equals scanProse for every calibration case (live VK addendum)', () => {
    for (const c of CALIBRATION_CASES) {
      expect(scanTurnProse(c.prose, vk, null)).toEqual(scanProse(c.prose, vk));
    }
  });
});
