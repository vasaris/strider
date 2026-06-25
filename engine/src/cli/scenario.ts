import { newEyeState } from "../eye/initial.js";
import { makeRng } from "../rng/rng.js";
import type { JourneyConfigs } from "../journey/config.js";
import type { HeroState, JourneyState } from "../journey/state.js";

/**
 * A fixed test Wanderer for the Stage-1 milestone. Deterministic: same seed and
 * pack yield the same journey. Not drawn from the pack's lifepaths yet (Stage 4);
 * this is a hand-built hero sufficient to exercise the integrated subsystems.
 */
export function makeTestHero(cfg: JourneyConfigs): HeroState {
  return {
    attributes: { strength: 4, heart: 5, wits: 3 },
    skills: { travel: 2, exploration: 2, awareness: 1, hunting: 1 },
    endurance: { current: 18, max: 18 },
    loadGear: 0,
    fatigue: 0,
    hope: { current: 3, max: 3 },
    shadow: { points: 0, scars: 0 },
    eye: newEyeState({ valourAtLeast4: false, culture: "other", famousItemCount: 0 }, cfg.eye),
    inspired: true, // Wanderer is inspired on journey skill checks
    wounded: false,
  };
}

export function makeMilestoneState(cfg: JourneyConfigs, seed: number | string): JourneyState {
  return {
    hero: makeTestHero(cfg),
    journey: {
      totalHexes: 7,
      remainingHexes: 7,
      region: "dark_lands",
      season: "winter_autumn",
      daysElapsed: 0,
      arrived: false,
    },
    rng: makeRng(seed),
    log: [],
  };
}
