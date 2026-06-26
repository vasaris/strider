import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { journeyConfigsFromPack } from "../../src/journey/config.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { progressionConfigFromPack, spendExperience, type ProgressionConfig } from "../../src/progression/index.js";
import { makeTestHero } from "../../src/cli/scenario.js";
import type { HeroState } from "../../src/hero/state.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

let cfg: ProgressionConfig;
let base: HeroState;

beforeAll(() => {
  const pack = loadPack(nodePackSource(packRoot));
  cfg = progressionConfigFromPack(pack);
  base = {
    ...makeTestHero(journeyConfigsFromPack(pack)),
    calling: "warrior",
    culture: "hobbits_of_the_shire",
    valour: 1,
    wisdom: 1,
    weaponSkills: { swords: 1 },
    experience: { adventurePoints: 30, skillPoints: 30 },
  };
});

describe("spendExperience — cost table and pools", () => {
  it("raises a skill with skill points by the folio-119 cost (level 3 costs 12)", () => {
    // makeTestHero gives awareness rating 1; raise to 2 (cost 8).
    const [res, h] = spendExperience(base, { items: [{ kind: "skill", id: "awareness", toRating: 2 }] }, cfg);
    expect(res.skillPointsSpent).toBe(8);
    expect(res.adventurePointsSpent).toBe(0);
    expect(h.skills["awareness"]).toBe(2);
    expect(h.experience).toEqual({ adventurePoints: 30, skillPoints: 22 });
  });

  it("raises a weapon-skill with adventure points", () => {
    const [res, h] = spendExperience(base, { items: [{ kind: "weaponSkill", id: "swords", toRating: 2 }] }, cfg);
    expect(res.adventurePointsSpent).toBe(8);
    expect(res.skillPointsSpent).toBe(0);
    expect(h.weaponSkills?.["swords"]).toBe(2);
  });

  it("raises valour with adventure points and grants a Reward", () => {
    const [res, h] = spendExperience(
      base,
      { items: [{ kind: "valour", toLevel: 2, grantRewardKey: "fell" }] },
      cfg,
    );
    expect(res.adventurePointsSpent).toBe(8);
    expect(res.grants).toEqual([{ kind: "reward", key: "fell" }]);
    expect(h.valour).toBe(2);
    expect(h.rewards).toEqual(["fell"]);
  });

  it("raises wisdom with adventure points and grants a Virtue", () => {
    const [res, h] = spendExperience(
      base,
      { items: [{ kind: "wisdom", toLevel: 2, grantVirtueKey: "confidence" }] },
      cfg,
    );
    expect(res.grants).toEqual([{ kind: "virtue", key: "confidence" }]);
    expect(h.wisdom).toBe(2);
    expect(h.virtues).toEqual(["confidence"]);
  });

  it("accepts a cultural Virtue for the hero's culture at wisdom level >= 2", () => {
    const [, h] = spendExperience(base, { items: [{ kind: "wisdom", toLevel: 2, grantVirtueKey: "true_aim" }] }, cfg);
    expect(h.virtues).toEqual(["true_aim"]);
  });
});

describe("spendExperience — validation and caps", () => {
  it("rejects an unknown skill id", () => {
    expect(() => spendExperience(base, { items: [{ kind: "skill", id: "nonsense", toRating: 1 }] }, cfg)).toThrow(/unknown skill/);
  });

  it("rejects raising by more than one level in a phase", () => {
    expect(() => spendExperience(base, { items: [{ kind: "skill", id: "awareness", toRating: 3 }] }, cfg)).toThrow(/raise by one level/);
  });

  it("rejects raising the same skill twice (max one level per skill per phase)", () => {
    expect(() =>
      spendExperience(
        base,
        { items: [{ kind: "skill", id: "awareness", toRating: 2 }, { kind: "skill", id: "awareness", toRating: 3 }] },
        cfg,
      ),
    ).toThrow(/phase/);
  });

  it("rejects raising both valour and wisdom in one phase", () => {
    expect(() =>
      spendExperience(
        base,
        {
          items: [
            { kind: "valour", toLevel: 2, grantRewardKey: "fell" },
            { kind: "wisdom", toLevel: 2, grantVirtueKey: "confidence" },
          ],
        },
        cfg,
      ),
    ).toThrow(/of valour\/wisdom per phase/);
  });

  it("rejects an unknown Reward key", () => {
    expect(() =>
      spendExperience(base, { items: [{ kind: "valour", toLevel: 2, grantRewardKey: "bogus" }] }, cfg),
    ).toThrow(/unknown reward key/);
  });

  it("rejects a cultural Virtue from the wrong culture", () => {
    const dwarf: HeroState = { ...base, culture: "dwarves_of_durins_folk" };
    expect(() =>
      spendExperience(dwarf, { items: [{ kind: "wisdom", toLevel: 2, grantVirtueKey: "true_aim" }] }, cfg),
    ).toThrow(/not allowed/);
  });

  it("rejects a plan that overspends a pool", () => {
    const poor: HeroState = { ...base, experience: { adventurePoints: 0, skillPoints: 3 } };
    expect(() => spendExperience(poor, { items: [{ kind: "skill", id: "awareness", toRating: 2 }] }, cfg)).toThrow(/insufficient skill points/);
  });

  it("leaves the hero untouched when the plan is empty", () => {
    const [res, h] = spendExperience(base, { items: [] }, cfg);
    expect(res).toEqual({ skillPointsSpent: 0, adventurePointsSpent: 0, grants: [] });
    expect(h.experience).toEqual(base.experience);
  });
});
