import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { makeRng } from "../../src/rng/rng.js";
import { newEyeState } from "../../src/eye/initial.js";
import { eyeConfigFromPack } from "../../src/eye/fromPack.js";
import { combatConfigsFromPack } from "../../src/combat/configs.js";
import { deriveAttackConfig, evaluateAttackRoll, resolveAttack } from "../../src/combat/attack.js";
import { spawnEnemy } from "../../src/combat/enemy.js";
import type { CombatState, EnemyStatBlock, HeroCombatFrame } from "../../src/combat/types.js";
import type { HeroState } from "../../src/hero/state.js";
import type { DiceRoll, FeatDieFace, FeatDieResult } from "../../src/dice/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const pack = loadPack(nodePackSource(packRoot));
const cfgs = combatConfigsFromPack(pack);

const TRIGGER = cfgs.attack.piercingTriggerFaces; // { numbers: [10], eye: true }

// --- manual dice-roll builders (for the precise, deterministic eval tests) ---

function featResult(face: FeatDieFace): FeatDieResult {
  if (face.kind === "eye") return { physicalFace: 11, face, numericValue: 0, isEye: true, isAutoSuccess: false };
  if (face.kind === "gandalf_rune") return { physicalFace: 12, face, numericValue: 0, isEye: false, isAutoSuccess: true };
  return { physicalFace: face.value, face, numericValue: face.value, isEye: false, isAutoSuccess: false };
}

function diceRoll(face: FeatDieFace, successFaces: readonly number[]): DiceRoll {
  const feat = featResult(face);
  return {
    feat,
    featCandidates: [feat],
    featModifier: "normal",
    successDice: successFaces.map((f) => ({ face: f, isSuccessIcon: f === 6 })),
    successDiceCount: successFaces.length,
  };
}

describe("evaluateAttackRoll — Feat die reads per side (enemy is inverted)", () => {
  it("hero: the Gandalf rune is an automatic success", () => {
    const r = evaluateAttackRoll(diceRoll({ kind: "gandalf_rune" }, [1, 1]), 99, {
      side: "hero",
      piercingTriggerFaces: TRIGGER,
    });
    expect(r).toMatchObject({ hit: true, autoSuccess: true, total: null });
  });

  it("hero: the Eye contributes 0 and misses a high TN", () => {
    const r = evaluateAttackRoll(diceRoll({ kind: "eye" }, [4, 5]), 14, { side: "hero", piercingTriggerFaces: TRIGGER });
    expect(r.hit).toBe(false);
    expect(r.total).toBe(9); // 0 + 4 + 5
  });

  it("enemy (INVERTED): the Eye is an automatic success", () => {
    const r = evaluateAttackRoll(diceRoll({ kind: "eye" }, [1]), 99, { side: "enemy", piercingTriggerFaces: TRIGGER });
    expect(r).toMatchObject({ hit: true, autoSuccess: true });
    expect(r.piercingTriggered).toBe(true); // Eye triggers Piercing for enemies
  });

  it("enemy (INVERTED): the Gandalf rune is the lowest result (0) and fails", () => {
    const r = evaluateAttackRoll(diceRoll({ kind: "gandalf_rune" }, [3, 3]), 14, {
      side: "enemy",
      piercingTriggerFaces: TRIGGER,
    });
    expect(r.hit).toBe(false);
    expect(r.total).toBe(6); // rune -> 0, + 3 + 3
    expect(r.piercingTriggered).toBe(false);
  });

  it("numbers sum the same on both sides; success iff total >= TN", () => {
    const hero = evaluateAttackRoll(diceRoll({ kind: "number", value: 8 }, [6, 2]), 14, {
      side: "hero",
      piercingTriggerFaces: TRIGGER,
    });
    expect(hero).toMatchObject({ hit: true, total: 16, successIcons: 1 });
    const enemy = evaluateAttackRoll(diceRoll({ kind: "number", value: 8 }, [6, 2]), 17, {
      side: "enemy",
      piercingTriggerFaces: TRIGGER,
    });
    expect(enemy.hit).toBe(false);
  });

  it("Piercing triggers on a 10 (when the attack hits), gated by hit", () => {
    const hit = evaluateAttackRoll(diceRoll({ kind: "number", value: 10 }, [6, 6]), 14, {
      side: "hero",
      piercingTriggerFaces: TRIGGER,
    });
    expect(hit).toMatchObject({ hit: true, piercingTriggered: true });
    const miss = evaluateAttackRoll(diceRoll({ kind: "number", value: 10 }, []), 14, {
      side: "hero",
      piercingTriggerFaces: TRIGGER,
    });
    expect(miss).toMatchObject({ hit: false, piercingTriggered: false });
  });

  it("a weary roller voids the configured Success faces", () => {
    const voided = cfgs.conditions.wearyVoidedFaces; // e.g. [1,2,3]
    const f = voided[0] ?? 1;
    const r = evaluateAttackRoll(diceRoll({ kind: "number", value: 5 }, [f, 6]), 11, {
      side: "enemy",
      conditions: { weary: true, wearyVoidedFaces: voided },
      piercingTriggerFaces: TRIGGER,
    });
    expect(r.total).toBe(11); // 5 + (voided->0) + 6
  });
});

