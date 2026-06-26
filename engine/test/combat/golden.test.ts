import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDemoCombat } from "../../src/cli/combat.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

// ork-2 is the canonical demo fight: a hero win whose defeated orc is taken out
// at 0 Endurance and survives the after_battle roll -- it exercises the whole
// loop, including the survival oracle, end to end.
const GOLDEN_SEED = "ork-2";

describe("Stage 1 milestone: CLI combat playthrough", () => {
  it("reports a coherent final state", () => {
    const r = runDemoCombat(packRoot, GOLDEN_SEED);
    expect(["hero_won", "hero_down", "hero_fled", "hero_dead"]).toContain(r.outcome);
    expect(r.rounds).toBeGreaterThanOrEqual(1);
    expect(r.hero.endurance).toBeGreaterThanOrEqual(0);
    expect(r.eventKinds[r.eventKinds.length - 1]).toBe("round_end");
  });

  it("is reproducible: same seed -> identical report", () => {
    expect(runDemoCombat(packRoot, GOLDEN_SEED)).toEqual(runDemoCombat(packRoot, GOLDEN_SEED));
  });

  it("a different seed yields a different but valid run", () => {
    const a = runDemoCombat(packRoot, GOLDEN_SEED);
    const c = runDemoCombat(packRoot, "ork-1");
    expect(["hero_won", "hero_down", "hero_fled", "hero_dead"]).toContain(c.outcome);
    expect(a.eventKinds).not.toEqual(c.eventKinds);
  });

  it("golden: fixed seed -> fixed report", () => {
    const r = runDemoCombat(packRoot, GOLDEN_SEED);
    expect({
      outcome: r.outcome,
      rounds: r.rounds,
      hero: r.hero,
      enemyStatuses: r.enemies.map((e) => e.status),
      afterBattle: r.afterBattle,
      eventKinds: r.eventKinds,
    }).toMatchInlineSnapshot(`
      {
        "afterBattle": [
          {
            "answer": "yes",
            "enemyIndex": 0,
            "survived": true,
          },
        ],
        "enemyStatuses": [
          "taken_out_survived",
        ],
        "eventKinds": [
          "stance",
          "hero_attack",
          "enemy_attack",
          "round_end",
          "stance",
          "hero_attack",
          "enemy_attack",
          "round_end",
          "stance",
          "hero_attack",
          "enemy_attack",
          "round_end",
          "stance",
          "hero_attack",
          "round_end",
        ],
        "hero": {
          "dead": false,
          "dying": false,
          "endurance": 9,
          "hope": 3,
          "wounded": false,
        },
        "outcome": "hero_won",
        "rounds": 4,
      }
    `);
  });
});
