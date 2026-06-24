import { describe, expect, it } from "vitest";
import { specialSuccessOptions, spendableIcons } from "../../src/checks/special.js";
import { failureOutcome } from "../../src/checks/risk.js";
import { spendHopeForDice } from "../../src/checks/hope.js";
import { evaluateCheck } from "../../src/checks/evaluate.js";
import { FEAT_GANDALF, KV_CHECKS, featNumber, makeRoll } from "./fixtures.js";

describe("special successes", () => {
  it("exposes the solo option menu", () => {
    const keys = specialSuccessOptions(KV_CHECKS).map((o) => o.key);
    expect(keys).toEqual([
      "learn_something",
      "be_silent",
      "be_swift",
      "widen_influence",
      "gain_advantage",
      "cancel_failure",
    ]);
  });

  it("spendable icons equals the rolled icon count", () => {
    const r = evaluateCheck(makeRoll(featNumber(10), [6, 6, 3]), 12, KV_CHECKS);
    expect(spendableIcons(r)).toBe(2);
  });
});

describe("failure outcome by risk degree", () => {
  it("returns the matching spec for each degree", () => {
    expect(failureOutcome("normal", KV_CHECKS).key).toBe("normal");
    expect(failureOutcome("dangerous", KV_CHECKS).key).toBe("dangerous");
    expect(failureOutcome("reckless", KV_CHECKS).key).toBe("reckless");
    expect(failureOutcome("reckless", KV_CHECKS).failureResult.length).toBeGreaterThan(0);
  });

  it("default risk is normal", () => {
    expect(KV_CHECKS.defaultRisk).toBe("normal");
  });
});

describe("spendHopeForDice", () => {
  it("spend 1 (not inspired) -> +1d, current decremented", () => {
    const r = spendHopeForDice({ hopeCurrent: 4, spend: 1, inspired: false }, KV_CHECKS);
    expect(r.bonusSuccessDice).toBe(1);
    expect(r.hopePatch.current).toBe(3);
  });

  it("spend 1 inspired (Wanderer) -> +2d", () => {
    const r = spendHopeForDice({ hopeCurrent: 4, spend: 1, inspired: true }, KV_CHECKS);
    expect(r.bonusSuccessDice).toBe(2);
    expect(r.hopePatch.current).toBe(3);
  });

  it("spend 0 -> no dice, no change", () => {
    const r = spendHopeForDice({ hopeCurrent: 2, spend: 0, inspired: true }, KV_CHECKS);
    expect(r.bonusSuccessDice).toBe(0);
    expect(r.hopePatch.current).toBe(2);
  });

  it("cannot spend Hope you do not have", () => {
    const r = spendHopeForDice({ hopeCurrent: 0, spend: 1, inspired: true }, KV_CHECKS);
    expect(r.bonusSuccessDice).toBe(0);
    expect(r.hopePatch.current).toBe(0);
  });

  it("rejects malformed input", () => {
    // @ts-expect-error spend must be 0|1
    expect(() => spendHopeForDice({ hopeCurrent: 1, spend: 2, inspired: false }, KV_CHECKS)).toThrow();
    expect(() => spendHopeForDice({ hopeCurrent: -1, spend: 1, inspired: false }, KV_CHECKS)).toThrow();
  });

  it("auto-success roll still allows icon spending downstream", () => {
    // sanity: an auto-success can carry icons (used by special successes)
    const r = evaluateCheck(makeRoll(FEAT_GANDALF, [6]), 50, KV_CHECKS);
    expect(spendableIcons(r)).toBe(1);
  });
});
