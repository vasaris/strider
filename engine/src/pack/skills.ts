/**
 * Skill -> governing attribute, read from the verified skills card
 * (kv.mechanics.traits.spisok_navykov; `category` is the attribute). Shared
 * helper so a subsystem needs only one copy of this derivation. The journey and
 * combat subsystems carry their own historical copies; new consumers (council,
 * later subsystems) use this one. No book number, no baked map: the mapping is
 * whatever the verified pack declares.
 */

import type { Attribute } from "../hero/state.js";
import type { Pack } from "./pack.js";

const SKILLS_CARD = "kv.mechanics.traits.spisok_navykov";

function obj(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new Error(`pack skills: ${where}: expected object`);
  }
  return v as Record<string, unknown>;
}

export function parseSkillAttribute(pack: Pack): Record<string, Attribute> {
  const payload = obj(obj(pack.requireById(SKILLS_CARD).raw, "skills card")["payload"], "skills.payload");
  const skills = obj(obj(payload["parameters"], "skills.parameters")["skills"], "skills.parameters.skills");
  const out: Record<string, Attribute> = {};
  for (const [key, def] of Object.entries(skills)) {
    const cat = obj(def, `skills.${key}`)["category"];
    if (cat === "strength" || cat === "heart" || cat === "wits") out[key] = cat;
    else throw new Error(`pack skills: skill ${key}: unexpected category ${JSON.stringify(cat)}`);
  }
  return out;
}
