// The A3 suite: 9 journey turns captured live from the engine (L3/L4 of the roadmap).
//
// SEED-SEARCH PROCEDURE (reproducible; the search script itself is not committed). For each spec
// below, in table order and independently of the others, try the candidate RNG seeds 'a3-0',
// 'a3-1', 'a3-2', ... and take the FIRST one whose captured turn (captureTurn with the Stage-1
// hero/route, the listed region and stepsBefore) meets the criterion, where
//   sceneType = pkg.oracle.result_ref, detailFace = pkg.oracle.detail.row.face,
//   significant = pkg.oracle.detail.row.significantEncounter,
//   sceneCheck = record.sceneCheck?.outcome ?? null:
//   j.border.shortcut    border_lands  short_cut, sceneCheck success
//   j.border.inspiring   border_lands  inspiring_sight, sceneCheck success
//   j.wild.mishap        wild_lands    mishap, sceneCheck failure
//   j.wild.meeting       wild_lands    chance_meeting, sceneCheck success AND pkg.patch deep-equals {}
//   j.dark.badchoice     dark_lands    bad_choice, sceneCheck failure
//   j.dark.despair       dark_lands    despair, sceneCheck failure, significant false
//   j.dark.misfortune    dark_lands    terrible_misfortune, sceneCheck failure, significant false
//   j.dark.significant   dark_lands    terrible_misfortune or despair, detailFace 1, significant
//                                      true -> sceneCheck null
//   j.dark.midjourney    dark_lands    stepsBefore 2, any step with a scene (not an arrival)
// The `expect` of each entry pins what the engine produced for the chosen seed; the pins are
// checked by engineProvider.test.ts, so a pack or engine change that moves a scene is caught.

import type { EngineSeed, JourneySpec } from './engineProvider.js';

export interface SuiteJourney {
  readonly id: string;
  readonly summary: string;
  readonly journey: JourneySpec;
}

export const SUITE_JOURNEYS: readonly SuiteJourney[] = [
  {
    id: 'j.border.shortcut',
    summary: 'border lands: a short cut found',
    journey: { rngSeed: 'a3-12', region: 'border_lands', expect: { sceneType: 'short_cut', detailFace: 2, sceneCheck: 'success' } },
  },
  {
    id: 'j.border.inspiring',
    summary: 'border lands: an inspiring sight',
    journey: { rngSeed: 'a3-14', region: 'border_lands', expect: { sceneType: 'inspiring_sight', detailFace: 5, sceneCheck: 'success' } },
  },
  {
    id: 'j.wild.mishap',
    summary: 'wild lands: a mishap, check failed',
    journey: { rngSeed: 'a3-0', region: 'wild_lands', expect: { sceneType: 'mishap', detailFace: 6, sceneCheck: 'failure' } },
  },
  {
    id: 'j.wild.meeting',
    summary: 'wild lands: a chance meeting, fatigue waived',
    journey: { rngSeed: 'a3-22', region: 'wild_lands', expect: { sceneType: 'chance_meeting', detailFace: 1, sceneCheck: 'success' } },
  },
  {
    id: 'j.dark.badchoice',
    summary: 'dark lands: a bad choice, check failed',
    journey: { rngSeed: 'a3-7', region: 'dark_lands', expect: { sceneType: 'bad_choice', detailFace: 2, sceneCheck: 'failure' } },
  },
  {
    id: 'j.dark.despair',
    summary: 'dark lands: despair, check failed',
    journey: { rngSeed: 'a3-10', region: 'dark_lands', expect: { sceneType: 'despair', detailFace: 5, sceneCheck: 'failure' } },
  },
  {
    id: 'j.dark.misfortune',
    summary: 'dark lands: terrible misfortune, hero wounded',
    journey: { rngSeed: 'a3-1', region: 'dark_lands', expect: { sceneType: 'terrible_misfortune', detailFace: 3, sceneCheck: 'failure' } },
  },
  {
    id: 'j.dark.significant',
    summary: 'dark lands: despair escalates to a significant encounter',
    journey: { rngSeed: 'a3-4', region: 'dark_lands', expect: { sceneType: 'despair', detailFace: 1, sceneCheck: null } },
  },
  {
    id: 'j.dark.midjourney',
    summary: 'dark lands: third step, a mishap',
    journey: { rngSeed: 'a3-3', region: 'dark_lands', stepsBefore: 2, expect: { sceneType: 'mishap', detailFace: 4, sceneCheck: 'failure' } },
  },
];

/** Suite journeys -> EngineSeeds sharing one Keeper system prompt. */
export function toEngineSeeds(systemPrompt: string, journeys: readonly SuiteJourney[] = SUITE_JOURNEYS): EngineSeed[] {
  return journeys.map((j) => ({ id: j.id, systemPrompt, summary: j.summary, journey: j.journey }));
}
