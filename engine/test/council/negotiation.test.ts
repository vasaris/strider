import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { makeRng } from "../../src/rng/rng.js";
import { councilConfigsFromPack } from "../../src/council/config.js";
import { runNegotiationRound } from "../../src/council/negotiation.js";
import { makeCouncilHero } from "../../src/cli/councilScenario.js";
import type { CouncilAttitude, CouncilState } from "../../src/council/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

const pack = loadPack(nodePackSource(packRoot));
const cfgs = councilConfigsFromPack(pack);
const hero = makeCouncilHero(pack);

/** A council mid-flight, past a successful introduction, ready to negotiate. */
function negotiating(attitude: CouncilAttitude, duration = 12): CouncilState {
  return {
    hero,
    resistance: 9,
    attitude,
    duration,
    attemptsUsed: 0,
    accumulated: 0,
    introductionSucceeded: true,
  };
}

describe("runNegotiationRound — one check accumulates successes", () => {
  it("a success adds 1 + one per sign; a failure adds nothing (over seeds)", () => {
    let sawSuccess = false;
    let sawFail = false;
    for (let i = 0; i < 80; i++) {
      const s = negotiating("neutral");
      const [s1, event] = runNegotiationRound(s, { skill: "inspire", roleplayBonusDice: 0 }, cfgs, makeRng(`neg-${i}`));
      expect(event.kind).toBe("negotiation");
      if (event.kind !== "negotiation") continue;
      const expectedGain = event.outcome === "success" ? 1 + event.successIcons : 0;
      expect(event.successesGained).toBe(expectedGain);
      expect(event.accumulated).toBe(expectedGain);
      expect(s1.accumulated).toBe(expectedGain);
      expect(s1.attemptsUsed).toBe(1);
      expect(event.attempt).toBe(1);
      if (event.outcome === "success") sawSuccess = true;
      else sawFail = true;
    }
    expect(sawSuccess).toBe(true);
    expect(sawFail).toBe(true);
  });

  it("a friendly audience succeeds at least as often as a cold one (added vs removed die)", () => {
    let friendlyWins = 0;
    let coldWins = 0;
    for (let i = 0; i < 200; i++) {
      const rngSeed = `att-${i}`;
      const [, fe] = runNegotiationRound(
        negotiating("friendly"),
        { skill: "persuade", roleplayBonusDice: 0 },
        cfgs,
        makeRng(rngSeed),
      );
      const [, ce] = runNegotiationRound(
        negotiating("cold"),
        { skill: "persuade", roleplayBonusDice: 0 },
        cfgs,
        makeRng(rngSeed),
      );
      if (fe.kind === "negotiation" && fe.outcome === "success") friendlyWins++;
      if (ce.kind === "negotiation" && ce.outcome === "success") coldWins++;
    }
    // Friendly adds a Success die, cold removes one: friendly must win strictly more often.
    expect(friendlyWins).toBeGreaterThan(coldWins);
  });

  it("accepts the pack-sanctioned roleplay bonuses and rejects others", () => {
    for (const bonus of cfgs.council.negotiations.goodRoleplayBonusDice) {
      expect(() =>
        runNegotiationRound(negotiating("neutral"), { skill: "inspire", roleplayBonusDice: bonus }, cfgs, makeRng("rp")),
      ).not.toThrow();
    }
    // 0 is always allowed (no bonus claimed).
    expect(() =>
      runNegotiationRound(negotiating("neutral"), { skill: "inspire", roleplayBonusDice: 0 }, cfgs, makeRng("rp")),
    ).not.toThrow();
    // A value outside the sanctioned set is rejected.
    const unsanctioned = 99;
    expect(() =>
      runNegotiationRound(
        negotiating("neutral"),
        { skill: "inspire", roleplayBonusDice: unsanctioned },
        cfgs,
        makeRng("rp"),
      ),
    ).toThrow(/not sanctioned/);
    // Negative bonus is rejected.
    expect(() =>
      runNegotiationRound(negotiating("neutral"), { skill: "inspire", roleplayBonusDice: -1 }, cfgs, makeRng("rp")),
    ).toThrow();
  });

  it("refuses to negotiate before the introduction or beyond the duration", () => {
    const preIntro: CouncilState = { ...negotiating("neutral"), duration: null, introductionSucceeded: null };
    expect(() =>
      runNegotiationRound(preIntro, { skill: "inspire", roleplayBonusDice: 0 }, cfgs, makeRng("z")),
    ).toThrow(/introduction not done/);

    const exhausted: CouncilState = { ...negotiating("neutral", 2), attemptsUsed: 2 };
    expect(() =>
      runNegotiationRound(exhausted, { skill: "inspire", roleplayBonusDice: 0 }, cfgs, makeRng("z")),
    ).toThrow(/no attempts left/);
  });
});
