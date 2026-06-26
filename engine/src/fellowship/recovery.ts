/**
 * Spiritual recovery, the deterministic heart of the Fellowship Phase. Every
 * hero automatically recovers Hope equal to their HEART rating during a
 * Fellowship Phase, or to full during Yule; and, if the adventuring phase was a
 * success against the rising Shadow, removes 1/2/3 Shadow points by the player's
 * chosen deed tier. The HEART rating is read off the hero (not a pack literal);
 * the removal amounts come from the verified pack (struktura tiers cross-checked
 * against the solo table). Pure and RNG-free.
 */

import type { HeroState } from "../hero/state.js";
import type { FellowshipConfig, FellowshipInput, RecoveryResult } from "./types.js";

function fail(msg: string): never {
  throw new Error(`fellowship recovery: ${msg}`);
}

/**
 * Resolve the chosen deed tier to a Shadow-removal amount. The tier names live
 * in the struktura card; the amount is cross-checked against the solo table
 * (kv.solo.shadow_recovery), the solo-canonical source. null tier means the
 * adventuring phase was not a success against the Shadow -> nothing removed.
 */
function resolveShadowAmount(tier: string | null, cfg: FellowshipConfig): number {
  if (tier === null) return 0;
  const amount = cfg.recovery.shadowReductionTiers[tier];
  if (amount === undefined) {
    const known = Object.keys(cfg.recovery.shadowReductionTiers).join(", ");
    fail(`unknown shadow-reduction tier ${JSON.stringify(tier)} (known: ${known})`);
  }
  if (!cfg.recovery.soloShadowAmounts.includes(amount)) {
    fail(`tier ${JSON.stringify(tier)} amount ${amount} not in solo shadow_recovery amounts`);
  }
  return amount;
}

export function applySpiritualRecovery(
  hero: HeroState,
  input: FellowshipInput,
  cfg: FellowshipConfig,
): [RecoveryResult, HeroState] {
  // Hope: HEART rating during a Fellowship Phase; full during Yule.
  const yuleFullHope = input.isYule && cfg.recovery.yuleFullHope;
  const heart = hero.attributes.heart;
  const target = yuleFullHope ? hero.hope.max : Math.min(hero.hope.max, hero.hope.current + heart);
  const hopeRestored = target - hero.hope.current;

  // Shadow: remove the chosen tier's amount, never below zero.
  const amount = resolveShadowAmount(input.shadowReductionTier, cfg);
  const shadowRemoved = Math.min(hero.shadow.points, amount);

  const hero2: HeroState = {
    ...hero,
    hope: { ...hero.hope, current: target },
    shadow: { ...hero.shadow, points: hero.shadow.points - shadowRemoved },
  };

  return [{ hopeRestored, yuleFullHope, shadowRemoved }, hero2];
}
