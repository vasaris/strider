import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  deriveRecovery,
  deriveStructure,
  deriveUndertakings,
  deriveYule,
  fellowshipConfigFromPack,
} from "../../src/fellowship/config.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

/** Minimal raw rule_card stub: only payload.parameters is read by the derivers. */
function card(parameters: unknown): unknown {
  return { payload: { parameters } };
}
/** Minimal raw lookup_table stub: payload is read directly (rows + phase). */
function tablePayload(payload: unknown): unknown {
  return { payload };
}

describe("fellowshipConfigFromPack — derives the verified phase numbers", () => {
  const pack = loadPack(nodePackSource(packRoot));
  const cfg = fellowshipConfigFromPack(pack);

  it("reads the four phase steps in book order", () => {
    expect(cfg.steps).toEqual(["determine_duration", "choose_place", "improve_stats", "choose_undertakings"]);
  });

  it("reads the duration descriptors and place tags", () => {
    expect(cfg.duration).toEqual({ min: "one_week", max: "a_season", longest: "yule" });
    expect(cfg.placeTags).toEqual(["safe", "previously_visited"]);
  });

  it("reads the spiritual-recovery tiers and cross-checks the solo amounts", () => {
    expect(cfg.recovery.hopeRecovered).toBe("heart_rating");
    expect(cfg.recovery.yuleFullHope).toBe(true);
    expect(cfg.recovery.shadowReductionTiers).toEqual({ minor: 1, active: 2, great_deeds: 3 });
    expect(cfg.recovery.soloShadowAmounts).toEqual([1, 2, 3]);
  });

  it("reads the Yule extras (full hope, aging, wits bonus skill points)", () => {
    expect(cfg.yule).toEqual({ fullHope: true, agingYears: 1, bonusSkillPoints: "wits_rating" });
  });

  it("reads the undertaking budget and catalog flags", () => {
    expect(cfg.undertakings.normal).toEqual({ partyCommon: 1, freeCalling: 1, maxTotal: 2 });
    expect(cfg.undertakings.yule).toEqual({ perHero: 1, plusPartyCommon: 1 });
    expect(cfg.undertakings.distinctExcept).toBe("yule_tagged");
    expect(cfg.undertakings.catalog["write_song"]).toEqual({ yuleTagged: false, freeIfCalling: "warrior" });
    expect(cfg.undertakings.catalog["heal_scars"]).toEqual({ yuleTagged: true, freeIfCalling: null });
  });
});

describe("derivers follow stub cards (anti-hardcode)", () => {
  it("deriveStructure reads steps/duration/place from the card, not literals", () => {
    const r = deriveStructure(
      card({
        steps: ["a", "b"],
        duration: { min: "x", max: "y", longest: "z" },
        place: ["p1", "p2", "p3"],
      }),
    );
    expect(r.steps).toEqual(["a", "b"]);
    expect(r.duration).toEqual({ min: "x", max: "y", longest: "z" });
    expect(r.placeTags).toEqual(["p1", "p2", "p3"]);
  });

  it("deriveRecovery reads tiers from struktura and amounts from the solo table", () => {
    const struktura = card({
      spiritual_recovery: {
        hope_recovered: "heart_rating",
        yule: "full_hope",
        shadow_reduction_on_success: { weak: 5, strong: 9 },
      },
    });
    const solo = tablePayload({ phase: "fellowship", rows: [{ shadow_removed: 5 }, { shadow_removed: 9 }] });
    const r = deriveRecovery(struktura, solo);
    expect(r.shadowReductionTiers).toEqual({ weak: 5, strong: 9 });
    expect(r.soloShadowAmounts).toEqual([5, 9]);
  });

  it("deriveRecovery fails on a wrong hope descriptor", () => {
    const struktura = card({
      spiritual_recovery: { hope_recovered: "soul_rating", yule: "full_hope", shadow_reduction_on_success: { a: 1 } },
    });
    const solo = tablePayload({ phase: "fellowship", rows: [{ shadow_removed: 1 }] });
    expect(() => deriveRecovery(struktura, solo)).toThrow(/hope_recovered/);
  });

  it("deriveRecovery fails when the solo table is not the fellowship phase", () => {
    const struktura = card({
      spiritual_recovery: { hope_recovered: "heart_rating", yule: "full_hope", shadow_reduction_on_success: { a: 1 } },
    });
    const solo = tablePayload({ phase: "adventuring", rows: [{ shadow_removed: 1 }] });
    expect(() => deriveRecovery(struktura, solo)).toThrow(/phase/);
  });

  it("deriveYule reads the aging descriptor and bonus-skill token", () => {
    expect(deriveYule(card({ full_hope: true, aging: "plus_one_year", bonus_skill_points: "wits_rating" }))).toEqual({
      fullHope: true,
      agingYears: 1,
      bonusSkillPoints: "wits_rating",
    });
    // An integer aging is accepted as-is (the descriptor is only one encoding).
    expect(deriveYule(card({ full_hope: true, aging: 3, bonus_skill_points: "wits_rating" })).agingYears).toBe(3);
  });

  it("deriveYule fails on an unexpected bonus-skill token", () => {
    expect(() => deriveYule(card({ full_hope: true, aging: "plus_one_year", bonus_skill_points: "mind_rating" }))).toThrow(
      /bonus_skill_points/,
    );
  });

  it("deriveUndertakings reads the budget and catalog flags from the card", () => {
    const r = deriveUndertakings(
      card({
        selection: {
          normal_phase: { party_common: 2, free_calling_undertaking: 1, max_total: 4 },
          yule: { per_hero: 3, plus_party_common: 2 },
          must_be_distinct_except: "yule_tagged",
        },
        undertakings: {
          alpha: { name_ru: "A", free_if_calling: "warrior" },
          beta: { name_ru: "B", yule: true },
          gamma: { name_ru: "C" },
        },
      }),
    );
    expect(r.normal).toEqual({ partyCommon: 2, freeCalling: 1, maxTotal: 4 });
    expect(r.yule).toEqual({ perHero: 3, plusPartyCommon: 2 });
    expect(r.catalog["alpha"]).toEqual({ yuleTagged: false, freeIfCalling: "warrior" });
    expect(r.catalog["beta"]).toEqual({ yuleTagged: true, freeIfCalling: null });
    expect(r.catalog["gamma"]).toEqual({ yuleTagged: false, freeIfCalling: null });
  });
});
