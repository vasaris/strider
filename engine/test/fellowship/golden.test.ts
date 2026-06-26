import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDemoFellowship } from "../../src/cli/fellowship.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

// fellowship-yule-1 is the canonical Stage-1 closer: a Barding warrior runs a
// Yule Fellowship Phase -- Hope fully restored, two Shadow points removed (the
// "active" deed tier), the WITS bonus skill points credited, then improve-stats
// raises Lore 0->1 and VALOUR 1->2 (taking the "fell" Reward), and two
// undertakings recorded. Deterministic: the Fellowship Phase rolls no dice.
const GOLDEN_SEED = "fellowship-yule-1";

describe("Stage 1 closer: CLI Fellowship Phase playthrough", () => {
  it("reports a coherent Yule phase", () => {
    const r = runDemoFellowship(packRoot, GOLDEN_SEED);
    expect(r.isYule).toBe(true);
    expect(r.hope).toEqual({ current: 3, max: 3 });
    expect(r.shadowRemoved).toBe(2);
    expect(r.valour).toBe(2);
    expect(r.grants).toEqual([{ kind: "reward", key: "fell" }]);
  });

  it("is reproducible: same label -> identical report (no RNG)", () => {
    expect(runDemoFellowship(packRoot, GOLDEN_SEED)).toEqual(runDemoFellowship(packRoot, GOLDEN_SEED));
  });

  it("golden: fixed scenario -> fixed report", () => {
    const r = runDemoFellowship(packRoot, GOLDEN_SEED);
    expect(r).toMatchInlineSnapshot(`
      {
        "agedYears": 1,
        "duration": "yule",
        "grants": [
          {
            "key": "fell",
            "kind": "reward",
          },
        ],
        "hope": {
          "current": 3,
          "max": 3,
        },
        "hopeRestored": 2,
        "isYule": true,
        "place": "rivendell",
        "pools": {
          "adventurePoints": 0,
          "skillPoints": 3,
        },
        "seed": "fellowship-yule-1",
        "shadow": {
          "points": 1,
          "scars": 1,
        },
        "shadowRemoved": 2,
        "undertakings": [
          "write_song",
          "change_useful_items",
        ],
        "valour": 2,
        "wisdom": 1,
        "yuleBonusSkillPoints": 3,
        "yuleFullHope": true,
      }
    `);
  });
});
