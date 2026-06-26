import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { combatConfigFromPack } from "../../src/combat/fromPack.js";
import { deriveCombatConfig } from "../../src/combat/config.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");

/** Minimal raw card stub: only payload.parameters is read by the derivers. */
function card(parameters: unknown): unknown {
  return { payload: { parameters } };
}

describe("combatConfigFromPack — derives the verified combat vocabulary", () => {
  const pack = loadPack(nodePackSource(packRoot));
  const cfg = combatConfigFromPack(pack);

  it("derives the four stances with their exact pack modifiers", () => {
    expect(cfg.stances.forward).toMatchObject({
      key: "forward",
      type: "melee",
      heroAttackMod: { kind: "flat", dice: 1 },
      enemyMeleeVsHeroMod: 1,
      task: "cow",
    });
    expect(cfg.stances.open).toMatchObject({
      type: "melee",
      heroAttackMod: { kind: "flat", dice: 0 },
      enemyMeleeVsHeroMod: 0,
      task: "rally",
    });
    expect(cfg.stances.defensive).toMatchObject({
      heroAttackMod: { kind: "per_engaged_enemy", dice: -1 },
      enemyMeleeVsHeroMod: -1,
      task: "protect",
    });
    // The ranged stance carries no melee modifiers; it is ranged-only.
    expect(cfg.stances.ranged).toMatchObject({
      type: "ranged",
      heroRangedOnly: true,
      targetableOnlyByRanged: true,
      task: "prepare_shot",
    });
    expect(cfg.stances.ranged.heroAttackMod).toBeUndefined();
    expect(cfg.stances.ranged.enemyMeleeVsHeroMod).toBeUndefined();
  });

  it("derives the stance action order", () => {
    expect(cfg.stanceOrder).toEqual(["forward", "open", "defensive", "ranged"]);
  });

  it("derives the four tasks with skill, stance and effect rungs", () => {
    expect(cfg.tasks.cow).toMatchObject({ stance: "forward", skill: "awe" });
    expect(cfg.tasks.rally).toMatchObject({ stance: "open", skill: "inspire", maxPerRound: 1 });
    expect(cfg.tasks.protect).toMatchObject({ stance: "defensive", skill: "athletics" });
    expect(cfg.tasks.prepare_shot).toMatchObject({ stance: "ranged", skill: "search" });

    // Effect text is carried opaquely; we assert presence/shape, not semantics.
    expect(cfg.tasks.cow.effect.onSuccess.length).toBeGreaterThan(0);
    expect(cfg.tasks.cow.effect.oneSign).toBeDefined();
    expect(cfg.tasks.cow.effect.twoSigns).toBeDefined();
    expect(cfg.tasks.protect.effect.perSign).toBeDefined();
    // Only rally is once-per-round.
    expect(cfg.tasks.cow.maxPerRound).toBeUndefined();
  });

  it("derives action economy, grapple limits and the manipulate skill", () => {
    expect(cfg.actions).toEqual({ main: 1, secondary: 1 });
    expect(cfg.grapple.rangedHeroesCannotBeGrappled).toBe(true);
    expect(cfg.grapple.maxEnemiesPerHero).toEqual({ humanSize: 3, large: 2 });
    expect(cfg.grapple.maxHeroesPerEnemy).toEqual({ humanSize: 3, large: 6 });
    expect(cfg.manipulateSkill).toBe("battle");
  });

  it("derives complication / advantage tiers", () => {
    expect(cfg.complicationTiers.complication).toEqual({ moderate: -1, serious: -2 });
    expect(cfg.complicationTiers.advantage).toEqual({ moderate: 1, serious: 2 });
  });

  it("derives the two exit methods (ranged free, defensive needs a roll)", () => {
    expect(cfg.exit.rangedExit).toMatchObject({ requiresStance: "ranged", requiresRoll: false });
    expect(cfg.exit.defensiveExit).toMatchObject({ requiresStance: "defensive", requiresRoll: true });
  });
});

