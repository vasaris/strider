import type { Manifest } from "./manifest.js";

/** One loaded content file. `raw` is the parsed JSON, consumed by derivers. */
export interface PackEntry {
  readonly id: string;
  readonly type: string;
  /** Content directory it came from (manifest dir), for diagnostics. */
  readonly dir: string;
  readonly raw: unknown;
}

export interface Pack {
  readonly manifest: Manifest;
  getById(id: string): PackEntry | undefined;
  requireById(id: string): PackEntry;
  listByType(type: string): readonly PackEntry[];
}

/** Thrown when a pack is not fully verified (architecture principle #5). */
export class PackNotVerifiedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackNotVerifiedError";
  }
}

/** Thrown when the pack on disk is inconsistent with its manifest. */
export class PackIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackIntegrityError";
  }
}
