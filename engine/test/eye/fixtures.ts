import type { EyeConfig } from "../../src/eye/config.js";

/** Canonical KV Eye config (numbers mirror kv.solo.eye_of_mordor; ASCII fixture). */
export const KV_EYE: EyeConfig = {
  initialBase: 0,
  cultureModifier: { dwarf: 1, elf_or_dunedain: 2, high_elf: 3 },
  valourModifier: 1,
  famousItemModifier: 1,
  growth: { eyeOnFeatOutOfCombat: 1, misfortuneEyeResult: 2, shadowPerPoint: true },
  pursuitThresholds: { border_lands: 18, wild_lands: 16, dark_lands: 14 },
  pursuitModifiers: [
    { value: 4, text: "blessing" },
    { value: 2, text: "false name / stealth" },
    { value: -2, text: "famous deed" },
    { value: -4, text: "enemy actively searching" },
  ],
};
