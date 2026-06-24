import { describe, expect, it } from "vitest";
import { targetNumber } from "../../src/checks/targetNumber.js";
import { degreeFromIcons, evaluateCheck } from "../../src/checks/evaluate.js";
import { ALT_CHECKS, FEAT_EYE, FEAT_GANDALF, KV_CHECKS, featNumber, makeRoll } from "./fixtures.js";

describe("targetNumber", () => {
  it("is tnBase - rating for ratings 0..6", () => {
    for (let r = 0; r <= 6; r++) {
      expect(targetNumber(r, KV_CHECKS)).toBe(18 - r);
    }
  });
  it("respects a different tnBase (not hardcoded)", () => {
    expect(targetNumber(3, ALT_CHECKS)).toBe(17); // 20 - 3
  });
  it("rejects negative rating", () => {
    expect(() => targetNumber(-1, KV_CHECKS)).toThrow();
  });
});

describe("evaluateCheck pass/fail", () => {
  it("succeeds when total >= TN, fails when below", () => {
    // feat 8 + success faces 5,4 = 17 vs TN 16 -> success
    expect(evaluateCheck(makeRoll(featNumber(8), [5, 4]), 16, KV_CHECKS).outcome).toBe("success");
    // feat 3 + 2 = 5 vs TN 14 -> failure
    expect(evaluateCheck(makeRoll(featNumber(3), [2]), 14, KV_CHECKS).outcome).toBe("failure");
  });

  it("reports the total as feat numeric + success faces", () => {
    const r = evaluateCheck(makeRoll(featNumber(7), [3, 5]), 10, KV_CHECKS);
    expect(r.total).toBe(15);
    expect(r.autoSuccess).toBe(false);
  });

  it("Eye contributes 0 to the total", () => {
    // eye(0) + 5 + 4 = 9 vs TN 10 -> failure; total 9
    const r = evaluateCheck(makeRoll(FEAT_EYE, [5, 4]), 10, KV_CHECKS);
    expect(r.total).toBe(9);
    expect(r.outcome).toBe("failure");
    expect(r.isEyeOnFeat).toBe(true);
  });

  it("Gandalf rune is auto-success even when the sum is below TN", () => {
    const r = evaluateCheck(makeRoll(FEAT_GANDALF, [1]), 99, KV_CHECKS);
    expect(r.outcome).toBe("success");
    expect(r.autoSuccess).toBe(true);
    expect(r.total).toBeNull();
  });
});

describe("degree of success", () => {
  it("0/1/2+ icons -> success/great/extraordinary", () => {
    expect(degreeFromIcons(0, KV_CHECKS)).toBe("success");
    expect(degreeFromIcons(1, KV_CHECKS)).toBe("great_success");
    expect(degreeFromIcons(2, KV_CHECKS)).toBe("extraordinary_success");
    expect(degreeFromIcons(5, KV_CHECKS)).toBe("extraordinary_success");
  });

  it("degree is reported on success, null on failure", () => {
    // success with one icon (face 6) -> great_success
    const ok = evaluateCheck(makeRoll(featNumber(10), [6, 4]), 12, KV_CHECKS);
    expect(ok.outcome).toBe("success");
    expect(ok.successIcons).toBe(1);
    expect(ok.degree).toBe("great_success");

    const bad = evaluateCheck(makeRoll(featNumber(1), [6]), 18, KV_CHECKS);
    expect(bad.outcome).toBe("failure");
    expect(bad.successIcons).toBe(1); // icon still counted
    expect(bad.degree).toBeNull();
  });

  it("auto-success still derives degree from icons", () => {
    const r = evaluateCheck(makeRoll(FEAT_GANDALF, [6, 6]), 50, KV_CHECKS);
    expect(r.autoSuccess).toBe(true);
    expect(r.successIcons).toBe(2);
    expect(r.degree).toBe("extraordinary_success");
  });
});
