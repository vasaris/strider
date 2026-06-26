/**
 * Undertaking selection validation. The Fellowship Phase records WHICH
 * undertakings the player chose (the keys, opaque) and checks them against the
 * pack budget: a normal phase allows the party-common undertaking plus one
 * free calling-tied undertaking (the free slot is only available to an
 * undertaking whose calling matches the hero's); a Yule phase allows the hero's
 * own undertaking plus a common one. Yule-tagged undertakings are exempt from
 * the per-phase distinctness rule. The mechanical EFFECTS of undertakings
 * (heal a scar, study maps, raise an heir, ...) are applied later -- this step
 * only validates the choice, like the grant-key model in Progression. Counts all
 * come from the pack; nothing is baked. Pure and RNG-free.
 */

import type { HeroState } from "../hero/state.js";
import type { FellowshipConfig, UndertakingMeta } from "./types.js";

function fail(msg: string): never {
  throw new Error(`fellowship undertakings: ${msg}`);
}

function metaOf(cfg: FellowshipConfig, key: string): UndertakingMeta {
  const m = cfg.undertakings.catalog[key];
  if (m === undefined) fail(`unknown undertaking ${JSON.stringify(key)}`);
  return m;
}

/** Non-yule-tagged undertakings must be distinct (book: distinct except yule). */
function requireDistinctExceptYule(chosen: readonly string[], cfg: FellowshipConfig): void {
  const seen = new Set<string>();
  for (const key of chosen) {
    if (metaOf(cfg, key).yuleTagged) continue;
    if (seen.has(key)) fail(`duplicate undertaking ${JSON.stringify(key)} (only yule undertakings may repeat)`);
    seen.add(key);
  }
}

export function validateUndertakings(
  hero: HeroState,
  chosen: readonly string[],
  isYule: boolean,
  cfg: FellowshipConfig,
): readonly string[] {
  for (const key of chosen) metaOf(cfg, key); // every key must be known
  requireDistinctExceptYule(chosen, cfg);

  if (isYule) {
    const budget = cfg.undertakings.yule.perHero + cfg.undertakings.yule.plusPartyCommon;
    if (chosen.length > budget) fail(`Yule phase allows at most ${budget} undertakings, got ${chosen.length}`);
    return chosen;
  }

  // Normal phase: Yule-tagged undertakings are Yule-only (the card marks them).
  for (const key of chosen) {
    if (metaOf(cfg, key).yuleTagged) fail(`undertaking ${JSON.stringify(key)} is Yule-only`);
  }

  // The free calling-tied slot is filled only by an undertaking
  // whose free_if_calling matches the hero's calling; everything else consumes a
  // party-common slot.
  let freeUsed = 0;
  let commonUsed = 0;
  for (const key of chosen) {
    const meta = metaOf(cfg, key);
    const callingMatches = meta.freeIfCalling !== null && meta.freeIfCalling === hero.calling;
    if (callingMatches && freeUsed < cfg.undertakings.normal.freeCalling) {
      freeUsed += 1;
    } else {
      commonUsed += 1;
    }
  }
  if (commonUsed > cfg.undertakings.normal.partyCommon) {
    fail(`normal phase allows ${cfg.undertakings.normal.partyCommon} common undertaking(s), got ${commonUsed}`);
  }
  if (chosen.length > cfg.undertakings.normal.maxTotal) {
    fail(`normal phase allows at most ${cfg.undertakings.normal.maxTotal} undertakings, got ${chosen.length}`);
  }
  return chosen;
}