describe("anti-hardcode: deriveCombatConfig reflects card numbers, bakes none", () => {
  // A stub pack with deliberately different numbers from the real book.
  const stancesStub = card({
    stances: {
      forward: { name_ru: "F", type: "melee", hero_attack_mod_dice: 2, enemy_melee_vs_hero_mod_dice: 3, task: "cow" },
      open: { name_ru: "O", type: "melee", hero_attack_mod_dice: 0, enemy_melee_vs_hero_mod_dice: 0, task: "rally" },
      defensive: {
        name_ru: "D",
        type: "melee",
        hero_attack_mod_dice_per_engaged_enemy: -2,
        enemy_melee_vs_hero_mod_dice: -3,
        task: "protect",
      },
      ranged: {
        name_ru: "R",
        type: "ranged",
        hero_ranged_only: true,
        targetable_only_by_ranged: true,
        task: "prepare_shot",
      },
    },
    stance_order: ["ranged", "defensive", "open", "forward"],
    grapple: {
      ranged_heroes_cannot_be_grappled: false,
      max_enemies_per_hero: { human_size: 9, large: 8 },
      max_heroes_per_enemy: { human_size: 7, large: 6 },
    },
    actions: { per_turn: { main: 2, secondary: 5 } },
  });

  const tasksStub = card({
    tasks: {
      cow: { name_ru: "c", stance: "forward", check: "awe", effect: { on_success: "x" } },
      rally: { name_ru: "r", stance: "open", check: "inspire", max_per_round: 4, effect: { on_success: "y" } },
      protect: { name_ru: "p", stance: "defensive", check: "athletics", effect: { on_success: "z", per_sign: "q" } },
      prepare_shot: { name_ru: "s", stance: "ranged", check: "search", effect: { on_success: "w" } },
    },
  });

  const complStub = card({
    tiers: {
      complication: { moderate: { dice: -7 }, serious: { dice: -8 } },
      advantage: { moderate: { dice: 5 }, serious: { dice: 6 } },
    },
    manipulate_action: { check: "lore" },
  });

  const exitStub = card({
    methods: {
      ranged_exit: { name_ru: "re", requires_stance: "ranged", roll: false },
      defensive_exit: { name_ru: "de", requires_stance: "defensive", roll: "attack_check" },
    },
  });

  // Solo overlay: the Advance task lives in its own card; stub numbers differ
  // from the book (plus_2d) so the merge is proven to follow the stub.
  const soloStub = card({
    tasks: {
      prodvinutsya: {
        name_ru: "adv",
        stance: "ranged",
        check_any: ["athletics", "search"],
        effect: { on_success: "plus_2d_next_ranged_attack", per_sign: "plus_1d" },
      },
    },
  });

  const cfg = deriveCombatConfig(stancesStub, tasksStub, complStub, exitStub, soloStub);

  it("uses the stub's numbers, not the book's", () => {
    expect(cfg.stances.forward.heroAttackMod).toEqual({ kind: "flat", dice: 2 });
    expect(cfg.stances.forward.enemyMeleeVsHeroMod).toBe(3);
    expect(cfg.stances.defensive.heroAttackMod).toEqual({ kind: "per_engaged_enemy", dice: -2 });
    expect(cfg.stanceOrder).toEqual(["ranged", "defensive", "open", "forward"]);
    expect(cfg.actions).toEqual({ main: 2, secondary: 5 });
    expect(cfg.grapple.rangedHeroesCannotBeGrappled).toBe(false);
    expect(cfg.grapple.maxEnemiesPerHero).toEqual({ humanSize: 9, large: 8 });
    expect(cfg.tasks.rally.maxPerRound).toBe(4);
    // The merged solo Advance task: a check_any choice, defaulting to the first.
    expect(cfg.tasks.prodvinutsya.skillAny).toEqual(["athletics", "search"]);
    expect(cfg.tasks.prodvinutsya.skill).toBe("athletics");
    expect(cfg.tasks.prodvinutsya.stance).toBe("ranged");
    expect(cfg.complicationTiers.complication).toEqual({ moderate: -7, serious: -8 });
    expect(cfg.manipulateSkill).toBe("lore");
    expect(cfg.exit.defensiveExit.requiresRoll).toBe(true);
  });

  it("rejects a malformed exit roll value", () => {
    const bad = card({
      methods: {
        ranged_exit: { name_ru: "re", requires_stance: "ranged", roll: false },
        defensive_exit: { name_ru: "de", requires_stance: "defensive", roll: 42 },
      },
    });
    expect(() => deriveCombatConfig(stancesStub, tasksStub, complStub, bad, soloStub)).toThrow(/roll/);
  });
});
