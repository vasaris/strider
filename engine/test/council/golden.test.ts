import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDemoCouncil } from "../../src/cli/council.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

// council-m10 is the canonical demo council: the introduction succeeds with one
// success sign (duration 4 + 1 = 5, proving the formula parse), the negotiation
// crosses the resistance on the second attempt (early stop), and the request is
// granted -- it exercises the whole loop end to end.
const GOLDEN_SEED = "council-m10";

describe("Stage 1 milestone: CLI council playthrough", () => {
  it("reports a coherent final state", () => {
    const r = runDemoCouncil(packRoot, GOLDEN_SEED);
    expect(["goal_achieved", "refusal", "goal_at_a_price", "catastrophe"]).toContain(r.outcome);
    expect(r.attemptsUsed).toBeLessThanOrEqual(r.duration);
    expect(r.eventKinds[0]).toBe("introduction");
    expect(r.eventKinds[r.eventKinds.length - 1]).toBe("council_end");
  });

  it("is reproducible: same seed -> identical report", () => {
    expect(runDemoCouncil(packRoot, GOLDEN_SEED)).toEqual(runDemoCouncil(packRoot, GOLDEN_SEED));
  });

  it("a different seed yields a different but valid run", () => {
    const a = runDemoCouncil(packRoot, GOLDEN_SEED);
    const c = runDemoCouncil(packRoot, "council-1");
    expect(["goal_achieved", "refusal", "goal_at_a_price", "catastrophe"]).toContain(c.outcome);
    expect(a.eventKinds).not.toEqual(c.eventKinds);
  });

  it("golden: fixed seed -> fixed report", () => {
    const r = runDemoCouncil(packRoot, GOLDEN_SEED);
    expect(r).toMatchInlineSnapshot(`
      {
        "accumulated": 4,
        "attemptsUsed": 2,
        "duration": 5,
        "eventKinds": [
          "introduction",
          "negotiation",
          "negotiation",
          "council_end",
        ],
        "introductionSucceeded": true,
        "outcome": "goal_achieved",
        "resistance": 3,
        "seed": "council-m10",
      }
    `);
  });
});
