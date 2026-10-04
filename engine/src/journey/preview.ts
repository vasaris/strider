import { spendHopeForDice } from "../checks/hope.js";
import type { CheckConditions } from "../checks/types.js";
import { isMiserable, isWeary, totalLoad } from "../conditions/index.js";
import type { DiceConfig } from "../dice/config.js";
import { featDieResultOfFace, keptFeatDie } from "../dice/featDie.js";
import type { FeatDieResult, FeatModifier } from "../dice/types.js";
import { skillCheckSetup, type SkillCheckSetup } from "./check.js";
import type { JourneyConfigs } from "./config.js";
import type { Attribute, HeroState } from "./state.js";

/**
 * What the roll panel shows before the player rolls a journey skill check (Travel check or
 * scene check): the dice, target number, Feat modifier with its reasons, the Hope spend on
 * offer, the conditions in force, and the exact success odds with and without the spend.
 */
export interface CheckPreview {
  readonly skill: string;
  readonly rating: number; // skill rating = base Success dice
  readonly attribute: Attribute;
  readonly attributeRating: number;
  readonly tn: number;
  readonly featModifier: FeatModifier;
  readonly reasons: readonly "overwhelmed"[]; // why featModifier is not normal; [] when normal
  readonly inspired: boolean;
  // bonusDice: what a spend would yield now (0 when !canSpend); canSpend iff spendHopeForDice(spend 1) would yield dice
  readonly hope: { readonly current: number; readonly max: number; readonly canSpend: boolean; readonly bonusDice: number };
  readonly weary: { readonly active: boolean; readonly voidedFaces: readonly number[]; readonly endurance: number; readonly load: number };
  readonly miserable: { readonly now: boolean; readonly afterSpend: boolean };
  readonly odds: { readonly base: number; readonly withHope: number | null }; // withHope null when !canSpend
}

/**
 * Exact P(outcome === "success") of a check, by enumeration over the DiceConfig faces (no RNG):
 * every Feat-die combination under the modifier (the kept die by keptFeatDie, as rolled), and
 * every Success-die face sequence of `successDice` dice (a weary-voided face counts 0). The
 * Gandalf rune succeeds, miserable + Eye fails, otherwise success iff total >= TN -- the
 * evaluateCheck rules. Outcomes are counted as integers and divided once.
 */
export function checkSuccessOdds(
  dice: DiceConfig,
  featModifier: FeatModifier,
  successDice: number,
  tn: number,
  conditions: CheckConditions,
): number {
  // Number of Success-dice face sequences per counted sum (index = sum).
  const voided = conditions.weary === true ? (conditions.wearyVoidedFaces ?? []) : [];
  let sums: number[] = [1];
  for (let i = 0; i < successDice; i++) {
    const nextSums: number[] = new Array<number>(sums.length + dice.success.sides).fill(0);
    sums.forEach((ways, sum) => {
      for (let face = 1; face <= dice.success.sides; face++) {
        const value = voided.includes(face) ? 0 : face;
        nextSums[sum + value] = (nextSums[sum + value] ?? 0) + ways;
      }
    });
    sums = nextSums;
  }
  const successSequences = dice.success.sides ** successDice;
  const waysAtLeast = (need: number): number => sums.reduce((acc, ways, sum) => (sum >= need ? acc + ways : acc), 0);

  // Every Feat-die combination (physical faces, roll order) -> the kept die.
  const count = featModifier === "normal" ? dice.feat.normalDiceCount : dice.feat.modifiedDiceCount;
  const faces: FeatDieResult[] = [];
  for (let f = 1; f <= dice.feat.sides; f++) faces.push(featDieResultOfFace(f, dice.feat));
  let combos: FeatDieResult[][] = [[]];
  for (let i = 0; i < count; i++) combos = combos.flatMap((c) => faces.map((f) => [...c, f]));

  let successes = 0;
  for (const combo of combos) {
    const kept = keptFeatDie(featModifier, combo);
    if (kept.isAutoSuccess) successes += successSequences;
    else if (conditions.miserable === true && kept.isEye) continue;
    else successes += waysAtLeast(tn - kept.numericValue);
  }
  return successes / (combos.length * successSequences);
}

function oddsOf(setup: SkillCheckSetup, bonusDice: number, cfg: JourneyConfigs): number {
  return checkSuccessOdds(cfg.dice, setup.featModifier, setup.rating + bonusDice, setup.tn, setup.conditions);
}

/**
 * Preview a journey skill check for the hero, as the beats would roll it: the same
 * skillCheckSetup runSkillCheckWithRoll uses (TN, Feat modifier, conditions), and the same
 * Hope spend rule (spendHopeForDice; inspired = hero.inspired; conditions after the spend).
 * No RNG.
 */
export function previewCheck(hero: HeroState, skill: string, cfg: JourneyConfigs): CheckPreview {
  const setup = skillCheckSetup(hero, skill, cfg);
  const spend = spendHopeForDice({ hopeCurrent: hero.hope.current, spend: 1, inspired: hero.inspired }, cfg.checks);
  const canSpend = spend.bonusSuccessDice > 0;
  const spentHero: HeroState = { ...hero, hope: { ...hero.hope, current: spend.hopePatch.current } };
  const afterSpend = skillCheckSetup(spentHero, skill, cfg);
  return {
    skill,
    rating: setup.rating,
    attribute: setup.attribute,
    attributeRating: setup.attributeRating,
    tn: setup.tn,
    featModifier: setup.featModifier,
    reasons: setup.reasons,
    inspired: hero.inspired,
    hope: { current: hero.hope.current, max: hero.hope.max, canSpend, bonusDice: canSpend ? spend.bonusSuccessDice : 0 },
    weary: { active: isWeary(hero), voidedFaces: cfg.conditions.wearyVoidedFaces, endurance: hero.endurance.current, load: totalLoad(hero) },
    miserable: { now: isMiserable(hero), afterSpend: isMiserable(spentHero) },
    odds: { base: oddsOf(setup, 0, cfg), withHope: canSpend ? oddsOf(afterSpend, spend.bonusSuccessDice, cfg) : null },
  };
}
