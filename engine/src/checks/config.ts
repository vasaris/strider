/**
 * Check configuration: the boundary where Checks rule numbers enter the engine
 * from the verified pack (mirror of the Dice discipline — no book numbers in
 * engine math).
 *
 * Provenance (verified source -> field):
 *   kv.solo.hero_adjustments    target_number_base 18 -> tnBase
 *                               (referenced by kv.solo.raschet_celevogo_chisla
 *                                via params_ref; KV base is 20, solo is 18)
 *   checks.degree_of_success    tiers 0/1/2+          -> degreeTiers
 *   kv.solo.special_successes    rows                 -> specialSuccesses (solo list)
 *   kv.solo.risk_degrees         rows + default       -> riskDegrees / defaultRisk
 *   checks.bonus_dice_hope       hope_spend/inspired  -> hopeSpend
 *   checks.assistance            cost/gain            -> assistance
 */

import type { DegreeTier, RiskDegree, RiskDegreeSpec, SpecialSuccessOption, SuccessDegree } from "./types.js";

export interface CheckConfig {
  readonly tnBase: number;
  readonly degreeTiers: readonly DegreeTier[];
  readonly specialSuccesses: readonly SpecialSuccessOption[];
  readonly riskDegrees: readonly RiskDegreeSpec[];
  readonly defaultRisk: RiskDegree;
  readonly hopeSpend: {
    readonly cost: number;
    readonly gainDice: number;
    readonly inspiredGainDice: number;
    readonly maxPerRoll: number;
  };
  readonly assistance: { readonly cost: number; readonly gainDice: number };
}

export interface CheckConfigSources {
  readonly heroAdjustments: unknown; // kv.solo.hero_adjustments
  readonly degreeOfSuccess: unknown; // checks.degree_of_success
  readonly specialSuccesses: unknown; // kv.solo.special_successes
  readonly riskDegrees: unknown; // kv.solo.risk_degrees
  readonly bonusDiceHope: unknown; // checks.bonus_dice_hope
  readonly assistance: unknown; // checks.assistance
}

const DEGREE_BY_INDEX: readonly SuccessDegree[] = ["success", "great_success", "extraordinary_success"];
const RISK_KEYS: readonly RiskDegree[] = ["normal", "dangerous", "reckless"];

function fail(msg: string): never {
  throw new Error(`deriveCheckConfig: ${msg}`);
}

function asObject(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null) fail(`${where}: expected object`);
  return v as Record<string, unknown>;
}

function payloadOf(card: unknown, id: string): Record<string, unknown> {
  return asObject(asObject(card, id)["payload"], `${id}.payload`);
}

function paramsOf(card: unknown, id: string): Record<string, unknown> {
  return asObject(payloadOf(card, id)["parameters"], `${id}.payload.parameters`);
}

function intField(obj: Record<string, unknown>, key: string, where: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isInteger(v)) fail(`${where}.${key}: expected integer, got ${JSON.stringify(v)}`);
  return v;
}

function strField(obj: Record<string, unknown>, key: string, where: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0) fail(`${where}.${key}: expected non-empty string`);
  return v;
}

/** Parse "Nd_success" -> N. */
function diceGain(token: unknown, where: string): number {
  if (typeof token !== "string") fail(`${where}: expected gain token string`);
  const m = /^(\d+)d_success$/.exec(token);
  if (!m || m[1] === undefined) fail(`${where}: malformed gain token "${token}"`);
  return Number.parseInt(m[1], 10);
}

/** Parse a success_icons entry: integer N or the string "N+" -> N. */
function minIconsOf(raw: unknown, where: string): number {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  if (typeof raw === "string") {
    const m = /^(\d+)\+?$/.exec(raw);
    if (m && m[1] !== undefined) return Number.parseInt(m[1], 10);
  }
  return fail(`${where}: cannot read success_icons from ${JSON.stringify(raw)}`);
}

function rowsOf(card: unknown, id: string): Record<string, unknown>[] {
  const rows = payloadOf(card, id)["rows"];
  if (!Array.isArray(rows)) fail(`${id}.payload.rows: expected array`);
  return rows.map((r, i) => asObject(r, `${id}.payload.rows[${i}]`));
}

