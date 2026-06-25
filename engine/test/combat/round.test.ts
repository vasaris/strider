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
import { runRound, startRound, type RoundEvent, type RoundPlan } from "../../src/combat/round.js";
import type { CombatState, EnemyState, EnemyStatBlock, HeroCombatFrame } from "../../src/combat/types.js";
import type { HeroState } from "../../src/hero/state.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const pack = loadPack(nodePackSource(packRoot));
const cfgs = combatConfigsFromPack(pack);

function makeHero(over: Partial<HeroState> = {}): HeroState {
  return {
    attributes: { strength: 5, heart: 4, wits: 3 },
    skills: { swords: 4, awe: 2 },
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
    ...over,
  };
}

function makeFrame(over: Partial<HeroCombatFrame> = {}): HeroCombatFrame {
  return {
    stance: "open",
    parryRating: 4,
    armourProtection: 2,
    equippedWeapon: { group: "swords", damage: 5, injury: 16 },
    drivenBackUsedThisRound: false,
    parryBonusThisRound: 0,
    outOfPosition: false,
    ...over,
  };
}

function enemyBlock(over: Partial<EnemyStatBlock> = {}): EnemyStatBlock {
  return {
    key: "dummy",
    nameRu: "учебный",
    level: 2,
    endurance: 24,
    might: 1,
    pool: 5,
    poolKind: "hatred",
    parry: 0,
    armour: 1,
    weapons: [{ name: "клинок", rating: 4, damage: 6, wound: 16, special: [] }],
    abilities: [],
    distinctive: [],
    ...over,
  };
}

function combatOf(hero: HeroState, frame: HeroCombatFrame, blocks: readonly EnemyStatBlock[]): CombatState {
  return { hero, heroFrame: frame, enemies: blocks.map((b) => spawnEnemy({ ...b })), round: 1, phase: "melee_rounds" };
}

const basicPlan = (over: Partial<RoundPlan> = {}): RoundPlan => ({
  heroStance: "open",
  heroMain: { kind: "attack", targetEnemyIndex: 0 },
  enemyPlans: [{ enemyIndex: 0 }],
  ...over,
});

function kinds(events: readonly RoundEvent[]): string[] {
  return events.map((e) => e.kind);
}

describe("startRound — round-boundary reset (Debts #1, #4)", () => {
  it("resets pool budget, Shield-Thrust debuff, driven-back budget and parry buff; keeps outOfPosition; bumps round", () => {
    const dirtyEnemy: EnemyState = {
      ...spawnEnemy(enemyBlock()),
      poolSpentThisRound: 2,
      attackDiceModUntilRoundEnd: -1,
    };
    const combat: CombatState = {
      hero: makeHero(),
      heroFrame: makeFrame({ drivenBackUsedThisRound: true, parryBonusThisRound: 2, outOfPosition: true }),
      enemies: [dirtyEnemy],
      round: 3,
      phase: "melee_rounds",
    };
    const next = startRound(combat);
    expect(next.round).toBe(4);
    expect(next.enemies[0]!.poolSpentThisRound).toBe(0);
    expect(next.enemies[0]!.attackDiceModUntilRoundEnd).toBe(0);
    expect(next.heroFrame.drivenBackUsedThisRound).toBe(false);
    expect(next.heroFrame.parryBonusThisRound).toBe(0);
    expect(next.heroFrame.outOfPosition).toBe(true); // persists until a restore action
  });
});

describe("runRound — pool spend grants dice (Debt #2)", () => {
  it("a planned pool spend is reported as grantedDice on the first enemy attack and lowers the pool", () => {
    const combat = combatOf(makeHero(), makeFrame(), [enemyBlock({ might: 2, pool: 5 })]);
    const plan = basicPlan({ enemyPlans: [{ enemyIndex: 0, poolSpend: 2 }] });
    const [outcome, next] = runRound(combat, plan, cfgs, makeRng("pool"));
    const first = outcome.events.find((e) => e.kind === "enemy_attack" && e.attackNumber === 1);
    expect(first && first.kind === "enemy_attack" ? first.grantedDice : -1).toBe(2);
    expect(next.enemies[0]!.pool).toBe(5 - 2);
  });

  it("spending more pool than Might throws (round cap enforced upstream)", () => {
    const combat = combatOf(makeHero(), makeFrame(), [enemyBlock({ might: 1, pool: 5 })]);
    const plan = basicPlan({ enemyPlans: [{ enemyIndex: 0, poolSpend: 2 }] }); // 2 > Might 1
    expect(() => runRound(combat, plan, cfgs, makeRng("cap"))).toThrow();
  });
});

describe("runRound — solo collapse and action order", () => {
  it("two enemies both act against the lone hero, after the hero, in plan order", () => {
    const combat = combatOf(makeHero(), makeFrame(), [enemyBlock(), enemyBlock({ key: "d2" })]);
    const plan = basicPlan({ enemyPlans: [{ enemyIndex: 0 }, { enemyIndex: 1 }] });
    const [outcome] = runRound(combat, plan, cfgs, makeRng("solo"));
    const ks = kinds(outcome.events);
    expect(ks[0]).toBe("stance");
    expect(ks[1]).toBe("hero_attack");
    const enemyAttacks = outcome.events.filter((e) => e.kind === "enemy_attack");
    expect(enemyAttacks.map((e) => (e.kind === "enemy_attack" ? e.enemyIndex : -1))).toEqual([0, 1]);
    expect(ks[ks.length - 1]).toBe("round_end");
  });
});

