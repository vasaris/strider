import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { diceConfigFromPack } from "../../src/pack/configFromPack.js";
import { oraclesFromPack } from "../../src/oracles/fromPack.js";
import { rollAnswer } from "../../src/oracles/answers.js";
import { rollLore } from "../../src/oracles/lore.js";
import { featEventRow, rollFeatDieEvent } from "../../src/oracles/featEvent.js";
import { makeRng } from "../../src/rng/rng.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

describe("oracles from the verified pack", () => {
  const pack = loadPack(nodePackSource(packRoot));
  const oracles = oraclesFromPack(pack);
  const dice = diceConfigFromPack(pack);

  it("answers table: 5 likelihoods, exactly one default, special faces present", () => {
    expect(oracles.answers.likelihoods).toHaveLength(5);
    expect(oracles.answers.likelihoods.filter((l) => l.isDefault)).toHaveLength(1);
    expect(oracles.answers.likelihoods.map((l) => l.yesIfAtLeast)).toEqual([1, 4, 6, 8, 10]);
    expect(oracles.answers.gandalfRune.answer).toBe("yes");
    expect(oracles.answers.eye.answer).toBe("no");
  });

  it("lore table: 12 sections, 6 rows each, three non-empty columns", () => {
    expect(oracles.lore.sections).toHaveLength(12);
    for (const s of oracles.lore.sections) {
      expect(s.rows).toHaveLength(6);
      for (const r of s.rows) {
        expect(r.action.length).toBeGreaterThan(0);
        expect(r.aspect.length).toBeGreaterThan(0);
        expect(r.focus.length).toBeGreaterThan(0);
      }
    }
    // sections include both special faces
    const faces = oracles.lore.sections.map((s) => s.face);
    expect(faces).toContain("eye");
    expect(faces).toContain("gandalf_rune");
  });

  it("luck/misfortune: 12 rows each; Eye row carries an awareness effect", () => {
    expect(oracles.luck.rows).toHaveLength(12);
    expect(oracles.misfortune.rows).toHaveLength(12);
    expect(featEventRow(oracles.luck, "eye").effects).toEqual([{ op: "eye_awareness_delta", value: -1 }]);
    expect(featEventRow(oracles.misfortune, "eye").effects).toEqual([{ op: "eye_awareness_delta", value: 2 }]);
  });

  it("rolling each oracle on the real pack is reproducible and well-formed", () => {
    const [ans] = rollAnswer(oracles.answers, null, dice, makeRng("real-1"));
    expect(ans.answer === "yes" || ans.answer === "no").toBe(true);

    const [lore, lore2] = [
      rollLore(oracles.lore, dice, makeRng("real-2"))[0],
      rollLore(oracles.lore, dice, makeRng("real-2"))[0],
    ];
    expect(lore).toEqual(lore2); // reproducible
    expect(lore.action.length).toBeGreaterThan(0);
    expect(lore.rowIndex).toBeGreaterThanOrEqual(0);
    expect(lore.rowIndex).toBeLessThan(6);

    const [evt, evt2] = [
      rollFeatDieEvent(oracles.luck, dice, makeRng("real-3"))[0],
      rollFeatDieEvent(oracles.luck, dice, makeRng("real-3"))[0],
    ];
    expect(evt).toEqual(evt2); // reproducible
    expect(evt.text.length).toBeGreaterThan(0);
  });
});
