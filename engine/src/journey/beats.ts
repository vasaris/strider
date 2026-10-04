import { spendHopeForDice } from "../checks/hope.js";
import { applyEyeAwarenessDelta, growthFromFeatDie } from "../eye/growth.js";
import { isDetected, pursuitThreshold, resetEye } from "../eye/pursuit.js";
import { rollFeatDieEvent } from "../oracles/featEvent.js";
import { runSkillCheckWithRoll } from "./check.js";
import type { JourneyConfigs } from "./config.js";
import { applyEffects } from "./effects.js";
import { drawScene, isSignificantDetail, resolveEncounter, resolveSceneCheck, type SceneResolution } from "./scene.js";
import type {
  CheckBeatRecord,
  EyeSource,
  HeroState,
  HopeSpend,
  JourneyEvent,
  JourneyProgress,
  JourneyState,
  TravelBeatRecord,
} from "./state.js";

export const TRAVEL_SKILL = "travel";

/**
 * A beat called out of turn: the journey has arrived (journey_over), a drawn scene still
 * awaits its check (check_pending), or checkBeat was called with no scene pending (no_pending).
 * Knowable from the state before the call, so a correct caller never sees it.
 */
export class JourneyBeatError extends Error {
  readonly code: "journey_over" | "check_pending" | "no_pending";
  constructor(code: "journey_over" | "check_pending" | "no_pending", message = `journey beat: ${code}`) {
    super(message);
    this.code = code;
    this.name = "JourneyBeatError";
  }
}

/** Run a detection scene when Awareness reaches the pursuit threshold, then reset. */
export function maybeDetection(state: JourneyState, cfg: JourneyConfigs): JourneyState {
  const threshold = pursuitThreshold(state.journey.route.region, [], cfg.eye);
  if (!isDetected(state.hero.eye.awareness, threshold)) return state;

  const [scene, rng] = rollFeatDieEvent(cfg.detectionScenes, cfg.dice, state.rng);
  let next: JourneyState = applyEffects({ ...state, rng }, scene.effects, cfg);
  const reset = resetEye(next.hero.eye);
  next = { ...next, hero: { ...next.hero, eye: reset } };
  const event: JourneyEvent = {
    kind: "detection",
    awareness: state.hero.eye.awareness,
    threshold,
    sceneText: scene.text,
    resetTo: reset.awareness,
  };
  return { ...next, log: [...next.log, event] };
}

/**
 * Spend Hope for bonus Success dice BEFORE the roll (checks.bonus_dice_hope, KV p.20): the
 * point leaves the hero first, so the check's conditions (weary / miserable / overwhelmed)
 * are evaluated on the post-spend hero. At most one point per roll; a spend the hero cannot
 * afford yields nothing (spendHopeForDice clamps). The Wanderer counts as inspired on journey
 * skill checks (IdO p.7), the Travel check included: inspired = hero.inspired.
 */
function spendHope(hero: HeroState, spend: 0 | 1, cfg: JourneyConfigs): readonly [HeroState, HopeSpend] {
  const r = spendHopeForDice({ hopeCurrent: hero.hope.current, spend, inspired: hero.inspired }, cfg.checks);
  const spent = hero.hope.current - r.hopePatch.current === 1 ? 1 : 0;
  return [{ ...hero, hope: { ...hero.hope, current: r.hopePatch.current } }, { spent, bonusDice: r.bonusSuccessDice }] as const;
}

function eyeSourcesOf(entries: readonly EyeSource[]): readonly EyeSource[] {
  return entries.filter((e) => e.delta > 0);
}

/** Drop journey.pending, keeping the other keys' insertion order (ABSENT == null). */
function withoutPending(journey: JourneyProgress): JourneyProgress {
  const { pending: _pending, ...rest } = journey;
  return rest;
}

/**
 * The player's travel beat: the guide's Travel check (with an optional Hope spend), then
 * either arrival, or the scene draw. A drawn scene with a check is left pending in
 * journey.pending for checkBeat; a significant encounter (no check) resolves at once,
 * followed by the pursuit/detection check.
 *
 * Advance on the check: 3 + success signs on success; 2 or 1 by season on failure. If it
 * covers the remaining hexes the journey ends.
 *
 * @throws JourneyBeatError journey_over (arrived) / check_pending (a scene awaits its check)
 */
