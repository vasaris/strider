/**
 * Internal parse helpers for the combat derivers (config.ts, enemy.ts).
 * Mirror of the per-subsystem deriver style used across the engine: every
 * number and string consumed by combat is read from the verified pack, never
 * baked. Not exported from the barrel — internal to the combat subsystem.
 */

export function fail(msg: string): never {
  throw new Error(`combat parse: ${msg}`);
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

export function boolField(obj: Record<string, unknown>, key: string, where: string): boolean {
  const v = obj[key];
  if (typeof v !== "boolean") fail(`${where}.${key}: expected boolean`);
  return v;
}

/** A list of non-empty strings; opaque pack content carried as-is. */
export function strArray(v: unknown, where: string): readonly string[] {
  return asArray(v, where).map((item, i) => {
    if (typeof item !== "string" || item.length === 0) fail(`${where}[${i}]: expected non-empty string`);
    return item;
  });
}
