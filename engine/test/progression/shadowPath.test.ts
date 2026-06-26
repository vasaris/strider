import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { journeyConfigsFromPack } from "../../src/journey/config.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { applyShadowPathAdvance, progressionConfigFromPack, type ProgressionConfig } from "../../src/progression/index.js";
import { makeTestHero } from "../../src/cli/scenario.js";
import type { HeroState } from "../../src/hero/state.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

let cfg: ProgressionConfig;
let warrior: HeroState;
let noCallingHero: HeroState;

beforeAll(() => {
  const pack = loadPack(nodePackSource(packRoot));
  cfg = progressionConfigFromPack(pack);
  noCallingHero = makeTestHero(journeyConfigsFromPack(pack));
  warrior = { ...noCallingHero, calling: "warrior" };
});

describe("applyShadowPathAdvance — advancing the calling's Shadow Path", () => {
  it("gains the first Flaw of the warrior's vengeance path", () => {
    const [step, h] = applyShadowPathAdvance(warrior, cfg);
    expect(step.path).toBe("vengeance");
    expect(step.flawsGainedTotal).toBe(1);
    expect(step.succumbed).toBe(false);
    expect(step.flawGained).toBe(cfg.shadowPath.pathFlaws["vengeance"]![0]);
    expect(h.shadowPath).toEqual({ key: "vengeance", flawsGained: 1 });
    expect(h.flaws).toEqual([step.flawGained]);
  });

  it("advances Flaw by Flaw and succumbs on the fourth", () => {
    let h = warrior;
    let last;
    for (let i = 0; i < 4; i++) {
      [last, h] = applyShadowPathAdvance(h, cfg);
    }
    expect(last!.flawsGainedTotal).toBe(4);
    expect(last!.succumbed).toBe(true);
    expect(h.flaws).toHaveLength(4);
  });

  it("throws once all Flaws of the path are already gained", () => {
    let h = warrior;
    for (let i = 0; i < 4; i++) [, h] = applyShadowPathAdvance(h, cfg);
    expect(() => applyShadowPathAdvance(h, cfg)).toThrow(/already gained/);
  });

  it("throws when the hero has no calling", () => {
    expect(() => applyShadowPathAdvance(noCallingHero, cfg)).toThrow(/no calling/);
  });

  it("messenger resolves to the wandering path (content gap reconciled)", () => {
    // The messenger calling card's shadow_path was reconciled from
    // "wandering_madness" to the Shadow-Path owner key "wandering". The engine
    // still aliases nothing: it works because the keys now agree in the pack.
    expect(cfg.shadowPath.callingToPath["messenger"]).toBe("wandering");
    expect(cfg.shadowPath.pathFlaws["wandering"]).toHaveLength(4);
    const messenger: HeroState = { ...warrior, calling: "messenger" };
    const [step, h] = applyShadowPathAdvance(messenger, cfg);
    expect(step.path).toBe("wandering");
    expect(step.flawsGainedTotal).toBe(1);
    expect(h.flaws).toHaveLength(1);
  });

  it("still fails fast on a calling whose shadow_path is absent from the card (no aliasing)", () => {
    // A stub config with a calling pointing at a path the owner card lacks.
    const broken = { ...cfg, shadowPath: { ...cfg.shadowPath, callingToPath: { phantom: "no_such_path" } } };
    const phantom: HeroState = { ...warrior, calling: "phantom" };
    expect(() => applyShadowPathAdvance(phantom, broken)).toThrow(/not found in the Shadow-Path card/);
  });
});
