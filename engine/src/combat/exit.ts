/**
 * Leaving an unwinnable fight (kv.mechanics.combat.vyhod_iz_boya, the "fly you
 * fools" rule). Two methods, both gated on the hero's stance (read from CombatConfig.exit, never
 * baked):
 *  - ranged   : from the ranged stance, no roll; the hero leaves on their turn.
 *  - defensive: from the defensive stance, an ordinary attack check; on success
 *               the hero leaves the field INSTEAD of dealing damage, on failure
 *               remains engaged.
 *
 * The defensive method reuses resolveAttack for the roll (so stance and condition
 * modifiers apply exactly as in a normal attack) and then DISCARDS the damage:
 * the rules say the hero leaves instead of harming the target, so no Endurance is
 * lost either way. Only the RNG is consumed. Whether the hero has actually left
 * is reported via `left`; the combat driver ends the fight for that hero.
 */

import type { Rng } from "../rng/rng.js";
import { resolveAttack } from "./attack.js";
import type { CombatConfigs } from "./configs.js";
import { fail } from "./parse.js";
import type { AttackOutcome, CombatState, ExitMethod } from "./types.js";

export type ExitMethodKey = "ranged" | "defensive" | "maneuver";

export interface ExitResult {
  /** The hero successfully left the field this turn. */
  readonly left: boolean;
  readonly method: ExitMethodKey;
  /** The attack check rolled for the defensive method (absent for ranged). */
  readonly attack?: AttackOutcome;
  /** Why the method was unavailable, when `left` is false without a roll. */
  readonly unavailableReason?: string;
}

/** First still-fighting enemy, or null when none remain to roll the exit against. */
function firstEngagedEnemyIndex(combat: CombatState): number | null {
  for (let i = 0; i < combat.enemies.length; i++) {
    const e = combat.enemies[i];
    if (e !== undefined && e.engaged && e.alive) return i;
  }
  return null;
}

/**
 * Attempt to leave the fight by the given method. `targetEnemyIndex` selects the
 * enemy the defensive exit attack is rolled against (defaults to the first
 * engaged enemy). The combat state is returned unchanged for both methods (exit
 * deals no damage); the RNG advances only for the defensive method's roll.
 */
export function resolveExit(
  combat: CombatState,
  method: ExitMethodKey,
  cfgs: CombatConfigs,
  rng: Rng,
  targetEnemyIndex?: number,
): readonly [ExitResult, CombatState, Rng] {
  // Manoeuvre-position leave-combat: a ranged-attack check WITHOUT the manoeuvre
  // ranged penalty ("ne ubiraya 1k"); on success the hero leaves dealing no
  // damage. Any pending Advance bonus dice may be spent on the attempt.
  if (method === "maneuver") {
    if (combat.heroFrame.stance !== "ranged") {
      return [{ left: false, method, unavailableReason: "requires ranged stance" }, combat, rng] as const;
    }
    const index = targetEnemyIndex ?? firstEngagedEnemyIndex(combat);
    const pending = combat.heroFrame.pendingRangedBonusDice;
    const cleared =
      pending > 0
        ? { ...combat, heroFrame: { ...combat.heroFrame, pendingRangedBonusDice: 0 } }
        : combat;
    if (index === null) {
      return [{ left: true, method }, cleared, rng] as const;
    }
    const [outcome, , rng2] = resolveAttack(
      combat,
      { attacker: "hero", target: { enemyIndex: index }, ...(pending > 0 ? { extraSuccessDice: pending } : {}) },
      cfgs,
      rng,
    );
    return [{ left: outcome.hit, method, attack: outcome }, cleared, rng2] as const;
  }

  const spec: ExitMethod = method === "ranged" ? cfgs.combat.exit.rangedExit : cfgs.combat.exit.defensiveExit;

  // Both methods require the hero to already hold the matching stance.
  if (combat.heroFrame.stance !== spec.requiresStance) {
    return [
      { left: false, method, unavailableReason: `requires ${spec.requiresStance} stance` },
      combat,
      rng,
    ] as const;
  }

  if (!spec.requiresRoll) {
    // Ranged exit: leave on your turn, no roll.
    return [{ left: true, method }, combat, rng] as const;
  }

  // Defensive exit: an ordinary attack check; success leaves instead of damaging.
  const index = targetEnemyIndex ?? firstEngagedEnemyIndex(combat);
  if (index === null) {
    // No enemy to roll against: nothing is blocking the hero, treat as a free leave.
    return [{ left: true, method }, combat, rng] as const;
  }
  const [outcome, , rng2] = resolveAttack(combat, { attacker: "hero", target: { enemyIndex: index } }, cfgs, rng);
  // Discard resolveAttack's state mutation: the exit deals no damage on a hit.
  return [{ left: outcome.hit, method, attack: outcome }, combat, rng2] as const;
}

/** Guard against a programming error: the two methods are the only valid keys. */
export function assertExitMethod(v: string): ExitMethodKey {
  if (v === "ranged" || v === "defensive" || v === "maneuver") return v;
  return fail(`resolveExit: unknown method ${JSON.stringify(v)}`);
}
