// The journey environment (3.1-C4; moved here from evals loadEngineEnv): load the verified pack
// once and derive the journey configs plus the pack identity a run record names. loadPack
// refuses an unverified pack, so every rule number downstream is pack-sourced.

import { journeyConfigsFromPack, loadPack, nodePackSource, type JourneyConfigs } from '@brodyazhnik/engine';

export interface JourneyEnv {
  readonly cfg: JourneyConfigs;
  readonly packId: string;
  readonly packVersion: string;
}

export function loadJourneyEnv(packDir: string): JourneyEnv {
  const pack = loadPack(nodePackSource(packDir));
  return {
    cfg: journeyConfigsFromPack(pack),
    packId: pack.manifest.pack_id,
    packVersion: pack.manifest.pack_version,
  };
}
