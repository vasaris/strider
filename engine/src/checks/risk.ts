import type { CheckConfig } from "./config.js";
import type { RiskDegree, RiskDegreeSpec } from "./types.js";

/**
 * Failure shape for a given risk degree (kv.solo.risk_degrees). The risk degree
 * is an input here: choosing it when uncertain uses the answers oracle and is
 * wired in once the Oracles subsystem exists. Until then callers pass an
 * explicit degree (defaultRisk when none applies).
 *
 * The returned failureResult is opaque pack content for the narrative layer;
 * the engine does not branch on its prose.
 */
export function failureOutcome(degree: RiskDegree, cfg: CheckConfig): RiskDegreeSpec {
  const spec = cfg.riskDegrees.find((r) => r.key === degree);
  if (spec === undefined) {
    throw new Error(`failureOutcome: risk degree "${degree}" not present in config`);
  }
  return spec;
}
