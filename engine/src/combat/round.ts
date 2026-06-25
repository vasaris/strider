/**
 * The solo melee round cycle (Tact 5), the combat analogue of journey/run.ts:
 * pure functions threading immutable state and RNG. It owns the DICE and the
 * action economy, never the tactics -- which stance, which target, which weapon,
 * whether an enemy spends pool are the player's calls, carried in a RoundPlan
 * (the solo collapse puts the lone hero as every enemy's target). Binary enemy
 * uncertainties go through the answers oracle (soloConduct), not here.
 *
 * Round steps (kv.mechanics.combat.shagi_v_raunde_blizhnego_boya):
 *   1. position  -- the hero picks a stance.
 *   2. grapple   -- in solo a no-op for targeting: the lone hero is every
 *                   enemy's only target; the grapple-limit bookkeeping that
 *                   matters in a party collapses here.
 *   3. take_actions -- heroes act first (one main + one secondary), then every
 *                   engaged enemy makes Might attacks against the hero.
 *
 * Debts paid here: round-local reset (#1 pool, #4 driven-back budget + parry
 * buff + Shield Thrust debuff), grantedDice woven via extraSuccessDice (#2),
 * hero special-damage data applied through resolveFullAttack (#3), and the
 * driven-back stance restoration (#4). The Eye is deliberately NOT grown from
 * the combat Feat die (eye growth is never called here; in-combat the Eye only
 * matters as the hero's worst Feat result, already handled in evaluateAttackRoll).
 */

import { evaluateCheck } from "../checks/evaluate.js";
import { targetNumber } from "../checks/targetNumber.js";
import type { CheckResult } from "../checks/types.js";
import { checkConditions, heroFeatModifier } from "../conditions/derive.js";
import { rollCheckDice } from "../dice/roll.js";
import type { Rng } from "../rng/rng.js";
import { resetRoundPool, spendPool } from "./adversary.js";
import type { CombatConfigs } from "./configs.js";
import type { ExitMethodKey } from "./exit.js";
import { resolveExit } from "./exit.js";
import { fail } from "./parse.js";
import { heroIsDown, resolveFullAttack } from "./pipeline.js";
import type { SpecialDamageSpends } from "./specialDamage.js";
import type { CombatState, CombatTaskKey, EnemyState, StanceKey } from "./types.js";

// --- the player's plan for one round (engine owns dice, not tactics) ---

export type HeroMainAction =
  | { readonly kind: "attack"; readonly targetEnemyIndex: number }
  | { readonly kind: "task"; readonly task: CombatTaskKey }
  | { readonly kind: "exit"; readonly method: ExitMethodKey; readonly targetEnemyIndex?: number }
  | { readonly kind: "restore_stance" }
  | { readonly kind: "other" }; // move, pick up a dropped weapon, carry an ally, etc.

/** Secondary actions are recorded for the transcript; none has a mechanical effect in Tact 5. */
export type HeroSecondaryAction = "advance" | "retreat" | "draw_weapon" | "look_around" | "drop_load" | "none";

export interface EnemyTurnPlan {
  readonly enemyIndex: number;
  readonly weaponIndex?: number;
  /** Hatred/Resolve to spend this turn (validated, capped at Might); grants +1 die each. */
  readonly poolSpend?: number;
  /** The hero elects to be driven back to halve this enemy's incoming damage (once/round). */
  readonly heroElectsDrivenBack?: boolean;
}

export interface RoundPlan {
  readonly heroStance: StanceKey;
  readonly heroMain: HeroMainAction;
  readonly heroSecondary?: HeroSecondaryAction;
  /** Special-damage signs to spend if heroMain is an attack that hits. */
  readonly heroSpecialSpends?: SpecialDamageSpends;
  /** One entry per enemy that acts this round (order = action order in solo). */
  readonly enemyPlans: readonly EnemyTurnPlan[];
}

// --- structured transcript: the engine reports facts, no prose ---

