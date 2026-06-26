/**
 * CLI demo: run the milestone fight (Wanderer vs orc soldier) deterministically,
 * without any LLM, and print a structured report. Mirror of journey.ts.
 *
 *   npm run combat            # default pack + seed
 *   tsx src/cli/combat.ts <packRoot> [seed]
 */

import type { RoundEvent } from "../combat/round.js";
import { runCombat, type CombatResult } from "../combat/runCombat.js";
import { loadPack } from "../pack/loadPack.js";
import { nodePackSource } from "../pack/nodeSource.js";
import { makeCombatScenario, minimalPolicy } from "./combatScenario.js";

export interface CombatReport {
  readonly seed: string;
  readonly outcome: CombatResult["outcome"];
  readonly rounds: number;
  readonly hero: {
    readonly endurance: number;
    readonly wounded: boolean;
    readonly dying: boolean;
    readonly dead: boolean;
    readonly hope: number;
  };
  readonly enemies: CombatResult["enemies"];
  readonly afterBattle: ReadonlyArray<{
    readonly enemyIndex: number;
    readonly survived: boolean;
    readonly answer: "yes" | "no";
  }>;
  readonly eventKinds: ReadonlyArray<RoundEvent["kind"]>;
}

/** Run the milestone fight end to end and produce a serialisable report. */
export function runDemoCombat(packRoot: string, seed: number | string): CombatReport {
  const pack = loadPack(nodePackSource(packRoot));
  const { combat, cfgs, answers, rng } = makeCombatScenario(pack, seed);
  const [result] = runCombat(combat, minimalPolicy, cfgs, answers, rng);
  return {
    seed: String(seed),
    outcome: result.outcome,
    rounds: result.rounds,
    hero: {
      endurance: result.hero.endurance.current,
      wounded: result.hero.wounded,
      dying: result.hero.dying,
      dead: result.hero.dead,
      hope: result.hero.hope.current,
    },
    enemies: result.enemies,
    afterBattle: result.afterBattle.map((r) => ({
      enemyIndex: r.enemyIndex,
      survived: r.survived,
      answer: r.decision.answer,
    })),
    eventKinds: result.events.map((e) => e.kind),
  };
}

/** CLI entry: `node combat.js <packRoot> [seed]`. Prints the report as JSON. */
function main(): void {
  const packRoot = process.argv[2];
  const seed = process.argv[3] ?? "ork-1";
  if (!packRoot) {
    process.stderr.write("usage: combat <packRoot> [seed]\n");
    process.exit(2);
    return;
  }
  const report = runDemoCombat(packRoot, seed);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

// Run main only when executed directly (not when imported by tests).
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) main();
