/**
 * Internal parse helpers for the council derivers (config.ts). Mirror of the
 * per-subsystem deriver style (combat/parse.ts): every number consumed by the
 * council is read from the verified pack, never baked. Not exported from the
 * barrel -- internal to the council subsystem.
 */

export function fail(msg: string): never {
  throw new Error(`council parse: ${msg}`);
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

/** A list of integers; opaque pack content carried as-is. */
export function intArray(v: unknown, where: string): readonly number[] {
  return asArray(v, where).map((item, i) => {
    if (typeof item !== "number" || !Number.isInteger(item)) fail(`${where}[${i}]: expected integer`);
    return item;
  });
}

/**
 * Parse the introduction success-duration formula. The pack expresses it as a
 * short text formula ("4 + 1 per success sign") rather than two integers, so
 * the base and per-sign coefficient are read out here at config time; the
 * resolver then holds no literal. Fail-fast if the shape is not recognised.
 */
export function parseDurationFormula(s: string, where: string): { readonly base: number; readonly perSign: number } {
  const m = /^(\d+)\s*\+\s*(\d+)\s+per\s+success\s+sign$/.exec(s.trim());
  const base = m?.[1];
  const per = m?.[2];
  if (base === undefined || per === undefined) fail(`${where}: cannot parse duration formula ${JSON.stringify(s)}`);
  return { base: Number(base), perSign: Number(per) };
}
