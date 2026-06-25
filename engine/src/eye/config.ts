/**
 * Eye configuration, derived from kv.solo.eye_of_mordor (rule_parameters).
 * Mirror of the engine-wide discipline: no Eye rule numbers live in code.
 */

import type { EyeRegion } from "./types.js";

export interface EyeConfig {
  readonly initialBase: number;
  /** Culture modifiers to the initial rating (dwarf/elf_or_dunedain/high_elf). */
  readonly cultureModifier: { readonly dwarf: number; readonly elf_or_dunedain: number; readonly high_elf: number };
  readonly valourModifier: number; // applied when Valour >= 4
  readonly famousItemModifier: number; // per famous weapon/armour
  readonly growth: {
    readonly eyeOnFeatOutOfCombat: number;
    readonly misfortuneEyeResult: number;
    readonly shadowPerPoint: boolean;
  };
  readonly pursuitThresholds: Record<EyeRegion, number>;
  readonly pursuitModifiers: readonly { readonly value: number; readonly text: string }[];
}

function fail(msg: string): never {
  throw new Error(`deriveEyeConfig: ${msg}`);
}

function asObject(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${where}: expected object`);
  return v as Record<string, unknown>;
}

function asArray(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) fail(`${where}: expected array`);
  return v;
}

function intField(obj: Record<string, unknown>, key: string, where: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isInteger(v)) fail(`${where}.${key}: expected integer`);
  return v;
}

/** Find an entry in a list whose `field` equals `value`, return its object. */
function findBy(arr: unknown[], field: string, value: string, where: string): Record<string, unknown> {
  for (const item of arr) {
    const o = asObject(item, where);
    if (o[field] === value) return o;
  }
  return fail(`${where}: no entry with ${field} == "${value}"`);
}

function modValue(modifiers: unknown[], condition: string): number {
  const o = findBy(modifiers, "condition", condition, "eye_of_mordor.initial_rating.modifiers");
  return intField(o, "value", `initial_rating.modifiers[${condition}]`);
}

export function deriveEyeConfig(raw: unknown): EyeConfig {
  const payload = asObject(asObject(raw, "eye_of_mordor")["payload"], "eye_of_mordor.payload");

  // --- initial rating ---
  const initial = asObject(payload["initial_rating"], "eye_of_mordor.initial_rating");
  const initialBase = intField(initial, "base", "eye_of_mordor.initial_rating");
  const modifiers = asArray(initial["modifiers"], "eye_of_mordor.initial_rating.modifiers");

  // --- growth triggers ---
  const triggers = asArray(payload["growth_triggers"], "eye_of_mordor.growth_triggers");
  const eyeOnFeat = intField(
    findBy(triggers, "trigger", "eye_on_feat_die_out_of_combat", "eye_of_mordor.growth_triggers"),
    "value",
    "growth_triggers[eye_on_feat_die_out_of_combat]",
  );
  const misfortuneEye = intField(
    findBy(triggers, "trigger", "eye_result_on_misfortune_table", "eye_of_mordor.growth_triggers"),
    "value",
    "growth_triggers[eye_result_on_misfortune_table]",
  );
  const shadowTrigger = findBy(triggers, "trigger", "shadow_points_gained_out_of_combat", "eye_of_mordor.growth_triggers");
  const shadowPerPoint = shadowTrigger["value"] === "per_point";
  if (!shadowPerPoint) fail(`shadow growth trigger expected "per_point", got ${JSON.stringify(shadowTrigger["value"])}`);

  // --- pursuit thresholds ---
  const thresholds = asObject(payload["pursuit_thresholds"], "eye_of_mordor.pursuit_thresholds");
  const pursuitThresholds: Record<EyeRegion, number> = {
    border_lands: intField(thresholds, "border_lands", "eye_of_mordor.pursuit_thresholds"),
    wild_lands: intField(thresholds, "wild_lands", "eye_of_mordor.pursuit_thresholds"),
    dark_lands: intField(thresholds, "dark_lands", "eye_of_mordor.pursuit_thresholds"),
  };

  // --- pursuit modifiers (value + opaque text) ---
  const modsArr = asArray(payload["pursuit_modifiers"], "eye_of_mordor.pursuit_modifiers");
  const pursuitModifiers = modsArr.map((m, i) => {
    const o = asObject(m, `eye_of_mordor.pursuit_modifiers[${i}]`);
    const text = o["text"];
    if (typeof text !== "string" || text.length === 0) fail(`pursuit_modifiers[${i}].text: expected non-empty string`);
    return { value: intField(o, "value", `pursuit_modifiers[${i}]`), text };
  });

  return {
    initialBase,
    cultureModifier: {
      dwarf: modValue(modifiers, "culture_dwarf"),
      elf_or_dunedain: modValue(modifiers, "culture_elf_or_dunedain"),
      high_elf: modValue(modifiers, "culture_high_elf"),
    },
    valourModifier: modValue(modifiers, "valour_gte_4"),
    famousItemModifier: modValue(modifiers, "per_famous_weapon_or_armour"),
    growth: { eyeOnFeatOutOfCombat: eyeOnFeat, misfortuneEyeResult: misfortuneEye, shadowPerPoint },
    pursuitThresholds,
    pursuitModifiers,
  };
}
