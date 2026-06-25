import type { JourneyConfigs } from "./config.js";
import { resolveScene } from "./scene.js";
import type { JourneyState } from "./state.js";

/**
 * A danger zone (journey.poryadok_puteshestviya): on entry the party stops and
 * plays a number of scenes equal to the zone's peril rating. No travel check or
 * arrival happens between them; each scene resolves normally (its consequences,
 * fatigue, and Eye growth all apply).
 */
export function runDangerZone(state: JourneyState, perilRating: number, cfg: JourneyConfigs): JourneyState {
  let s = state;
  for (let i = 0; i < Math.max(0, perilRating); i++) {
    s = resolveScene(s, cfg);
  }
  return s;
}
