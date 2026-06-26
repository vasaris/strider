import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { makeRng } from "../../src/rng/rng.js";
import { combatConfigsFromPack } from "../../src/combat/configs.js";
import { oraclesFromPack } from "../../src/oracles/fromPack.js";
import {
  MAX_COMBAT_ROUNDS,
  runCombat,
  type CombatPolicy,
  type CombatResult,
  type EnemyFateStatus,
} from "../../src/combat/runCombat.js";
import { makeCombatScenario, minimalPolicy } from "../../src/cli/combatScenario.js";
import type { CombatState, EnemyState } from "../../src/combat/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const pack = loadPack(nodePackSource(packRoot));
const cfgs = combatConfigsFromPack(pack);
const { answers } = oraclesFromPack(pack);

function run(seed: string, policy: CombatPolicy = minimalPolicy): CombatResult {
  const { combat, rng } = makeCombatScenario(pack, seed);
  return runCombat(combat, policy, cfgs, answers, rng)[0];
}

/** Statuses an enemy reaches only via a survivable take-out at 0 Endurance. */
const TAKEN_OUT: ReadonlySet<EnemyFateStatus> = new Set<EnemyFateStatus>(["taken_out_survived", "taken_out_died"]);

const SEEDS = Array.from({ length: 20 }, (_, i) => `ork-${i + 1}`);

describe("runCombat -- the melee loop drives to a structured end", () => {
  it("runs at least one round and reports a coherent rounds count", () => {
    for (const seed of SEEDS) {
      const r = run(seed);
      expect(r.rounds).toBeGreaterThanOrEqual(1);
      expect(r.rounds).toBeLessThan(MAX_COMBAT_ROUNDS);
      // round_end events == rounds run
      expect(r.events.filter((e) => e.kind === "round_end").length).toBe(r.rounds);
    }
  });

  it("reports one of the four outcomes; a win leaves no enemy still standing", () => {
    for (const seed of SEEDS) {
      const r = run(seed);
      expect(["hero_won", "hero_down", "hero_fled", "hero_dead"]).toContain(r.outcome);
      if (r.outcome === "hero_won") {
        expect(r.enemies.some((e) => e.status === "still_standing")).toBe(false);
      }
    }
  });

  it("is reproducible: same seed -> identical result", () => {
    for (const seed of ["ork-1", "ork-2", "ork-7", "ork-10"]) {
      expect(run(seed)).toEqual(run(seed));
    }
  });

  it("a different seed yields a different transcript", () => {
    expect(run("ork-1").events).not.toEqual(run("ork-2").events);
  });
});

describe("runCombat -- after_battle phase (adversaries.format_opisaniya)", () => {
  it("rolls survival exactly for the enemies taken out at 0 Endurance, and for no others", () => {
    for (const seed of SEEDS) {
      const r = run(seed);
      const takenOutIndices = r.enemies.filter((e) => TAKEN_OUT.has(e.status)).map((e) => e.index).sort();
      const rolledIndices = r.afterBattle.map((a) => a.enemyIndex).sort();
      expect(rolledIndices).toEqual(takenOutIndices);
    }
  });

  it("a 'yes' roll keeps the enemy alive (taken_out_survived); a 'no' kills it (taken_out_died)", () => {
    for (const seed of SEEDS) {
      const r = run(seed);
      for (const roll of r.afterBattle) {
        const fate = r.enemies[roll.enemyIndex];
        expect(fate).toBeDefined();
        expect(roll.survived).toBe(roll.decision.answer === "yes");
        expect(fate?.status).toBe(roll.survived ? "taken_out_survived" : "taken_out_died");
      }
    }
  });

  it("consults survivalLikelihood once per survivable take-out (the optional read is wired)", () => {
    const seen: Array<{ key: string; likelihood: string | null }> = [];
    const recording: CombatPolicy = {
      planRound: minimalPolicy.planRound,
      survivalLikelihood(enemy: EnemyState) {
        seen.push({ key: enemy.block.key, likelihood: "even" });
        return "even";
      },
    };
    // ork-2 is a known win with a survivable take-out (one after_battle roll).
    const r = run("ork-2", recording);
    expect(r.afterBattle.length).toBe(1);
    expect(seen.length).toBe(1);
    expect(seen[0]?.key).toBe("ork_soldat");
  });
});

describe("runCombat -- non-terminating guard", () => {
  it("throws after MAX_COMBAT_ROUNDS when neither side can end the fight", () => {
    // A pathological policy: the hero never attacks and no enemy acts, so the
    // fight can never reach an end condition. The cap must fire.
    const stalemate: CombatPolicy = {
      planRound(_combat: CombatState) {
        return { heroStance: "open", heroMain: { kind: "other" }, heroSecondary: "none", enemyPlans: [] };
      },
    };
    const { combat, rng } = makeCombatScenario(pack, "stalemate");
    expect(() => runCombat(combat, stalemate, cfgs, answers, rng)).toThrow(/exceeded .* rounds/);
  });
});

describe("runCombat -- threads the RNG", () => {
  it("returns the post-combat RNG so the seeded stream can continue", () => {
    const { combat, rng } = makeCombatScenario(pack, "ork-2");
    const [, rngAfter] = runCombat(combat, minimalPolicy, cfgs, answers, rng);
    // The fight advanced the seeded stream: the returned state is not the start.
    expect(rngAfter).not.toEqual(makeRng("ork-2"));
  });
});
