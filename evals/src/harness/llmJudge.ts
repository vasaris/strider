import { z } from 'zod';
import { scanProse } from '../antislop.js';
import { aggregateMean } from './aggregate.js';
import type {
  AggregateFn,
  AxisScore,
  Judge,
  JudgeContext,
  LlmClient,
  RubricAxis,
  Verdict,
} from './types.js';

// Zod schema for the LLM's rubric output. parse() + Zod (the chosen mechanism); on any
// parse/shape failure the judge returns an ERROR verdict -- it never throws or silently
// passes. If messages.parse()+Zod proves unstable in the pinned SDK at calibration, the
// real LlmClient can fall back to tool-use or prompted-JSON; this validation stays here.
const AxisOut = z.object({ score: z.number().min(0).max(100), notes: z.string() });
const LlmOutputSchema = z.object({
  specificity: AxisOut,
  accuracy: AxisOut,
  playability: AxisOut,
  agency: AxisOut,
  tone: AxisOut,
  anti_slop: AxisOut,
});
type LlmOutput = z.infer<typeof LlmOutputSchema>;

export interface LlmJudgeConfig {
  readonly llm: LlmClient;
  /** Model id -- CONFIG, not hardcoded in judge logic (claude-opus-4-8 at wiring; swappable
   *  by calibration/cost). */
  readonly model: string;
  /** Rubric (arch sec 0.7) + activated tone.md, assembled by the caller. */
  readonly systemPrompt: string;
  /** Production token-saver: skip the LLM when the deterministic pre-gate already blocks.
   *  DEFAULT false, and MUST be false at few-shot calibration -- otherwise the LLM never
   *  sees block-caught bad examples and we cannot prove the LLM (not just regex) rejects them. */
  readonly shortCircuit?: boolean;
  /** Pluggable aggregate (default mean). */
  readonly aggregate?: AggregateFn;
}

export function buildJudgeUser(prose: string): string {
  return `Оцени эту прозу Хранителя по рубрике. Верни ТОЛЬКО JSON по схеме (6 осей, score 0..100, notes).\n\nПРОЗА:\n${prose}`;
}

/**
 * The tone-judge (the "AnthropicJudge" role) -- provider-agnostic: the Anthropic call lives
 * behind the injected LlmClient (mock now, real at calibration), symmetric with the Keeper
 * seam. Fills all six rubric axes from the model (incl. a NUANCED anti_slop that REPLACES
 * the deterministic 0/100 -- RECONCILE 6) and computes the >=80 aggregate (RECONCILE 7: only
 * when all six are scored). `pass` stays the deterministic block-clean hard gate;
 * `aggregate.pass` is the >=80 rubric verdict.
 */
export class LlmJudge implements Judge {
  private readonly aggregate: AggregateFn;

  constructor(private readonly cfg: LlmJudgeConfig) {
    this.aggregate = cfg.aggregate ?? aggregateMean;
  }

  async score(prose: string, ctx: JudgeContext): Promise<Verdict> {
    const vk = ctx.vkAddendum ?? null;
    const violations = scanProse(prose, vk);
    const blocking = violations.some((v) => v.severity === 'block');
    const lt = ctx.lengthTarget ?? null;
    const budgetWarn = lt !== null && (prose.length < lt.minChars || prose.length > lt.maxChars);
    const antiSlop: Verdict['antiSlop'] = { violations, blocking };

    if (this.cfg.shortCircuit && blocking) {
      return { axes: blockedAxes(), antiSlop, budgetWarn, pass: false, aggregate: null };
    }

    let raw: string;
    try {
      raw = await this.cfg.llm.complete({
        model: this.cfg.model,
        system: this.cfg.systemPrompt,
        user: buildJudgeUser(prose),
      });
    } catch (e) {
      return errorVerdict(`llm call failed: ${String(e)}`, antiSlop, budgetWarn);
    }

    const parsed = parseLlmOutput(raw);
    if (!parsed.ok) {
      return errorVerdict(parsed.error, antiSlop, budgetWarn);
    }

    const o = parsed.value;
    const scores: Record<RubricAxis, number> = {
      specificity: o.specificity.score,
      accuracy: o.accuracy.score,
      playability: o.playability.score,
      agency: o.agency.score,
      tone: o.tone.score,
      anti_slop: o.anti_slop.score,
    };
    return { axes: scoredAxes(o), antiSlop, budgetWarn, pass: !blocking, aggregate: this.aggregate(scores) };
  }
}

function parseLlmOutput(raw: string): { ok: true; value: LlmOutput } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'llm output is not valid JSON' };
  }
  const r = LlmOutputSchema.safeParse(json);
  if (!r.success) {
    return { ok: false, error: `llm output failed schema: ${r.error.issues[0]?.message ?? 'invalid'}` };
  }
  return { ok: true, value: r.data };
}

function scoredAxes(o: LlmOutput): Record<RubricAxis, AxisScore> {
  const mk = (a: { score: number; notes: string }): AxisScore => ({ status: 'scored', score: a.score, notes: a.notes });
  return {
    specificity: mk(o.specificity),
    accuracy: mk(o.accuracy),
    playability: mk(o.playability),
    agency: mk(o.agency),
    tone: mk(o.tone),
    anti_slop: mk(o.anti_slop),
  };
}

function blockedAxes(): Record<RubricAxis, AxisScore> {
  const pend = (): AxisScore => ({ status: 'pending', score: null, notes: 'short-circuited before LLM (production)' });
  return {
    specificity: pend(),
    accuracy: pend(),
    playability: pend(),
    agency: pend(),
    tone: pend(),
    anti_slop: { status: 'scored', score: 0, notes: 'short-circuited: deterministic block (production)' },
  };
}

function errorVerdict(message: string, antiSlop: Verdict['antiSlop'], budgetWarn: boolean): Verdict {
  const err = (): AxisScore => ({ status: 'error', score: null, notes: message });
  return {
    axes: {
      specificity: err(),
      accuracy: err(),
      playability: err(),
      agency: err(),
      tone: err(),
      anti_slop: err(),
    },
    antiSlop,
    budgetWarn,
    pass: false,
    aggregate: null,
    error: message,
  };
}

// AnthropicLlmClient -> calibration (slot, not built here): a concrete LlmClient that wraps
// `@anthropic-ai/sdk` (client.messages.create / .parse) with model=claude-opus-4-8 and returns
// the rubric JSON text. It needs an API key + network, so it is wired at the live calibration
// step, not in this offline plumbing. The mock LlmClient in the tests stands in for it now.
