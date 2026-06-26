import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { resolveCouncil } from "../../src/council/resolve.js";
import { makeCouncilHero } from "../../src/cli/councilScenario.js";
import type { CouncilPolicy, CouncilState } from "../../src/council/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

const pack = loadPack(nodePackSource(packRoot));
const hero = makeCouncilHero(pack);

const noopPlans = {
  planIntroduction: () => ({ skill: "courtesy" }),
  planNegotiationRound: () => ({ skill: "inspire", roleplayBonusDice: 0 }),
};
const refusePolicy: CouncilPolicy = { ...noopPlans, acceptPriceOnShortfall: false };
const pricePolicy: CouncilPolicy = { ...noopPlans, acceptPriceOnShortfall: true };

/** A finished council state (introduction done, some attempts used). */
function finished(over: Partial<CouncilState>): CouncilState {
  return {
    hero,
    resistance: 6,
    attitude: "neutral",
    duration: 5,
    attemptsUsed: 5,
    accumulated: 0,
    introductionSucceeded: true,
    ...over,
  };
}

describe("resolveCouncil — classifies the finished council", () => {
  it("meeting or exceeding the resistance is goal_achieved", () => {
    expect(resolveCouncil(finished({ accumulated: 6 }), [], refusePolicy).outcome).toBe("goal_achieved");
    expect(resolveCouncil(finished({ accumulated: 8 }), [], refusePolicy).outcome).toBe("goal_achieved");
  });

  it("zero successes is a catastrophe even after a sound introduction", () => {
    expect(resolveCouncil(finished({ accumulated: 0, introductionSucceeded: true }), [], refusePolicy).outcome).toBe(
      "catastrophe",
    );
  });

  it("a shortfall after a FAILED introduction is a catastrophe", () => {
    expect(resolveCouncil(finished({ accumulated: 3, introductionSucceeded: false }), [], refusePolicy).outcome).toBe(
      "catastrophe",
    );
  });

  it("a shortfall after a sound introduction is a refusal by default", () => {
    expect(resolveCouncil(finished({ accumulated: 3, introductionSucceeded: true }), [], refusePolicy).outcome).toBe(
      "refusal",
    );
  });

  it("the same shortfall becomes goal_at_a_price only with the Keeper's permission", () => {
    expect(resolveCouncil(finished({ accumulated: 3, introductionSucceeded: true }), [], pricePolicy).outcome).toBe(
      "goal_at_a_price",
    );
  });

  it("echoes the tally and appends a council_end event to the transcript", () => {
    const prior = [
      { kind: "introduction" as const, skill: "courtesy", outcome: "success" as const, successIcons: 0, durationSet: 5 },
    ];
    const r = resolveCouncil(finished({ accumulated: 6 }), prior, refusePolicy);
    expect(r.resistance).toBe(6);
    expect(r.accumulated).toBe(6);
    expect(r.duration).toBe(5);
    expect(r.attemptsUsed).toBe(5);
    expect(r.introductionSucceeded).toBe(true);
    expect(r.events.length).toBe(2);
    expect(r.events[r.events.length - 1]).toEqual({ kind: "council_end", outcome: "goal_achieved" });
  });

  it("refuses to resolve before the introduction has run", () => {
    const preIntro = finished({ duration: null, introductionSucceeded: null });
    expect(() => resolveCouncil(preIntro, [], refusePolicy)).toThrow(/introduction not done/);
  });
});
