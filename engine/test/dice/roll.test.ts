import { describe, expect, it } from "vitest";
import { makeRng } from "../../src/rng/rng.js";
import { rollCheckDice, type CheckDiceSpec } from "../../src/dice/roll.js";
import { KV_DICE } from "./fixtures.js";

describe("rollCheckDice", () => {
  it("is reproducible for a fixed seed + spec", () => {
    const spec: CheckDiceSpec = {
      abilityRating: 3,
      featModifier: "favoured",
      bonusSuccessDice: 1,
      penaltySuccessDice: 0,
    };
    const [a] = rollCheckDice(KV_DICE, spec, makeRng("journey-1"));
    const [b] = rollCheckDice(KV_DICE, spec, makeRng("journey-1"));
    expect(a).toEqual(b);
  });

  it("respects modifier candidate count and success-dice count", () => {
    const spec: CheckDiceSpec = {
      abilityRating: 2,
      featModifier: "ill_favoured",
      bonusSuccessDice: 3,
      penaltySuccessDice: 1,
    };
    const [roll] = rollCheckDice(KV_DICE, spec, makeRng("inv"));
    expect(roll.featCandidates).toHaveLength(KV_DICE.feat.modifiedDiceCount);
    expect(roll.successDiceCount).toBe(4); // 2 + 3 - 1
    expect(roll.successDice).toHaveLength(4);
  });

  it("rating 0 -> only the feat die rolls", () => {
    const spec: CheckDiceSpec = {
      abilityRating: 0,
      featModifier: "normal",
      bonusSuccessDice: 0,
      penaltySuccessDice: 0,
    };
    const [roll] = rollCheckDice(KV_DICE, spec, makeRng("rating0"));
    expect(roll.successDiceCount).toBe(0);
    expect(roll.successDice).toEqual([]);
    expect(roll.featCandidates).toHaveLength(1);
  });

  it("golden: fixed seed + spec yields a fixed DiceRoll", () => {
    const spec: CheckDiceSpec = {
      abilityRating: 4,
      featModifier: "normal",
      bonusSuccessDice: 0,
      penaltySuccessDice: 0,
    };
    const [roll] = rollCheckDice(KV_DICE, spec, makeRng("golden-seed-0"));
    expect(roll).toMatchInlineSnapshot(`
      {
        "feat": {
          "face": {
            "kind": "number",
            "value": 10,
          },
          "isAutoSuccess": false,
          "isEye": false,
          "numericValue": 10,
          "physicalFace": 10,
        },
        "featCandidates": [
          {
            "face": {
              "kind": "number",
              "value": 10,
            },
            "isAutoSuccess": false,
            "isEye": false,
            "numericValue": 10,
            "physicalFace": 10,
          },
        ],
        "featModifier": "normal",
        "successDice": [
          {
            "face": 5,
            "isSuccessIcon": false,
          },
          {
            "face": 1,
            "isSuccessIcon": false,
          },
          {
            "face": 3,
            "isSuccessIcon": false,
          },
          {
            "face": 4,
            "isSuccessIcon": false,
          },
        ],
        "successDiceCount": 4,
      }
    `);
  });
});
