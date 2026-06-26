/**
 * A fixed Fellowship Phase scenario for the Stage-1 closer: a Barding warrior
 * settles into a Yule phase at a safe haven after an adventure that struck a
 * real blow against the Shadow. The phase restores Hope fully (Yule), removes
 * two Shadow points (the "active" deed tier), grants the WITS bonus skill points,
 * then spends the experience on one skill and one VALOUR level (taking a Reward),
 * and records two undertakings. Mirror of progressionScenario.ts /
 * councilScenario.ts. Deterministic: the same pack yields the same phase (the
 * Fellowship Phase rolls no dice). The hero is hand-built on top of the journey
 * Wanderer (the lifepath-driven creation economy is Stage 4).
 */

import { fellowshipConfigFromPack } from "../fellowship/config.js";
import type { FellowshipConfig, FellowshipInput } from "../fellowship/types.js";
import type { HeroState } from "../hero/state.js";
import type { Pack } from "../pack/pack.js";
import { progressionConfigFromPack } from "../progression/config.js";
import type { ProgressionConfig } from "../progression/types.js";
import { makeProgressionHero } from "./progressionScenario.js";

/**
 * The progression Wanderer, entering a Fellowship Phase with Hope spent down to
 * 1/3, three accrued Shadow points (one already hardened into a scar) and a
 * stocked experience pool (8 adventure / 4 skill points) to improve with.
 */
export function makeFellowshipHero(pack: Pack): HeroState {
  const hero = makeProgressionHero(pack);
  return {
    ...hero,
    hope: { current: 1, max: 3 },
    shadow: { points: 3, scars: 1 },
    experience: { adventurePoints: 8, skillPoints: 4 },
  };
}

/**
 * The Yule phase input: full Hope restore is automatic; the player judges the
 * adventure an "active" success against the Shadow (remove 2). Improve-stats
 * raises Lore 0->1 (4 skill points) and VALOUR 1->2 (8 adventure points, taking
 * the "fell" Reward); no milestones earned in this isolated pass and no bout of
 * madness. Two undertakings are chosen: writing a song (free to a warrior) and
 * changing useful items.
 */
export const FELLOWSHIP_INPUT = (cfg: FellowshipConfig): FellowshipInput => ({
  isYule: true,
  duration: cfg.duration.longest,
  place: "rivendell",
  shadowReductionTier: "active",
  undertakings: ["write_song", "change_useful_items"],
  progression: {
    milestoneIndices: [],
    spendPlan: {
      items: [
        { kind: "skill", id: "lore", toRating: 1 },
        { kind: "valour", toLevel: 2, grantRewardKey: "fell" },
      ],
    },
    boutsOfMadness: 0,
  },
});

export interface FellowshipScenario {
  readonly hero: HeroState;
  readonly input: FellowshipInput;
  readonly cfg: FellowshipConfig;
  readonly progressionCfg: ProgressionConfig;
}

/** Build the Yule Fellowship Phase scenario from the pack. */
export function makeFellowshipScenario(pack: Pack): FellowshipScenario {
  const cfg = fellowshipConfigFromPack(pack);
  return {
    hero: makeFellowshipHero(pack),
    input: FELLOWSHIP_INPUT(cfg),
    cfg,
    progressionCfg: progressionConfigFromPack(pack),
  };
}
