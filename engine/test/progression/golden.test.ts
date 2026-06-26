import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDemoProgression } from "../../src/cli/progression.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

// progression-1 is the canonical demo growth pass: a warrior earns 4 adventure
// and 4 skill points across five solo milestones, spends them on Lore 0->1 and
// the Bows weapon-skill 0->1 (pools land at zero), and one bout of madness
// advances the vengeance path by one Flaw. Deterministic: no dice are rolled.
const GOLDEN_SEED = "progression-1";

describe("Stage 1 milestone: CLI progression playthrough", () => {
  it("reports a coherent growth pass", () => {
    const r = runDemoProgression(packRoot, GOLDEN_SEED);
    expect(r.earned).toEqual(r.spent); // this scenario earns exactly what it spends
    expect(r.pools).toEqual({ adventurePoints: 0, skillPoints: 0 });
    expect(r.shadowPath).toBe("vengeance");
    expect(r.flawsGained).toBe(1);
  });

  it("is reproducible: same label -> identical report (no RNG)", () => {
    expect(runDemoProgression(packRoot, GOLDEN_SEED)).toEqual(runDemoProgression(packRoot, GOLDEN_SEED));
  });

  it("golden: fixed scenario -> fixed report", () => {
    const r = runDemoProgression(packRoot, GOLDEN_SEED);
    expect(r).toMatchInlineSnapshot(`
      {
        "earned": {
          "adventurePoints": 4,
          "skillPoints": 4,
        },
        "flawsGained": 1,
        "grants": [],
        "milestonesReached": 5,
        "pools": {
          "adventurePoints": 0,
          "skillPoints": 0,
        },
        "seed": "progression-1",
        "shadowPath": "vengeance",
        "spent": {
          "adventurePoints": 4,
          "skillPoints": 4,
        },
        "succumbed": false,
        "valour": 1,
        "wisdom": 1,
      }
    `);
  });
});
