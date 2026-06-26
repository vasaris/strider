import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { makeRng } from "../../src/rng/rng.js";
import { councilConfigsFromPack } from "../../src/council/config.js";
import { runIntroduction, startCouncil } from "../../src/council/start.js";
import { makeCouncilHero } from "../../src/cli/councilScenario.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

const pack = loadPack(nodePackSource(packRoot));
const cfgs = councilConfigsFromPack(pack);
const hero = makeCouncilHero(pack);
const intro = cfgs.council.introduction;

describe("runIntroduction — one representative check sets the duration", () => {
  it("startCouncil resolves the resistance rating and leaves duration unset", () => {
    const s = startCouncil(hero, "bold", "neutral", cfgs.council);
    expect(s.resistance).toBe(cfgs.council.resistance.bold);
    expect(s.duration).toBeNull();
    expect(s.introductionSucceeded).toBeNull();
    expect(s.accumulated).toBe(0);
    expect(s.attemptsUsed).toBe(0);
  });

  it("sets duration by the pack formula and exercises both branches over seeds", () => {
    let sawSuccess = false;
    let sawFail = false;
    for (let i = 0; i < 80; i++) {
      const s0 = startCouncil(hero, "reasonable", "neutral", cfgs.council);
      const [s1, event, _rng] = runIntroduction(s0, { skill: "courtesy" }, cfgs, makeRng(`intro-${i}`));
      expect(event.kind).toBe("introduction");
      if (event.kind !== "introduction") continue;
      expect(event.skill).toBe("courtesy");

      const expectedDuration =
        event.outcome === "success"
          ? intro.durationSuccessBase + intro.durationSuccessPerSign * event.successIcons
          : intro.durationOnFail;

      expect(event.durationSet).toBe(expectedDuration);
      expect(s1.duration).toBe(expectedDuration);
      expect(s1.introductionSucceeded).toBe(event.outcome === "success");
      // The introduction never adds to the accumulated tally; it only buys attempts.
      expect(s1.accumulated).toBe(0);

      if (event.outcome === "success") sawSuccess = true;
      else sawFail = true;
    }
    // The sample must actually cover both the success-formula and the flat-fail branch.
    expect(sawSuccess).toBe(true);
    expect(sawFail).toBe(true);
  });

  it("a failed introduction yields exactly the flat fail duration", () => {
    for (let i = 0; i < 80; i++) {
      const s0 = startCouncil(hero, "reasonable", "neutral", cfgs.council);
      const [s1, event] = runIntroduction(s0, { skill: "courtesy" }, cfgs, makeRng(`introfail-${i}`));
      if (event.kind === "introduction" && event.outcome === "failure") {
        expect(s1.duration).toBe(intro.durationOnFail);
      }
    }
  });

  it("refuses to run the introduction twice", () => {
    const s0 = startCouncil(hero, "reasonable", "neutral", cfgs.council);
    const [s1] = runIntroduction(s0, { skill: "courtesy" }, cfgs, makeRng("twice"));
    expect(() => runIntroduction(s1, { skill: "courtesy" }, cfgs, makeRng("twice"))).toThrow(/already done/);
  });

  it("rejects a skill the pack does not know", () => {
    const s0 = startCouncil(hero, "reasonable", "neutral", cfgs.council);
    expect(() => runIntroduction(s0, { skill: "not_a_skill" }, cfgs, makeRng("x"))).toThrow(/unknown skill/);
  });
});
