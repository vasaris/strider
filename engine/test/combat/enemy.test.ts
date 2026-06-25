import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { enemyStatBlockFromPack } from "../../src/combat/fromPack.js";
import { deriveEnemyStatBlock, spawnEnemy } from "../../src/combat/enemy.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

const ORKI = "kv.mechanics.adversaries.orki";
const BAD_MEN = "kv.mechanics.adversaries.nedobrye_lyudi";

describe("enemyStatBlockFromPack — parses verified adversary stat blocks", () => {
  const pack = loadPack(nodePackSource(packRoot));

  it("derives a goblin archer, carrying Cyrillic content opaquely", () => {
    const goblin = enemyStatBlockFromPack(pack, ORKI, "goblin_luchnik");
    expect(goblin).toMatchObject({
      key: "goblin_luchnik",
      level: 2,
      endurance: 8,
      might: 1,
      pool: 2,
      poolKind: "hatred",
      parry: null,
      armour: 1,
    });
    expect(goblin.weapons).toHaveLength(2);
    expect(goblin.weapons[0]).toMatchObject({ rating: 3, damage: 3, wound: 14 });
    expect(goblin.weapons[0]?.special).toEqual(["Укол"]);
    expect(goblin.weapons[1]?.special).toEqual([]);
    expect(goblin.abilities).toEqual(["Орочий яд", "Трус"]);
    expect(goblin.nameRu.length).toBeGreaterThan(0);
    expect(goblin.distinctive.length).toBeGreaterThan(0);
  });

  it("derives a Might-2 great orc chieftain with multiple abilities", () => {
    const chief = enemyStatBlockFromPack(pack, ORKI, "velikiy_ork_glavar");
    expect(chief).toMatchObject({ level: 7, endurance: 48, might: 2, pool: 7, poolKind: "hatred", parry: 3, armour: 4 });
    expect(chief.weapons).toHaveLength(2);
    expect(chief.abilities.length).toBe(3);
  });

  it("reads Resolve (not Hatred) for non-monstrous foes", () => {
    const raider = enemyStatBlockFromPack(pack, BAD_MEN, "yuzhanin_naletchik");
    expect(raider.poolKind).toBe("resolve");
    expect(raider.pool).toBeGreaterThan(0);
  });

  it("throws on an unknown enemy key", () => {
    expect(() => enemyStatBlockFromPack(pack, ORKI, "no_such_orc")).toThrow(/not found/);
  });
});

describe("deriveEnemyStatBlock — pool invariant", () => {
  function card(entry: unknown): unknown {
    return { payload: { parameters: { enemies: { e: entry } } } };
  }
  const base = {
    name_ru: "x",
    level: 1,
    endurance: 5,
    might: 1,
    parry: 0,
    armour: 0,
    weapons: [],
  };

  it("rejects an entry carrying both Hatred and Resolve", () => {
    expect(() => deriveEnemyStatBlock(card({ ...base, hatred: 1, resolve: 1 }), "e")).toThrow(/hatred.*resolve|exactly one/i);
  });

  it("rejects an entry carrying neither", () => {
    expect(() => deriveEnemyStatBlock(card({ ...base }), "e")).toThrow(/exactly one/i);
  });
});

describe("spawnEnemy — full Endurance and pool, unwounded, engaged", () => {
  const pack = loadPack(nodePackSource(packRoot));
  const block = enemyStatBlockFromPack(pack, ORKI, "velikiy_ork_glavar");

  it("starts a fight at maximum resources", () => {
    const e = spawnEnemy(block);
    expect(e.endurance).toBe(block.endurance);
    expect(e.pool).toBe(block.pool);
    expect(e.woundsTaken).toBe(0);
    expect(e.poolSpentThisRound).toBe(0);
    expect(e.engaged).toBe(true);
    expect(e.alive).toBe(true);
    expect(e.block).toBe(block);
  });
});
