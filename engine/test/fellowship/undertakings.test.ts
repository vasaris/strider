import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { makeFellowshipHero } from "../../src/cli/fellowshipScenario.js";
import { fellowshipConfigFromPack } from "../../src/fellowship/config.js";
import type { FellowshipConfig } from "../../src/fellowship/types.js";
import { validateUndertakings } from "../../src/fellowship/undertakings.js";
import type { HeroState } from "../../src/hero/state.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

let cfg: FellowshipConfig;
let warrior: HeroState; // calling "warrior"

beforeAll(() => {
  const pack = loadPack(nodePackSource(packRoot));
  cfg = fellowshipConfigFromPack(pack);
  warrior = makeFellowshipHero(pack); // calling warrior
});

describe("validateUndertakings — normal phase", () => {
  it("accepts a calling-free undertaking plus one common (within max_total 2)", () => {
    // write_song is free to a warrior (separate slot); change_useful_items is the common one.
    const r = validateUndertakings(warrior, ["write_song", "change_useful_items"], false, cfg);
    expect(r).toEqual(["write_song", "change_useful_items"]);
  });

  it("rejects two common undertakings (party_common is 1)", () => {
    // gather_rumours is free to a warden, not a warrior -> both consume common slots.
    expect(() => validateUndertakings(warrior, ["gather_rumours", "change_useful_items"], false, cfg)).toThrow(/common/);
  });

  it("rejects too many undertakings in a normal phase", () => {
    // write_song fills the warrior free slot; the other two both want the single
    // common slot, so the common cap (the binding constraint) rejects the choice.
    expect(() =>
      validateUndertakings(warrior, ["write_song", "change_useful_items", "perform_songs"], false, cfg),
    ).toThrow(/common|max/i);
  });

  it("rejects a Yule-only undertaking outside Yule", () => {
    expect(() => validateUndertakings(warrior, ["heal_scars"], false, cfg)).toThrow(/Yule-only/);
  });

  it("does not grant the free slot when the calling does not match", () => {
    const scholar = { ...warrior, calling: "scholar" };
    // write_song is warrior-free; for a scholar it falls back to a common slot.
    // Paired with another common it exceeds party_common 1.
    expect(() => validateUndertakings(scholar, ["write_song", "change_useful_items"], false, cfg)).toThrow(/common/);
  });
});

describe("validateUndertakings — Yule phase", () => {
  it("accepts two undertakings (per_hero 1 + plus_party_common 1)", () => {
    const r = validateUndertakings(warrior, ["heal_scars", "change_useful_items"], true, cfg);
    expect(r).toEqual(["heal_scars", "change_useful_items"]);
  });

  it("rejects more than the Yule budget", () => {
    expect(() =>
      validateUndertakings(warrior, ["heal_scars", "change_useful_items", "perform_songs"], true, cfg),
    ).toThrow(/Yule/);
  });
});

describe("validateUndertakings — distinctness", () => {
  it("rejects a repeated non-Yule undertaking", () => {
    expect(() => validateUndertakings(warrior, ["change_useful_items", "change_useful_items"], true, cfg)).toThrow(
      /duplicate/,
    );
  });

  it("allows a repeated Yule-tagged undertaking", () => {
    // heal_scars is yule-tagged -> exempt from distinctness; two of them is within the Yule budget.
    const r = validateUndertakings(warrior, ["heal_scars", "heal_scars"], true, cfg);
    expect(r).toEqual(["heal_scars", "heal_scars"]);
  });

  it("rejects an unknown undertaking key", () => {
    expect(() => validateUndertakings(warrior, ["dance_a_jig"], true, cfg)).toThrow(/unknown/);
  });
});
