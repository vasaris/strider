/**
 * Fellowship Phase config, assembled from the verified pack. Mirror of
 * progression/config.ts: each `deriveX` function is a pure seam that reads one
 * raw card's numbers out, so the anti-hardcode tests can feed a stub card with
 * different numbers and watch the config follow. `fellowshipConfigFromPack` then
 * wires them together with `pack.requireById`.
 *
 * The Fellowship Phase reads from four cards (structure, Yule, undertakings, and
 * the solo Shadow-recovery table), so -- like progression, and unlike the
 * one-card subsystems -- the card-id literals live here (and in the CLI), per
 * the engine invariant. No number below is baked: phase steps, duration
 * descriptors, recovery tiers, Yule extras and the undertaking budget/catalog
 * all come from the cards. Recovery amounts that depend on the hero (HEART/WITS
 * ratings) are read off HeroState at apply time, not here.
 */

import type { Pack } from "../pack/pack.js";
import {
  asArray,
  asObject,
  boolField,
  fail,
  intField,
  parseAgingYears,
  paramsOf,
  payloadOf,
  requireToken,
  strArray,
} from "./parse.js";
import type {
  FellowshipConfig,
  RecoveryModel,
  UndertakingMeta,
  UndertakingModel,
  YuleModel,
} from "./types.js";

const STRUKTURA_CARD = "kv.mechanics.fellowship_phase.struktura_fazy_bratstva";
const YOL_CARD = "kv.mechanics.fellowship_phase.yol";
const NACHINANIYA_CARD = "kv.mechanics.fellowship_phase.nachinaniya_fazy_bratstva";
const SOLO_SHADOW_CARD = "kv.solo.shadow_recovery";

// ---------------------------------------------------------------------------
// Derivers (pure; one card each)
// ---------------------------------------------------------------------------

/** Ordered phase steps + duration descriptors + place tags (struktura). */
export function deriveStructure(raw: unknown): {
  readonly steps: readonly string[];
  readonly duration: { readonly min: string; readonly max: string; readonly longest: string };
  readonly placeTags: readonly string[];
} {
  const where = STRUKTURA_CARD;
  const p = paramsOf(raw, where);
  const steps = strArray(p["steps"], `${where}.steps`);
  if (steps.length === 0) fail(`${where}.steps: empty`);
  const dur = asObject(p["duration"], `${where}.duration`);
  const duration = {
    min: requireNonEmpty(dur["min"], `${where}.duration.min`),
    max: requireNonEmpty(dur["max"], `${where}.duration.max`),
    longest: requireNonEmpty(dur["longest"], `${where}.duration.longest`),
  };
  const placeTags = strArray(p["place"], `${where}.place`);
  return { steps, duration, placeTags };
}

/** Spiritual-recovery tiers from struktura + solo amounts from the solo table. */
export function deriveRecovery(rawStruktura: unknown, rawSolo: unknown): RecoveryModel {
  const where = `${STRUKTURA_CARD}.spiritual_recovery`;
  const sr = asObject(paramsOf(rawStruktura, STRUKTURA_CARD)["spiritual_recovery"], where);

  // Hope restore is the HEART rating; pin the descriptor so a card change shows.
  requireToken(sr, "hope_recovered", "heart_rating", where);
  // Yule restores Hope fully; pin the descriptor likewise.
  const yuleHope = sr["yule"];
  if (yuleHope !== "full_hope") fail(`${where}.yule: expected "full_hope", got ${JSON.stringify(yuleHope)}`);

  const tiersRaw = asObject(sr["shadow_reduction_on_success"], `${where}.shadow_reduction_on_success`);
  const shadowReductionTiers: Record<string, number> = {};
  for (const key of Object.keys(tiersRaw)) {
    shadowReductionTiers[key] = intField(tiersRaw, key, `${where}.shadow_reduction_on_success`);
  }
  if (Object.keys(shadowReductionTiers).length === 0) fail(`${where}.shadow_reduction_on_success: empty`);

  // Solo-canonical removal amounts (kv.solo.shadow_recovery is a lookup_table:
  // payload.rows[].shadow_removed). Used to cross-check the tier amounts.
  const soloWhere = SOLO_SHADOW_CARD;
  const payload = payloadOf(rawSolo, soloWhere);
  const phase = payload["phase"];
  if (phase !== "fellowship") fail(`${soloWhere}.phase: expected "fellowship", got ${JSON.stringify(phase)}`);
  const rows = asArray(payload["rows"], `${soloWhere}.rows`);
  const soloShadowAmounts = rows.map((row, i) =>
    intField(asObject(row, `${soloWhere}.rows[${i}]`), "shadow_removed", `${soloWhere}.rows[${i}]`),
  );
  if (soloShadowAmounts.length === 0) fail(`${soloWhere}.rows: empty`);

  return {
    hopeRecovered: "heart_rating",
    yuleFullHope: true,
    shadowReductionTiers,
    soloShadowAmounts,
  };
}

