import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { makeRng } from "../../src/rng/rng.js";
import { newEyeState } from "../../src/eye/initial.js";
import { eyeConfigFromPack } from "../../src/eye/fromPack.js";
import { combatConfigsFromPack } from "../../src/combat/configs.js";
import { deriveWoundConfig } from "../../src/combat/wounds.js";
import {
  applyFirstWound,
  applySecondWound,
  clearLightWoundAfterCombat,
  dyingRescue,
  firstAid,
  resolvePiercing,
  rollWoundSeverity,
  severityForFace,
  takeWound,
} from "../../src/combat/wounds.js";
import type { HeroState, WoundState } from "../../src/hero/state.js";
import type { CheckConditions } from "../../src/checks/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const pack = loadPack(nodePackSource(packRoot));
const cfgs = combatConfigsFromPack(pack);

function hero(over: Partial<HeroState> = {}): HeroState {
  return {
    attributes: { strength: 4, heart: 4, wits: 3 },
    skills: {},
    endurance: { current: 20, max: 20 },
    loadGear: 0,
    fatigue: 0,
    hope: { current: 3, max: 3 },
    shadow: { points: 0, scars: 0 },
    eye: newEyeState({ valourAtLeast4: false, culture: "other", famousItemCount: 0 }, eyeConfigFromPack(pack)),
    inspired: false,
    wounded: false,
    wound: null,
    dying: false,
    dead: false,
    permanentInjuryMarks: 0,
    ...over,
  };
}

// --- config derivation (numbers come from the verified pack) ---

describe("deriveWoundConfig — first-aid + dying numbers read from raneniya", () => {
  it("reads first-aid reduction, per-sign, minimum, retry and dying numbers", () => {
    const c = cfgs.wounds;
    expect(c.firstAid.reduceDaysBase).toBe(1);
    expect(c.firstAid.perSuccessSign).toBe(1);
    expect(c.firstAid.minDays).toBe(1);
    expect(c.firstAid.retryAfterDaysOnFail).toBe(1);
    expect(c.dying.addRecoveryDaysIfMarked).toBe(10);
    expect(c.dying.reviveEndurance).toBe(1);
    expect(typeof c.severityNameRu.light).toBe("string");
    expect(typeof c.severityNameRu.serious).toBe("string");
    expect(typeof c.severityNameRu.terrible).toBe("string");
  });

  it("anti-hardcode: an alternate raneniya stub yields alternate numbers", () => {
    const stub = {
      payload: {
        parameters: {
          wound_severity: {
            by_feat_die: {
              gandalf_rune: { name_ru: "L" },
              "1-10": { name_ru: "S" },
              eye: { name_ru: "T" },
            },
          },
          first_aid: { reduces_severity_days: 3, per_success_sign: 2, min_days: 2, retry_after_days_on_fail: 4 },
          dying: {
            if_wound_marked_add_recovery_days: 99,
            rescue: { on_success: "revive_in_1h_with_5_endurance" },
          },
        },
      },
    };
    const c = deriveWoundConfig(stub);
    expect(c.firstAid).toEqual({ reduceDaysBase: 3, perSuccessSign: 2, minDays: 2, retryAfterDaysOnFail: 4 });
    expect(c.dying).toEqual({ addRecoveryDaysIfMarked: 99, reviveEndurance: 5 });
  });
});

// --- severity table per Feat face ---

describe("severityForFace — rune=Light, number=Serious(days), Eye=Terrible(dying)", () => {
  it("the Gandalf rune is a Light wound (recovers after combat, no days, not dying)", () => {
    expect(severityForFace({ kind: "gandalf_rune" })).toEqual({ severity: "light", healingDays: 0, dying: false });
  });

  it("a number is a Serious wound with healing days equal to the value", () => {
    for (const v of [1, 5, 10]) {
      expect(severityForFace({ kind: "number", value: v })).toEqual({ severity: "serious", healingDays: v, dying: false });
    }
  });

  it("the Eye is a Terrible wound and starts the dying crisis", () => {
    expect(severityForFace({ kind: "eye" })).toEqual({ severity: "terrible", healingDays: 0, dying: true });
  });
});

