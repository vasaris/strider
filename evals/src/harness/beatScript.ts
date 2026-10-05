// 3.3a-K4: the scripted player for the 11 SUITE_JOURNEYS played as BEATS (keeper v0.4, §8).
// Deterministic: the same script + the same seeds give the same packages byte for byte
// (keeper-requests.v0.4.json pins them). The script decides only what a player would decide --
// Hope spends, approach lines, oracle questions -- the engine rolls everything.
//
// Play of one journey (start exactly like captureTurn): initialJourneyState, replay stepsBefore
// whole steps with journeyTurn; then [oracleAnswer if the question is asked before travel] ->
// travelBeatTurn -> [oracleAnswer if asked before the check] -> checkBeatTurn (only when the
// travel beat is a 'setup'). Prose beats: setup / resolution / arrival / encounter.
//
// HOPE (hopeSpend 1) only where the suite's pinned outcome survives the spend -- extra Success
// dice can only raise a total, so a success stays a success and an arrival stays an arrival:
//   j.border.shortcut   scene check (pinned success)
//   j.border.inspiring  scene check (pinned success)
//   j.border.arrival    travel roll (the step stays the arrival)
// Never on any other roll: a Hope spend on a travel roll that leads to a scene shifts the RNG
// (the bonus dice are rolled before the scene table) and would change the suite's scene.
//
// APPROACHES: the rolls that get one are every scene check (resolution) and the arrival's travel
// roll; in play order (suite order, travel before check) they take APPROACHES round-robin. All
// setup beats and the encounter (j.dark.significant) carry no approach. APPROACHES[4] is the
// two-line one (rendered as a block scalar `approach: |`).
//
// ORACLE QUESTIONS: exactly 3 seeds, one question each (QUESTIONS):
//   j.dark.despair    asked BEFORE the travel roll -> woven into that step's first prose beat
//                     (the setup). The oracle roll consumes RNG and shifts the later rolls; for
//                     this seed the step still lands on the same scene (despair, a setup with a
//                     pending check, not significant) -- verified by keeperRequestsV04.test.ts.
//                     Likelihood null (the pack default).
//   j.wild.mishap     asked between setup and resolution -> woven into the resolution ('likely').
//   j.dark.badchoice  asked between setup and resolution -> woven into the resolution ('doubtful').
// The two between-beat questions shift the scene-check roll of their step (the scene itself is
// already fixed by the travel beat); their check outcome is whatever the engine rolls.
//
// PREVIOUS PROSE: PREVIOUS_PROSE_STUB stands in for "the accepted prose of the previous prose
// beat" on the FIRST prose beat of every seed. The resolution's previous prose is supplied by the
// caller (the live run passes the accepted setup prose); default: the same stub (offline fixture).
//
// Every approach, question and the stub are free of proper names and pass
// scanTurnProse(text, vkAddendum, null) with no findings (checked by keeperRequestsV04.test.ts).

import {
  checkBeatTurn,
  journeyTurn,
  oracleAnswer,
  travelBeatTurn,
  type JourneyEnv,
  type NarrativePackage,
  type OracleQuestion,
} from '@brodyazhnik/orchestrator';
import type { JourneyState } from '@brodyazhnik/engine';
import { initialJourneyState } from './engineProvider.js';
import type { SuiteJourney } from './suiteSeeds.js';
import { SUITE_JOURNEYS } from './suiteSeeds.js';

export const PREVIOUS_PROSE_STUB = 'Ты шёл весь вечер по сырому ельнику, под сапогами мягко пружинила хвоя, и пахло смолой.';

export const APPROACHES: readonly string[] = [
  'Иду медленно и проверяю землю палкой перед каждым шагом.',
  'Прислушиваюсь к ветру и держусь подветренной стороны.',
  'Пробую обойти низиной, там мягче ступать.',
  'Перетягиваю ремни на мешке и иду дальше без спешки.',
  'Держусь ближе к деревьям, чтобы не маячить на открытом месте.\nЕсли услышу шаги, замру и пережду.',
];

export type QuestionWhen = 'before_travel' | 'before_check';

export interface ScriptedQuestion {
  readonly when: QuestionWhen;
  readonly question: string;
  readonly likelihood: string | null; // kv.solo.answers likelihood key; null = the pack default
}

export const QUESTIONS: Readonly<Record<string, ScriptedQuestion>> = {
  'j.wild.mishap': { when: 'before_check', question: 'Есть ли поблизости вода?', likelihood: 'likely' },
  'j.dark.badchoice': { when: 'before_check', question: 'Видны ли следы чужого лагеря?', likelihood: 'doubtful' },
  'j.dark.despair': { when: 'before_travel', question: 'Слышен ли впереди шум реки?', likelihood: null },
};