/** Yule extras: full hope, aging, bonus skill points (fellowship_phase.yol). */
export function deriveYule(raw: unknown): YuleModel {
  const where = YOL_CARD;
  const p = paramsOf(raw, where);
  const fullHope = boolField(p, "full_hope", where);
  const agingYears = parseAgingYears(p["aging"], `${where}.aging`);
  // Bonus skill points are the WITS rating; pin the descriptor.
  requireToken(p, "bonus_skill_points", "wits_rating", where);
  return { fullHope, agingYears, bonusSkillPoints: "wits_rating" };
}

/** Undertaking selection budget + catalog (nachinaniya_fazy_bratstva). */
export function deriveUndertakings(raw: unknown): UndertakingModel {
  const where = NACHINANIYA_CARD;
  const p = paramsOf(raw, where);
  const sel = asObject(p["selection"], `${where}.selection`);

  const normalRaw = asObject(sel["normal_phase"], `${where}.selection.normal_phase`);
  const normal = {
    partyCommon: intField(normalRaw, "party_common", `${where}.selection.normal_phase`),
    freeCalling: intField(normalRaw, "free_calling_undertaking", `${where}.selection.normal_phase`),
    maxTotal: intField(normalRaw, "max_total", `${where}.selection.normal_phase`),
  };
  const yuleRaw = asObject(sel["yule"], `${where}.selection.yule`);
  const yule = {
    perHero: intField(yuleRaw, "per_hero", `${where}.selection.yule`),
    plusPartyCommon: intField(yuleRaw, "plus_party_common", `${where}.selection.yule`),
  };
  const distinctExcept = requireNonEmpty(sel["must_be_distinct_except"], `${where}.selection.must_be_distinct_except`);

  const undertakingsRaw = asObject(p["undertakings"], `${where}.undertakings`);
  const catalog: Record<string, UndertakingMeta> = {};
  for (const key of Object.keys(undertakingsRaw)) {
    const u = asObject(undertakingsRaw[key], `${where}.undertakings.${key}`);
    const freeRaw = u["free_if_calling"];
    catalog[key] = {
      yuleTagged: u["yule"] === true,
      freeIfCalling: typeof freeRaw === "string" && freeRaw.length > 0 ? freeRaw : null,
    };
  }
  if (Object.keys(catalog).length === 0) fail(`${where}.undertakings: empty`);

  return { normal, yule, distinctExcept, catalog };
}

// ---------------------------------------------------------------------------
// Pack assembly
// ---------------------------------------------------------------------------

export function fellowshipConfigFromPack(pack: Pack): FellowshipConfig {
  const struktura = pack.requireById(STRUKTURA_CARD).raw;
  const { steps, duration, placeTags } = deriveStructure(struktura);
  const recovery = deriveRecovery(struktura, pack.requireById(SOLO_SHADOW_CARD).raw);
  const yule = deriveYule(pack.requireById(YOL_CARD).raw);
  const undertakings = deriveUndertakings(pack.requireById(NACHINANIYA_CARD).raw);
  return { steps, duration, placeTags, recovery, yule, undertakings };
}

// ---------------------------------------------------------------------------
// Local helper (string field on an unknown-typed object value)
// ---------------------------------------------------------------------------

function requireNonEmpty(v: unknown, where: string): string {
  if (typeof v !== "string" || v.length === 0) fail(`${where}: expected non-empty string`);
  return v;
}
