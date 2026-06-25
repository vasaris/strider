import type { EyeState } from "../eye/types.js";

/** The three core attributes; their rating sets a check's target number. */
export type Attribute = "strength" | "heart" | "wits";

/**
 * The hero's mechanical state. Foundational and shared across subsystems
 * (journey, conditions, combat, council, progression), so it lives here rather
 * than inside any one of them.
 */
export interface HeroState {
  readonly attributes: Readonly<Record<Attribute, number>>; // ratings -> TN = tnBase - rating
  readonly skills: Readonly<Record<string, number>>; // skill rating -> success dice
  readonly endurance: { readonly current: number; readonly max: number };
  /** Gear weight. Total Load = loadGear + fatigue (journey Iznurenie raises Load). */
  readonly loadGear: number;
  readonly fatigue: number; // journey-only Iznurenie
  readonly hope: { readonly current: number; readonly max: number };
  readonly shadow: { readonly points: number; readonly scars: number };
  readonly eye: EyeState;
  readonly inspired: boolean; // Wanderer on journey skill checks
  readonly wounded: boolean;
}
