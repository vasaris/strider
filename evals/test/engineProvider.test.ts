import { pursuitThreshold, stepJourney } from '@brodyazhnik/engine';
// Drift pin via a DEEP import (this test file only, never in src): scenario.ts is not part of the
// engine's public API, so orchestrator's pregen (pregenWanderer / startJourney, 3.1-C4) mirrors its
// fixtures and the mirror is pinned here.
import { makeMilestoneState, makeTestHero } from '@brodyazhnik/engine/src/cli/scenario.js';
import {
  journeyTurn,
  loadJourneyEnv,
  pregenWanderer,
  renderNarrativePackage,
  startJourney,
} from '@brodyazhnik/orchestrator';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { captureTurn, initialJourneyState, type JourneySpec } from '../src/harness/engineProvider.js';
import { SUITE_JOURNEYS } from '../src/harness/suiteSeeds.js';

const packDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'content-packs/kv');
const env = loadJourneyEnv(packDir);

const journeyOf = (id: string): JourneySpec => {
  const j = SUITE_JOURNEYS.find((x) => x.id === id);
  if (!j) throw new Error(`no suite journey ${id}`);
  return j.journey;
};

/** The body lines of one rendered `## <name>` section ([] when absent). */
function sectionBody(rendered: string, name: string): string[] {
  const out = rendered.split('\n');
  const at = out.indexOf(`## ${name}`);
  if (at === -1) return [];
  const rest = out.slice(at + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return end === -1 ? rest : rest.slice(0, end);
}

describe('engine provider (live engine -> journeyTurn -> package)', () => {
  it('drift pin: orchestrator pregen hero/route/start state mirror the Stage-1 milestone fixtures', () => {
    expect(pregenWanderer(env.cfg)).toEqual(makeTestHero(env.cfg));
    // pins route, duration, rng and hero in one go
    expect(startJourney(env.cfg, { rngSeed: 'dark-1', region: 'dark_lands' })).toEqual(
      makeMilestoneState(env.cfg, 'dark-1'),
    );
    // without eyeGap the eval start IS the pregen start
    expect(initialJourneyState(env, { rngSeed: 'dark-1', region: 'dark_lands' })).toEqual(
      startJourney(env.cfg, { rngSeed: 'dark-1', region: 'dark_lands' }),
    );
  });

  it('is deterministic: same spec -> byte-identical package, also across a fresh env', () => {
    const spec = journeyOf('j.dark.misfortune');
    const a = JSON.stringify(captureTurn(env, spec).pkg);
    expect(JSON.stringify(captureTurn(env, spec).pkg)).toBe(a);
    expect(JSON.stringify(captureTurn(loadJourneyEnv(packDir), spec).pkg)).toBe(a);
  });

  it('every suite journey captures the engine scene it pins (engine-produced, not invented)', () => {
    for (const j of SUITE_JOURNEYS) {
      const t = captureTurn(env, j.journey);
      expect(
        {
          sceneType: t.pkg.oracle?.result_ref ?? null,
          detailFace: t.pkg.oracle?.detail?.row?.face ?? null,
          sceneCheck: t.record.sceneCheck?.outcome ?? null,
          ...(t.pkg.journey?.arrived === true ? { arrived: true } : {}),
          ...(t.pkg.detection ? { detection: true } : {}),
        },
        j.id,
      ).toEqual(j.journey.expect);
    }
  });

  it('oracle.detail.row is the verified pack row, read independently from the table file', () => {
    for (const j of SUITE_JOURNEYS) {
      const { sceneType, detailFace } = j.journey.expect;
      if (sceneType === null) continue; // no scene this step (the arrival)
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

  it('TP1: days/arrival/detection reach the package', () => {
    // The short cut's main consequence (journey_days_delta -1) now reaches the package under
    // `## journey`; the patch still carries only the scene fatigue_gain (no waiver on short_cut).
    const shortcut = captureTurn(env, journeyOf('j.border.shortcut'));
    expect(shortcut.pkg.journey?.days_delta).toBe(-1);
    expect(shortcut.pkg.patch).toEqual({ fatigue_delta: 1 });
    const sc = renderNarrativePackage(shortcut.pkg);
    expect(sectionBody(sc, 'patch')).toEqual(['fatigue_delta: 1']); // the whole patch body
    expect(sectionBody(sc, 'journey')[0]).toBe('days_delta: -1');

    // chance_meeting on success waives the fatigue and nothing else changed: patch {} -> no
    // '## patch', but '## journey' still says the day count did not move (days_delta 0).
    const meeting = captureTurn(env, journeyOf('j.wild.meeting'));
    expect(meeting.pkg.patch).toEqual({});
    const mt = renderNarrativePackage(meeting.pkg);
    expect(mt).not.toContain('## patch');
    expect(sectionBody(mt, 'journey')[0]).toBe('days_delta: 0');

    // The arrival after a mishap (+1 day): the final duration reaches the package.
    const arrival = captureTurn(env, journeyOf('j.border.arrival'));
    expect(arrival.pkg.journey).toMatchObject({ days_delta: 0, arrived: true, days_total: 8 });
    expect(arrival.pkg.dice).toBeNull();
    expect(arrival.pkg.oracle).toBeNull();

    // The detection scene is the pack row text, verbatim; eye_delta is the growth (+1), not the reset.
    const spec = journeyOf('j.dark.detection');
    const det = captureTurn(env, spec);
    const rows = (
      JSON.parse(readFileSync(resolve(packDir, 'tables/solo/detection_scenes.json'), 'utf8')) as {
        payload: { rows: Array<{ text: string }> };
      }
    ).payload.rows.map((r) => r.text);
    expect(det.pkg.detection?.table).toBe('detection_scenes');
    expect(rows).toContain(det.pkg.detection?.scene);
    expect(det.pkg.patch?.eye_delta).toBe(1);
    expect(initialJourneyState(env, spec).hero.eye.awareness).toBe(pursuitThreshold('dark_lands', [], env.cfg.eye) - 1);
  });

  it('a significant encounter carries no dice: the travel check is never surfaced (A4.1)', () => {
    const t = captureTurn(env, journeyOf('j.dark.significant'));
    expect(t.record.sceneCheck).toBeNull();
    expect(t.record.travelCheck).not.toBeNull(); // the engine did roll travel ...
    expect(t.pkg.dice).toBeNull(); // ... but the package does not carry it as dice ...
    const out = renderNarrativePackage(t.pkg);
    expect(out).not.toContain('## dice');
    // ... only under ## journey, labeled travel_check.* (TP1)
    const travel = out.split('\n').filter((l) => l.startsWith('travel_check.'));
    expect(travel.length).toBeGreaterThan(0);
    expect(sectionBody(out, 'journey').filter((l) => l.startsWith('travel_check.'))).toEqual(travel);
  });
});