// --- resolveAttack: build a controllable combat state ---

function makeHero(): HeroState {
  return {
    attributes: { strength: 4, heart: 4, wits: 3 },
    skills: { swords: 3 },
    endurance: { current: 30, max: 30 },
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
  };
}

function makeFrame(over: Partial<HeroCombatFrame> = {}): HeroCombatFrame {
  return {
    stance: "open",
    parryRating: 6,
    armourProtection: 2,
    equippedWeapon: { group: "swords", damage: 5, injury: 16 },
    drivenBackUsedThisRound: false,
    ...over,
  };
}

function enemyBlock(over: Partial<EnemyStatBlock> = {}): EnemyStatBlock {
  return {
    key: "dummy",
    nameRu: "dummy",
    level: 3,
    endurance: 12,
    might: 1,
    pool: 2,
    poolKind: "hatred",
    parry: 0,
    armour: 1,
    weapons: [{ name: "blade", rating: 3, damage: 4, wound: 14, special: [] }],
    abilities: [],
    distinctive: [],
    ...over,
  };
}

function combatWith(enemy: EnemyStatBlock, frame?: HeroCombatFrame): CombatState {
  return {
    hero: makeHero(),
    heroFrame: frame ?? makeFrame(),
    enemies: [spawnEnemy(enemy)],
    round: 1,
    phase: "melee_rounds",
  };
}

const SEEDS = Array.from({ length: 60 }, (_, i) => `s${i}`);

