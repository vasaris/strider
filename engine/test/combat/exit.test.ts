import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { makeRng } from "../../src/rng/rng.js";
import { newEyeState } from "../../src/eye/initial.js";
import { eyeConfigFromPack } from "../../src/eye/fromPack.js";
import { combatConfigsFromPack } from "../../src/combat/configs.js";
import { spawnEnemy } from "../../src/combat/enemy.js";
import { enemyStatBlockFromPack } from "../../src/combat/fromPack.js";
import { resolveExit } from "../../src/combat/exit.js";
import type { CombatState, HeroCombatFrame, StanceKey } from "../../src/combat/types.js";
import type { HeroState } from "../../src/hero/state.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const pack = loadPack(nodePackSource(packRoot));
const cfgs = combatConfigsFromPack(pack);
const ORKI = "kv.mechanics.adversaries.orki";

function makeHero(): HeroState {
  return {
    attributes: { strength: 5, heart: 4, wits: 3 },
    skills: { swords: 3 },
    endurance: { current: 30, max: 30 },
    loadGear: 0,
    fatigue: 0,
    hope: { current: 3, max: 3 },
    shadow: { points: 0, scars: 0 },
    eye: newEyeState({ valourAtLeast4: false, culture: "other", famousItemCount: 0 }, eyeConfigFromPack(pack)),
    inspired: false,
    wounded: false,
    wound: null,
    dying: false,
    dead: false,
    permanentInjuryMarks: 0,
  };
}

function frame(stance: StanceKey): HeroCombatFrame {
  return {
    stance,
    parryRating: 4,
    armourProtection: 2,
    equippedWeapon: { group: "swords", damage: 5, injury: 16 },
    drivenBackUsedThisRound: false,
    parryBonusThisRound: 0,
    outOfPosition: false,
  };
}

function combat(stance: StanceKey): CombatState {
  return {
    hero: makeHero(),
    heroFrame: frame(stance),
    enemies: [spawnEnemy(enemyStatBlockFromPack(pack, ORKI, "ork_soldat"))],
    round: 1,
    phase: "melee_rounds",
  };
}

describe("resolveExit — ranged method (no roll)", () => {
  it("leaves on your turn from the ranged stance, RNG untouched", () => {
    const rng = makeRng("exit-ranged");
    const [res, next, rngOut] = resolveExit(combat("ranged"), "ranged", cfgs, rng);
    expect(res.left).toBe(true);
    expect(res.method).toBe("ranged");
    expect(res.attack).toBeUndefined();
    expect(rngOut).toBe(rng); // no roll consumed
    expect(next.enemies[0]!.endurance).toBe(combat("ranged").enemies[0]!.endurance); // no damage
  });

  it("is unavailable from a melee stance and does not roll", () => {
    const rng = makeRng("exit-ranged-wrong");
    const [res, , rngOut] = resolveExit(combat("forward"), "ranged", cfgs, rng);
    expect(res.left).toBe(false);
    expect(res.unavailableReason).toMatch(/ranged/);
    expect(rngOut).toBe(rng);
  });
});

describe("resolveExit — defensive method (attack check, no damage)", () => {
  it("over many seeds: success leaves, failure remains engaged; the enemy never loses Endurance", () => {
    let left = 0;
    let stayed = 0;
    const before = combat("defensive").enemies[0]!.endurance;
    for (let i = 0; i < 60; i++) {
      const c = combat("defensive");
      const [res, next, rngOut] = resolveExit(c, "defensive", cfgs, makeRng(`def-${i}`));
      expect(res.method).toBe("defensive");
      expect(res.attack).toBeDefined();
      expect(rngOut).not.toBe(makeRng(`def-${i}`)); // a roll advanced the RNG
      // Exit deals no damage on a hit or a miss.
      expect(next.enemies[0]!.endurance).toBe(before);
      if (res.left) left++;
      else stayed++;
    }
    expect(left).toBeGreaterThan(0);
    expect(stayed).toBeGreaterThan(0);
    expect(left + stayed).toBe(60);
  });

  it("is unavailable outside the defensive stance and does not roll", () => {
    const rng = makeRng("def-wrong");
    const [res, , rngOut] = resolveExit(combat("open"), "defensive", cfgs, rng);
    expect(res.left).toBe(false);
    expect(res.unavailableReason).toMatch(/defensive/);
    expect(rngOut).toBe(rng);
  });

  it("is deterministic: same seed -> same verdict", () => {
    const a = resolveExit(combat("defensive"), "defensive", cfgs, makeRng("fix"))[0];
    const b = resolveExit(combat("defensive"), "defensive", cfgs, makeRng("fix"))[0];
    expect(a.left).toBe(b.left);
  });
});