export type RoundEvent =
  | { readonly kind: "stance"; readonly stance: StanceKey }
  | {
      readonly kind: "hero_attack";
      readonly targetEnemyIndex: number;
      readonly hit: boolean;
      readonly enduranceLoss: number;
      readonly signsSpent: number;
      readonly piercing: boolean;
      readonly wounded: boolean;
      readonly enemyTakenOut: boolean;
    }
  | {
      readonly kind: "hero_task";
      readonly task: CombatTaskKey;
      readonly outcome: CheckResult["outcome"];
      readonly successIcons: number;
      /** Opaque effect string from the pack; the buff is NOT applied in Tact 5 (deferred to solo backfill). */
      readonly effectOpaque: string;
      readonly buffApplied: false;
    }
  | { readonly kind: "hero_exit"; readonly method: ExitMethodKey; readonly left: boolean }
  | { readonly kind: "hero_restore_stance" }
  | { readonly kind: "hero_main_other" }
  | { readonly kind: "hero_secondary"; readonly action: HeroSecondaryAction }
  | {
      readonly kind: "enemy_attack";
      readonly enemyIndex: number;
      readonly attackNumber: number; // 1..Might
      readonly grantedDice: number;
      readonly hit: boolean;
      readonly enduranceLoss: number;
      readonly drivenBack: boolean;
      readonly piercing: boolean;
      readonly wounded: boolean;
      readonly heroDown: boolean;
    }
  | { readonly kind: "round_end"; readonly round: number };

export interface RoundOutcome {
  readonly events: readonly RoundEvent[];
  readonly combatEnded: boolean;
  readonly heroExited: boolean;
  readonly heroDown: boolean;
}

// --- round boundary reset (Debts #1, #4) ---

/**
 * Reset all round-local state at a round boundary: every enemy's per-round pool
 * budget and Shield-Thrust debuff, and the hero's driven-back budget and Fend
 * Off parry buff. `outOfPosition` is NOT reset -- it persists until a
 * restore_stance main action clears it. Increments the round counter.
 */
export function startRound(combat: CombatState): CombatState {
  const enemies = combat.enemies.map((e) => {
    const pooled = resetRoundPool(e);
    return pooled.attackDiceModUntilRoundEnd === 0 ? pooled : { ...pooled, attackDiceModUntilRoundEnd: 0 };
  });
  const heroFrame =
    combat.heroFrame.drivenBackUsedThisRound || combat.heroFrame.parryBonusThisRound !== 0
      ? { ...combat.heroFrame, drivenBackUsedThisRound: false, parryBonusThisRound: 0 }
      : combat.heroFrame;
  return { ...combat, enemies, heroFrame, round: combat.round + 1 };
}

// --- helpers ---

/** Resolve a combat-task skill check (used by a task main action). */
function runTaskCheck(combat: CombatState, skill: string, cfgs: CombatConfigs, rng: Rng): readonly [CheckResult, Rng] {
  const attribute = cfgs.skillAttribute[skill];
  if (attribute === undefined) fail(`runTaskCheck: unknown task skill "${skill}"`);
  const skillRating = combat.hero.skills[skill] ?? 0;
  const tn = targetNumber(combat.hero.attributes[attribute], cfgs.check);
  const [roll, next] = rollCheckDice(
    cfgs.dice,
    { abilityRating: skillRating, featModifier: heroFeatModifier(combat.hero), bonusSuccessDice: 0, penaltySuccessDice: 0 },
    rng,
  );
  return [evaluateCheck(roll, tn, cfgs.check, checkConditions(combat.hero, cfgs.conditions)), next] as const;
}

/** Number of attacks an enemy makes per round = its Might (format_opisaniya). */
function attacksPerRound(enemy: EnemyState): number {
  return enemy.block.might;
}

// --- hero turn ---

