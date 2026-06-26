/**
 * Experience spending: validate a phase's spend plan against the verified pack
 * cost table and the per-phase caps, then apply it. WHICH targets to raise (and
 * which Reward/Virtue to take on a valour/wisdom level) is the player's input,
 * like combat tactics; the engine only validates and applies costs. A valid plan
 * is one phase's worth of spending: at most one level per skill, one per
 * weapon-skill, and one of valour-or-wisdom (the book caps). An invalid plan
 * (unknown target, wrong step, insufficient points, cap exceeded, bad grant key)
 * fails fast -- the engine never silently drops or partially applies a plan.
 * Pure and RNG-free.
 */

import type { HeroState } from "../hero/state.js";
import type { GrantEvent, ProgressionConfig, SpendItem, SpendPlan, SpendResult } from "./types.js";

function fail(msg: string): never {
  throw new Error(`progression spend: ${msg}`);
}

function pools(h: HeroState): { adventurePoints: number; skillPoints: number } {
  return h.experience ?? { adventurePoints: 0, skillPoints: 0 };
}

function skillCost(cfg: ProgressionConfig, newLevel: number, where: string): number {
  const c = cfg.trainingCost.skillByNewLevel[newLevel];
  if (c === undefined) fail(`${where}: no training cost for new level ${newLevel}`);
  return c;
}

function valourWisdomCost(cfg: ProgressionConfig, newLevel: number, where: string): number {
  const c = cfg.trainingCost.valourWisdomByNewLevel[newLevel];
  if (c === undefined) fail(`${where}: no training cost for new level ${newLevel}`);
  return c;
}

/** Validate a single-level raise: the target rises by exactly one. */
function requireSingleLevelStep(current: number, to: number, where: string): void {
  if (to !== current + 1) fail(`${where}: must raise by one level (from ${current} to ${current + 1}, got ${to})`);
}

/** Is the chosen Virtue key valid for this hero (regular, or cultural if gated)? */
function virtueKeyAllowed(cfg: ProgressionConfig, hero: HeroState, newWisdom: number, key: string): boolean {
  if (cfg.grants.virtueKeys.includes(key)) return true;
  const culture = hero.culture;
  if (culture === undefined) return false;
  const culturalKeys = cfg.grants.culturalVirtueKeysByCulture[culture];
  if (culturalKeys === undefined || !culturalKeys.includes(key)) return false;
  return newWisdom >= cfg.grants.culturalMinWisdomLevel;
}

export function spendExperience(
  hero: HeroState,
  plan: SpendPlan,
  cfg: ProgressionConfig,
): [SpendResult, HeroState] {
  // Mutable working copies of the parts the plan touches.
  const skills: Record<string, number> = { ...hero.skills };
  const weaponSkills: Record<string, number> = { ...(hero.weaponSkills ?? {}) };
  let valour = hero.valour ?? 0;
  let wisdom = hero.wisdom ?? 0;
  const newVirtues: string[] = [];
  const newRewards: string[] = [];
  const grants: GrantEvent[] = [];

  let skillPointsSpent = 0;
  let adventurePointsSpent = 0;

  // Cap counters across the plan batch (one phase).
  const skillRaises = new Map<string, number>();
  const weaponRaises = new Map<string, number>();
  let valourWisdomRaises = 0;

  for (let i = 0; i < plan.items.length; i++) {
    const item = plan.items[i] as SpendItem;
    const where = `item[${i}]`;
    switch (item.kind) {
      case "skill": {
        if (!cfg.validSkills.includes(item.id)) fail(`${where}: unknown skill ${JSON.stringify(item.id)}`);
        const current = skills[item.id] ?? 0;
        requireSingleLevelStep(current, item.toRating, where);
        const n = (skillRaises.get(item.id) ?? 0) + 1;
        skillRaises.set(item.id, n);
        if (n > cfg.caps.maxLevelsPerSkill) fail(`${where}: skill ${item.id} exceeds ${cfg.caps.maxLevelsPerSkill}/phase`);
        skillPointsSpent += skillCost(cfg, item.toRating, where);
        skills[item.id] = item.toRating;
        break;
      }
      case "weaponSkill": {
        if (!cfg.validWeaponSkills.includes(item.id)) fail(`${where}: unknown weapon skill ${JSON.stringify(item.id)}`);
        const current = weaponSkills[item.id] ?? 0;
        requireSingleLevelStep(current, item.toRating, where);
        const n = (weaponRaises.get(item.id) ?? 0) + 1;
        weaponRaises.set(item.id, n);
        if (n > cfg.caps.maxLevelsPerWeaponSkill) {
          fail(`${where}: weapon skill ${item.id} exceeds ${cfg.caps.maxLevelsPerWeaponSkill}/phase`);
        }
        adventurePointsSpent += skillCost(cfg, item.toRating, where);
        weaponSkills[item.id] = item.toRating;
        break;
      }
      case "valour": {
        requireSingleLevelStep(valour, item.toLevel, where);
        valourWisdomRaises += 1;
        if (valourWisdomRaises > cfg.caps.valourOrWisdomPerPhase) {
          fail(`${where}: only ${cfg.caps.valourOrWisdomPerPhase} of valour/wisdom per phase`);
        }
        if (!cfg.grants.rewardKeys.includes(item.grantRewardKey)) {
          fail(`${where}: unknown reward key ${JSON.stringify(item.grantRewardKey)}`);
        }
        adventurePointsSpent += valourWisdomCost(cfg, item.toLevel, where);
        valour = item.toLevel;
        newRewards.push(item.grantRewardKey);
        grants.push({ kind: "reward", key: item.grantRewardKey });
        break;
      }
      case "wisdom": {
        requireSingleLevelStep(wisdom, item.toLevel, where);
        valourWisdomRaises += 1;
        if (valourWisdomRaises > cfg.caps.valourOrWisdomPerPhase) {
          fail(`${where}: only ${cfg.caps.valourOrWisdomPerPhase} of valour/wisdom per phase`);
        }
        if (!virtueKeyAllowed(cfg, hero, item.toLevel, item.grantVirtueKey)) {
          fail(`${where}: virtue key ${JSON.stringify(item.grantVirtueKey)} not allowed at wisdom ${item.toLevel}`);
        }
        adventurePointsSpent += valourWisdomCost(cfg, item.toLevel, where);
        wisdom = item.toLevel;
        newVirtues.push(item.grantVirtueKey);
        grants.push({ kind: "virtue", key: item.grantVirtueKey });
        break;
      }
    }
  }

  const base = pools(hero);
  if (skillPointsSpent > base.skillPoints) {
    fail(`insufficient skill points: need ${skillPointsSpent}, have ${base.skillPoints}`);
  }
  if (adventurePointsSpent > base.adventurePoints) {
    fail(`insufficient adventure points: need ${adventurePointsSpent}, have ${base.adventurePoints}`);
  }

  const hero2: HeroState = {
    ...hero,
    skills,
    weaponSkills,
    valour,
    wisdom,
    experience: {
      adventurePoints: base.adventurePoints - adventurePointsSpent,
      skillPoints: base.skillPoints - skillPointsSpent,
    },
    virtues: [...(hero.virtues ?? []), ...newVirtues],
    rewards: [...(hero.rewards ?? []), ...newRewards],
  };

  return [{ skillPointsSpent, adventurePointsSpent, grants }, hero2];
}
