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

  it("surfaces the messenger content gap: its shadow_path key is not in the Shadow-Path card", () => {
    // The messenger calling card carries shadow_path "wandering_madness" while the
    // Shadow-Path owner lists "wandering" -- a pack inconsistency to fix at the
    // content gate. The engine refuses to alias it and fails fast instead.
    expect(cfg.shadowPath.callingToPath["messenger"]).toBe("wandering_madness");
    expect(cfg.shadowPath.pathFlaws["wandering_madness"]).toBeUndefined();
    const messenger: HeroState = { ...warrior, calling: "messenger" };
    expect(() => applyShadowPathAdvance(messenger, cfg)).toThrow(/not found in the Shadow-Path card/);
  });
});
