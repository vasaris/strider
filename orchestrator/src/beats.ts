// The interactive journey step (3.3a): one engine step split into player beats, each prose beat
// with its own NarrativePackage.
//
//   travelBeatTurn  the player rolls the guide's Travel check (optional Hope spend) -> engine
//                   travelBeat -> a 'setup' package (scene drawn, its check still pending), an
//                   'arrival' package, or an 'encounter' package (a significant encounter, no check).
//   checkBeatTurn   the player rolls the pending scene's check -> engine checkBeat -> a
//                   'resolution' package.
//   oracleAnswer    a yes/no question -> engine askOracle -> an OracleQuestion the CALLER holds and
//                   passes to the next prose beat (BeatContext.questions). No Keeper call.
// So a step with a scene check costs 2 Keeper calls (setup + resolution); an arrival or a
// significant encounter costs 1. journeyTurn (turn.ts, one whole step) is unchanged.
//
// Pure: the RNG lives in JourneyState.rng and advances ONLY inside the engine beat functions --
// nothing here rolls or re-rolls. The mapping is provider.ts's (buildNarrativePackage, mapDice,
// diffHeroState, the SD1 oracle builder, eye_delta up to a detection), so a beat package and a
// whole-step package describe the same mechanics the same way.
//
// The caller owns the context: what prose was accepted (previous_prose), which oracle answers
// came since the last prose beat (questions) and the player's approach. The orchestrator never
// decides any of it; it only drops blank values.
//
// Errors: UnsupportedRouteError (DZ1, as journeyTurn); the engine's JourneyBeatError
// (journey_over / check_pending / no_pending) propagates unchanged -- the API maps the codes.

import {
  askOracle,
  checkBeat,
  travelBeat,
  type CheckBeatRecord,
  type EyeSource,
  type JourneyConfigs,
  type JourneyState,
  type OracleRecord,
  type SceneDraw,
  type TravelBeatRecord,
} from '@brodyazhnik/engine';
import type {
  BeatKind,
  BeatRolls,
  EyeSourceSummary,
  JourneyStepSummary,
  NarrativePackage,
  OracleQuestion,
  PlayerInput,
} from './contract.js';
import {
  buildNarrativePackage,
  detectionOf,
  diffHeroState,
  eyeBeforeResetOf,
  mapDice,
  provisionalBeatLengthFor,
  type EngineTurnResult,
} from './provider.js';
import { UnsupportedRouteError } from './turn.js';

/** What the caller carries between beats. Blank (whitespace-only) strings count as absent. */
export interface BeatContext {
  readonly previousProse?: string | null; // accepted prose of the previous prose beat -- the CALLER decides what was accepted
  readonly questions?: readonly OracleQuestion[]; // oracle answers since the last prose beat, held by the caller
  readonly approach?: string | null; // the player's approach for THIS roll (optional)
}

export interface TravelBeatTurn {
  readonly next: JourneyState;
  readonly record: TravelBeatRecord;
  readonly beat: 'setup' | 'arrival' | 'encounter';
  readonly pkg: NarrativePackage;
}

export interface CheckBeatTurn {
  readonly next: JourneyState;
  readonly record: CheckBeatRecord;
  readonly beat: 'resolution';
  readonly pkg: NarrativePackage;
}

export interface OracleAnswerTurn {
  readonly next: JourneyState;
  readonly record: OracleRecord;
  readonly question: OracleQuestion;
}

/** DZ1, ordered as journeyTurn: an arrived journey is the engine's journey_over, not a route error. */
function guardRoute(state: JourneyState): void {
  if (!state.journey.arrived && state.journey.route.dangerZones.length > 0) throw new UnsupportedRouteError();
}

const hasText = (s: string | null | undefined): s is string => typeof s === 'string' && /\S/.test(s);

function playerOf(hopeSpent: 0 | 1, ctx: BeatContext): PlayerInput {
  return hasText(ctx.approach) ? { hope_spent: hopeSpent, approach: ctx.approach } : { hope_spent: hopeSpent };
}

function eyeSourcesOf(sources: readonly EyeSource[]): readonly EyeSourceSummary[] {
  return sources.map((e) => ({ source: e.source, delta: e.delta }));
}

/** The scene-table + detail rolls of a drawn scene (UI-only). Candidates + modifier only on a
 *  modified roll, as DiceResult. */
function sceneRolls(scene: SceneDraw): Pick<BeatRolls, 'scene_table' | 'scene_detail_die'> {
  const t = scene.tableRoll;
  return {
    scene_table:
      t.modifier === 'normal'
        ? { feat_die: t.feat }
        : { feat_die: t.feat, feat_candidates: [...t.candidates], feat_modifier: t.modifier },
    scene_detail_die: scene.detailDie,
  };
}

/** The SD1 oracle slice of an EngineTurnResult for a drawn scene (the same shape projectStep reads
 *  off the scene event); buildNarrativePackage turns it into oracle + oracle.detail.row. */
function sceneTurn(scene: SceneDraw): Pick<EngineTurnResult, 'oracleTable' | 'oracleResultRef' | 'detailTable' | 'sceneDetail'> {
  return {
    oracleTable: 'journey_scenes',
    oracleResultRef: scene.sceneType,
    detailTable: `scene_details.${scene.sceneType}`,
    sceneDetail: scene.detail,
  };
}

/** One beat's package: the provider's whole-step assembly, the beat length, then the 3.3a fields
 *  (context fields only when present). */
