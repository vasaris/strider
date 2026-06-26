import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { makeFellowshipHero } from "../../src/cli/fellowshipScenario.js";
import { fellowshipConfigFromPack } from "../../src/fellowship/config.js";
import { applyYule } from "../../src/fellowship/yule.js";
import type { FellowshipConfig } from "../../src/fellowship/types.js";
import type { HeroState } from "../../src/hero/state.js";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

let cfg: FellowshipConfig;
let hero: HeroState; // wits 3, experience 8/4

beforeAll(() => {
  const pack = loadPack(nodePackSource(packRoot));
  cfg = fellowshipConfigFromPack(pack);
  hero = makeFellowshipHero(pack);
});

describe("applyYule", () => {
  it("credits bonus skill points equal to the WITS rating", () => {
    const [y, h] = applyYule(hero, cfg); // wits 3
    expect(y.bonusSkillPoints).toBe(3);
    expect(h.experience?.skillPoints).toBe(7); // 4 + 3
    expect(h.experience?.adventurePoints).toBe(8); // untouched
  });

  it("ages the hero by the configured number of years", () => {
    const [y] = applyYule(hero, cfg);
    expect(y.agedYears).toBe(1);
  });

  it("starts from empty pools when the hero has none", () => {
    const { experience: _omit, ...rest } = hero;
    const fresh: HeroState = rest;
    const [y, h] = applyYule(fresh, cfg);
    expect(y.bonusSkillPoints).toBe(3);
    expect(h.experience).toEqual({ adventurePoints: 0, skillPoints: 3 });
  });

  it("reads the aging years from config, not a baked 1 (anti-hardcode)", () => {
    const stub: FellowshipConfig = { ...cfg, yule: { ...cfg.yule, agingYears: 7 } };
    const [y] = applyYule(hero, stub);
    expect(y.agedYears).toBe(7);
  });
});
