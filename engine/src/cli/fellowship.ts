/**
 * CLI demo: run one Fellowship Phase (spiritual recovery, Yule extras,
 * improve-stats via the Progression driver, undertaking selection)
 * deterministically, without any LLM, and print a structured report. Mirror of
 * progression.ts / council.ts / combat.ts / journey.ts.
 *
 *   npm run fellowship          # default pack + label
 *   tsx src/cli/fellowship.ts <packRoot> [label]
 */

import { runFellowship } from "../fellowship/index.js";
import { loadPack } from "../pack/loadPack.js";
import { nodePackSource } from "../pack/nodeSource.js";
import { makeFellowshipScenario } from "./fellowshipScenario.js";

export interface FellowshipReport {
  readonly seed: string;
  readonly isYule: boolean;
  readonly duration: string;
  readonly place: string;
  readonly hope: { readonly current: number; readonly max: number };
  readonly hopeRestored: number;
  readonly yuleFullHope: boolean;
  readonly shadow: { readonly points: number; readonly scars: number };
  readonly shadowRemoved: number;
  readonly yuleBonusSkillPoints: number | null;
  readonly agedYears: number | null;
  readonly valour: number;
  readonly wisdom: number;
  readonly pools: { readonly adventurePoints: number; readonly skillPoints: number };
  readonly grants: ReadonlyArray<{ readonly kind: string; readonly key: string }>;
  readonly undertakings: readonly string[];
}

/** Run the Fellowship Phase and produce a serialisable, ASCII-only report. */
export function runDemoFellowship(packRoot: string, seed: number | string): FellowshipReport {
  const pack = loadPack(nodePackSource(packRoot));
  const { hero, input, cfg, progressionCfg } = makeFellowshipScenario(pack);
  const [result, finalHero] = runFellowship(hero, input, cfg, progressionCfg);
  return {
    seed: String(seed),
    isYule: result.isYule,
    duration: result.duration,
    place: result.place,
    hope: finalHero.hope,
    hopeRestored: result.recovery.hopeRestored,
    yuleFullHope: result.recovery.yuleFullHope,
    shadow: finalHero.shadow,
    shadowRemoved: result.recovery.shadowRemoved,
    yuleBonusSkillPoints: result.yule?.bonusSkillPoints ?? null,
    agedYears: result.yule?.agedYears ?? null,
    valour: finalHero.valour ?? 0,
    wisdom: finalHero.wisdom ?? 0,
    pools: finalHero.experience ?? { adventurePoints: 0, skillPoints: 0 },
    grants: result.progression.spend.grants.map((g) => ({ kind: g.kind, key: g.key })),
    undertakings: result.undertakingsChosen,
  };
}

/** CLI entry: `node fellowship.js <packRoot> [label]`. Prints the report as JSON. */
function main(): void {
  const packRoot = process.argv[2];
  const seed = process.argv[3] ?? "fellowship-yule-1";
  if (!packRoot) {
    process.stderr.write("usage: fellowship <packRoot> [label]\n");
    process.exit(2);
    return;
  }
  const report = runDemoFellowship(packRoot, seed);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

// Run main only when executed directly (not when imported by tests).
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) main();