export function travelBeat(
  state: JourneyState,
  input: { readonly hopeSpend: 0 | 1 },
  cfg: JourneyConfigs,
): readonly [JourneyState, TravelBeatRecord] {
  if (state.journey.arrived) throw new JourneyBeatError("journey_over");
  if (state.journey.pending != null) throw new JourneyBeatError("check_pending");
  const beforeLen = state.log.length;

  const [hero, hope] = spendHope(state.hero, input.hopeSpend, cfg);
  const [travelCheck, travelRoll, rng] = runSkillCheckWithRoll(hero, TRAVEL_SKILL, cfg, state.rng, hope.bonusDice);
  const eyeDelta = travelCheck.isEyeOnFeat ? growthFromFeatDie(true, false, cfg.eye) : 0;
  let s: JourneyState = { ...state, rng, hero: { ...hero, eye: applyEyeAwarenessDelta(hero.eye, eyeDelta) } };
  const travelEye: EyeSource = { source: "travel_check", delta: eyeDelta };

  const advance =
    travelCheck.outcome === "success" ? 3 + travelCheck.successIcons : s.journey.route.season === "summer_spring" ? 2 : 1;

  if (advance >= s.journey.remainingHexes) {
    const travelEvent: JourneyEvent = { kind: "travel_check", outcome: travelCheck.outcome, advance, remainingAfter: 0, eyeDelta };
    const arrival: JourneyEvent = { kind: "arrival", durationDays: s.journey.durationDays };
    s = { ...s, journey: { ...s.journey, remainingHexes: 0, arrived: true }, log: [...s.log, travelEvent, arrival] };
    const record: TravelBeatRecord = {
      kind: "arrival",
      events: s.log.slice(beforeLen),
      travelCheck,
      travelRoll,
      hope,
      scene: null,
      eyeSources: eyeSourcesOf([travelEye]),
    };
    return [s, record] as const;
  }

  const remainingAfter = s.journey.remainingHexes - advance;
  const travelEvent: JourneyEvent = { kind: "travel_check", outcome: travelCheck.outcome, advance, remainingAfter, eyeDelta };
  s = { ...s, journey: { ...s.journey, remainingHexes: remainingAfter }, log: [...s.log, travelEvent] };

  const [scene, rngAfterDraw] = drawScene(s, cfg);
  s = { ...s, rng: rngAfterDraw };

  if (isSignificantDetail(scene.detail)) {
    const resolved: SceneResolution = resolveEncounter(s, scene, cfg);
    s = maybeDetection(resolved.state, cfg);
    const record: TravelBeatRecord = {
      kind: "encounter",
      events: s.log.slice(beforeLen),
      travelCheck,
      travelRoll,
      hope,
      scene,
      eyeSources: eyeSourcesOf([travelEye, { source: "shadow", delta: resolved.shadowEyeDelta }]),
    };
    return [s, record] as const;
  }

  s = { ...s, journey: { ...s.journey, pending: scene } };
  const record: TravelBeatRecord = {
    kind: "pending",
    events: s.log.slice(beforeLen),
    travelCheck,
    travelRoll,
    hope,
    scene,
    eyeSources: eyeSourcesOf([travelEye]),
  };
  return [s, record] as const;
}

/**
 * The player's check beat on the pending scene: the detail row's skill check (with an
 * optional Hope spend), the consequence by trigger, scene fatigue unless waived, the scene
 * event, then the pursuit/detection check. Clears journey.pending.
 *
 * @throws JourneyBeatError no_pending (no scene awaits a check)
 */
export function checkBeat(
  state: JourneyState,
  input: { readonly hopeSpend: 0 | 1 },
  cfg: JourneyConfigs,
): readonly [JourneyState, CheckBeatRecord] {
  const scene = state.journey.pending;
  if (scene == null) throw new JourneyBeatError("no_pending");
  const skill = scene.detail.skill;
  if (skill === null || isSignificantDetail(scene.detail)) throw new Error(`checkBeat: pending "${scene.sceneType}" has no check`);
  const beforeLen = state.log.length;

  const [hero, hope] = spendHope(state.hero, input.hopeSpend, cfg);
  const [sceneCheck, sceneRoll, rng] = runSkillCheckWithRoll(hero, skill, cfg, state.rng, hope.bonusDice);
  const resolved = resolveSceneCheck({ ...state, rng, hero }, scene, sceneCheck, cfg);
  let s = maybeDetection(resolved.state, cfg);
  s = { ...s, journey: withoutPending(s.journey) };

  const record: CheckBeatRecord = {
    events: s.log.slice(beforeLen),
    scene,
    sceneCheck,
    sceneRoll,
    hope,
    eyeSources: eyeSourcesOf([
      { source: "scene_check", delta: resolved.checkEyeDelta },
      { source: "shadow", delta: resolved.shadowEyeDelta },
    ]),
  };
  return [s, record] as const;
}