export function deriveCheckConfig(src: CheckConfigSources): CheckConfig {
  // --- TN base (rule_parameters: flat payload, no .parameters) ---
  const haPayload = payloadOf(src.heroAdjustments, "kv.solo.hero_adjustments");
  const tnBase = intField(haPayload, "target_number_base", "kv.solo.hero_adjustments.payload");

  // --- degree tiers ---
  const tiersRaw = paramsOf(src.degreeOfSuccess, "checks.degree_of_success")["tiers"];
  if (!Array.isArray(tiersRaw)) fail("checks.degree_of_success.parameters.tiers: expected array");
  if (tiersRaw.length !== DEGREE_BY_INDEX.length) {
    fail(`expected ${DEGREE_BY_INDEX.length} degree tiers, got ${tiersRaw.length}`);
  }
  const degreeTiers: DegreeTier[] = tiersRaw.map((t, i) => {
    const obj = asObject(t, `checks.degree_of_success.tiers[${i}]`);
    const minIcons = minIconsOf(obj["success_icons"], `checks.degree_of_success.tiers[${i}].success_icons`);
    if (minIcons !== i) fail(`degree tier ${i} has success_icons ${minIcons}, expected ${i}`);
    const degree = DEGREE_BY_INDEX[i];
    if (degree === undefined) fail(`no degree enum for tier index ${i}`);
    return { minIcons, degree, label: strField(obj, "label", `checks.degree_of_success.tiers[${i}]`) };
  });

  // --- special successes (solo list) ---
  const ssRows = rowsOf(src.specialSuccesses, "kv.solo.special_successes");
  if (ssRows.length === 0) fail("kv.solo.special_successes has no rows");
  const specialSuccesses: SpecialSuccessOption[] = ssRows.map((r, i) => ({
    key: strField(r, "key", `kv.solo.special_successes.rows[${i}]`),
    label: strField(r, "label", `kv.solo.special_successes.rows[${i}]`),
  }));

  // --- risk degrees ---
  const rdPayload = payloadOf(src.riskDegrees, "kv.solo.risk_degrees");
  const rdRows = rowsOf(src.riskDegrees, "kv.solo.risk_degrees");
  const riskDegrees: RiskDegreeSpec[] = rdRows.map((r, i) => {
    const key = strField(r, "key", `kv.solo.risk_degrees.rows[${i}]`);
    if (!RISK_KEYS.includes(key as RiskDegree)) fail(`unknown risk key "${key}"`);
    return {
      key: key as RiskDegree,
      label: strField(r, "degree", `kv.solo.risk_degrees.rows[${i}]`),
      failureResult: strField(r, "failure_result", `kv.solo.risk_degrees.rows[${i}]`),
    };
  });
  const defaultRiskRaw = strField(rdPayload, "default", "kv.solo.risk_degrees.payload");
  if (!RISK_KEYS.includes(defaultRiskRaw as RiskDegree)) fail(`unknown default risk "${defaultRiskRaw}"`);
  const defaultRisk = defaultRiskRaw as RiskDegree;

  // --- hope spend ---
  const bdhParams = paramsOf(src.bonusDiceHope, "checks.bonus_dice_hope");
  const hopeSpendObj = asObject(bdhParams["hope_spend"], "checks.bonus_dice_hope.parameters.hope_spend");
  const inspiredObj = asObject(bdhParams["inspired"], "checks.bonus_dice_hope.parameters.inspired");
  const hopeSpend = {
    cost: intField(hopeSpendObj, "cost", "checks.bonus_dice_hope.hope_spend"),
    gainDice: diceGain(hopeSpendObj["gain"], "checks.bonus_dice_hope.hope_spend.gain"),
    inspiredGainDice: diceGain(inspiredObj["gain"], "checks.bonus_dice_hope.inspired.gain"),
    maxPerRoll: intField(hopeSpendObj, "max_per_roll", "checks.bonus_dice_hope.hope_spend"),
  };

  // --- assistance ---
  const asParams = paramsOf(src.assistance, "checks.assistance");
  const assistance = {
    cost: intField(asParams, "cost", "checks.assistance.parameters"),
    gainDice: diceGain(asParams["gain"], "checks.assistance.parameters.gain"),
  };

  return { tnBase, degreeTiers, specialSuccesses, riskDegrees, defaultRisk, hopeSpend, assistance };
}
