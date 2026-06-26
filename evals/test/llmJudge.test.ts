import { describe, expect, it } from 'vitest';
import { aggregateMean } from '../src/harness/aggregate.js';
import { LlmJudge } from '../src/harness/llmJudge.js';
import type { JudgeContext, LlmClient, LlmRequest } from '../src/harness/types.js';

class MockLlm implements LlmClient {
  readonly calls: LlmRequest[] = [];
  constructor(private readonly responder: (req: LlmRequest) => string) {}
  complete(req: LlmRequest): Promise<string> {
    this.calls.push(req);
    return Promise.resolve(this.responder(req));
  }
}

// mean(85,90,80,88,84,92) = 519/6 = 86.5 -> Math.round = 87
const OK_JSON = JSON.stringify({
  specificity: { score: 85, notes: 'concrete' },
  accuracy: { score: 90, notes: 'matches package' },
  playability: { score: 80, notes: 'ok' },
  agency: { score: 88, notes: 'ok' },
  tone: { score: 84, notes: 'in register' },
  anti_slop: { score: 92, notes: 'clean' },
});

const CLEAN = 'Тропа вильнула к ольшанику; под сапогом хрустнул ледок.';
const ctx: JudgeContext = {};

describe('LlmJudge plumbing (mock client; no key/network)', () => {
  it('assembles the request: model + injected system + prose in user', async () => {
    const llm = new MockLlm(() => OK_JSON);
    const judge = new LlmJudge({ llm, model: 'test-model', systemPrompt: 'STUB-RUBRIC' });
    await judge.score(CLEAN, ctx);
    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0]?.model).toBe('test-model');
    expect(llm.calls[0]?.system).toBe('STUB-RUBRIC');
    expect(llm.calls[0]?.user).toContain(CLEAN);
  });

  it('parses a valid response into 6 scored axes + aggregate', async () => {
    const judge = new LlmJudge({ llm: new MockLlm(() => OK_JSON), model: 'm', systemPrompt: 's' });
    const v = await judge.score(CLEAN, ctx);
    expect(Object.values(v.axes).every((a) => a.status === 'scored')).toBe(true);
    expect(v.axes.tone.score).toBe(84);
    expect(v.aggregate?.score).toBe(87);
    expect(v.aggregate?.pass).toBe(true);
    expect(v.pass).toBe(true); // deterministic block-clean hard gate
    expect(v.error ?? null).toBeNull();
  });

  it('returns an error-Verdict (not throw, not silent pass) on invalid JSON', async () => {
    const judge = new LlmJudge({ llm: new MockLlm(() => 'not json {{{'), model: 'm', systemPrompt: 's' });
    const v = await judge.score(CLEAN, ctx);
    expect(v.error).toBeTruthy();
    expect(v.aggregate ?? null).toBeNull();
    expect(Object.values(v.axes).every((a) => a.status === 'error')).toBe(true);
    expect(v.pass).toBe(false);
  });

  it('returns an error-Verdict on schema mismatch (out-of-range score)', async () => {
    const bad = JSON.stringify({ ...JSON.parse(OK_JSON), tone: { score: 150, notes: 'x' } });
    const judge = new LlmJudge({ llm: new MockLlm(() => bad), model: 'm', systemPrompt: 's' });
    const v = await judge.score(CLEAN, ctx);
    expect(v.error).toBeTruthy();
    expect(v.aggregate ?? null).toBeNull();
  });

  it('returns an error-Verdict when the llm call throws', async () => {
    const judge = new LlmJudge({
      llm: new MockLlm(() => {
        throw new Error('boom');
      }),
      model: 'm',
      systemPrompt: 's',
    });
    const v = await judge.score(CLEAN, ctx);
    expect(v.error).toContain('llm call failed');
    expect(v.aggregate ?? null).toBeNull();
  });

  it('short-circuit OFF (default): scores block-caught prose via the LLM (calibration-critical)', async () => {
    const bad = 'Герой теряет хиты.'; // deterministic block (calque)
    const llm = new MockLlm(() => OK_JSON);
    const judge = new LlmJudge({ llm, model: 'm', systemPrompt: 's' }); // shortCircuit default false
    const v = await judge.score(bad, ctx);
    expect(llm.calls).toHaveLength(1); // LLM WAS called despite the deterministic block
    expect(v.aggregate?.score).toBe(87);
    expect(v.antiSlop.blocking).toBe(true);
  });

  it('short-circuit ON: skips the LLM on a deterministic block (production token-saver)', async () => {
    const bad = 'Герой теряет хиты.';
    const llm = new MockLlm(() => OK_JSON);
    const judge = new LlmJudge({ llm, model: 'm', systemPrompt: 's', shortCircuit: true });
    const v = await judge.score(bad, ctx);
    expect(llm.calls).toHaveLength(0); // LLM NOT called
    expect(v.aggregate ?? null).toBeNull();
    expect(v.pass).toBe(false);
    expect(v.axes.anti_slop.score).toBe(0);
  });

  it('REGRESSION: a deterministic block scores the anti_slop axis, NOT tone', async () => {
    // Guards the fixed blockedAxes bug where the block 0 landed on `tone` instead of `anti_slop`.
    const judge = new LlmJudge({ llm: new MockLlm(() => OK_JSON), model: 'm', systemPrompt: 's', shortCircuit: true });
    const v = await judge.score('Герой теряет хиты.', ctx);
    expect(v.axes.anti_slop.status).toBe('scored');
    expect(v.axes.anti_slop.score).toBe(0);
    expect(v.axes.tone.status).toBe('pending'); // tone must NOT be the one scored 0
    expect(v.axes.tone.score).toBeNull();
  });

  it('aggregate is pluggable (swap the rule without touching the judge)', async () => {
    const constLow = () => ({ score: 10, threshold: 80, pass: false, rule: 'test-const' });
    const judge = new LlmJudge({ llm: new MockLlm(() => OK_JSON), model: 'm', systemPrompt: 's', aggregate: constLow });
    const v = await judge.score(CLEAN, ctx);
    expect(v.aggregate?.score).toBe(10);
    expect(v.aggregate?.rule).toBe('test-const');
  });

  it('mean aggregate matches the helper', () => {
    expect(
      aggregateMean({ specificity: 85, accuracy: 90, playability: 80, agency: 88, tone: 84, anti_slop: 92 }).score,
    ).toBe(87);
  });
});
