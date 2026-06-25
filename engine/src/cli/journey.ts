import { journeyConfigsFromPack } from "../journey/config.js";
import { runJourney } from "../journey/run.js";
import type { JourneyState } from "../journey/state.js";
import { loadPack } from "../pack/loadPack.js";
import { nodePackSource } from "../pack/nodeSource.js";
import { makeMilestoneState } from "./scenario.js";

export interface JourneyReport {
  readonly seed: string;
  readonly arrived: boolean;
  readonly durationDays: number;
  readonly hero: {
    readonly hope: number;
    readonly shadow: number;
    readonly fatigue: number;
    readonly eyeAwareness: number;
    readonly wounded: boolean;
  };
  readonly log: JourneyState["log"];
}

/** Run the milestone journey end to end and produce a serialisable report. */
export function runMilestoneJourney(packRoot: string, seed: number | string): JourneyReport {
  const pack = loadPack(nodePackSource(packRoot));
  const cfg = journeyConfigsFromPack(pack);
  const final = runJourney(makeMilestoneState(cfg, seed), cfg);
  return {
    seed: String(seed),
    arrived: final.journey.arrived,
    durationDays: final.journey.durationDays,
    hero: {
      hope: final.hero.hope.current,
      shadow: final.hero.shadow.points,
      fatigue: final.hero.fatigue,
      eyeAwareness: final.hero.eye.awareness,
      wounded: final.hero.wounded,
    },
    log: final.log,
  };
}

/** CLI entry: `node journey.js <packRoot> [seed]`. Prints the report as JSON. */
function main(): void {
  const packRoot = process.argv[2];
  const seed = process.argv[3] ?? "milestone-1";
  if (!packRoot) {
    process.stderr.write("usage: journey <packRoot> [seed]\n");
    process.exit(2);
    return;
  }
  const report = runMilestoneJourney(packRoot, seed);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

// Run main only when executed directly (not when imported by tests).
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) main();
