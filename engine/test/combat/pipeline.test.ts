import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { makeRng, type Rng } from "../../src/rng/rng.js";
import { newEyeState } from "../../src/eye/initial.js";
import { eyeConfigFromPack } from "../../src/eye/fromPack.js";
import { combatConfigsFromPack } from "../../src/combat/configs.js";
import { spawnEnemy } from "../../src/combat/enemy.js";
import { resolveFullAttack } from "../../src/combat/pipeline.js";
import type { SpecialDamageSpends } from "../../src/combat/specialDamage.js";
import type { CombatState, EnemyStatBlock, HeroCombatFrame } from "../../src/combat/types.js";
import type { HeroState } from "../../src/hero/state.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const pack = loadPack(nodePackSource(packRoot));
const cfgs = combatConfigsFromPack(pack);

function makeHero(over: Partial<HeroState> = {}): HeroState {
  return {
    attributes: { strength: 5, heart: 4, wits: 3 },
    skills: { swords: 4 },
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
    ...over,
  };
}

function makeFrame(over: Partial<HeroCombatFrame> = {}): HeroCombatFrame {
  return {
    stance: "open",
    parryRating: 4,
    armourProtection: 2,
    equippedWeapon: { group: "swords", damage: 5, injury: 16 },
    drivenBackUsedThisRound: false,
    parryBonusThisRound: 0,
    pendingRangedBonusDice: 0,
    outOfPosition: false,
    ...over,
  };
}

function enemyBlock(over: Partial<EnemyStatBlock> = {}): EnemyStatBlock {
  return {
    key: "dummy",
    nameRu: "учебный",
    level: 1,
    endurance: 40,
    might: 1,
    pool: 0, // weary -> no Hatred dice voiding here unless we set it
    poolKind: "hatred",
    parry: 0,
    armour: 1,
    weapons: [{ name: "клинок", rating: 3, damage: 6, wound: 14, special: [] }],
    abilities: [],
    distinctive: [],
    ...over,
  };
}

function combatWith(hero: HeroState, frame: HeroCombatFrame, block: EnemyStatBlock): CombatState {
  return { hero, heroFrame: frame, enemies: [spawnEnemy({ ...block })], round: 1, phase: "melee_rounds" };
}

/** Find a seed where the hero hits with >= minIcons success signs and does NOT trigger Piercing. */
function findHeroHitSeed(minIcons: number, combat: CombatState): { seed: string; rng: Rng } {
  for (let i = 0; i < 800; i++) {
    const seed = `hit-${minIcons}-${i}`;
    const rng = makeRng(seed);
    const [res] = resolveFullAttack(combat, { attacker: "hero", target: { enemyIndex: 0 } }, undefined, cfgs, rng);
    if (res.base.hit && res.base.spendableIcons >= minIcons && !res.base.piercingTriggered) {
      return { seed, rng: makeRng(seed) };
    }
  }
  throw new Error(`no seed found with >=${minIcons} icons and no piercing`);
}

