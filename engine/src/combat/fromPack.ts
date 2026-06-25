/**
 * Wire the combat derivers to a loaded, verified Pack. Card ids are the only
 * place the combat subsystem names pack content; the derivers themselves are
 * pack-agnostic (they take raw JSON), keeping them unit-testable with stubs.
 */

import type { Pack } from "../pack/pack.js";
import { deriveCombatConfig } from "./config.js";
import { deriveAttackConfig } from "./attack.js";
import { deriveEnemyStatBlock } from "./enemy.js";
import type { AttackConfig, CombatConfig, EnemyStatBlock } from "./types.js";

/** Build the CombatConfig from the four verified combat rule cards. */
export function combatConfigFromPack(pack: Pack): CombatConfig {
  return deriveCombatConfig(
    pack.requireById("kv.mechanics.combat.shagi_v_raunde_blizhnego_boya").raw,
    pack.requireById("kv.mechanics.combat.boevye_zadachi").raw,
    pack.requireById("kv.mechanics.combat.oslozhneniya_i_preimuschestva").raw,
    pack.requireById("kv.mechanics.combat.vyhod_iz_boya").raw,
  );
}

/** Build the AttackConfig from kv.mechanics.combat.sovershenie_atak. */
export function attackConfigFromPack(pack: Pack): AttackConfig {
  return deriveAttackConfig(pack.requireById("kv.mechanics.combat.sovershenie_atak").raw);
}

/** Build one enemy stat block, e.g. (pack, "kv.mechanics.adversaries.orki", "goblin_luchnik"). */
export function enemyStatBlockFromPack(pack: Pack, cardId: string, enemyKey: string): EnemyStatBlock {
  return deriveEnemyStatBlock(pack.requireById(cardId).raw, enemyKey);
}
