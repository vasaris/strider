import type {
  Effect,
  FaceKey,
  FeatDieEventTable,
  FeatEventRow,
  LoreRow,
  LoreSection,
  OracleAnswersTable,
  OracleLikelihood,
  OracleLoreTable,
  SpecialAnswer,
} from "./types.js";

function fail(msg: string): never {
  throw new Error(`oracle parse: ${msg}`);
}

function asObject(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${where}: expected object`);
  return v as Record<string, unknown>;
}

function asArray(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) fail(`${where}: expected array`);
  return v;
}

function str(obj: Record<string, unknown>, key: string, where: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0) fail(`${where}.${key}: expected non-empty string`);
  return v;
}

function payloadOf(raw: unknown, where: string): Record<string, unknown> {
  return asObject(asObject(raw, where)["payload"], `${where}.payload`);
}

/** A Feat-die face key: integer 1..10, or "eye" / "gandalf_rune". */
function parseFaceKey(v: unknown, where: string): FaceKey {
  if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 10) return v;
  if (v === "eye" || v === "gandalf_rune") return v;
  return fail(`${where}: invalid face ${JSON.stringify(v)}`);
}

function parseEffects(v: unknown, where: string): Effect[] {
  if (v === undefined) return [];
  const arr = asArray(v, where);
  return arr.map((e, i) => {
    const obj = asObject(e, `${where}[${i}]`);
    if (typeof obj["op"] !== "string" || obj["op"].length === 0) fail(`${where}[${i}].op: expected non-empty string`);
    return obj as Effect;
  });
}

export function parseAnswersTable(raw: unknown): OracleAnswersTable {
  const p = payloadOf(raw, "answers");
  const likeArr = asArray(p["likelihoods"], "answers.payload.likelihoods");
  const likelihoods: OracleLikelihood[] = likeArr.map((l, i) => {
    const o = asObject(l, `answers.likelihoods[${i}]`);
    const yes = o["yes_if_at_least"];
    if (typeof yes !== "number" || !Number.isInteger(yes)) fail(`answers.likelihoods[${i}].yes_if_at_least: integer`);
    return {
      key: str(o, "key", `answers.likelihoods[${i}]`),
      label: str(o, "label", `answers.likelihoods[${i}]`),
      yesIfAtLeast: yes,
      isDefault: o["default"] === true,
    };
  });
  if (likelihoods.filter((l) => l.isDefault).length !== 1) {
    fail("answers: exactly one likelihood must be marked default");
  }

  const special = asObject(p["special_faces"], "answers.payload.special_faces");
  const parseSpecial = (v: unknown, where: string): SpecialAnswer => {
    const o = asObject(v, where);
    const answer = o["answer"];
    if (answer !== "yes" && answer !== "no") fail(`${where}.answer: expected "yes" or "no"`);
    if (typeof o["extreme"] !== "boolean") fail(`${where}.extreme: expected boolean`);
    return { answer, extreme: o["extreme"], text: str(o, "text", where) };
  };

  return {
    likelihoods,
    gandalfRune: parseSpecial(special["gandalf_rune"], "answers.special_faces.gandalf_rune"),
    eye: parseSpecial(special["eye"], "answers.special_faces.eye"),
  };
}

export function parseLoreTable(raw: unknown): OracleLoreTable {
  const p = payloadOf(raw, "lore");
  const sectionsArr = asArray(p["sections"], "lore.payload.sections");
  const sections: LoreSection[] = sectionsArr.map((s, i) => {
    const o = asObject(s, `lore.sections[${i}]`);
    const rowsArr = asArray(o["rows"], `lore.sections[${i}].rows`);
    const rows: LoreRow[] = rowsArr.map((r, j) => {
      const ro = asObject(r, `lore.sections[${i}].rows[${j}]`);
      return {
        action: str(ro, "action", `lore.sections[${i}].rows[${j}]`),
        aspect: str(ro, "aspect", `lore.sections[${i}].rows[${j}]`),
        focus: str(ro, "focus", `lore.sections[${i}].rows[${j}]`),
      };
    });
    return { face: parseFaceKey(o["face"], `lore.sections[${i}].face`), rows };
  });
  return { sections };
}

export function parseFeatDieEventTable(raw: unknown): FeatDieEventTable {
  const p = payloadOf(raw, "feat_die_event");
  const rowsArr = asArray(p["rows"], "feat_die_event.payload.rows");
  const rows: FeatEventRow[] = rowsArr.map((r, i) => {
    const o = asObject(r, `feat_die_event.rows[${i}]`);
    return {
      face: parseFaceKey(o["face"], `feat_die_event.rows[${i}].face`),
      text: str(o, "text", `feat_die_event.rows[${i}]`),
      effects: parseEffects(o["effects"], `feat_die_event.rows[${i}].effects`),
    };
  });
  return { rows };
}
