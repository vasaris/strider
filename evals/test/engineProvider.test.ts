import { stepJourney } from '@brodyazhnik/engine';
// Drift pin via a DEEP import (this test file only, never in src): scenario.ts is not part of the
// engine's public API, so evals mirrors its fixtures and pins the mirror here.
import { makeMilestoneState, makeTestHero } from '@brodyazhnik/engine/src/cli/scenario.js';
import { journeyTurn, renderNarrativePackage } from '@brodyazhnik/orchestrator';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  captureTurn,
  evalHero,
  initialJourneyState,
  loadEngineEnv,
  type JourneySpec,
} from '../src/harness/engineProvider.js';
import { SUITE_JOURNEYS } from '../src/harness/suiteSeeds.js';

const packDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'content-packs/kv');
const env = loadEngineEnv(packDir);

const journeyOf = (id: string): JourneySpec => {
  const j = SUITE_JOURNEYS.find((x) => x.id === id);
  if (!j) throw new Error(`no suite journey ${id}`);
  return j.journey;
};

describe('engine provider (live engine -> extractTurn -> package)', () => {
  it('drift pin: the eval hero/route/start state mirror the Stage-1 milestone fixtures', () => {
    expect(evalHero(env.cfg)).toEqual(makeTestHero(env.cfg));
    // pins route, duration, rng and hero in one go
    expect(initialJourneyState(env, { rngSeed: 'dark-1', region: 'dark_lands' })).toEqual(
      makeMilestoneState(env.cfg, 'dark-1'),
    );
  });

  it('is deterministic: same spec -> byte-identical package, also across a fresh env', () => {
    const spec = journeyOf('j.dark.misfortune');
    const a = JSON.stringify(captureTurn(env, spec).pkg);
    expect(JSON.stringify(captureTurn(env, spec).pkg)).toBe(a);
    expect(JSON.stringify(captureTurn(loadEngineEnv(packDir), spec).pkg)).toBe(a);
  });

  it('every suite journey captures the engine scene it pins (engine-produced, not invented)', () => {
    for (const j of SUITE_JOURNEYS) {
      const t = captureTurn(env, j.journey);
      expect(
        {
          sceneType: t.pkg.oracle?.result_ref,
          detailFace: t.pkg.oracle?.detail?.row?.face,
          sceneCheck: t.record.sceneCheck?.outcome ?? null,
        },
        j.id,
      ).toEqual(j.journey.expect);
    }
  });

  it('oracle.detail.row is the verified pack row, read independently from the table file', () => {
    for (const j of SUITE_JOURNEYS) {
      const { sceneType, detailFace } = j.journey.expect;
      const table = JSON.parse(
        readFileSync(resolve(packDir, 'tables/solo', `scene_details.${sceneType}.json`), 'utf8'),
      ) as { payload: { rows: Array<{ face: number; scene: string; prompt: string; skill: string | null; significant_encounter?: boolean }> } };
      const raw = table.payload.rows.find((r) => r.face === detailFace);
      expect(raw, j.id).toBeDefined();
      expect(captureTurn(env, j.journey).pkg.oracle?.detail?.row, j.id).toEqual({
        face: raw?.face,
        scene: raw?.scene,
        prompt: raw?.prompt,
        skill: raw?.skill,
        significantEncounter: raw?.significant_encounter === true,
      });
    }
  });

  it('stepsBefore replays engine steps, then captures the next turn (manual replay agrees)', () => {
    const spec = journeyOf('j.dark.midjourney');
    expect(spec.stepsBefore).toBe(2);
    let s = initialJourneyState(env, spec);
    s = stepJourney(s, env.cfg)[0];
    s = stepJourney(s, env.cfg)[0];
    expect(captureTurn(env, spec)).toEqual(journeyTurn(s, env.cfg));
  });

  it('TP1 illustrations: what the patch does (and does not) carry', () => {
    // DEFERRED TP1 illustration: the short cut's main consequence (journey_days_delta -1) is NOT
    // surfaced in the package -- only the scene fatigue_gain reaches the patch (no waiver on
    // short_cut). journey days / detection / arrival are not in the contract yet.
    const shortcut = captureTurn(env, journeyOf('j.border.shortcut'));
    expect(shortcut.pkg.patch).toEqual({ fatigue_delta: 1 });
    const out = renderNarrativePackage(shortcut.pkg).split('\n');
    const at = out.indexOf('## patch');
    const rest = out.slice(at + 1);
    const end = rest.findIndex((l) => l.startsWith('## '));
    expect(at).toBeGreaterThan(-1);
    expect(end === -1 ? rest : rest.slice(0, end)).toEqual(['fatigue_delta: 1']); // the whole patch body

    // DEFERRED TP1 illustration: chance_meeting on success waives the fatigue and nothing else
    // changed, so the patch is {} and the rendered package has no '## patch' section at all.
    const meeting = captureTurn(env, journeyOf('j.wild.meeting'));
    expect(meeting.pkg.patch).toEqual({});
    expect(renderNarrativePackage(meeting.pkg)).not.toContain('## patch');
  });
});
