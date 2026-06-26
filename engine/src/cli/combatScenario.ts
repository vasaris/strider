/**
 * A fixed combat scenario for the Stage-1 milestone: the test Wanderer against a
 * single orc soldier from the pack, with a minimal deterministic policy. Mirror
 * of scenario.ts (journey). Deterministic: same seed and pack yield the same
 * fight. The pack holds the orc (real content); the hero is hand-built (the
 * equipment economy is Stage 4) and equipped for melee with one weapon skill on
 * top of the journey Wanderer.
 */

import { spawnEnemy } from "../combat/enemy.js";
import { enemyStatBlockFromPack } from "../combat/fromPack.js";
import { combatConfigsFromPack, type CombatConfigs } from "../combat/configs.js";
import type { CombatPolicy } from "../combat/runCombat.js";
import type { EnemyTurnPlan } from "../combat/round.js";
import type { CombatState, EnemyState, HeroCombatFrame } from "../combat/types.js";
import type { HeroState } from "../hero/state.js";
import { journeyConfigsFromPack } from "../journey/config.js";
import { oraclesFromPack } from "../oracles/fromPack.js";
import type { OracleAnswersTable } from "../oracles/types.js";
import type { Pack } from "../pack/pack.js";
import { makeRng, type Rng } from "../rng/rng.js";
import { makeTestHero } from "./scenario.js";

const ORK_CARD = "kv.mechanics.adversaries.orki";
const ORK_KEY = "ork_soldat";

/** The journey Wanderer, equipped for melee with a sword skill (frame: a sword). */
export function makeCombatHero(pack: Pack): HeroState {
  const hero = makeTestHero(journeyConfigsFromPack(pack));
  return { ...hero, skills: { ...hero.skills, swords: 2 } };
}

/** The hero's combat frame: balanced (open) stance, a sword, light armour, no shield. */
export function makeCombatFrame(): HeroCombatFrame {
  return {
    stance: "open",
    parryRating: 4,
    armourProtection: 2,
    equippedWeapon: { group: "swords", damage: 5, injury: 16, nameRu: "mech strannika" },
    drivenBackUsedThisRound: false,
    parryBonusThisRound: 0,
    outOfPosition: false,
  };
}

export interface CombatScenario {
  readonly combat: CombatState;
  readonly cfgs: CombatConfigs;
  readonly answers: OracleAnswersTable;
  readonly rng: Rng;
}

/** Build the milestone fight: Wanderer vs one orc soldier, seeded. */
export function makeCombatScenario(pack: Pack, seed: number | string): CombatScenario {
  const cfgs = combatConfigsFromPack(pack);
  const { answers } = oraclesFromPack(pack);
  const enemy = spawnEnemy(enemyStatBlockFromPack(pack, ORK_CARD, ORK_KEY));
  const combat: CombatState = {
    hero: makeCombatHero(pack),
    heroFrame: makeCombatFrame(),
    enemies: [enemy],
    round: 1,
    phase: "melee_rounds",
  };
  return { combat, cfgs, answers, rng: makeRng(seed) };
}

/** The lowest-Endurance engaged, living enemy (ties -> lowest index); null if none. */
function weakestEngagedIndex(enemies: readonly EnemyState[]): number | null {
  let best: number | null = null;
  let bestEndurance = Number.POSITIVE_INFINITY;
  enemies.forEach((e, i) => {
    if (!e.engaged || !e.alive) return;
    if (e.endurance < bestEndurance) {
      bestEndurance = e.endurance;
      best = i;
    }
  });
  return best;
}

/**
 * A minimal, deterministic policy: the hero holds the open stance and attacks
 * the weakest engaged enemy; each engaged enemy attacks the lone hero, spending
 * one point of pool per round while it can (within the per-round Might cap). No
 * special-damage spends, no oracle-driven enemy decisions -- those are the
 * extension points an LLM-assisted Stage-2 policy fills. survivalLikelihood is
 * left to the table default (an absent function).
 */
export const minimalPolicy: CombatPolicy = {
  planRound(combat) {
    const target = weakestEngagedIndex(combat.enemies);
    const enemyPlans: EnemyTurnPlan[] = [];
    combat.enemies.forEach((enemy, index) => {
      if (!enemy.engaged || !enemy.alive) return;
      const canSpend = enemy.pool > 0 && enemy.poolSpentThisRound + 1 <= enemy.block.might;
      enemyPlans.push({ enemyIndex: index, weaponIndex: 0, ...(canSpend ? { poolSpend: 1 } : {}) });
    });
    return {
      heroStance: "open",
      heroMain: target === null ? { kind: "other" } : { kind: "attack", targetEnemyIndex: target },
      heroSecondary: "none",
      enemyPlans,
    };
  },
};
