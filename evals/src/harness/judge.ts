import { scanProse } from '../antislop.js';
import type { AxisScore, Judge, JudgeContext, RubricAxis, Verdict } from './types.js';

function pending(): AxisScore {
  return { status: 'pending', score: null, notes: 'awaits LLM judge (chat 2.4)' };
}

/**
 * Deterministic judge. Fills the anti-slop axis NOW by reusing scanProse (the same engine
 * the lore gate uses) and surfaces a length-budget WARN. The other five rubric axes --
 * specificity, accuracy, playability, agency, tone -- are PENDING until the LLM judge in
 * chat 2.4; tone also waits for tone.md activation. The Verdict already carries all six,
 * so 2.4 fills slots instead of reshaping it.
 *
 * Budget is a WARN, never a block: the hard gate is anti-slop block-cleanliness, which
 * does not depend on any provisional length/token calibration.
 *
 * RECONCILE 6: at 2.4 the LLM judge REPLACES the anti_slop axis with a nuanced score --
 * it does not stack on top of this deterministic 0/100 (no double-counting one axis).
 * RECONCILE 7 (aggregation guard): this judge computes NO aggregate >=80 verdict -- five
 * axes are 'pending', and an aggregate is assembled only once all six are 'scored' (2.4).
 *
 * DIVISION OF LABOUR (do not blur): deterministic = high-confidence EXACT phrases, cheap.
 * Morphology, voice, register, and nuance are the LLM judge's job -- do NOT add stemming /
 * lemmatization to the seed (a rabbit hole). The seed missing an inflected form (e.g.
 * "эпической битве" vs the seeded "эпическая битва") is BY DESIGN; the LLM catches it.
 *
 * Returns NO aggregate/error keys -- those belong to the LLM judge. Keeping this shape
 * unchanged is what keeps the harness golden byte-stable.
 */
export class DeterministicJudge implements Judge {
  // eslint-disable-next-line @typescript-eslint/require-await
  async score(prose: string, ctx: JudgeContext): Promise<Verdict> {
    const vk = ctx.vkAddendum ?? null;
    const violations = scanProse(prose, vk);
    const blocking = violations.some((v) => v.severity === 'block');

    const lt = ctx.lengthTarget ?? null;
    const budgetWarn = lt !== null && (prose.length < lt.minChars || prose.length > lt.maxChars);

    const antiSlop: AxisScore = {
      status: 'scored',
      score: blocking ? 0 : 100,
      notes: `${violations.length} violation(s), blocking=${blocking}`,
    };

    const axes: Record<RubricAxis, AxisScore> = {
      specificity: pending(),
      accuracy: pending(),
      playability: pending(),
      agency: pending(),
      tone: pending(),
      anti_slop: antiSlop,
    };

    return { axes, antiSlop: { violations, blocking }, budgetWarn, pass: !blocking };
  }
}
