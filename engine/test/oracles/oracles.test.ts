import { describe, expect, it } from "vitest";
import { makeRng } from "../../src/rng/rng.js";
import { KV_DICE } from "../dice/fixtures.js";
import { answerFor, rollAnswer } from "../../src/oracles/answers.js";
import { loreCell } from "../../src/oracles/lore.js";
import { featEventRow } from "../../src/oracles/featEvent.js";
import { ANSWERS, EVENT, FEAT_EYE, FEAT_GANDALF, LORE, featNumber } from "./fixtures.js";

describe("answers logic (pure, exhaustive over faces x thresholds)", () => {
  it("numeric yes iff face >= threshold", () => {
    for (const lk of ANSWERS.likelihoods) {
      for (let n = 1; n <= 10; n++) {
        const a = answerFor(ANSWERS, lk.key, featNumber(n));
        expect(a.answer).toBe(n >= lk.yesIfAtLeast ? "yes" : "no");
        expect(a.extreme).toBe(false);
        expect(a.specialText).toBeNull();
        expect(a.likelihoodKey).toBe(lk.key);
      }
    }
  });

  it("rune is always yes-extreme, Eye always no-extreme", () => {
    const g = answerFor(ANSWERS, "even", FEAT_GANDALF);
    expect(g.answer).toBe("yes");
    expect(g.extreme).toBe(true);
    expect(g.specialText).toBe("yes, and a twist");

    const e = answerFor(ANSWERS, "even", FEAT_EYE);
    expect(e.answer).toBe("no");
    expect(e.extreme).toBe(true);
    expect(e.specialText).toBe("no, and a twist");
  });

  it("null likelihood uses the table default", () => {
    // default is 'even' (>=6): face 6 -> yes, face 5 -> no
    expect(answerFor(ANSWERS, null, featNumber(6)).likelihoodKey).toBe("even");
    expect(answerFor(ANSWERS, null, featNumber(6)).answer).toBe("yes");
    expect(answerFor(ANSWERS, null, featNumber(5)).answer).toBe("no");
  });

  it("unknown likelihood throws", () => {
    expect(() => answerFor(ANSWERS, "nope", featNumber(5))).toThrow();
  });
});

describe("lore lookup", () => {
  it("returns the cell at (section face, row index)", () => {
    expect(loreCell(LORE, 3, 0)).toEqual({ sectionFace: 3, rowIndex: 0, action: "seek", aspect: "ancient", focus: "road" });
    expect(loreCell(LORE, "eye", 1)).toEqual({ sectionFace: "eye", rowIndex: 1, action: "ruin", aspect: "fell", focus: "war" });
  });
  it("throws on missing section or out-of-range row", () => {
    expect(() => loreCell(LORE, 9, 0)).toThrow();
    expect(() => loreCell(LORE, 3, 5)).toThrow();
  });
});

describe("feat-die event lookup", () => {
  it("matches by face and carries effects through", () => {
    const eye = featEventRow(EVENT, "eye");
    expect(eye.text).toBe("the Eye turns");
    expect(eye.effects).toEqual([{ op: "eye_awareness_delta", value: 2 }]);
    expect(featEventRow(EVENT, 5).effects).toEqual([]);
  });
  it("throws on a face not in the table", () => {
    expect(() => featEventRow(EVENT, 1)).toThrow();
  });
});

describe("rolls are reproducible", () => {
  it("same seed -> same answer (answers handles every face)", () => {
    const [a1] = rollAnswer(ANSWERS, "even", KV_DICE, makeRng("o"));
    const [a2] = rollAnswer(ANSWERS, "even", KV_DICE, makeRng("o"));
    expect(a1).toEqual(a2);
  });

  it("rollAnswer advances the RNG (threads state)", () => {
    const rng = makeRng("thread");
    const [, next] = rollAnswer(ANSWERS, "even", KV_DICE, rng);
    expect(next).not.toEqual(rng);
  });
});
