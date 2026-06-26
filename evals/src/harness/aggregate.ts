import type { AggregateFn, RubricAxis } from './types.js';

const AXES: readonly RubricAxis[] = [
  'specificity',
  'accuracy',
  'playability',
  'agency',
  'tone',
  'anti_slop',
];

/**
 * PROVISIONAL aggregate: mean of the six axis scores, gate at 80 (arch sec 0.7 line 123).
 * Naive ON PURPOSE -- a catastrophe on one axis (e.g. tone=10) is masked by the average.
 * Calibration is expected to swap this for a mean+floor (reject if any axis < floor) or a
 * weighted rule. It is a single pluggable function so that swap never touches the judge.
 *
 * SUITE FORWARD-NOTE: an error-Verdict (LLM unparseable/refused -> aggregate=null, error set)
 * is NOT a score-0 result. The future suite pass-rate must EXCLUDE or FLAG error-verdicts
 * ("eval errored, re-run"), never fold them in as a failing 0 -- a parse glitch must not tank
 * the pass-rate. The aggregate only ever sees fully-scored axes (it is never called on error).
 */
export const aggregateMean: AggregateFn = (scores) => {
  const vals = AXES.map((a) => scores[a]);
  const score = Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length);
  return {
    score,
    threshold: 80,
    pass: score >= 80,
    rule: 'mean(6)>=80 (PROVISIONAL: calibration likely adds a per-axis floor)',
  };
};
