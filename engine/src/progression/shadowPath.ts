/**
 * Shadow-Path advancement: a bout of madness (conditions/shadow.boutOfMadness)
 * is the only escape from being overwhelmed, and it advances the hero one step
 * along the Shadow Path of their calling, gaining a new Flaw (bezumie +
 * ispolzovanie_izyanov). This is the resolver the conditions subsystem defers
 * to. Pure and RNG-free.
 *
 * The path is keyed off the hero's calling: callingToPath[calling] gives the
 * path key, and pathFlaws[pathKey] the ordered Flaws. A calling whose
 * shadow_path key is not present in the Shadow-Path card fails fast here rather
 * than being papered over -- the messenger card currently carries
 * "wandering_madness" where the path owner has "wandering", a content
 * inconsistency to fix at the pack gate, not to alias in code.
 */

import type { HeroState } from "../hero/state.js";
import type { ProgressionConfig, ShadowStepResult } from "./types.js";

export function applyShadowPathAdvance(
  hero: HeroState,
  cfg: ProgressionConfig,
): [ShadowStepResult, HeroState] {
  const calling = hero.calling;
  if (calling === undefined) {
    throw new Error("progression shadow path: hero has no calling; cannot determine Shadow Path");
  }
  const pathKey = cfg.shadowPath.callingToPath[calling];
  if (pathKey === undefined) {
    throw new Error(`progression shadow path: calling ${JSON.stringify(calling)} has no shadow_path mapping`);
  }
  const flaws = cfg.shadowPath.pathFlaws[pathKey];
  if (flaws === undefined) {
    throw new Error(
      `progression shadow path: path ${JSON.stringify(pathKey)} (calling ${JSON.stringify(calling)}) not found in the Shadow-Path card`,
    );
  }

  const current = hero.shadowPath?.flawsGained ?? 0;
  if (current >= flaws.length) {
    throw new Error(`progression shadow path: all ${flaws.length} flaws of ${pathKey} already gained`);
  }
  const flawGained = flaws[current];
  if (flawGained === undefined) {
    throw new Error(`progression shadow path: missing flaw ${current} of ${pathKey}`);
  }

  const flawsGainedTotal = current + 1;
  const succumbed = flawsGainedTotal >= cfg.shadowPath.succumbAfterFlaws;

  const hero2: HeroState = {
    ...hero,
    shadowPath: { key: pathKey, flawsGained: flawsGainedTotal },
    flaws: [...(hero.flaws ?? []), flawGained],
  };

  return [{ path: pathKey, flawGained, flawsGainedTotal, succumbed }, hero2];
}
