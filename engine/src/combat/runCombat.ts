/**
 * Tact 5b: the combat driver. Runs the melee-round loop to its end, then
 * resolves the after_battle survival phase, and projects a structured
 * CombatResult -- the seam Stage 2 (the narrative Keeper) reads.
 *
 * The driver only orchestrates. It CALLS the round cycle (startRound / runRound,
 * Tact 5a) and the enemy / oracle helpers (isTakenOutSurvivable,
 * resolveEnemySurvival, Tact 4); it never reimplements them, and it never
 * invents tactics. Tactics come from the injected CombatPolicy (pure, no RNG),
 * so the golden run is deterministic and Stage 2 can swap the policy for an
 * LLM-assisted one without touching the dice.
 *
 * Scope: the melee-rounds phase only. First volleys and surprise
 * (combat.posledovatelnost_boya: first_volleys -> melee_rounds) are out of 5b;
 * the CombatState is handed in already in the melee_rounds phase. The loop-exit
 * predicate is NOT re-derived here -- runRound reports combatEnded, itself built
 * from the phase rules (hero exited / hero down / no enemies left).
 */

import type { HeroState } from "../hero/state.js";
import type { OracleAnswersTable } from "../oracles/types.js";
import type { Rng } from "../rng/rng.js";
import { isTakenOutSurvivable } from "./adversary.js";
import type { CombatConfigs } from "./configs.js";
import { fail } from "./parse.js";
import { runRound, startRound, type RoundEvent, type RoundPlan } from "./round.js";
import { resolveEnemySurvival, type EnemyDecisionResult } from "./soloConduct.js";
import type { CombatState, EnemyState, HeroCombatFrame } from "./types.js";

/** Flat outcome of a fight (the journey seam, wired in a later tact). */
export type CombatOutcome = "hero_won" | "hero_down" | "hero_fled" | "hero_dead";

/**
 * The fate of one enemy at the end of combat, derived from its final state. The
 * four cases partition (alive, engaged): a future press_or_flee policy will add
 * a "fled" branch (alive && !engaged && Endurance > 0), which the current solo
 * engine never produces.
 */
export type EnemyFateStatus =
  | "destroyed" // killed by wounds during the fight (woundsTaken === Might)
  | "taken_out_survived" // out at 0 Endurance, after_battle: survives
  | "taken_out_died" // out at 0 Endurance, after_battle: dies
  | "still_standing"; // still engaged when combat ended (hero fled / went down)

export interface EnemyFate {
  readonly index: number;
  readonly key: string;
  readonly nameRu: string;
  readonly status: EnemyFateStatus;
}

/** One post-combat survival roll (the after_battle phase). */
export interface AfterBattleRoll {
  readonly enemyIndex: number;
  readonly survived: boolean;
  readonly decision: EnemyDecisionResult;
}

/**
 * The structured result of a whole fight: a flat summary for the journey seam
 * plus the full transcript for the Stage-2 narrative layer. `events` stays the
 * closed RoundEvent union owned by round.ts; the after_battle rolls live in
 * their own typed field rather than extending that union.
 */
export interface CombatResult {
  readonly outcome: CombatOutcome;
  readonly rounds: number;
  readonly hero: HeroState;
  readonly heroFrame: HeroCombatFrame;
  readonly enemies: readonly EnemyFate[];
  readonly events: readonly RoundEvent[];
  readonly afterBattle: readonly AfterBattleRoll[];
}

/**
 * The tactics provider. PURE: no RNG -- all randomness lives in the engine
 * (runRound threads it). planRound builds the player's plan for the upcoming
 * round; survivalLikelihood is the player's read for an enemy's after_battle
 * roll (null, or an absent function, selects the answers-table default). Binary
 * enemy decisions (press_or_flee / surrender) are an extension point a richer
 * policy may drive itself.
 */
export interface CombatPolicy {
  readonly planRound: (combat: CombatState, cfgs: CombatConfigs) => RoundPlan;
  readonly survivalLikelihood?: (enemy: EnemyState, combat: CombatState) => string | null;
}

/**
 * Engineering guard against a non-terminating fight (e.g. neither side can land
 * damage). NOT a rule literal -- a defensive cap, not a book number.
 */
export const MAX_COMBAT_ROUNDS = 100;

function replaceEnemy(combat: CombatState, index: number, enemy: EnemyState): CombatState {
  return { ...combat, enemies: combat.enemies.map((e, i) => (i === index ? enemy : e)) };
}

function enemyFate(enemy: EnemyState, index: number): EnemyFate {
  const status: EnemyFateStatus = !enemy.alive
    ? enemy.woundsTaken >= enemy.block.might
      ? "destroyed"
      : "taken_out_died"
    : enemy.engaged
      ? "still_standing"
      : "taken_out_survived";
  return { index, key: enemy.block.key, nameRu: enemy.block.nameRu, status };
}

function deriveOutcome(hero: HeroState, heroExited: boolean, heroDown: boolean): CombatOutcome {
  if (heroExited) return "hero_fled";
  if (hero.dead) return "hero_dead";
  if (heroDown) return "hero_down";
  return "hero_won";
}

/**
 * Drive a fight from a melee-phase CombatState to a CombatResult. Returns the
 * threaded RNG so a caller can continue the seeded stream after the fight.
 */
export function runCombat(
  combat: CombatState,
  policy: CombatPolicy,
  cfgs: CombatConfigs,
  answers: OracleAnswersTable,
  rng: Rng,
): readonly [CombatResult, Rng] {
  const events: RoundEvent[] = [];
  let state: CombatState = combat;
  let rngCur = rng;
  let heroExited = false;
  let heroDown = false;

  // --- melee-round loop: drive startRound -> runRound until combatEnded ---
  // Round 1 runs fresh; startRound (which bumps the round counter and resets
  // round-local state) is called only before each SUBSEQUENT round.
  let first = true;
  for (;;) {
    if (!first) state = startRound(state);
    first = false;
    const plan = policy.planRound(state, cfgs);
    const [outcome, next, rngNext] = runRound(state, plan, cfgs, rngCur);
    events.push(...outcome.events);
    state = next;
    rngCur = rngNext;
    heroExited = outcome.heroExited;
    heroDown = outcome.heroDown;
    if (outcome.combatEnded) break;
    if (state.round >= MAX_COMBAT_ROUNDS) {
      fail(`runCombat: exceeded ${MAX_COMBAT_ROUNDS} rounds without an end (non-terminating fight?)`);
    }
  }

  const rounds = state.round;

  // --- after_battle phase ---
  // Pack (adversaries.format_opisaniya): enemies taken out at 0 Endurance are,
  // AFTER the battle, still breathing and may survive if helped. Rolled once
  // over every survivable take-out, regardless of the hero's outcome.
  const afterBattle: AfterBattleRoll[] = [];
  state.enemies.forEach((enemy, index) => {
    if (!isTakenOutSurvivable(enemy)) return;
    const likelihood = policy.survivalLikelihood?.(enemy, state) ?? null;
    const [resolved, decision, rngNext] = resolveEnemySurvival(enemy, answers, likelihood, cfgs.dice, rngCur);
    rngCur = rngNext;
    state = replaceEnemy(state, index, resolved);
    afterBattle.push({ enemyIndex: index, survived: resolved.alive, decision });
  });

  const result: CombatResult = {
    outcome: deriveOutcome(state.hero, heroExited, heroDown),
    rounds,
    hero: state.hero,
    heroFrame: state.heroFrame,
    enemies: state.enemies.map((e, i) => enemyFate(e, i)),
    events,
    afterBattle,
  };
  return [result, rngCur] as const;
}
