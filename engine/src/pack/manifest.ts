/**
 * Manifest: the pack's entry point. The engine parses only what it consumes
 * (versions, content layout, verification counts). Other blocks
 * (system/sources/schemas/dependencies) are passed through untouched and may be
 * parsed later if a real need appears (e.g. multi-pack dependencies).
 */

export interface ManifestContentEntry {
  readonly dir: string;
  readonly count: number;
  readonly types: readonly string[];
}

export interface ManifestVerified {
  readonly all_verified: boolean;
  readonly total: number;
  readonly verified: number;
}

export interface Manifest {
  readonly pack_id: string;
  readonly pack_version: string;
  readonly schema_version: string;
  readonly content: readonly ManifestContentEntry[];
  readonly verified: ManifestVerified;
}

function fail(msg: string): never {
  throw new Error(`parseManifest: ${msg}`);
}

function asObject(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${where}: expected object`);
  return v as Record<string, unknown>;
}

function str(obj: Record<string, unknown>, key: string, where: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0) fail(`${where}.${key}: expected non-empty string`);
  return v;
}

function int(obj: Record<string, unknown>, key: string, where: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isInteger(v)) fail(`${where}.${key}: expected integer`);
  return v;
}

function bool(obj: Record<string, unknown>, key: string, where: string): boolean {
  const v = obj[key];
  if (typeof v !== "boolean") fail(`${where}.${key}: expected boolean`);
  return v;
}

export function parseManifest(raw: unknown): Manifest {
  const m = asObject(raw, "manifest");

  const contentRaw = m["content"];
  if (!Array.isArray(contentRaw)) fail("manifest.content: expected array");
  const content: ManifestContentEntry[] = contentRaw.map((e, i) => {
    const o = asObject(e, `manifest.content[${i}]`);
    const typesRaw = o["types"];
    if (!Array.isArray(typesRaw) || !typesRaw.every((t) => typeof t === "string")) {
      fail(`manifest.content[${i}].types: expected string[]`);
    }
    return {
      dir: str(o, "dir", `manifest.content[${i}]`),
      count: int(o, "count", `manifest.content[${i}]`),
      types: typesRaw as string[],
    };
  });

  const v = asObject(m["verified"], "manifest.verified");
  const verified: ManifestVerified = {
    all_verified: bool(v, "all_verified", "manifest.verified"),
    total: int(v, "total", "manifest.verified"),
    verified: int(v, "verified", "manifest.verified"),
  };

  return {
    pack_id: str(m, "pack_id", "manifest"),
    pack_version: str(m, "pack_version", "manifest"),
    schema_version: str(m, "schema_version", "manifest"),
    content,
    verified,
  };
}
