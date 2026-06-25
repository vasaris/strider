import { type Manifest, parseManifest } from "./manifest.js";
import { type Pack, type PackEntry, PackIntegrityError, PackNotVerifiedError } from "./pack.js";
import type { PackSource } from "./source.js";

const MANIFEST_FILE = "manifest.json";

interface RawEntry {
  readonly id: string;
  readonly type: string;
  readonly verified: boolean;
  readonly dir: string;
  readonly raw: unknown;
}

function readEntry(source: PackSource, dir: string, file: string): RawEntry {
  const relPath = dir.endsWith("/") ? `${dir}${file}` : `${dir}/${file}`;
  const parsed: unknown = JSON.parse(source.readText(relPath));
  if (typeof parsed !== "object" || parsed === null) {
    throw new PackIntegrityError(`${relPath}: not a JSON object`);
  }
  const obj = parsed as Record<string, unknown>;
  const id = obj["id"];
  const type = obj["type"];
  const verified = obj["verified"];
  if (typeof id !== "string" || id.length === 0) throw new PackIntegrityError(`${relPath}: missing id`);
  if (typeof type !== "string" || type.length === 0) throw new PackIntegrityError(`${relPath}: missing type`);
  if (typeof verified !== "boolean") throw new PackIntegrityError(`${relPath}: missing boolean verified`);
  return { id, type, verified, dir, raw: parsed };
}

/**
 * Load a content pack through a PackSource.
 *
 * Architecture principle #5 (TS mirror): refuse to load if the manifest reports
 * all_verified:false, and refuse if any individual file is not verified:true.
 * Also checks structural integrity: per-directory file counts and the total
 * match the manifest. Schema validation is NOT repeated here — that is the
 * Python content gates' job (green); duplicating it would only invite drift.
 */
export function loadPack(source: PackSource): Pack {
  const manifest: Manifest = parseManifest(JSON.parse(source.readText(MANIFEST_FILE)));

  if (!manifest.verified.all_verified) {
    throw new PackNotVerifiedError(`pack "${manifest.pack_id}" is not fully verified (all_verified:false); refusing to load`);
  }

  const entries: RawEntry[] = [];
  for (const entry of manifest.content) {
    const files = source.listJsonFiles(entry.dir);
    if (files.length !== entry.count) {
      throw new PackIntegrityError(
        `dir "${entry.dir}": found ${files.length} json files, manifest declares ${entry.count}`,
      );
    }
    for (const file of files) {
      entries.push(readEntry(source, entry.dir, file));
    }
  }

  // Per-file verification (principle #5, granular): manifest aggregate must not
  // mask an individual unverified file.
  const unverified = entries.filter((e) => !e.verified);
  if (unverified.length > 0) {
    const names = unverified.slice(0, 5).map((e) => e.id).join(", ");
    throw new PackNotVerifiedError(`pack "${manifest.pack_id}": ${unverified.length} file(s) not verified (e.g. ${names})`);
  }

  // Count integrity against the manifest.
  if (entries.length !== manifest.verified.total) {
    throw new PackIntegrityError(
      `indexed ${entries.length} files but manifest.verified.total is ${manifest.verified.total}`,
    );
  }
  if (entries.length !== manifest.verified.verified) {
    throw new PackIntegrityError(
      `verified ${entries.length} files but manifest.verified.verified is ${manifest.verified.verified}`,
    );
  }

  // Build indexes.
  const byId = new Map<string, PackEntry>();
  const byType = new Map<string, PackEntry[]>();
  for (const e of entries) {
    const publicEntry: PackEntry = { id: e.id, type: e.type, dir: e.dir, raw: e.raw };
    if (byId.has(e.id)) throw new PackIntegrityError(`duplicate id "${e.id}"`);
    byId.set(e.id, publicEntry);
    const bucket = byType.get(e.type);
    if (bucket) bucket.push(publicEntry);
    else byType.set(e.type, [publicEntry]);
  }

  return {
    manifest,
    getById: (id) => byId.get(id),
    requireById: (id) => {
      const found = byId.get(id);
      if (!found) throw new Error(`loadPack: required pack entry "${id}" not found`);
      return found;
    },
    listByType: (type) => byType.get(type) ?? [],
  };
}
