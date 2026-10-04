// 900-run journey snapshot (3.3a-K1): the proof that the beat refactor (travelBeat / checkBeat)
// reproduces the old stepJourney byte for byte, and that R2 (Eye growth only from hero checks)
// moves nothing but Eye/detection fields. See snapshot900.test.ts for how the fixture was made.
//
// Test helper only (node:crypto is fine here; engine/src stays dependency-free).
import { createHash } from "node:crypto";
import { makeMilestoneState } from "../../src/cli/scenario.js";
import type { JourneyConfigs } from "../../src/journey/config.js";
import { stepJourney } from "../../src/journey/run.js";
import type { JourneyState, StepRecord } from "../../src/journey/state.js";

export const SNAPSHOT_SEEDS: readonly string[] = Array.from({ length: 300 }, (_, i) => `snap-${i}`);
export const SNAPSHOT_REGIONS = ["border_lands", "wild_lands", "dark_lands"] as const;
export type SnapshotRegion = (typeof SNAPSHOT_REGIONS)[number];

/** One step of one run, exactly as hashed: the state after the step plus the step record. */
export interface SnapshotStep {
  readonly state: Pick<JourneyState, "hero" | "journey" | "rng" | "log">;
  readonly record: StepRecord;
}

export interface SnapshotRun {
  readonly seed: string;
  readonly region: SnapshotRegion;
  readonly full: string; // sha256 (16 hex) of plain insertion-order JSON.stringify(steps)
  readonly masked: string; // same, after maskEye
  readonly steps: readonly SnapshotStep[];
}

function hash16(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

/** The milestone start with only the route region overridden (key order preserved). */
export function snapshotStart(cfg: JourneyConfigs, seed: string, region: SnapshotRegion): JourneyState {
  const s = makeMilestoneState(cfg, seed);
  return { ...s, journey: { ...s.journey, route: { ...s.journey.route, region } } };
}

/**
 * Every `eyeDelta` -> 0, every `eye.awareness` -> 0, every `detection` event removed (wherever
 * they occur: state.log, record.events, hero.eye). Works on the parsed JSON, so key order is kept.
 */
export function maskEye(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((v) => !(typeof v === "object" && v !== null && (v as { kind?: unknown }).kind === "detection"))
      .map(maskEye);
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "eyeDelta") out[k] = 0;
      else if (k === "eye" && typeof v === "object" && v !== null && !Array.isArray(v)) {
        const eye = maskEye(v) as Record<string, unknown>;
        out[k] = "awareness" in eye ? { ...eye, awareness: 0 } : eye;
      } else out[k] = maskEye(v);
    }
    return out;
  }
  return value;
}

/** Run one journey with stepJourney until arrival, collecting every step. */
export function snapshotRun(cfg: JourneyConfigs, seed: string, region: SnapshotRegion): SnapshotRun {
  let s = snapshotStart(cfg, seed, region);
  const steps: SnapshotStep[] = [];
  const cap = s.journey.route.totalHexes + 50;
  for (let i = 0; i < cap && !s.journey.arrived; i++) {
    const [next, record] = stepJourney(s, cfg);
    steps.push({ state: { hero: next.hero, journey: next.journey, rng: next.rng, log: next.log }, record });
    s = next;
  }
  if (!s.journey.arrived) throw new Error(`snapshotRun: ${seed}/${region} did not arrive`);
  const text = JSON.stringify(steps);
  return { seed, region, full: hash16(text), masked: hash16(JSON.stringify(maskEye(JSON.parse(text)))), steps };
}

/** All 900 runs, seeds outer, regions inner. */
export function snapshotAll(cfg: JourneyConfigs): SnapshotRun[] {
  const out: SnapshotRun[] = [];
  for (const seed of SNAPSHOT_SEEDS) for (const region of SNAPSHOT_REGIONS) out.push(snapshotRun(cfg, seed, region));
  return out;
}
