// Server-side environment: locates the repo root and loads the verified pack once (the journey
// env, the VK addendum for the prose gate, the label catalog with the UI labels sidecar -- each
// memoized).
// Paths come from the process cwd (or BRODYAZHNIK_REPO_ROOT), never from
// import.meta.url / __dirname: bundled module paths differ from source paths.
import 'server-only';

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { loadPack, nodePackSource } from '@brodyazhnik/engine';
import { loadJourneyEnv, type JourneyEnv } from '@brodyazhnik/orchestrator';
import { loadVkAddendumFromPack, type StopEntry } from '@brodyazhnik/prose-gate';

import { packLabels, type Labels } from './service/labels';
import { loadUiLabelsFromPack } from './service/uiLabels';

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

let vkMemo: readonly StopEntry[] | undefined;

/** The pack's VK addendum (content-packs/kv/tone.stoplist.json) for the live prose gate. Memoized. */
export function getVkAddendum(): readonly StopEntry[] {
  if (vkMemo === undefined) {
    vkMemo = loadVkAddendumFromPack(join(repoRoot(), PACK_REL));
  }
  return vkMemo;
}

let labelsMemo: Labels | undefined;

/** The label catalog over the verified pack and its UI labels sidecar (service/labels.ts,
 *  service/uiLabels.ts). Memoized; throws if the pack, the sidecar or its evidence fails. */
export function getPackLabels(): Labels {
  if (labelsMemo === undefined) {
    const packRoot = join(repoRoot(), PACK_REL);
    labelsMemo = packLabels(loadPack(nodePackSource(packRoot)), loadUiLabelsFromPack(packRoot));
  }
  return labelsMemo;
}
