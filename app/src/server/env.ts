// Server-side environment: locates the repo root and loads the verified pack once.
// Paths come from the process cwd (or BRODYAZHNIK_REPO_ROOT), never from
// import.meta.url / __dirname: bundled module paths differ from source paths.
import 'server-only';

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { loadJourneyEnv, type JourneyEnv } from '@brodyazhnik/orchestrator';

const PACK_REL = join('content-packs', 'kv');
const MARKER = join(PACK_REL, 'manifest.json');

/** Walk up from startDir to the first directory containing content-packs/kv/manifest.json. */
export function findRepoRoot(startDir: string): string {
  let dir = resolve(startDir);
  for (;;) {
    if (existsSync(join(dir, MARKER))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`findRepoRoot: no ${MARKER} in ${resolve(startDir)} or any parent directory`);
    }
    dir = parent;
  }
}

let rootMemo: string | undefined;

/** Repo root: BRODYAZHNIK_REPO_ROOT if set, else found from the process cwd. Memoized. */
export function repoRoot(): string {
  if (rootMemo === undefined) {
    const fromEnv = process.env['BRODYAZHNIK_REPO_ROOT'];
    rootMemo = fromEnv !== undefined && fromEnv !== '' ? resolve(fromEnv) : findRepoRoot(process.cwd());
  }
  return rootMemo;
}

let journeyEnvMemo: JourneyEnv | undefined;

/** The journey environment over the verified pack. Memoized; throws if the pack cannot load. */
export function getJourneyEnv(): JourneyEnv {
  if (journeyEnvMemo === undefined) {
    journeyEnvMemo = loadJourneyEnv(join(repoRoot(), PACK_REL));
  }
  return journeyEnvMemo;
}