function runHeroMain(
  combat: CombatState,
  plan: RoundPlan,
  cfgs: CombatConfigs,
  rng: Rng,
): readonly [RoundEvent, CombatState, Rng, boolean] {
  // Being out of position forces the hero to restore before anything else
  // (driven_back.cost = next_main_action_restores_stance). The engine owns this
  // rule; the planned main is overridden until the hero is back in position.
  if (combat.heroFrame.outOfPosition && cfgs.attack.drivenBackCostsMainAction) {
    const next = { ...combat, heroFrame: { ...combat.heroFrame, outOfPosition: false } };
    return [{ kind: "hero_restore_stance" }, next, rng, false] as const;
  }

  const main = plan.heroMain;
  switch (main.kind) {
    case "attack": {
      const [res, next, rng2] = resolveFullAttack(
        combat,
        { attacker: "hero", target: { enemyIndex: main.targetEnemyIndex } },
        plan.heroSpecialSpends,
        cfgs,
        rng,
      );
      const event: RoundEvent = {
        kind: "hero_attack",
        targetEnemyIndex: main.targetEnemyIndex,
        hit: res.base.hit,
        enduranceLoss: res.base.enduranceLoss + (res.special?.extraEnduranceLoss ?? 0),
        signsSpent: res.special?.signsSpent ?? 0,
        piercing: res.piercing?.woundTriggered === true || res.base.piercingTriggered,
        wounded: res.wound !== undefined,
        enemyTakenOut: res.enemyTakenOut,
      };
      return [event, next, rng2, false] as const;
    }
    case "task": {
      const taskSpec = cfgs.combat.tasks[main.task];
      const [check, rng2] = runTaskCheck(combat, taskSpec.skill, cfgs, rng);
      const event: RoundEvent = {
        kind: "hero_task",
        task: main.task,
        outcome: check.outcome,
        successIcons: check.successIcons,
        effectOpaque: taskSpec.effect.onSuccess,
        buffApplied: false,
      };
      return [event, combat, rng2, false] as const;
    }
    case "exit": {
      const [exit, next, rng2] = resolveExit(combat, main.method, cfgs, rng, main.targetEnemyIndex);
      return [{ kind: "hero_exit", method: main.method, left: exit.left }, next, rng2, exit.left] as const;
    }
    case "restore_stance": {
      const next = combat.heroFrame.outOfPosition
        ? { ...combat, heroFrame: { ...combat.heroFrame, outOfPosition: false } }
        : combat;
      return [{ kind: "hero_restore_stance" }, next, rng, false] as const;
    }
    case "other":
      return [{ kind: "hero_main_other" }, combat, rng, false] as const;
    default:
      return fail(`runHeroMain: unhandled main action`);
  }
}

// --- one enemy's turn: Might attacks against the lone hero ---