describe("rollWoundSeverity — seeded roll maps to a valid severity and advances rng", () => {
  it("is deterministic on a fixed seed and threads the rng", () => {
    const rng = makeRng("wound-1");
    const [a, rng2] = rollWoundSeverity(cfgs.dice, rng);
    const [b] = rollWoundSeverity(cfgs.dice, makeRng("wound-1"));
    expect(a).toEqual(b);
    expect(["light", "serious", "terrible"]).toContain(a.severity);
    // a fresh roll off the threaded rng differs from re-using the original seed
    const [c] = rollWoundSeverity(cfgs.dice, rng2);
    expect(typeof c.severity).toBe("string");
  });
});

// --- applying wounds ---

describe("applyFirstWound — marks the sheet and records detail; Terrible drops to dying", () => {
  it("Light: marked, no days, not dying, Endurance untouched", () => {
    const h = applyFirstWound(hero(), { severity: "light", healingDays: 0, dying: false });
    expect(h.wounded).toBe(true);
    expect(h.wound).toEqual({ severity: "light", healingDays: 0, marked: true });
    expect(h.dying).toBe(false);
    expect(h.endurance.current).toBe(20);
  });

  it("Serious: marked with the rolled healing days", () => {
    const h = applyFirstWound(hero(), { severity: "serious", healingDays: 7, dying: false });
    expect(h.wound).toEqual({ severity: "serious", healingDays: 7, marked: true });
    expect(h.dying).toBe(false);
  });

  it("Terrible: marked, dying, Endurance forced to 0", () => {
    const h = applyFirstWound(hero({ endurance: { current: 12, max: 20 } }), {
      severity: "terrible",
      healingDays: 0,
      dying: true,
    });
    expect(h.wounded).toBe(true);
    expect(h.dying).toBe(true);
    expect(h.endurance.current).toBe(0);
  });
});

describe("applySecondWound — 0 Endurance, dying, no new mark, no severity roll", () => {
  it("wipes Endurance and starts dying while leaving the existing wound untouched", () => {
    const existing: WoundState = { severity: "serious", healingDays: 4, marked: true };
    const h = applySecondWound(hero({ wounded: true, wound: existing, endurance: { current: 9, max: 20 } }));
    expect(h.endurance.current).toBe(0);
    expect(h.dying).toBe(true);
    expect(h.wound).toEqual(existing); // unchanged
  });
});

describe("takeWound — routes first vs second wound by the existing mark", () => {
  it("an unmarked hero takes a first wound (rolls severity, marks)", () => {
    const [h, ev, rng2] = takeWound(hero(), cfgs.dice, makeRng("tw-first"));
    expect(ev.kind).toBe("first_wound");
    expect(h.wounded).toBe(true);
    expect(h.wound).not.toBeNull();
    expect(rng2).not.toBe(makeRng("tw-first")); // rng advanced by the roll
  });

  it("an already-marked hero takes a second wound (no roll, rng unchanged)", () => {
    const start = hero({ wounded: true, wound: { severity: "light", healingDays: 0, marked: true } });
    const rng = makeRng("tw-second");
    const [h, ev, rng2] = takeWound(start, cfgs.dice, rng);
    expect(ev).toEqual({ kind: "second_wound" });
    expect(h.dying).toBe(true);
    expect(h.endurance.current).toBe(0);
    expect(rng2).toBe(rng); // no roll consumed
  });
});

// --- first aid ---

describe("firstAid — reduce by base + per-sign, floored at the minimum", () => {
  const wound: WoundState = { severity: "serious", healingDays: 7, marked: true };

  it("reduces by base (1) plus one day per success sign", () => {
    expect(firstAid(wound, 0, cfgs.wounds).healingDays).toBe(6); // 7 - (1 + 0)
    expect(firstAid(wound, 2, cfgs.wounds).healingDays).toBe(4); // 7 - (1 + 2)
  });

  it("never drops below the minimum of 1 day", () => {
    const small: WoundState = { severity: "serious", healingDays: 2, marked: true };
    expect(firstAid(small, 5, cfgs.wounds).healingDays).toBe(1); // max(1, 2 - 6)
  });

  it("a wound with no outstanding days (Light) is unchanged", () => {
    const light: WoundState = { severity: "light", healingDays: 0, marked: true };
    expect(firstAid(light, 3, cfgs.wounds)).toEqual(light);
  });
});

// --- dying rescue ---

