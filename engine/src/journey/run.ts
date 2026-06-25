import { applyEyeAwarenessDelta, growthFromFeatDie } from "../eye/growth.js";
import { isDetected, pursuitThreshold, resetEye } from "../eye/pursuit.js";
import { rollFeatDieEvent } from "../oracles/featEvent.js";
import { runSkillCheck } from "./check.js";
import type { JourneyConfigs } from "./config.js";
import { runDangerZone } from "./danger.js";
import { applyEffects } from "./effects.js";
import { resolveScene } from "./scene.js";
import type { JourneyEvent, JourneyState } from "./state.js";

const TRAVEL_SKILL = "travel";

/** Run a detection scene when Awareness reaches the pursuit threshold, then reset. */
function maybeDetection(state: JourneyState, cfg: JourneyConfigs): JourneyState {
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
 * One journey step: the guide makes a Travel check. If the result covers the
 * remaining hexes the journey ends; otherwise the party advances (3 + success
 * signs on success; 2 or 1 by season on failure) and a scene occurs, followed by
 * a pursuit/detection check. Days come from the route duration (set at start)
 * and from scene effects, not from per-hex accrual here.
 */
export function stepJourney(state: JourneyState, cfg: JourneyConfigs): JourneyState {
  if (state.journey.arrived) return state;

  const [travel, rng] = runSkillCheck(state.hero, TRAVEL_SKILL, cfg, state.rng);
  const eyeDelta = travel.isEyeOnFeat ? growthFromFeatDie(true, false, cfg.eye) : 0;
  let s: JourneyState = { ...state, rng, hero: { ...state.hero, eye: applyEyeAwarenessDelta(state.hero.eye, eyeDelta) } };

  const advance = travel.outcome === "success" ? 3 + travel.successIcons : s.journey.route.season === "summer_spring" ? 2 : 1;

  if (advance >= s.journey.remainingHexes) {
    const travelEvent: JourneyEvent = { kind: "travel_check", outcome: travel.outcome, advance, remainingAfter: 0, eyeDelta };
    const arrival: JourneyEvent = { kind: "arrival", durationDays: s.journey.durationDays };
    return {
      ...s,
      journey: { ...s.journey, remainingHexes: 0, arrived: true },
      log: [...s.log, travelEvent, arrival],
    };
  }

  const remainingAfter = s.journey.remainingHexes - advance;
  const travelEvent: JourneyEvent = { kind: "travel_check", outcome: travel.outcome, advance, remainingAfter, eyeDelta };
  s = { ...s, journey: { ...s.journey, remainingHexes: remainingAfter }, log: [...s.log, travelEvent] };

  s = resolveScene(s, cfg);
  s = maybeDetection(s, cfg);
  return s;
}

/**
 * Run the journey to arrival. Entry danger zones are played first (the party
 * stops and clears peril-rating scenes), then the travel loop. The safety cap
 * guards against a non-terminating bug.
 */
export function runJourney(state0: JourneyState, cfg: JourneyConfigs): JourneyState {
  let s = state0;
  for (const degree of s.journey.route.dangerZones) {
    s = runDangerZone(s, degree, cfg);
  }
  const cap = state0.journey.route.totalHexes + 50;
  for (let i = 0; i < cap; i++) {
    if (s.journey.arrived) return s;
    s = stepJourney(s, cfg);
  }
  throw new Error("runJourney: exceeded step cap without arriving (possible bug)");
}