describe("resolveAttack — hero attacks an enemy", () => {
  it("over many seeds: a hit removes Endurance = weapon Damage; a miss removes none", () => {
    const combat = combatWith(enemyBlock());
    const dmg = combat.heroFrame.equippedWeapon.damage;
    let hits = 0;
    let misses = 0;
    for (const seed of SEEDS) {
      const [out, next] = resolveAttack(combat, { attacker: "hero", target: { enemyIndex: 0 } }, cfgs, makeRng(seed));
      const before = combat.enemies[0]!.endurance;
      const after = next.enemies[0]!.endurance;
      if (out.hit) {
        hits++;
        expect(out.enduranceLoss).toBe(dmg);
        expect(after).toBe(Math.max(0, before - dmg));
      } else {
        misses++;
        expect(out.enduranceLoss).toBe(0);
        expect(after).toBe(before);
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(misses).toBeGreaterThan(0); // the test exercises both branches
  });

  it("destroys an enemy whose Endurance drops to 0", () => {
    const combat = combatWith(enemyBlock({ endurance: 5 })); // weapon damage 5 -> one hit destroys
    for (const seed of SEEDS) {
      const [out, next] = resolveAttack(combat, { attacker: "hero", target: { enemyIndex: 0 } }, cfgs, makeRng(seed));
      if (out.hit) {
        expect(out.targetDestroyed).toBe(true);
        expect(next.enemies[0]!.alive).toBe(false);
        expect(next.enemies[0]!.engaged).toBe(false);
      }
    }
  });

  it("a higher target parry makes hits rarer (parry feeds the TN)", () => {
    const rate = (parry: number): number => {
      const combat = combatWith(enemyBlock({ parry }));
      const h = SEEDS.filter(
        (s) => resolveAttack(combat, { attacker: "hero", target: { enemyIndex: 0 } }, cfgs, makeRng(s))[0].hit,
      ).length;
      return h / SEEDS.length;
    };
    expect(rate(4)).toBeLessThanOrEqual(rate(0));
  });

  it("the forward stance (+1 Success die) hits at least as often as open", () => {
    const rate = (stance: "open" | "forward"): number => {
      const combat = combatWith(enemyBlock(), makeFrame({ stance }));
      const h = SEEDS.filter(
        (s) => resolveAttack(combat, { attacker: "hero", target: { enemyIndex: 0 } }, cfgs, makeRng(s))[0].hit,
      ).length;
      return h;
    };
    expect(rate("forward")).toBeGreaterThanOrEqual(rate("open"));
  });

  it("spendable icons are exposed only on a hit", () => {
    const combat = combatWith(enemyBlock());
    for (const seed of SEEDS) {
      const [out] = resolveAttack(combat, { attacker: "hero", target: { enemyIndex: 0 } }, cfgs, makeRng(seed));
      if (!out.hit) expect(out.spendableIcons).toBe(0);
      else expect(out.spendableIcons).toBe(out.successIcons);
    }
  });
});

describe("resolveAttack — enemy attacks the hero", () => {
  it("a hit removes Endurance = enemy weapon Damage; driven-back halves it (round up)", () => {
    const combat = combatWith(enemyBlock());
    const enemyDmg = combat.enemies[0]!.block.weapons[0]!.damage; // 4
    for (const seed of SEEDS) {
      const plain = resolveAttack(combat, { attacker: { enemyIndex: 0 }, target: "hero" }, cfgs, makeRng(seed))[0];
      const driven = resolveAttack(
        combat,
        { attacker: { enemyIndex: 0 }, target: "hero", heroDrivenBack: true },
        cfgs,
        makeRng(seed),
      )[0];
      if (plain.hit) {
        expect(plain.enduranceLoss).toBe(enemyDmg);
        expect(driven.enduranceLoss).toBe(Math.ceil(enemyDmg / 2));
        expect(driven.drivenBackApplied).toBe(true);
      }
    }
  });

  it("driven-back is unavailable once already used this round", () => {
    const combat = combatWith(enemyBlock(), makeFrame({ drivenBackUsedThisRound: true }));
    const enemyDmg = combat.enemies[0]!.block.weapons[0]!.damage;
    for (const seed of SEEDS) {
      const [out] = resolveAttack(
        combat,
        { attacker: { enemyIndex: 0 }, target: "hero", heroDrivenBack: true },
        cfgs,
        makeRng(seed),
      );
      if (out.hit) {
        expect(out.drivenBackApplied).toBe(false);
        expect(out.enduranceLoss).toBe(enemyDmg);
      }
    }
  });

  it("knocks the hero unconscious at 0 Endurance", () => {
    const enemy = enemyBlock({ weapons: [{ name: "maul", rating: 6, damage: 30, wound: 18, special: [] }] });
    const combat = combatWith(enemy);
    for (const seed of SEEDS) {
      const [out, next] = resolveAttack(combat, { attacker: { enemyIndex: 0 }, target: "hero" }, cfgs, makeRng(seed));
      if (out.hit) {
        expect(out.heroUnconscious).toBe(true);
        expect(next.hero.endurance.current).toBe(0);
      }
    }
  });

  it("an enemy with no Hatred/Resolve rolls as weary (rejects nothing, just resolves)", () => {
    const combat = combatWith(enemyBlock({ pool: 0 }));
    // Should not throw; weary path supplies wearyVoidedFaces internally.
    expect(() =>
      resolveAttack(combat, { attacker: { enemyIndex: 0 }, target: "hero" }, cfgs, makeRng("w")),
    ).not.toThrow();
  });
});

describe("resolveAttack — guards", () => {
  it("rejects hero-vs-hero and enemy-vs-enemy", () => {
    const combat = combatWith(enemyBlock());
    expect(() => resolveAttack(combat, { attacker: "hero", target: "hero" }, cfgs, makeRng("x"))).toThrow();
    expect(() =>
      resolveAttack(combat, { attacker: { enemyIndex: 0 }, target: { enemyIndex: 0 } }, cfgs, makeRng("x")),
    ).toThrow();
  });
});

describe("anti-hardcode: deriveAttackConfig reflects the card, bakes nothing", () => {
  function card(parameters: unknown): unknown {
    return { payload: { parameters } };
  }
  it("reads driven-back count and Piercing trigger faces from the pack", () => {
    const real = deriveAttackConfig(pack.requireById("kv.mechanics.combat.sovershenie_atak").raw);
    expect(real.drivenBackTimesPerRound).toBe(1);
    expect(real.drivenBackHalveRoundUp).toBe(true);
    expect(real.piercingTriggerFaces).toEqual({ numbers: [10], eye: true });

    const stub = deriveAttackConfig(
      card({
        driven_back: { times_per_round: 3, effect: "halve_endurance_loss_round_up" },
        piercing_blow: { trigger_feat_die: [7, 8, "eye"] },
      }),
    );
    expect(stub.drivenBackTimesPerRound).toBe(3);
    expect(stub.piercingTriggerFaces).toEqual({ numbers: [7, 8], eye: true });
  });
});