export type HopeRoll = 'travel' | 'check';

export const HOPE: Readonly<Record<string, HopeRoll>> = {
  'j.border.shortcut': 'check',
  'j.border.inspiring': 'check',
  'j.border.arrival': 'travel',
};

export interface ScriptedBeat {
  readonly key: string; // `<suite id>.<beat>`
  readonly beat: 'setup' | 'resolution' | 'arrival' | 'encounter';
  readonly pkg: NarrativePackage;
  readonly next: JourneyState;
  readonly hopeSpent: 0 | 1;
  readonly approach: string | null;
  readonly questions: readonly OracleQuestion[];
}

export interface ScriptOptions {
  // previous prose for the resolution, given its setup beat; default: PREVIOUS_PROSE_STUB
  readonly resolutionPreviousProse?: (setup: ScriptedBeat) => string | Promise<string>;
}

// Approach per roll, round-robin over the rolls that get one, in play order. A roll is
// `<suite id>.travel` or `<suite id>.check`; which rolls exist is fixed by the suite design
// (the arrival and the encounter have no check; every other seed's travel beat is a setup).
const APPROACH_ROLLS: readonly string[] = SUITE_JOURNEYS.flatMap((j) => {
  if (j.id === 'j.border.arrival') return [`${j.id}.travel`];
  if (j.id === 'j.dark.significant') return [];
  return [`${j.id}.check`];
});

export function approachFor(roll: string): string | null {
  const i = APPROACH_ROLLS.indexOf(roll);
  return i < 0 ? null : APPROACHES[i % APPROACHES.length]!;
}

/** Play one suite journey with the script; returns its prose beats in play order. */
export async function playScriptedJourney(env: JourneyEnv, j: SuiteJourney, opts: ScriptOptions = {}): Promise<ScriptedBeat[]> {
  let state = initialJourneyState(env, j.journey);
  for (let i = 0; i < (j.journey.stepsBefore ?? 0); i++) state = journeyTurn(state, env.cfg).next;

  const q = QUESTIONS[j.id];
  const hope = HOPE[j.id];
  const ask = (s: JourneyState, when: QuestionWhen): [JourneyState, OracleQuestion[]] => {
    if (q === undefined || q.when !== when) return [s, []];
    const o = oracleAnswer(s, { question: q.question, likelihood: q.likelihood }, env.cfg);
    return [o.next, [o.question]];
  };

  const [s0, travelQs] = ask(state, 'before_travel');
  const travelHope = hope === 'travel' ? 1 : 0;
  const travelApproach = approachFor(`${j.id}.travel`);
  const travel = travelBeatTurn(
    s0,
    { hopeSpend: travelHope },
    {
      previousProse: PREVIOUS_PROSE_STUB,
      ...(travelQs.length > 0 ? { questions: travelQs } : {}),
      ...(travelApproach !== null ? { approach: travelApproach } : {}),
    },
    env.cfg,
  );
  const first: ScriptedBeat = {
    key: `${j.id}.${travel.beat}`,
    beat: travel.beat,
    pkg: travel.pkg,
    next: travel.next,
    hopeSpent: travelHope,
    approach: travelApproach,
    questions: travelQs,
  };
  if (travel.beat !== 'setup') return [first];

  const previous = opts.resolutionPreviousProse === undefined ? PREVIOUS_PROSE_STUB : await opts.resolutionPreviousProse(first);
  const [s1, checkQs] = ask(travel.next, 'before_check');
  const checkHope = hope === 'check' ? 1 : 0;
  const checkApproach = approachFor(`${j.id}.check`);
  const check = checkBeatTurn(
    s1,
    { hopeSpend: checkHope },
    {
      previousProse: previous,
      ...(checkQs.length > 0 ? { questions: checkQs } : {}),
      ...(checkApproach !== null ? { approach: checkApproach } : {}),
    },
    env.cfg,
  );
  return [
    first,
    {
      key: `${j.id}.resolution`,
      beat: 'resolution',
      pkg: check.pkg,
      next: check.next,
      hopeSpent: checkHope,
      approach: checkApproach,
      questions: checkQs,
    },
  ];
}

/** All 11 suite journeys, played in suite order. */
export async function playScriptedSuite(env: JourneyEnv, opts: ScriptOptions = {}): Promise<ScriptedBeat[]> {
  const out: ScriptedBeat[] = [];
  for (const j of SUITE_JOURNEYS) out.push(...(await playScriptedJourney(env, j, opts)));
  return out;
}
