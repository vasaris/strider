import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PackSource } from "./source.js";

/**
 * The single fs-bound adapter. Everything else in the engine stays portable.
 * Listing is sorted for deterministic load order.
 */
export function nodePackSource(packRoot: string): PackSource {
  return {
    readText: (relPath) => readFileSync(join(packRoot, relPath), "utf8"),
    listJsonFiles: (relDir) =>
      readdirSync(join(packRoot, relDir))
        .filter((f) => f.endsWith(".json"))
        .sort(),
  };
}
