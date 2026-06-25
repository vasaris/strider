import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { diceConfigFromPack } from "../../src/pack/configFromPack.js";
import { oraclesFromPack } from "../../src/oracles/fromPack.js";
import { rollAnswer } from "../../src/oracles/answers.js";
import { enemyStatBlockFromPack } from "../../src/combat/fromPack.js";
import { spawnEnemy } from "../../src/combat/enemy.js";
import { resolveEnemySurvival, rollEnemyDecision } from "../../src/combat/soloConduct.js";
import type { EnemyState } from "../../src/combat/types.js";
import { makeRng } from "../../src/rng/rng.js";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = resolve(here, "../../..", "content-packs/kv");
const pack = loadPack(nodePackSource(packRoot));
const answers = oraclesFromPack(pack).answers;
const dice = diceConfigFromPack(pack);

const ORKI = "kv.mechanics.adversaries.orki";
const chief = () => spawnEnemy(enemyStatBlockFromPack(pack, ORKI, "velikiy_ork_glavar"));
const takenOut = (): EnemyState => ({ ...chief(), endurance: 0, engaged: false });

const SEEDS = Array.from({ length: 40 }, (_, i) => `conduct-${i}`);

describe("rollEnemyDecision — thin, deterministic adapter over the answers oracle", () => {
  it("is deterministic on a seed", () => {
    const a = rollEnemyDecision(answers, "activate_ability", "likely", dice, makeRng("s1"))[0];
    const b = rollEnemyDecision(answers, "activate_ability", "likely", dice, makeRng("s1"))[0];
    expect(a).toEqual(b);
  });

  it("carries the decision kind through unchanged", () => {
    const [r] = rollEnemyDecision(answers, "press_or_flee", null, dice, makeRng("s2"));
    expect(r.kind).toBe("press_or_flee");
    expect(["yes", "no"]).toContain(r.answer);
  });

  it("matches rollAnswer exactly for the same seed and likelihood (no reimplementation)", () => {
    for (const seed of SEEDS) {
      const [decision] = rollEnemyDecision(answers, "surrender", "even", dice, makeRng(seed));
      const [oracle] = rollAnswer(answers, "even", dice, makeRng(seed));
      expect(decision.answer).toBe(oracle.answer);
      expect(decision.extreme).toBe(oracle.extreme);
      expect(decision.featFace).toBe(oracle.featFace);
      expect(decision.specialText).toBe(oracle.specialText);
    }
  });

  it("propagates the rune/Eye extreme flag (some seed produces each special face)", () => {
    const faces = SEEDS.map((s) => rollEnemyDecision(answers, "activate_ability", "even", dice, makeRng(s))[0]);
    const rune = faces.find((r) => r.featFace === "gandalf_rune");
    const eye = faces.find((r) => r.featFace === "eye");
    if (rune) {
      expect(rune.answer).toBe("yes");
      expect(rune.extreme).toBe(true);
    }
    if (eye) {
      expect(eye.answer).toBe("no");
      expect(eye.extreme).toBe(true);
    }
    // The 40-seed sweep must surface at least one special face, else the claim is untested.
    expect(rune || eye).toBeTruthy();
  });
});

describe("resolveEnemySurvival — wires the survives_defeat decision through afterBattle", () => {
  it("a 'yes' keeps the enemy alive, a 'no' kills it; the state matches the oracle", () => {
    let sawYes = false;
    let sawNo = false;
    for (const seed of SEEDS) {
      const [resolved, result] = resolveEnemySurvival(takenOut(), answers, "even", dice, makeRng(seed));
      expect(result.kind).toBe("survives_defeat");
      if (result.answer === "yes") {
        sawYes = true;
        expect(resolved.alive).toBe(true);
      } else {
        sawNo = true;
        expect(resolved.alive).toBe(false);
      }
      expect(resolved.engaged).toBe(false); // out either way
    }
    expect(sawYes).toBe(true);
    expect(sawNo).toBe(true);
  });

  it("does not change an enemy that is not a survivable take-out (still rolls for the log)", () => {
    const up = chief();
    const [resolved, result] = resolveEnemySurvival(up, answers, "even", dice, makeRng("noop-1"));
    expect(resolved).toBe(up); // unchanged reference
    expect(result.kind).toBe("survives_defeat");
  });
});
