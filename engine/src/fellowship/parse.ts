/**
 * Internal parse helpers for the Fellowship Phase config derivers (config.ts).
 * Mirror of the per-subsystem deriver style (progression/parse.ts,
 * council/parse.ts, combat/parse.ts): every value the Fellowship Phase consumes
 * is read from the verified pack, never baked. Not exported from the barrel --
 * internal to the fellowship subsystem.
 */

export function fail(msg: string): never {
  throw new Error(`fellowship parse: ${msg}`);
}

export function asObject(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${where}: expected object`);
  return v as Record<string, unknown>;
}

export function asArray(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) fail(`${where}: expected array`);
  return v;
}

/** Read raw card -> its payload.parameters object (structured rule data). */
export function paramsOf(raw: unknown, where: string): Record<string, unknown> {
  const payload = asObject(asObject(raw, where)["payload"], `${where}.payload`);
  return asObject(payload["parameters"], `${where}.payload.parameters`);
}

/** Read raw card -> its payload object (for lookup_table cards with no parameters). */
export function payloadOf(raw: unknown, where: string): Record<string, unknown> {
  return asObject(asObject(raw, where)["payload"], `${where}.payload`);
}

export function intField(obj: Record<string, unknown>, key: string, where: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isInteger(v)) fail(`${where}.${key}: expected integer`);
  return v as number;
}

export function boolField(obj: Record<string, unknown>, key: string, where: string): boolean {
  const v = obj[key];
  if (typeof v !== "boolean") fail(`${where}.${key}: expected boolean`);
  return v;
}

export function strField(obj: Record<string, unknown>, key: string, where: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0) fail(`${where}.${key}: expected non-empty string`);
  return v;
}

/**
 * Assert a descriptor field equals an expected token. The Fellowship Phase reads
 * recovery amounts off hero attributes (heart/wits ratings), so the pack carries
 * the *descriptor* ("heart_rating", "wits_rating") rather than a number; pinning
 * the exact token here makes a card change visible instead of silently misread.
 */
export function requireToken(obj: Record<string, unknown>, key: string, expected: string, where: string): string {
  const v = strField(obj, key, where);
  if (v !== expected) fail(`${where}.${key}: expected token ${JSON.stringify(expected)}, got ${JSON.stringify(v)}`);
  return v;
}

/** A list of non-empty strings; opaque pack content carried as-is. */
export function strArray(v: unknown, where: string): readonly string[] {
  return asArray(v, where).map((item, i) => {
    if (typeof item !== "string" || item.length === 0) fail(`${where}[${i}]: expected non-empty string`);
    return item;
  });
}

/**
 * Parse the Yule aging descriptor. The card expresses it as the text
 * "plus_one_year" rather than the integer 1, so the coefficient is read out here
 * at config time (analogous to progression's parseValourWisdomCap). Fail-fast on
 * an unknown form so a card change cannot be silently dropped.
 */
export function parseAgingYears(v: unknown, where: string): number {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (v === "plus_one_year") return 1;
  return fail(`${where}: cannot parse aging descriptor ${JSON.stringify(v)}`);
}
