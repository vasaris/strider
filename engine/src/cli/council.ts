/**
 * CLI demo: run the milestone council (Wanderer asks a neutral audience a
 * reasonable favour) deterministically, without any LLM, and print a structured
 * report. Mirror of combat.ts / journey.ts.
 *
 *   npm run council            # default pack + seed
 *   tsx src/cli/council.ts <packRoot> [seed]
 */

import { runCouncil, type CouncilEvent, type CouncilResult } from "../council/index.js";
import { loadPack } from "../pack/loadPack.js";
import { nodePackSource } from "../pack/nodeSource.js";
import { makeCouncilScenario, minimalPolicy } from "./councilScenario.js";

export interface CouncilReport {
  readonly seed: string;
  readonly outcome: CouncilResult["outcome"];
  readonly resistance: number;
  readonly accumulated: number;
  readonly duration: number;
  readonly attemptsUsed: number;
  readonly introductionSucceeded: boolean;
  readonly eventKinds: ReadonlyArray<CouncilEvent["kind"]>;
}

/** Run the milestone council end to end and produce a serialisable report. */
export function runDemoCouncil(packRoot: string, seed: number | string): CouncilReport {
  const pack = loadPack(nodePackSource(packRoot));
  const { hero, setup, cfgs, rng } = makeCouncilScenario(pack, seed);
  const [result] = runCouncil(hero, setup, minimalPolicy, cfgs, rng);
  return {
    seed: String(seed),
    outcome: result.outcome,
    resistance: result.resistance,
    accumulated: result.accumulated,
    duration: result.duration,
    attemptsUsed: result.attemptsUsed,
    introductionSucceeded: result.introductionSucceeded,
    eventKinds: result.events.map((e) => e.kind),
  };
}

/** CLI entry: `node council.js <packRoot> [seed]`. Prints the report as JSON. */
function main(): void {
  const packRoot = process.argv[2];
  const seed = process.argv[3] ?? "council-m10";
  if (!packRoot) {
    process.stderr.write("usage: council <packRoot> [seed]\n");
    process.exit(2);
    return;
  }
  const report = runDemoCouncil(packRoot, seed);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

// Run main only when executed directly (not when imported by tests).
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) main();
