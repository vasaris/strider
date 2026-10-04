// 900-run journey snapshot gate (3.3a-K1: beat split + R2).
//
// HOW THE FIXTURE WAS PRODUCED (fixtures/snapshot900.json). For 300 seeds 'snap-0'..'snap-299' x
// 3 regions (border_lands, wild_lands, dark_lands) = 900 runs, snapshotRun (snapshot900.ts) starts
// from makeMilestoneState(cfg, seed) with only journey.route.region overridden, calls stepJourney
// until arrival, collects every step's { state: { hero, journey, rng, log }, record } and hashes
// plain insertion-order JSON.stringify (stricter than a canonical form: key-order changes, which
// the CLI golden output depends on, are caught too); 16 hex chars of sha256.
//   pre    = the full hash on the UNMODIFIED code (3a8f213), generated before engine/src was touched.
//   masked = the hash of the same data with every eyeDelta -> 0, every eye.awareness -> 0 and every
//            detection event removed (also generated on 3a8f213).
//   post   = the full hash on the final code (after R2).
// Step 1 (beat refactor with the scene-table Eye still folded in) reproduced `pre` for all 900 runs
// byte for byte; step 2 (R2: the scene event's eyeDelta is the Eye of the hero's scene check only)
// changed 180 full hashes and none of the masked ones -- the R2 diff is confined to Eye/detection
// fields. (A detection appearing or vanishing would change the RNG stream and thus `masked`.)
//
// REPRODUCE `pre`: in src/journey/scene.ts (applyScene) restore the table-roll Eye -- add
//   growthFromFeatDie(featDieResultOfFace(draw.tableRoll.feat, cfg.dice.feat).isEye, false, cfg.eye)
// to eyeDelta (importing featDieResultOfFace from ../dice/featDie.js) -- and the full hashes equal `pre` for all 900 runs (switch the assertion below).
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { journeyConfigsFromPack } from "../../src/journey/config.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { SNAPSHOT_REGIONS, SNAPSHOT_SEEDS, snapshotAll } from "./snapshot900.js";

const here = dirname(fileURLToPath(import.meta.url));
const cfg = journeyConfigsFromPack(loadPack(nodePackSource(resolve(here, "../../..", "content-packs/kv"))));

interface FixtureRun {
  readonly seed: string;
  readonly region: string;
  readonly pre: string;
  readonly post: string;
  readonly masked: string;
}
const fixture = JSON.parse(readFileSync(resolve(here, "fixtures/snapshot900.json"), "utf8")) as { readonly runs: readonly FixtureRun[] };

describe("900-run journey snapshot (beat split byte-identical; R2 only moves Eye/detection)", () => {
  const runs = snapshotAll(cfg);

  it("covers 300 seeds x 3 regions, in fixture order", () => {
    expect(fixture.runs).toHaveLength(SNAPSHOT_SEEDS.length * SNAPSHOT_REGIONS.length);
    expect(runs.map((r) => [r.seed, r.region])).toEqual(fixture.runs.map((r) => [r.seed, r.region]));
  });

  it("full hashes equal `post` and masked hashes equal `masked` for every run", () => {
    const fullMismatch = runs.filter((r, i) => r.full !== fixture.runs[i]?.post).map((r) => `${r.seed}/${r.region}`);
    const maskedMismatch = runs.filter((r, i) => r.masked !== fixture.runs[i]?.masked).map((r) => `${r.seed}/${r.region}`);
    expect(fullMismatch).toEqual([]);
    expect(maskedMismatch).toEqual([]);
  });

  it("R2 is visible: exactly 180 runs differ from `pre`", () => {
    const changed = fixture.runs.filter((r) => r.pre !== r.post);
    expect(changed.length).toBe(180);
  });
});