describe("resolveFullAttack — hero special damage applied to state (Debt #3)", () => {
  const hero = makeHero();
  const frame = makeFrame();
  const block = enemyBlock();
  const combat = combatWith(hero, frame, block);

  it("Heavy Blow adds STRENGTH to the enemy's Endurance loss", () => {
    const { rng } = findHeroHitSeed(1, combat);
    const params = { attacker: "hero" as const, target: { enemyIndex: 0 } };
    const [plain, afterPlain] = resolveFullAttack(combat, params, undefined, cfgs, rng);
    const [heavy, afterHeavy] = resolveFullAttack(combat, params, { heavyBlow: 1 }, cfgs, rng);

    const lostPlain = block.endurance - afterPlain.enemies[0]!.endurance;
    const lostHeavy = block.endurance - afterHeavy.enemies[0]!.endurance;
    expect(heavy.special?.extraEnduranceLoss).toBe(hero.attributes.strength);
    expect(lostHeavy - lostPlain).toBe(hero.attributes.strength);
    expect(plain.base.hit).toBe(true);
  });

  it("Fend Off raises the hero's PARRY for the round (parryBonusThisRound)", () => {
    const { rng } = findHeroHitSeed(1, combat);
    const spends: SpecialDamageSpends = { fendOff: true };
    const [res, after] = resolveFullAttack(combat, { attacker: "hero", target: { enemyIndex: 0 } }, spends, cfgs, rng);
    expect(res.special?.parryBonusThisRound).toBeGreaterThan(0);
    expect(after.heroFrame.parryBonusThisRound).toBe(res.special!.parryBonusThisRound);
  });

  it("Shield Thrust pushes the target down a die until round end", () => {
    const shielded = makeFrame({ hasShield: true });
    const lowLevel = combatWith(hero, shielded, enemyBlock({ level: 1 }));
    const { rng } = findHeroHitSeed(1, lowLevel);
    const spends: SpecialDamageSpends = { shieldThrust: true };
    const [res, after] = resolveFullAttack(lowLevel, { attacker: "hero", target: { enemyIndex: 0 } }, spends, cfgs, rng);
    expect(res.special?.shieldThrustApplied).toBe(true);
    expect(after.enemies[0]!.attackDiceModUntilRoundEnd).toBe(-cfgs.specialDamage.shieldThrust.targetMinusDice);
  });

  it("a miss applies no special damage even when spends are offered", () => {
    // Heavy parry so the hero usually misses; assert no special on the misses.
    const tough = combatWith(makeHero({ skills: { swords: 0 } }), makeFrame(), enemyBlock({ parry: 6 }));
    let misses = 0;
    for (let i = 0; i < 40; i++) {
      const [res, after] = resolveFullAttack(
        tough,
        { attacker: "hero", target: { enemyIndex: 0 } },
        { heavyBlow: 2 },
        cfgs,
        makeRng(`miss-${i}`),
      );
      if (!res.base.hit) {
        misses++;
        expect(res.special).toBeUndefined();
        expect(after.enemies[0]!.endurance).toBe(tough.enemies[0]!.endurance);
      }
    }
    expect(misses).toBeGreaterThan(0);
  });
});

describe("resolveFullAttack — Piercing leads to a Wound", () => {
  it("hero side: when Piercing triggers, a protection roll happens; a failed roll wounds the enemy", () => {
    const hero = makeHero();
    const frame = makeFrame();
    const block = enemyBlock({ armour: 0, might: 3 }); // no armour -> protection often fails; survives 1 wound
    const combat = combatWith(hero, frame, block);
    let pierced = 0;
    let wounded = 0;
    for (let i = 0; i < 200; i++) {
      const [res] = resolveFullAttack(
        combat,
        { attacker: "hero", target: { enemyIndex: 0 } },
        undefined,
        cfgs,
        makeRng(`pierce-${i}`),
      );
      if (res.base.piercingTriggered) {
        pierced++;
        expect(res.piercing).toBeDefined();
        if (res.wound !== undefined) {
          wounded++;
          expect(res.piercing!.woundTriggered).toBe(true);
        }
      } else {
        expect(res.piercing).toBeUndefined();
      }
    }
    expect(pierced).toBeGreaterThan(0);
    expect(wounded).toBeGreaterThan(0);
  });

  it("enemy side: a Piercing enemy hit can wound the hero through a failed protection roll", () => {
    const hero = makeHero();
    const frame = makeFrame({ armourProtection: 0 }); // no protection dice -> wounds land
    const block = enemyBlock({ weapons: [{ name: "пика", rating: 4, damage: 6, wound: 18, special: [] }] });
    const combat = combatWith(hero, frame, block);
    let wounded = 0;
    for (let i = 0; i < 200; i++) {
      const [res, after] = resolveFullAttack(
        combat,
        { attacker: { enemyIndex: 0 }, target: "hero" },
        undefined,
        cfgs,
        makeRng(`ewound-${i}`),
      );
      if (res.wound !== undefined) {
        wounded++;
        expect(after.hero.wounded).toBe(true);
        expect(res.piercing?.woundTriggered).toBe(true);
      }
    }
    expect(wounded).toBeGreaterThan(0);
  });
});

describe("resolveFullAttack — determinism", () => {
  it("same seed + same spends -> identical result and state", () => {
    const combat = combatWith(makeHero(), makeFrame(), enemyBlock());
    const a = resolveFullAttack(combat, { attacker: "hero", target: { enemyIndex: 0 } }, { heavyBlow: 1 }, cfgs, makeRng("d"));
    const b = resolveFullAttack(combat, { attacker: "hero", target: { enemyIndex: 0 } }, { heavyBlow: 1 }, cfgs, makeRng("d"));
    expect(a[0]).toEqual(b[0]);
    expect(a[1]).toEqual(b[1]);
  });
});
