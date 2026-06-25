import { type CheckConfig } from "../checks/config.js";
import { checkConfigFromPack, diceConfigFromPack } from "../pack/configFromPack.js";
import { type DiceConfig } from "../dice/config.js";
import { type EyeConfig } from "../eye/config.js";
import { eyeConfigFromPack } from "../eye/fromPack.js";
import { type PackOracles, oraclesFromPack } from "../oracles/fromPack.js";
import { parseFeatDieEventTable } from "../oracles/parse.js";
import type { FaceKey, FeatDieEventTable } from "../oracles/types.js";
import type { Pack } from "../pack/pack.js";
import type { Attribute, Consequence } from "./state.js";

export type SceneBias = "favoured" | "plain" | "ill_favoured";

export interface JourneySceneRow {
  /** Exactly one of face / range identifies the matching Feat result. */
  readonly face?: FaceKey;
  readonly range?: { readonly min: number; readonly max: number };
  readonly sceneType: string;
  readonly consequence: Consequence;
  readonly fatigueGain: number; // null in pack -> 0
  readonly detailTableId: string;
}

export interface JourneyScenesTable {
  readonly bias: Readonly<Record<"border_lands" | "wild_lands" | "dark_lands", SceneBias>>;
  readonly rows: readonly JourneySceneRow[]; // 7
}

export interface SceneDetailRow {
  readonly face: number; // 1..6
  readonly scene: string;
  readonly prompt: string;
  readonly skill: string | null;
  readonly significantEncounter: boolean;
}

export interface SceneDetailTable {
  readonly sceneType: string;
  readonly rows: readonly SceneDetailRow[]; // 6
}

export interface JourneyConfigs {
  readonly dice: DiceConfig;
  readonly checks: CheckConfig;
  readonly eye: EyeConfig;
  readonly oracles: PackOracles;
  readonly detectionScenes: FeatDieEventTable;
  readonly scenes: JourneyScenesTable;
  readonly detailTables: ReadonlyMap<string, SceneDetailTable>; // by sceneType
  readonly skillAttribute: Readonly<Record<string, Attribute>>;
}

