/**
 * The thin growth driver: one between-adventures pass, sequencing the three
 * progression primitives over a structured adventure result -- earn from reached
 * milestones, spend the player's plan, then advance the Shadow Path once per
 * bout of madness. Mirror of runCombat / runCouncil, but RNG-free (progression
 * rolls no dice; everything is table lookup and arithmetic).
 *
 * This is NOT the Fellowship Phase: it does no duration/place/undertaking
 * sequencing and no spiritual recovery (hope restore, shadow reduction). Those
 * belong to the Fellowship Phase subsystem, which will call this driver for the
 * improve-stats step.
 */

import type { HeroState } from "../hero/state.js";
import { earnExperience } from "./earn.js";
import { applyShadowPathAdvance } from "./shadowPath.js";
import { spendExperience } from "./spend.js";
import type { ProgressionConfig, ProgressionInput, ProgressionResult, ShadowStepResult } from "./types.js";

export function runProgression(
  hero: HeroState,
  input: ProgressionInput,
  cfg: ProgressionConfig,
): [ProgressionResult, HeroState] {
  const [earn, afterEarn] = earnExperience(hero, input.milestoneIndices, cfg);
  const [spend, afterSpend] = spendExperience(afterEarn, input.spendPlan, cfg);

  let current = afterSpend;
  const shadowSteps: ShadowStepResult[] = [];
  for (let i = 0; i < input.boutsOfMadness; i++) {
    const [step, next] = applyShadowPathAdvance(current, cfg);
    shadowSteps.push(step);
    current = next;
  }

  return [{ earn, spend, shadowSteps }, current];
}
