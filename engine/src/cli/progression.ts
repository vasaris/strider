/**
 * CLI demo: run one between-adventures growth pass (earn from milestones, spend
 * a plan, advance the Shadow Path) deterministically, without any LLM, and print
 * a structured report. Mirror of council.ts / combat.ts / journey.ts.
 *
 *   npm run progression          # default pack + label
 *   tsx src/cli/progression.ts <packRoot> [label]
 */

import { loadPack } from "../pack/loadPack.js";
import { nodePackSource } from "../pack/nodeSource.js";
import { runProgression } from "../progression/index.js";
import { makeProgressionScenario } from "./progressionScenario.js";

export interface ProgressionReport {
  readonly seed: string;
  readonly earned: { readonly adventurePoints: number; readonly skillPoints: number };
  readonly spent: { readonly adventurePoints: number; readonly skillPoints: number };
  readonly pools: { readonly adventurePoints: number; readonly skillPoints: number };
  readonly valour: number;
  readonly wisdom: number;
  readonly grants: ReadonlyArray<{ readonly kind: string; readonly key: string }>;
  readonly shadowPath: string | null;
  readonly flawsGained: number;
  readonly succumbed: boolean;
  readonly milestonesReached: number;
}

/** Run the milestone progression and produce a serialisable, ASCII-only report. */
export function runDemoProgression(packRoot: string, seed: number | string): ProgressionReport {
  const pack = loadPack(nodePackSource(packRoot));
  const { hero, input, cfg } = makeProgressionScenario(pack);
  const [result, finalHero] = runProgression(hero, input, cfg);
  const lastStep = result.shadowSteps[result.shadowSteps.length - 1];
  return {
    seed: String(seed),
    earned: { adventurePoints: result.earn.adventurePointsGained, skillPoints: result.earn.skillPointsGained },
    spent: { adventurePoints: result.spend.adventurePointsSpent, skillPoints: result.spend.skillPointsSpent },
    pools: finalHero.experience ?? { adventurePoints: 0, skillPoints: 0 },
    valour: finalHero.valour ?? 0,
    wisdom: finalHero.wisdom ?? 0,
    grants: result.spend.grants.map((g) => ({ kind: g.kind, key: g.key })),
    shadowPath: finalHero.shadowPath?.key ?? null,
    flawsGained: finalHero.shadowPath?.flawsGained ?? 0,
    succumbed: lastStep?.succumbed ?? false,
    milestonesReached: (finalHero.milestonesReached ?? []).length,
  };
}

/** CLI entry: `node progression.js <packRoot> [label]`. Prints the report as JSON. */
function main(): void {
  const packRoot = process.argv[2];
  const seed = process.argv[3] ?? "progression-1";
  if (!packRoot) {
    process.stderr.write("usage: progression <packRoot> [label]\n");
    process.exit(2);
    return;
  }
  const report = runDemoProgression(packRoot, seed);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

// Run main only when executed directly (not when imported by tests).
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) main();
