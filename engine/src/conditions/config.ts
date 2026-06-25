import type { Pack } from "../pack/pack.js";

/** Numbers and flags governing conditions, read from verified rule cards. */
export interface ConditionsConfig {
  /** Success die faces voided for a weary hero (conditions.weariness). */
  readonly wearyVoidedFaces: readonly number[];
  /** Whether Shadow points cap at the maximum Hope rating (bally_teni). */
  readonly shadowCapsAtMaxHope: boolean;
  /** Endurance regained on waking from 0 if not wounded (vynoslivost). */
  readonly zeroEnduranceRecover: number;
}

function fail(msg: string): never {
  throw new Error(`conditions config: ${msg}`);
}
function obj(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${where}: expected object`);
  return v as Record<string, unknown>;
}
function params(pack: Pack, id: string): Record<string, unknown> {
  const payload = obj(obj(pack.requireById(id).raw, id)["payload"], `${id}.payload`);
  return obj(payload["parameters"], `${id}.parameters`);
}

export function deriveConditionsConfig(pack: Pack): ConditionsConfig {
  const weariness = params(pack, "kv.mechanics.conditions.weariness");
  const effect = obj(weariness["effect"], "weariness.effect");
  const voidedRaw = effect["success_die_values_voided"];
  if (!Array.isArray(voidedRaw) || voidedRaw.some((n) => typeof n !== "number" || !Number.isInteger(n))) {
    fail("weariness.effect.success_die_values_voided: expected integer array");
  }
  const wearyVoidedFaces = (voidedRaw as number[]).slice();

  const shadow = params(pack, "kv.mechanics.shadow.bally_teni");
  const shadowPoints = obj(shadow["shadow_points"], "bally_teni.shadow_points");
  const shadowCapsAtMaxHope = shadowPoints["cap"] === "max_hope_rating";
  if (!shadowCapsAtMaxHope) fail("bally_teni.shadow_points.cap: expected max_hope_rating");

  const endurance = params(pack, "kv.mechanics.endurance_hope.vynoslivost");
  const zeroRaw = endurance["zero_endurance"];
  // Pack encodes the rule as e.g. "unconscious_recover_1_after_1h_if_not_wounded";
  // the recover magnitude is parsed from that string, not baked here.
  const match = typeof zeroRaw === "string" ? zeroRaw.match(/recover_(\d+)/) : null;
  const zeroEnduranceRecover = match ? Number(match[1]) : fail("vynoslivost.zero_endurance: cannot read recover magnitude");

  return { wearyVoidedFaces, shadowCapsAtMaxHope, zeroEnduranceRecover };
}