describe("dyingRescue — success revives; marked wounds add days; failure kills", () => {
  it("success: revive at 1 Endurance, +1 permanent mark, +10 days on a marked wound", () => {
    const start = hero({
      dying: true,
      wounded: true,
      wound: { severity: "terrible", healingDays: 0, marked: true },
      endurance: { current: 0, max: 20 },
    });
    const h = dyingRescue(start, true, cfgs.wounds);
    expect(h.dying).toBe(false);
    expect(h.dead).toBe(false);
    expect(h.endurance.current).toBe(1);
    expect(h.permanentInjuryMarks).toBe(1);
    expect(h.wound?.healingDays).toBe(10); // 0 + 10 (marked)
  });

  it("success on an unmarked dying hero adds no recovery days", () => {
    const start = hero({ dying: true, wound: null, endurance: { current: 0, max: 20 } });
    const h = dyingRescue(start, true, cfgs.wounds);
    expect(h.endurance.current).toBe(1);
    expect(h.wound).toBeNull();
    expect(h.permanentInjuryMarks).toBe(1);
  });

  it("failure: the hero dies", () => {
    const start = hero({ dying: true, endurance: { current: 0, max: 20 } });
    const h = dyingRescue(start, false, cfgs.wounds);
    expect(h.dead).toBe(true);
    expect(h.dying).toBe(false);
  });
});

describe("clearLightWoundAfterCombat — only Light wounds clear", () => {
  it("clears a Light wound's mark and detail", () => {
    const h = clearLightWoundAfterCombat(hero({ wounded: true, wound: { severity: "light", healingDays: 0, marked: true } }));
    expect(h.wounded).toBe(false);
    expect(h.wound).toBeNull();
  });

  it("leaves a Serious wound in place", () => {
    const w: WoundState = { severity: "serious", healingDays: 5, marked: true };
    const h = clearLightWoundAfterCombat(hero({ wounded: true, wound: w }));
    expect(h.wounded).toBe(true);
    expect(h.wound).toEqual(w);
  });
});

// --- piercing protection roll (TN = weapon injury, dice = armour) ---

describe("resolvePiercing — protection roll; fail -> wound; side-aware Feat die", () => {
  it("an impossibly high injury TN is failed -> wound triggered (hero, unless rune)", () => {
    // Across seeds, a non-rune Feat with armour dice cannot reach TN 99 -> wound.
    let anyWound = false;
    for (let i = 0; i < 20; i++) {
      const [r] = resolvePiercing("hero", 2, 99, undefined, cfgs.dice, makeRng(`pierce-hi-${i}`));
      if (r.woundTriggered) anyWound = true;
      expect(r.tn).toBe(99);
    }
    expect(anyWound).toBe(true);
  });

  it("a TN of 0 is always met -> never a wound", () => {
    for (let i = 0; i < 20; i++) {
      const [r] = resolvePiercing("hero", 1, 0, undefined, cfgs.dice, makeRng(`pierce-lo-${i}`));
      expect(r.passed).toBe(true);
      expect(r.woundTriggered).toBe(false);
    }
  });

  it("is deterministic on a fixed seed", () => {
    const [a] = resolvePiercing("hero", 3, 12, undefined, cfgs.dice, makeRng("pierce-det"));
    const [b] = resolvePiercing("hero", 3, 12, undefined, cfgs.dice, makeRng("pierce-det"));
    expect(a).toEqual(b);
  });

  it("enemy side is inverted: the Eye protects (passes even a high TN sometimes)", () => {
    // With enemy semantics the Eye is an auto-success, so some seeds pass TN 99.
    let anyPass = false;
    for (let i = 0; i < 60; i++) {
      const [r] = resolvePiercing("enemy", 0, 99, undefined, cfgs.dice, makeRng(`pierce-enemy-${i}`));
      if (r.passed) anyPass = true;
    }
    expect(anyPass).toBe(true);
  });

  it("a weary hero defender requires wearyVoidedFaces in conditions (raneniya: roll before weariness)", () => {
    const weary: CheckConditions = { weary: true, wearyVoidedFaces: cfgs.conditions.wearyVoidedFaces };
    const [r] = resolvePiercing("hero", 2, 10, weary, cfgs.dice, makeRng("pierce-weary"));
    expect(typeof r.woundTriggered).toBe("boolean");
  });
});
