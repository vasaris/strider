/**
 * Adversary mechanics (Tact 4): the enemy-side resource and damage rules that
 * the hero side already owns. All pure (no RNG): the Piercing roll has already
 * happened upstream (resolvePiercing); here we only apply its outcome and manage
 * the Hatred/Resolve pool. Every magnitude comes from the enemy's stat block
 * (block.might) -- no book number is baked.
 *
 * kv.mechanics.adversaries.format_opisaniya:
 *  - Might = wounds needed to destroy the enemy AND attacks per round.
 *  - An enemy is TAKEN OUT at 0 Endurance (may survive: after_battle); a kill is
 *    woundsTaken === might.
 *  - Pool (Hatred or Resolve) plays the role of Hope: spend <= Might per round;
 *    an enemy with no pool counts as weary.
 */

import { fail } from "./parse.js";
import type { EnemyState } from "./types.js";

// --- weary derivation (centralises the inline check used by attack.ts) ---

/** An enemy with no Hatred/Resolve points counts as weary (format_opisaniya). */
export function enemyIsWeary(enemy: EnemyState): boolean {
  return enemy.pool === 0;
}

// --- applying a wound to an enemy (Debt #1) ---

/** What happened when a wound landed on an enemy (for transcripts / the loop). */
export type EnemyWoundEvent =
  | { readonly kind: "wounded"; readonly woundsTaken: number; readonly woundsToDestroy: number }
  | { readonly kind: "destroyed"; readonly woundsTaken: number };

/**
 * Apply one wound to an enemy (the upstream Piercing roll already failed for the
 * defender). Increment woundsTaken; once it reaches the enemy's Might the enemy
 * is destroyed: killed (alive=false) and removed from the fight (engaged=false).
 * Pure; idempotent guard: a wound on an already-destroyed enemy is a no-op.
 */
export function applyEnemyWound(enemy: EnemyState): readonly [EnemyState, EnemyWoundEvent] {
  const might = enemy.block.might;
  if (!enemy.alive) {
    return [enemy, { kind: "destroyed", woundsTaken: enemy.woundsTaken }] as const;
  }
  const woundsTaken = enemy.woundsTaken + 1;
  if (woundsTaken >= might) {
    const next: EnemyState = { ...enemy, woundsTaken, alive: false, engaged: false };
    return [next, { kind: "destroyed", woundsTaken }] as const;
  }
  const next: EnemyState = { ...enemy, woundsTaken };
  return [next, { kind: "wounded", woundsTaken, woundsToDestroy: might }] as const;
}

// --- after_battle survival of an out-at-0-Endurance enemy ---

/** True for an enemy taken out at 0 Endurance that was not killed by wounds. */
export function isTakenOutSurvivable(enemy: EnemyState): boolean {
  return !enemy.engaged && enemy.alive && enemy.endurance === 0 && enemy.woundsTaken < enemy.block.might;
}

/**
 * Resolve the post-battle fate of an enemy taken out at 0 Endurance: on `survives`
 * the enemy stays alive (incapacitated / captured / can be helped); otherwise it
 * dies. `survives` comes from the solo answers oracle (see soloConduct). A no-op
 * for an enemy that is not a survivable take-out (already killed, or still up).
 */
export function afterBattle(enemy: EnemyState, survives: boolean): EnemyState {
  if (!isTakenOutSurvivable(enemy)) return enemy;
  if (survives) return enemy; // alive already true; remains out of combat
  return { ...enemy, alive: false };
}

// --- Hatred / Resolve pool spending ---

/** The result of spending pool: the dice it grants and the post-spend weariness. */
export interface PoolSpendResult {
  /** Success dice this spend grants on a combat check (lower pool by 1 -> +1 die). */
  readonly grantedDice: number;
  readonly poolAfter: number;
  readonly spentThisRoundAfter: number;
  readonly weary: boolean;
}

/**
 * Spend `amount` points of the enemy's Hatred/Resolve. Two invariants from
 * format_opisaniya: a spend cannot exceed the remaining pool, and the cumulative
 * spend in a round cannot exceed the enemy's Might. Spending `n` grants `n`
 * Success dice on the fuelled check (or fuels an ability of that cost; the
 * effect itself is opaque and applied by the loop / player). An enemy left at 0
 * pool counts as weary.
 */
export function spendPool(enemy: EnemyState, amount: number): readonly [EnemyState, PoolSpendResult] {
  if (!Number.isInteger(amount) || amount < 0) fail(`spendPool: amount must be a non-negative integer, got ${amount}`);
  if (amount > enemy.pool) fail(`spendPool: cannot spend ${amount}, only ${enemy.pool} pool remaining`);
  const roundCap = enemy.block.might;
  const spentAfter = enemy.poolSpentThisRound + amount;
  if (spentAfter > roundCap) {
    fail(`spendPool: round cap exceeded (Might=${roundCap}, already spent ${enemy.poolSpentThisRound}, +${amount})`);
  }
  const poolAfter = enemy.pool - amount;
  const next: EnemyState = { ...enemy, pool: poolAfter, poolSpentThisRound: spentAfter };
  return [
    next,
    { grantedDice: amount, poolAfter, spentThisRoundAfter: spentAfter, weary: poolAfter === 0 },
  ] as const;
}

/** Reset an enemy's per-round pool budget. A hook for the round boundary (Tact 5). */
export function resetRoundPool(enemy: EnemyState): EnemyState {
  if (enemy.poolSpentThisRound === 0) return enemy;
  return { ...enemy, poolSpentThisRound: 0 };
}
