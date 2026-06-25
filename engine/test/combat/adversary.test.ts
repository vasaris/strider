import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { enemyStatBlockFromPack } from "../../src/combat/fromPack.js";
import { spawnEnemy } from "../../src/combat/enemy.js";
import {
  afterBattle,
  applyEnemyWound,
  enemyIsWeary,
  isTakenOutSurvivable,
  resetRoundPool,
  spendPool,
} from "../../src/combat/adversary.js";
import type { EnemyState } from "../../src/combat/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const pack = loadPack(nodePackSource(packRoot));

const ORKI = "kv.mechanics.adversaries.orki";
// goblin_luchnik: might 1, pool 2.   velikiy_ork_glavar: might 2, pool 7.
const goblin = () => spawnEnemy(enemyStatBlockFromPack(pack, ORKI, "goblin_luchnik"));
const chief = () => spawnEnemy(enemyStatBlockFromPack(pack, ORKI, "velikiy_ork_glavar"));

describe("applyEnemyWound — increments to Might, then destroys", () => {
  it("a Might-1 enemy is destroyed by a single wound", () => {
    const [e, ev] = applyEnemyWound(goblin());
    expect(ev).toEqual({ kind: "destroyed", woundsTaken: 1 });
    expect(e.woundsTaken).toBe(1);
    expect(e.alive).toBe(false);
    expect(e.engaged).toBe(false);
  });

  it("a Might-2 enemy survives the first wound and falls on the second", () => {
    const [e1, ev1] = applyEnemyWound(chief());
    expect(ev1).toEqual({ kind: "wounded", woundsTaken: 1, woundsToDestroy: 2 });
    expect(e1.alive).toBe(true);
    expect(e1.engaged).toBe(true);

    const [e2, ev2] = applyEnemyWound(e1);
    expect(ev2).toEqual({ kind: "destroyed", woundsTaken: 2 });
    expect(e2.alive).toBe(false);
    expect(e2.engaged).toBe(false);
  });

  it("is a no-op (idempotent) on an already-destroyed enemy", () => {
    const [dead] = applyEnemyWound(goblin());
    const [again, ev] = applyEnemyWound(dead);
    expect(again).toBe(dead); // unchanged reference
    expect(ev.kind).toBe("destroyed");
  });

  it("does not touch Endurance or pool", () => {
    const start = chief();
    const [e] = applyEnemyWound(start);
    expect(e.endurance).toBe(start.endurance);
    expect(e.pool).toBe(start.pool);
  });
});

describe("afterBattle — survival of a take-out at 0 Endurance", () => {
  // A take-out at 0 Endurance not killed by wounds (engaged=false, alive=true, endurance=0).
  const takenOut = (): EnemyState => ({ ...chief(), endurance: 0, engaged: false });

  it("recognises a survivable take-out", () => {
    expect(isTakenOutSurvivable(takenOut())).toBe(true);
  });

  it("survives=true keeps the enemy alive but out of combat", () => {
    const e = afterBattle(takenOut(), true);
    expect(e.alive).toBe(true);
    expect(e.engaged).toBe(false);
  });

  it("survives=false marks the enemy dead", () => {
    const e = afterBattle(takenOut(), false);
    expect(e.alive).toBe(false);
  });

  it("is a no-op on an enemy killed by wounds (not a survivable take-out)", () => {
    const [killed] = applyEnemyWound(goblin());
    expect(isTakenOutSurvivable(killed)).toBe(false);
    expect(afterBattle(killed, true)).toBe(killed);
    expect(afterBattle(killed, false)).toBe(killed);
  });

  it("is a no-op on an enemy still standing", () => {
    const up = chief();
    expect(isTakenOutSurvivable(up)).toBe(false);
    expect(afterBattle(up, false)).toBe(up);
  });
});

describe("spendPool — pool spend with the per-round Might cap", () => {
  it("decrements the pool and grants one die per point", () => {
    const [e, r] = spendPool(chief(), 2);
    expect(r.grantedDice).toBe(2);
    expect(e.pool).toBe(chief().pool - 2);
    expect(r.poolAfter).toBe(chief().pool - 2);
    expect(e.poolSpentThisRound).toBe(2);
    expect(r.weary).toBe(false);
  });

  it("caps the cumulative round spend at Might", () => {
    // chief Might = 2: a single spend of 2 is fine, but a third point in the round is not.
    const [e1] = spendPool(chief(), 2);
    expect(() => spendPool(e1, 1)).toThrow(/round cap/i);
  });

  it("rejects a spend larger than the remaining pool", () => {
    const g = goblin(); // pool 2
    expect(() => spendPool(g, 3)).toThrow(/only 2 pool/i);
  });

  it("rejects a negative or non-integer spend", () => {
    expect(() => spendPool(chief(), -1)).toThrow(/non-negative/i);
    expect(() => spendPool(chief(), 1.5)).toThrow(/integer/i);
  });

  it("a spend that empties the pool leaves the enemy weary", () => {
    // goblin pool 2, Might 1 -> only 1 may be spent per round; empty it across rounds.
    const [e1, r1] = spendPool(goblin(), 1);
    expect(r1.weary).toBe(false);
    const e1b = resetRoundPool(e1); // next round
    const [e2, r2] = spendPool(e1b, 1);
    expect(e2.pool).toBe(0);
    expect(r2.weary).toBe(true);
    expect(enemyIsWeary(e2)).toBe(true);
  });

  it("resetRoundPool clears the round budget and is identity when already 0", () => {
    const [e1] = spendPool(chief(), 1);
    expect(e1.poolSpentThisRound).toBe(1);
    const e2 = resetRoundPool(e1);
    expect(e2.poolSpentThisRound).toBe(0);
    expect(resetRoundPool(e2)).toBe(e2); // unchanged reference
  });

  it("allows spending up to Might across several smaller spends in one round", () => {
    const [e1] = spendPool(chief(), 1);
    const [e2] = spendPool(e1, 1); // total 2 == Might, ok
    expect(e2.poolSpentThisRound).toBe(2);
    expect(() => spendPool(e2, 1)).toThrow(/round cap/i);
  });
});

describe("enemyIsWeary — derived from an empty pool", () => {
  it("true at 0 pool, false otherwise", () => {
    expect(enemyIsWeary(goblin())).toBe(false);
    expect(enemyIsWeary({ ...goblin(), pool: 0 })).toBe(true);
  });
});
