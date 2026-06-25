import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { eyeConfigFromPack } from "../../src/eye/fromPack.js";
import { oraclesFromPack } from "../../src/oracles/fromPack.js";
import { featEventRow } from "../../src/oracles/featEvent.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

describe("eyeConfigFromPack", () => {
  const pack = loadPack(nodePackSource(packRoot));
  const cfg = eyeConfigFromPack(pack);

  it("derives initial-rating modifiers from the pack", () => {
    expect(cfg.initialBase).toBe(0);
    expect(cfg.valourModifier).toBe(1);
    expect(cfg.cultureModifier).toEqual({ dwarf: 1, elf_or_dunedain: 2, high_elf: 3 });
    expect(cfg.famousItemModifier).toBe(1);
  });

  it("derives growth values and pursuit thresholds", () => {
    expect(cfg.growth.eyeOnFeatOutOfCombat).toBe(1);
    expect(cfg.growth.misfortuneEyeResult).toBe(2);
    expect(cfg.growth.shadowPerPoint).toBe(true);
    expect(cfg.pursuitThresholds).toEqual({ border_lands: 18, wild_lands: 16, dark_lands: 14 });
    expect(cfg.pursuitModifiers.length).toBeGreaterThan(0);
  });

  it("cross-check: the misfortune Eye row's effect matches growth.misfortuneEyeResult", () => {
    const oracles = oraclesFromPack(pack);
    const eyeRow = featEventRow(oracles.misfortune, "eye");
    const effect = eyeRow.effects.find((e) => e.op === "eye_awareness_delta");
    expect(effect).toBeDefined();
    expect(effect?.["value"]).toBe(cfg.growth.misfortuneEyeResult);
  });
});
