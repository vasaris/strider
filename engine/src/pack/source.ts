/**
 * I/O port for reading a content pack. The engine core stays fs-free and
 * portable: pure loading logic depends only on this interface. A Node adapter
 * (pack/nodeSource.ts) is the single place that touches the filesystem; a
 * browser build (Stage 3) can supply a different adapter (fetch / bundled).
 */
export interface PackSource {
  /** Read a UTF-8 text file at a path relative to the pack root. */
  readText(relPath: string): string;
  /** List `.json` file names (non-recursive) in a directory relative to root. */
  listJsonFiles(relDir: string): readonly string[];
}
