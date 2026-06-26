import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { makeRng } from "../../src/rng/rng.js";
import { councilConfigsFromPack } from "../../src/council/config.js";
import { runCouncil } from "../../src/council/runCouncil.js";
import { makeCouncilHero, COUNCIL_SETUP, minimalPolicy } from "../../src/cli/councilScenario.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

const pack = loadPack(nodePackSource(packRoot));
const cfgs = councilConfigsFromPack(pack);
const hero = makeCouncilHero(pack);

const OUTCOMES = ["goal_achieved", "refusal", "goal_at_a_price", "catastrophe"];

describe("runCouncil — drives a whole council end to end", () => {
  it("is reproducible: same seed -> identical result", () => {
    const [a] = runCouncil(hero, COUNCIL_SETUP, minimalPolicy, cfgs, makeRng("repro"));
    const [b] = runCouncil(hero, COUNCIL_SETUP, minimalPolicy, cfgs, makeRng("repro"));
    expect(a).toEqual(b);
  });

  it("holds the structural invariants for every seed", () => {
    let sawEarlyStop = false;
    for (let i = 0; i < 120; i++) {
      const [r] = runCouncil(hero, COUNCIL_SETUP, minimalPolicy, cfgs, makeRng(`run-${i}`));
      expect(OUTCOMES).toContain(r.outcome);

      // Attempts never exceed the duration the introduction granted.
      expect(r.attemptsUsed).toBeLessThanOrEqual(r.duration);

      // The transcript opens with the introduction and closes with council_end.
      expect(r.events[0]?.kind).toBe("introduction");
      expect(r.events[r.events.length - 1]?.kind).toBe("council_end");

      // Exactly one negotiation event per attempt used.
      const negEvents = r.events.filter((e) => e.kind === "negotiation");
      expect(negEvents.length).toBe(r.attemptsUsed);

      // The tally equals the sum of per-attempt gains.
      const summed = negEvents.reduce((acc, e) => acc + (e.kind === "negotiation" ? e.successesGained : 0), 0);
      expect(summed).toBe(r.accumulated);

      // Reaching the resistance before the last attempt must stop the loop early.
      if (r.outcome === "goal_achieved" && r.attemptsUsed < r.duration) sawEarlyStop = true;
    }
    // The early-break path is genuinely exercised by the sample.
    expect(sawEarlyStop).toBe(true);
  });

  it("goal_achieved iff the tally reached the resistance", () => {
    for (let i = 0; i < 120; i++) {
      const [r] = runCouncil(hero, COUNCIL_SETUP, minimalPolicy, cfgs, makeRng(`iff-${i}`));
      expect(r.outcome === "goal_achieved").toBe(r.accumulated >= r.resistance);
    }
  });

  it("a different seed yields a valid run", () => {
    const [a] = runCouncil(hero, COUNCIL_SETUP, minimalPolicy, cfgs, makeRng("seed-a"));
    const [c] = runCouncil(hero, COUNCIL_SETUP, minimalPolicy, cfgs, makeRng("seed-b"));
    expect(OUTCOMES).toContain(c.outcome);
    expect(a.events[0]?.kind).toBe("introduction");
    expect(c.events[0]?.kind).toBe("introduction");
  });

  it("threads the RNG forward (the returned stream is advanced)", () => {
    const seedRng = makeRng("thread");
    const [, after] = runCouncil(hero, COUNCIL_SETUP, minimalPolicy, cfgs, seedRng);
    // A council always rolls at least the introduction, so the stream must move.
    expect(after).not.toEqual(seedRng);
  });
});