describe("runRound — driven back forces a stance restore next round (Debt #4)", () => {
  it("being driven back sets outOfPosition; the next round's main is forced to restore", () => {
    // Find a seed where the enemy hits and the hero elects driven-back -> outOfPosition.
    const combat = combatOf(makeHero({ skills: { swords: 4 } }), makeFrame({ parryRating: 2 }), [
      enemyBlock({ weapons: [{ name: "молот", rating: 6, damage: 6, wound: 18, special: [] }] }),
    ]);
    let drivenState: CombatState | null = null;
    for (let i = 0; i < 200; i++) {
      const plan = basicPlan({ enemyPlans: [{ enemyIndex: 0, heroElectsDrivenBack: true }] });
      const [outcome, next] = runRound(combat, plan, cfgs, makeRng(`db-${i}`));
      const wasDriven = outcome.events.some((e) => e.kind === "enemy_attack" && e.drivenBack);
      if (wasDriven) {
        expect(next.heroFrame.outOfPosition).toBe(true);
        drivenState = next;
        break;
      }
    }
    expect(drivenState).not.toBeNull();

    // Next round: even though the plan says "attack", the engine forces a restore.
    const round2 = startRound(drivenState!);
    const [out2, after2] = runRound(round2, basicPlan(), cfgs, makeRng("after-db"));
    expect(out2.events.some((e) => e.kind === "hero_restore_stance")).toBe(true);
    expect(out2.events.some((e) => e.kind === "hero_attack")).toBe(false);
    expect(after2.heroFrame.outOfPosition).toBe(false);
  });
});

describe("runRound — task main action (rolls, reports, does NOT apply the buff)", () => {
  it("emits a task event with the opaque effect and buffApplied=false", () => {
    const combat = combatOf(makeHero(), makeFrame({ stance: "forward" }), [enemyBlock()]);
    const plan = basicPlan({ heroStance: "forward", heroMain: { kind: "task", task: "cow" } });
    const [outcome] = runRound(combat, plan, cfgs, makeRng("task"));
    const task = outcome.events.find((e) => e.kind === "hero_task");
    expect(task).toBeDefined();
    if (task && task.kind === "hero_task") {
      expect(task.task).toBe("cow");
      expect(task.buffApplied).toBe(false);
      expect(task.effectOpaque.length).toBeGreaterThan(0);
      expect(["success", "failure"]).toContain(task.outcome);
    }
    // No hero_attack on a task turn.
    expect(outcome.events.some((e) => e.kind === "hero_attack")).toBe(false);
  });
});

describe("runRound — exit via the cycle ends the fight for the hero", () => {
  it("a ranged exit from the ranged stance leaves and ends combat", () => {
    const combat = combatOf(makeHero(), makeFrame({ stance: "ranged" }), [enemyBlock()]);
    const plan = basicPlan({ heroStance: "ranged", heroMain: { kind: "exit", method: "ranged" } });
    const [outcome] = runRound(combat, plan, cfgs, makeRng("exit"));
    expect(outcome.heroExited).toBe(true);
    expect(outcome.combatEnded).toBe(true);
    // Enemies do not act once the hero has left.
    expect(outcome.events.some((e) => e.kind === "enemy_attack")).toBe(false);
  });
});

describe("runRound — invariants", () => {
  it("the Eye never grows from a combat Feat die (awareness unchanged across a round)", () => {
    const combat = combatOf(makeHero(), makeFrame(), [enemyBlock({ might: 2 })]);
    const before = combat.hero.eye.awareness;
    const [, next] = runRound(combat, basicPlan({ enemyPlans: [{ enemyIndex: 0 }] }), cfgs, makeRng("eye"));
    expect(next.hero.eye.awareness).toBe(before);
  });

  it("is deterministic: same seed + plan -> identical transcript and state", () => {
    const combat = combatOf(makeHero(), makeFrame(), [enemyBlock({ might: 2 })]);
    const a = runRound(combat, basicPlan({ enemyPlans: [{ enemyIndex: 0 }] }), cfgs, makeRng("det"));
    const b = runRound(combat, basicPlan({ enemyPlans: [{ enemyIndex: 0 }] }), cfgs, makeRng("det"));
    expect(a[0]).toEqual(b[0]);
    expect(a[1]).toEqual(b[1]);
  });

  it("a fragile hero against a strong enemy eventually goes down and ends the fight", () => {
    let combat = combatOf(makeHero({ endurance: { current: 6, max: 6 } }), makeFrame({ parryRating: 1 }), [
      enemyBlock({ might: 2, weapons: [{ name: "секира", rating: 8, damage: 8, wound: 18, special: [] }] }),
    ]);
    let ended = false;
    for (let r = 0; r < 12 && !ended; r++) {
      combat = r === 0 ? combat : startRound(combat);
      const [outcome, next] = runRound(combat, basicPlan({ enemyPlans: [{ enemyIndex: 0 }] }), cfgs, makeRng(`down-${r}`));
      combat = next;
      if (outcome.combatEnded) {
        ended = true;
        expect(outcome.heroDown).toBe(true);
      }
    }
    expect(ended).toBe(true);
  });
});
