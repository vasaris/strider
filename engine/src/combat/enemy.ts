/**
 * Enemy stat blocks: derive a typed EnemyStatBlock from one entry of an
 * adversaries.* card, and spawn a live EnemyState from it. All Russian display
 * strings (names, weapon names, abilities, distinctive qualities) are opaque
 * pack content carried through; no enemy number is baked.
 */

import { asArray, asObject, fail, intField, paramsOf, strArray, strField } from "./parse.js";
import type { EnemyState, EnemyStatBlock, EnemyWeapon } from "./types.js";

function deriveWeapon(raw: unknown, where: string): EnemyWeapon {
  const o = asObject(raw, where);
  const special = o["special"] === undefined ? [] : strArray(o["special"], `${where}.special`);
  return {
    name: strField(o, "name", where),
    rating: intField(o, "rating", where),
    damage: intField(o, "damage", where),
    wound: intField(o, "wound", where),
    special,
  };
}

/** Parse one enemy entry (by key) from an adversaries.* card's raw JSON. */
export function deriveEnemyStatBlock(raw: unknown, enemyKey: string): EnemyStatBlock {
  const params = paramsOf(raw, `adversaries[${enemyKey}]`);
  const enemies = asObject(params["enemies"], "enemies");
  const entry = enemies[enemyKey];
  if (entry === undefined) {
    fail(`enemy key "${enemyKey}" not found; available: ${Object.keys(enemies).join(", ")}`);
  }
  const where = `enemies.${enemyKey}`;
  const o = asObject(entry, where);

  // Pool: an enemy carries either Hatred (servants/monsters) or Resolve (others).
  const hasHatred = o["hatred"] !== undefined;
  const hasResolve = o["resolve"] !== undefined;
  if (hasHatred === hasResolve) {
    fail(`${where}: expected exactly one of "hatred" or "resolve"`);
  }
  const poolKind = hasHatred ? "hatred" : "resolve";
  const pool = intField(o, poolKind, where);

  // Parry may be an integer modifier or null (no parry).
  const parryRaw = o["parry"];
  let parry: number | null;
  if (parryRaw === null) parry = null;
  else if (typeof parryRaw === "number" && Number.isInteger(parryRaw)) parry = parryRaw;
  else return fail(`${where}.parry: expected integer or null, got ${JSON.stringify(parryRaw)}`);

  const weaponsArr = asArray(o["weapons"], `${where}.weapons`);
  const weapons = weaponsArr.map((w, i) => deriveWeapon(w, `${where}.weapons[${i}]`));

  const abilities = o["abilities"] === undefined ? [] : strArray(o["abilities"], `${where}.abilities`);
  const distinctive = o["distinctive"] === undefined ? [] : strArray(o["distinctive"], `${where}.distinctive`);

  return {
    key: enemyKey,
    nameRu: strField(o, "name_ru", where),
    level: intField(o, "level", where),
    endurance: intField(o, "endurance", where),
    might: intField(o, "might", where),
    pool,
    poolKind,
    parry,
    armour: intField(o, "armour", where),
    weapons,
    abilities,
    distinctive,
  };
}

/** Spawn a live enemy at full Endurance and full pool, unwounded and engaged. */
export function spawnEnemy(block: EnemyStatBlock): EnemyState {
  return {
    block,
    endurance: block.endurance,
    pool: block.pool,
    poolSpentThisRound: 0,
    woundsTaken: 0,
    engaged: true,
    alive: true,
    attackDiceModUntilRoundEnd: 0,
  };
}
