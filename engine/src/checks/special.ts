import type { CheckConfig } from "./config.js";
import type { CheckResult, SpecialSuccessOption } from "./types.js";

/**
 * The solo special-success menu (kv.solo.special_successes). Spending an icon on
 * one of these does NOT lower the numeric result or the degree
 * (checks.special_successes), so the same icons both set the degree and remain
 * spendable here.
 */
export function specialSuccessOptions(cfg: CheckConfig): readonly SpecialSuccessOption[] {
  return cfg.specialSuccesses;
}

/** Icons available to spend on special successes: one per rolled success icon. */
export function spendableIcons(result: CheckResult): number {
  return result.successIcons;
}
