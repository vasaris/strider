/**
 * Eye of Mordor subsystem types.
 *
 * The Eye Awareness rating (Бдительность Ока) grows out of combat from Eye
 * results on the Feat die, Shadow gained, and misfortune-table Eye results;
 * when it reaches the pursuit threshold a detection scene fires and the rating
 * resets to its initial value. All numbers come from kv.solo.eye_of_mordor.
 */

export type EyeRegion = "border_lands" | "wild_lands" | "dark_lands";
export type EyeCulture = "dwarf" | "elf_or_dunedain" | "high_elf" | "other";

/** State slice. `initial` is retained so the rating can reset to it. */
export interface EyeState {
  readonly awareness: number;
  readonly initial: number;
}

/** Inputs to the initial-rating computation, assembled by the caller. */
export interface EyeSetup {
  readonly valourAtLeast4: boolean;
  readonly culture: EyeCulture;
  readonly famousItemCount: number;
}