function runEnemyTurn(
  combat: CombatState,
  plan: EnemyTurnPlan,
  cfgs: CombatConfigs,
  rng: Rng,
): readonly [readonly RoundEvent[], CombatState, Rng] {
  const events: RoundEvent[] = [];
  let state = combat;
  let rngCur = rng;

  const enemy0 = state.enemies[plan.enemyIndex];
  if (enemy0 === undefined || !enemy0.engaged || !enemy0.alive) return [events, state, rngCur] as const;

  // Spend pool (if any) once for this turn -> grantedDice on the first attack.
  let grantedDice = 0;
  if (plan.poolSpend !== undefined && plan.poolSpend > 0) {
    const [spent, res] = spendPool(enemy0, plan.poolSpend);
    grantedDice = res.grantedDice;
    state = { ...state, enemies: state.enemies.map((e, i) => (i === plan.enemyIndex ? spent : e)) };
  }

  const attacks = attacksPerRound(enemy0);
  for (let k = 0; k < attacks; k++) {
    const enemy = state.enemies[plan.enemyIndex];
    if (enemy === undefined || !enemy.engaged || !enemy.alive) break;
    if (heroIsDown(state)) break;

    // Round-local debuff (Shield Thrust) plus this enemy's pool dice on attack #1.
    const extra = enemy.attackDiceModUntilRoundEnd + (k === 0 ? grantedDice : 0);

    // Fold the round-local parry buff into the TN only for this roll, then restore.
    const baseParry = state.heroFrame.parryRating;
    const buff = state.heroFrame.parryBonusThisRound;
    const rollState =
      buff > 0 ? { ...state, heroFrame: { ...state.heroFrame, parryRating: baseParry + buff } } : state;

    const [res, afterRoll, rng2] = resolveFullAttack(
      rollState,
      {
        attacker: { enemyIndex: plan.enemyIndex },
        target: "hero",
        ...(plan.weaponIndex !== undefined ? { enemyWeaponIndex: plan.weaponIndex } : {}),
        ...(plan.heroElectsDrivenBack === true ? { heroDrivenBack: true } : {}),
        ...(extra !== 0 ? { extraSuccessDice: extra } : {}),
      },
      undefined,
      cfgs,
      rngCur,
    );
    rngCur = rng2;

    // Restore the base parry; mark out-of-position if the hero was driven back.
    let restored = buff > 0 ? { ...afterRoll, heroFrame: { ...afterRoll.heroFrame, parryRating: baseParry } } : afterRoll;
    if (res.base.drivenBackApplied) {
      restored = { ...restored, heroFrame: { ...restored.heroFrame, outOfPosition: true } };
    }
    state = restored;

    events.push({
      kind: "enemy_attack",
      enemyIndex: plan.enemyIndex,
      attackNumber: k + 1,
      grantedDice: k === 0 ? grantedDice : 0,
      hit: res.base.hit,
      enduranceLoss: res.base.enduranceLoss,
      drivenBack: res.base.drivenBackApplied,
      piercing: res.piercing?.woundTriggered === true || res.base.piercingTriggered,
      wounded: res.wound !== undefined,
      heroDown: heroIsDown(state),
    });
  }

  return [events, state, rngCur] as const;
}

// --- combat-end predicate ---

function noEnemiesLeft(combat: CombatState): boolean {
  return combat.enemies.every((e) => !e.engaged || !e.alive);
}

// --- the round ---

/**
 * Run one full round on the given combat state (assumed already reset for this
 * round by startRound, except round 1 which starts fresh). Returns the
 * structured transcript, the post-round state, and the threaded RNG. Round-local
 * reset for the NEXT round is the driver's job via startRound.
 */
export function runRound(
  combat: CombatState,
  plan: RoundPlan,
  cfgs: CombatConfigs,
  rng: Rng,
): readonly [RoundOutcome, CombatState, Rng] {
  const events: RoundEvent[] = [];
  let rngCur = rng;

  // 1. position
  let state: CombatState = { ...combat, heroFrame: { ...combat.heroFrame, stance: plan.heroStance } };
  events.push({ kind: "stance", stance: plan.heroStance });

  // 2. grapple -- no-op for solo targeting (single hero is every enemy's target).

  // 3a. hero acts first (main, then secondary).
  let heroExited = false;
  {
    const [mainEvent, afterMain, rngM, exited] = runHeroMain(state, plan, cfgs, rngCur);
    events.push(mainEvent);
    state = afterMain;
    rngCur = rngM;
    heroExited = exited;
    if (plan.heroSecondary !== undefined && plan.heroSecondary !== "none") {
      events.push({ kind: "hero_secondary", action: plan.heroSecondary });
    }
  }

  // 3b. enemies act, unless the hero already left or the fight is over.
  if (!heroExited && !heroIsDown(state) && !noEnemiesLeft(state)) {
    for (const ep of plan.enemyPlans) {
      if (heroIsDown(state)) break;
      const [evs, afterEnemy, rngE] = runEnemyTurn(state, ep, cfgs, rngCur);
      events.push(...evs);
      state = afterEnemy;
      rngCur = rngE;
    }
  }

  events.push({ kind: "round_end", round: state.round });

  const heroDown = heroIsDown(state);
  const combatEnded = heroExited || heroDown || noEnemiesLeft(state);
  return [{ events, combatEnded, heroExited, heroDown }, state, rngCur] as const;
}
