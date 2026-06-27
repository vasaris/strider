import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { makeMilestoneState } from "../../src/cli/scenario.js";
import { journeyConfigsFromPack } from "../../src/journey/config.js";
import { stepJourney } from "../../src/journey/run.js";
import type { JourneyState } from "../../src/journey/state.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const SEED = "dark-1";

describe("stepJourney StepRecord (channel B: per-step checks side-channel)", () => {
  const pack = loadPack(nodePackSource(packRoot));
  const cfg = journeyConfigsFromPack(pack);

  it("record.events is EXACTLY the log slice appended this step (single source of truth)", () => {
    const before: JourneyState = makeMilestoneState(cfg, SEED);
    const beforeLen = before.log.length;
    const [next, record] = stepJourney(before, cfg);

    expect(record.events.length).toBe(next.log.length - beforeLen);
    // reference identity per element: the record reuses the log entries, never recomputes them
    record.events.forEach((e, i) => expect(e).toBe(next.log[beforeLen + i]));
  });

  it("travelCheck is present and its outcome matches the travel_check event", () => {
    const [, record] = stepJourney(makeMilestoneState(cfg, SEED), cfg);
    expect(record.travelCheck).not.toBeNull();
    const travelEvent = record.events.find((e) => e.kind === "travel_check");
    expect(travelEvent).toBeDefined();
    if (travelEvent?.kind === "travel_check") {
      expect(record.travelCheck?.outcome).toBe(travelEvent.outcome);
    }
  });

  it("sceneCheck nullability tracks a non-significant scene event (and matches its outcome)", () => {
    const [, record] = stepJourney(makeMilestoneState(cfg, SEED), cfg);
    const sceneEvent = record.events.find((e) => e.kind === "scene");
    if (sceneEvent?.kind === "scene" && !sceneEvent.significantEncounter && sceneEvent.skill !== null) {
      expect(record.sceneCheck).not.toBeNull();
      expect(record.sceneCheck?.outcome).toBe(sceneEvent.checkOutcome);
    } else {
      // significant encounter / no check / arrival-only step -> no scene check rolled
      expect(record.sceneCheck).toBeNull();
    }
  });

  it("is reproducible: same seed -> identical record", () => {
    const [, a] = stepJourney(makeMilestoneState(cfg, SEED), cfg);
    const [, b] = stepJourney(makeMilestoneState(cfg, SEED), cfg);
    expect(a).toEqual(b);
  });

  it("degenerate: stepping an arrived state is a no-op with an empty record", () => {
    const arrived: JourneyState = {
      ...makeMilestoneState(cfg, SEED),
      journey: { ...makeMilestoneState(cfg, SEED).journey, arrived: true },
    };
    const [next, record] = stepJourney(arrived, cfg);
    expect(next).toBe(arrived); // unchanged reference
    expect(record.events).toEqual([]);
    expect(record.travelCheck).toBeNull();
    expect(record.sceneCheck).toBeNull();
  });
});
