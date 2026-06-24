import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { deriveDiceConfig } from "../../src/dice/config.js";
import { rollFeatDie } from "../../src/dice/featDie.js";
import { rollSuccessDie } from "../../src/dice/successDie.js";
import { makeRng } from "../../src/rng/rng.js";
import { ALT_DICE } from "./fixtures.js";

describe("anti-hardcode: math respects config, never bakes book numbers", () => {
  it("feat math honours an alternate (d10) config", () => {
    const FEAT = ALT_DICE.feat; // sides 10, eye 9, gandalf 10
    let rng = makeRng("alt-feat");
    let sawEye = false;
    let sawGandalf = false;
    for (let i = 0; i < 20_000; i++) {
      const [r, next] = rollFeatDie(FEAT, rng);
      expect(r.physicalFace).toBeGreaterThanOrEqual(1);
      expect(r.physicalFace).toBeLessThanOrEqual(10); // never 11/12
      if (r.physicalFace === 9) {
        expect(r.isEye).toBe(true);
        sawEye = true;
      }
      if (r.physicalFace === 10) {
        expect(r.isAutoSuccess).toBe(true);
        sawGandalf = true;
      }
      rng = next;
    }
    expect(sawEye).toBe(true);
    expect(sawGandalf).toBe(true);
  });

  it("success math honours an alternate (d8, icon on 8) config", () => {
    const SUCCESS = ALT_DICE.success;
    let rng = makeRng("alt-succ");
    for (let i = 0; i < 20_000; i++) {
      const [r, next] = rollSuccessDie(SUCCESS, rng);
      expect(r.face).toBeGreaterThanOrEqual(1);
      expect(r.face).toBeLessThanOrEqual(8);
      expect(r.isSuccessIcon).toBe(r.face === 8); // icon moved off 6
      rng = next;
    }
  });
});

describe("deriveDiceConfig from the verified pack", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const mechanics = resolve(here, "../../..", "content-packs/kv/mechanics");
  const card = (name: string): unknown => JSON.parse(readFileSync(resolve(mechanics, name), "utf8"));

  it("derives the canonical KV config (numbers come from the pack)", () => {
    const cfg = deriveDiceConfig({
      diceSet: card("checks.dice_set.json"),
      featDieValues: card("checks.feat_die_values.json"),
      successDieValues: card("checks.success_die_values.json"),
      procedure: card("checks.procedure.json"),
      favouredIllFavoured: card("checks.favoured_ill_favoured.json"),
    });
    expect(cfg).toEqual({
      feat: {
        sides: 12,
        eyeFace: 11, // derived as sides-1, faithful to common.schema featDieFace
        gandalfRuneFace: 12, // derived as sides
        eyeNumericValue: 0,
        normalDiceCount: 1,
        modifiedDiceCount: 2,
      },
      success: {
        sides: 6,
        successIconFace: 6,
      },
    });
  });

  it("fails loudly if favoured semantics change", () => {
    const broken = JSON.parse(JSON.stringify(card("checks.favoured_ill_favoured.json"))) as {
      payload: { parameters: { favoured: { pick: string } } };
    };
    broken.payload.parameters.favoured.pick = "worst";
    expect(() =>
      deriveDiceConfig({
        diceSet: card("checks.dice_set.json"),
        featDieValues: card("checks.feat_die_values.json"),
        successDieValues: card("checks.success_die_values.json"),
        procedure: card("checks.procedure.json"),
        favouredIllFavoured: broken,
      }),
    ).toThrow();
  });
});
