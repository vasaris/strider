/**
 * The Fellowship Phase driver: one between-adventures phase, sequencing the
 * deterministic steps in book order. Mirror of runProgression / runCouncil, and
 * RNG-free like runProgression (the Fellowship Phase rolls no dice). This is the
 * Stage-1 closer: it wraps the growth primitives rather than re-implementing
 * them.
 *
 * Order matters: spiritual recovery first (Hope / Shadow), then the Yule extras
 * (the bonus skill points must be credited to the experience pool BEFORE the
 * improve-stats step spends it), then improve-stats by delegating to the already
 * built Progression driver, then undertaking selection. The improve-stats step
 * is `runProgression` (earn from milestones -> spend the plan -> advance the
 * Shadow Path per bout of madness); the Fellowship Phase does not duplicate any
 * of it.
 */

import type { HeroState } from "../hero/state.js";
import { runProgression } from "../progression/runProgression.js";
import type { ProgressionConfig } from "../progression/types.js";
import { applySpiritualRecovery } from "./recovery.js";
import type { FellowshipConfig, FellowshipInput, FellowshipResult, YuleResult } from "./types.js";
import { validateUndertakings } from "./undertakings.js";
import { applyYule } from "./yule.js";

function fail(msg: string): never {
  throw new Error(`fellowship: ${msg}`);
}

/** A Yule phase must use the longest duration descriptor; place must be set. */
function validatePhaseChoices(input: FellowshipInput, cfg: FellowshipConfig): void {
  if (input.duration.length === 0) fail("duration must be a non-empty descriptor");
  if (input.place.length === 0) fail("place must be a non-empty descriptor");
  if (input.isYule && input.duration !== cfg.duration.longest) {
    fail(`a Yule phase must use the longest duration ${JSON.stringify(cfg.duration.longest)}, got ${JSON.stringify(input.duration)}`);
  }
}

export function runFellowship(
  hero: HeroState,
  input: FellowshipInput,
  cfg: FellowshipConfig,
  progressionCfg: ProgressionConfig,
): [FellowshipResult, HeroState] {
  validatePhaseChoices(input, cfg);

  // Validate undertakings up front (against the entering hero's calling) so the
  // phase fails fast before mutating anything; the keys are recorded below.
  const undertakingsChosen = validateUndertakings(hero, input.undertakings, input.isYule, cfg);

  // 1) Spiritual recovery: Hope restore and Shadow-point removal.
  const [recovery, afterRecovery] = applySpiritualRecovery(hero, input, cfg);

  // 2) Yule extras: credit the WITS bonus skill points BEFORE the spend step.
  let afterYule = afterRecovery;
  let yule: YuleResult | null = null;
  if (input.isYule) {
    const [y, h] = applyYule(afterRecovery, cfg);
    yule = y;
    afterYule = h;
  }

  // 3) Improve stats: delegate the full growth pass to the Progression driver.
  const [progression, afterProgression] = runProgression(afterYule, input.progression, progressionCfg);

  const result: FellowshipResult = {
    isYule: input.isYule,
    duration: input.duration,
    place: input.place,
    recovery,
    yule,
    progression,
    undertakingsChosen,
  };
  return [result, afterProgression];
}
