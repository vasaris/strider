/**
 * Internal parse helpers for the progression derivers (config.ts). Mirror of the
 * per-subsystem deriver style (council/parse.ts, combat/parse.ts): every value
 * consumed by progression is read from the verified pack, never baked. Not
 * exported from the barrel -- internal to the progression subsystem.
 */

export function fail(msg: string): never {
  throw new Error(`progression parse: ${msg}`);
}

export function asObject(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${where}: expected object`);
  return v as Record<string, unknown>;
}

export function asArray(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) fail(`${where}: expected array`);
  return v;
}

/** Read raw card -> its payload.parameters object (the structured rule data). */
export function paramsOf(raw: unknown, where: string): Record<string, unknown> {
  const payload = asObject(asObject(raw, where)["payload"], `${where}.payload`);
  return asObject(payload["parameters"], `${where}.payload.parameters`);
}

export function intField(obj: Record<string, unknown>, key: string, where: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isInteger(v)) fail(`${where}.${key}: expected integer`);
  return v as number;
}

export function strField(obj: Record<string, unknown>, key: string, where: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0) fail(`${where}.${key}: expected non-empty string`);
  return v;
}

/** A list of non-empty strings; opaque pack content carried as-is. */
export function strArray(v: unknown, where: string): readonly string[] {
  return asArray(v, where).map((item, i) => {
    if (typeof item !== "string" || item.length === 0) fail(`${where}[${i}]: expected non-empty string`);
    return item;
  });
}

/** The keys of an object field, as a list (taxonomy ids). */
export function objectKeys(v: unknown, where: string): readonly string[] {
  return Object.keys(asObject(v, where));
}

/**
 * Parse the per-phase valour-or-wisdom cap. The pack expresses it as the text
 * "one_only" rather than the integer 1, so the coefficient is read out here at
 * config time; the resolver then holds no literal. Fail-fast on an unknown form.
 */
export function parseValourWisdomCap(v: unknown, where: string): number {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (v === "one_only") return 1;
  return fail(`${where}: cannot parse valour-or-wisdom cap ${JSON.stringify(v)}`);
}