function beatPackage(
  beat: BeatKind,
  turn: EngineTurnResult,
  player: PlayerInput,
  rolls: BeatRolls,
  eye: readonly EyeSource[],
  ctx: BeatContext,
): NarrativePackage {
  const questions = ctx.questions ?? [];
  return {
    ...buildNarrativePackage(turn),
    length_target: provisionalBeatLengthFor(beat),
    beat,
    player,
    ...(questions.length > 0 ? { questions: [...questions] } : {}),
    ...(hasText(ctx.previousProse) ? { previous_prose: ctx.previousProse } : {}),
    rolls,
    eye_sources: eyeSourcesOf(eye),
  };
}

/**
 * The player's travel beat. Arrival -> an 'arrival' package (no oracle, no dice; journey arrived /
 * days_total / travel_check). A drawn scene awaiting its check -> a 'setup' package (the scene and
 * its detail row, the travel roll; no dice and no detection -- the check is not rolled yet). A
 * significant encounter -> an 'encounter' package (the scene, its fatigue, a detection if rolled).
 * @throws UnsupportedRouteError on a route with entry danger zones (DZ1)
 * @throws JourneyBeatError journey_over / check_pending (engine)
 */
export function travelBeatTurn(
  state: JourneyState,
  input: { readonly hopeSpend: 0 | 1 },
  ctx: BeatContext,
  cfg: JourneyConfigs,
): TravelBeatTurn {
  guardRoute(state);
  const [next, record] = travelBeat(state, input, cfg);
  const beat = record.kind === 'pending' ? 'setup' : record.kind;
  const arrival = record.events.find((e) => e.kind === 'arrival');
  const journey: JourneyStepSummary = {
    days_delta: next.journey.durationDays - state.journey.durationDays,
    ...(arrival !== undefined && arrival.kind === 'arrival' ? { arrived: true as const, days_total: arrival.durationDays } : {}),
    travel_check: mapDice(record.travelCheck, record.travelRoll),
  };
  const turn: EngineTurnResult = {
    intent: 'journey',
    scene: 'journey',
    dice: null,
    ...(record.scene === null ? {} : sceneTurn(record.scene)),
    detection: detectionOf(record.events),
    patch: diffHeroState(state.hero, next.hero, eyeBeforeResetOf(record.events)),
    journey,
    journalFacts: [],
  };
  const rolls: BeatRolls = {
    ...(record.scene === null ? {} : sceneRolls(record.scene)),
    bonus_dice: record.hope.bonusDice,
  };
  const pkg = beatPackage(beat, turn, playerOf(record.hope.spent, ctx), rolls, record.eyeSources, ctx);
  return { next, record, beat, pkg };
}

/**
 * The player's check beat on the pending scene -> a 'resolution' package: the scene check as dice
 * (UI-only faces included), the same scene as oracle, a detection if rolled, the beat's patch and
 * days_delta (journey WITHOUT travel_check: this beat rolled none).
 * @throws UnsupportedRouteError on a route with entry danger zones (DZ1)
 * @throws JourneyBeatError no_pending (engine)
 */
export function checkBeatTurn(
  state: JourneyState,
  input: { readonly hopeSpend: 0 | 1 },
  ctx: BeatContext,
  cfg: JourneyConfigs,
): CheckBeatTurn {
  guardRoute(state);
  const [next, record] = checkBeat(state, input, cfg);
  const turn: EngineTurnResult = {
    intent: 'journey',
    scene: 'journey',
    dice: mapDice(record.sceneCheck, record.sceneRoll),
    ...sceneTurn(record.scene),
    detection: detectionOf(record.events),
    patch: diffHeroState(state.hero, next.hero, eyeBeforeResetOf(record.events)),
    journey: { days_delta: next.journey.durationDays - state.journey.durationDays },
    journalFacts: [],
  };
  const pkg = beatPackage(
    'resolution',
    turn,
    playerOf(record.hope.spent, ctx),
    { bonus_dice: record.hope.bonusDice },
    record.eyeSources,
    ctx,
  );
  return { next, record, beat: 'resolution', pkg };
}

/**
 * A yes/no oracle question (engine askOracle; never grows the Eye). No Keeper call: the returned
 * OracleQuestion goes into the next prose beat's BeatContext.questions. `likelihood` in the result
 * is the pack label of the resolved likelihood (null input = the pack default); `note` is the pack
 * text of the rune / Eye face, only on an extreme answer.
 * @throws UnsupportedRouteError on a route with entry danger zones (DZ1)
 * @throws JourneyBeatError journey_over (engine); an unknown likelihood key throws from the engine
 */
export function oracleAnswer(
  state: JourneyState,
  input: { readonly question: string; readonly likelihood: string | null },
  cfg: JourneyConfigs,
): OracleAnswerTurn {
  guardRoute(state);
  const [next, record] = askOracle(state, { likelihood: input.likelihood }, cfg);
  const a = record.answer;
  const likelihood = cfg.oracles.answers.likelihoods.find((l) => l.key === a.likelihoodKey);
  if (likelihood === undefined) throw new Error(`oracleAnswer: engine resolved unknown likelihood "${a.likelihoodKey}"`);
  const question: OracleQuestion = {
    question: input.question,
    likelihood: likelihood.label,
    answer: a.answer,
    extreme: a.extreme,
    ...(a.extreme && a.specialText !== null ? { note: a.specialText } : {}),
  };
  return { next, record, question };
}
