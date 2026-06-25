import { describe, expect, it } from "vitest";
import { initialEyeRating, newEyeState } from "../../src/eye/initial.js";
import {
  applyEyeAwarenessDelta,
  applyEyeEffects,
  growthFromFeatDie,
  growthFromShadowGain,
} from "../../src/eye/growth.js";
import { isDetected, pursuitThreshold, resetEye } from "../../src/eye/pursuit.js";
import type { EyeState } from "../../src/eye/types.js";
import { KV_EYE } from "./fixtures.js";

describe("initial Eye rating", () => {
  it("base only", () => {
    expect(initialEyeRating({ valourAtLeast4: false, culture: "other", famousItemCount: 0 }, KV_EYE)).toBe(0);
  });
  it("valour >= 4 adds 1", () => {
    expect(initialEyeRating({ valourAtLeast4: true, culture: "other", famousItemCount: 0 }, KV_EYE)).toBe(1);
  });
  it("culture modifiers (dwarf/elf-dunedain/high-elf)", () => {
    expect(initialEyeRating({ valourAtLeast4: false, culture: "dwarf", famousItemCount: 0 }, KV_EYE)).toBe(1);
    expect(initialEyeRating({ valourAtLeast4: false, culture: "elf_or_dunedain", famousItemCount: 0 }, KV_EYE)).toBe(2);
    expect(initialEyeRating({ valourAtLeast4: false, culture: "high_elf", famousItemCount: 0 }, KV_EYE)).toBe(3);
  });
  it("famous items add one each, and modifiers stack", () => {
    expect(initialEyeRating({ valourAtLeast4: true, culture: "high_elf", famousItemCount: 2 }, KV_EYE)).toBe(1 + 3 + 2);
  });
  it("newEyeState sets awareness == initial", () => {
    const s = newEyeState({ valourAtLeast4: false, culture: "dwarf", famousItemCount: 0 }, KV_EYE);
    expect(s).toEqual({ awareness: 1, initial: 1 });
  });
});

describe("Eye growth", () => {
  it("Eye on feat die: +1 out of combat, 0 in combat", () => {
    expect(growthFromFeatDie(true, false, KV_EYE)).toBe(1);
    expect(growthFromFeatDie(true, true, KV_EYE)).toBe(0);
    expect(growthFromFeatDie(false, false, KV_EYE)).toBe(0);
  });
  it("Shadow gain: +N out of combat, 0 in combat", () => {
    expect(growthFromShadowGain(3, false, KV_EYE)).toBe(3);
    expect(growthFromShadowGain(3, true, KV_EYE)).toBe(0);
    expect(() => growthFromShadowGain(-1, false, KV_EYE)).toThrow();
  });
  it("awareness delta floors at zero", () => {
    const eye: EyeState = { awareness: 0, initial: 0 };
    expect(applyEyeAwarenessDelta(eye, -1).awareness).toBe(0);
    expect(applyEyeAwarenessDelta({ awareness: 2, initial: 0 }, 3).awareness).toBe(5);
  });
  it("applyEyeEffects applies only eye_awareness_delta", () => {
    const eye: EyeState = { awareness: 3, initial: 0 };
    const out = applyEyeEffects(eye, [
      { op: "hope_points", value: 1 }, // ignored
      { op: "eye_awareness_delta", value: 2 }, // +2
      { op: "shadow_points", value: 1 }, // ignored
      { op: "eye_awareness_delta", value: -1 }, // -1
    ]);
    expect(out.awareness).toBe(4);
  });
});

describe("pursuit + reset", () => {
  it("effective threshold = region base + applied modifiers", () => {
    expect(pursuitThreshold("wild_lands", [], KV_EYE)).toBe(16);
    expect(pursuitThreshold("wild_lands", [2, -4], KV_EYE)).toBe(14); // false-name +2, enemy searching -4
    expect(pursuitThreshold("dark_lands", [4], KV_EYE)).toBe(18); // blessing
  });
  it("unknown region throws", () => {
    // @ts-expect-error region must be a known key
    expect(() => pursuitThreshold("mordor", [], KV_EYE)).toThrow();
  });
  it("detection fires at or above threshold (direct comparison)", () => {
    expect(isDetected(15, 16)).toBe(false);
    expect(isDetected(16, 16)).toBe(true);
    expect(isDetected(20, 16)).toBe(true);
  });
  it("reset returns awareness to initial", () => {
    expect(resetEye({ awareness: 17, initial: 3 })).toEqual({ awareness: 3, initial: 3 });
  });
});