function fail(msg: string): never {
  throw new Error(`journey config: ${msg}`);
}
function asObject(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${where}: expected object`);
  return v as Record<string, unknown>;
}
function asArray(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) fail(`${where}: expected array`);
  return v;
}
function str(o: Record<string, unknown>, k: string, where: string): string {
  const v = o[k];
  if (typeof v !== "string" || v.length === 0) fail(`${where}.${k}: expected non-empty string`);
  return v;
}
function payloadOf(raw: unknown, where: string): Record<string, unknown> {
  return asObject(asObject(raw, where)["payload"], `${where}.payload`);
}

function parseConsequence(v: unknown, where: string): Consequence {
  const o = asObject(v, where);
  const trigger = o["trigger"];
  if (trigger !== "on_success" && trigger !== "on_failure") fail(`${where}.trigger: on_success|on_failure`);
  const effects = asArray(o["effects"], `${where}.effects`).map((e, i) => {
    const eo = asObject(e, `${where}.effects[${i}]`);
    if (typeof eo["op"] !== "string") fail(`${where}.effects[${i}].op: string`);
    return eo as { op: string };
  });
  return { trigger, effects };
}

function parseFace(v: unknown, where: string): FaceKey {
  if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 10) return v;
  if (v === "eye" || v === "gandalf_rune") return v;
  return fail(`${where}: invalid face ${JSON.stringify(v)}`);
}

export function parseJourneyScenesTable(raw: unknown): JourneyScenesTable {
  const p = payloadOf(raw, "journey_scenes");
  const biasObj = asObject(p["regional_roll_bias"], "journey_scenes.regional_roll_bias");
  const readBias = (k: string): SceneBias => {
    const v = biasObj[k];
    if (v !== "favoured" && v !== "plain" && v !== "ill_favoured") fail(`regional_roll_bias.${k}: invalid`);
    return v;
  };
  const rowsArr = asArray(p["rows"], "journey_scenes.rows");
  const rows: JourneySceneRow[] = rowsArr.map((r, i) => {
    const o = asObject(r, `journey_scenes.rows[${i}]`);
    const fatigueRaw = o["fatigue_gain"];
    const fatigueGain = fatigueRaw === null || fatigueRaw === undefined ? 0 : fatigueRaw;
    if (typeof fatigueGain !== "number" || !Number.isInteger(fatigueGain)) fail(`rows[${i}].fatigue_gain`);
    const base = {
      sceneType: str(o, "scene_type", `journey_scenes.rows[${i}]`),
      consequence: parseConsequence(o["consequence"], `journey_scenes.rows[${i}].consequence`),
      fatigueGain,
      detailTableId: str(o, "detail_table", `journey_scenes.rows[${i}]`),
    };
    if (o["face"] !== undefined) return { ...base, face: parseFace(o["face"], `rows[${i}].face`) };
    const rangeO = asObject(o["range"], `journey_scenes.rows[${i}].range`);
    const min = rangeO["min"];
    const max = rangeO["max"];
    if (typeof min !== "number" || typeof max !== "number") fail(`rows[${i}].range: min/max integers`);
    return { ...base, range: { min, max } };
  });
  return {
    bias: { border_lands: readBias("border_lands"), wild_lands: readBias("wild_lands"), dark_lands: readBias("dark_lands") },
    rows,
  };
}

export function parseSceneDetailTable(raw: unknown): SceneDetailTable {
  const p = payloadOf(raw, "scene_detail");
  const sceneType = str(p, "scene_type", "scene_detail");
  const rowsArr = asArray(p["rows"], "scene_detail.rows");
  const rows: SceneDetailRow[] = rowsArr.map((r, i) => {
    const o = asObject(r, `scene_detail.rows[${i}]`);
    const face = o["face"];
    if (typeof face !== "number" || !Number.isInteger(face) || face < 1 || face > 6) fail(`rows[${i}].face: 1..6`);
    const skillRaw = o["skill"];
    const skill = skillRaw === undefined || skillRaw === null ? null : typeof skillRaw === "string" ? skillRaw : fail(`rows[${i}].skill`);
    return {
      face,
      scene: str(o, "scene", `scene_detail.rows[${i}]`),
      prompt: str(o, "prompt", `scene_detail.rows[${i}]`),
      skill,
      significantEncounter: o["significant_encounter"] === true,
    };
  });
  return { sceneType, rows };
}

/** Skill -> governing attribute, from traits.spisok_navykov (category). */
function parseSkillAttribute(pack: Pack): Record<string, Attribute> {
  const p = asObject(asObject(pack.requireById("kv.mechanics.traits.spisok_navykov").raw, "skills card")["payload"], "skills.payload");
  const skills = asObject(asObject(p["parameters"], "skills.parameters")["skills"], "skills.parameters.skills");
  const out: Record<string, Attribute> = {};
  for (const [key, def] of Object.entries(skills)) {
    const cat = asObject(def, `skills.${key}`)["category"];
    if (cat === "strength" || cat === "heart" || cat === "wits") out[key] = cat;
    else fail(`skill ${key}: unexpected category ${JSON.stringify(cat)}`);
  }
  return out;
}

export function journeyConfigsFromPack(pack: Pack): JourneyConfigs {
  const scenes = parseJourneyScenesTable(pack.requireById("kv.solo.journey_scenes").raw);
  const detailTables = new Map<string, SceneDetailTable>();
  for (const entry of pack.listByType("scene_detail_table")) {
    const t = parseSceneDetailTable(entry.raw);
    detailTables.set(t.sceneType, t);
  }
  return {
    dice: diceConfigFromPack(pack),
    checks: checkConfigFromPack(pack),
    eye: eyeConfigFromPack(pack),
    oracles: oraclesFromPack(pack),
    detectionScenes: parseFeatDieEventTable(pack.requireById("kv.solo.detection_scenes").raw),
    scenes,
    detailTables,
    skillAttribute: parseSkillAttribute(pack),
  };
}
