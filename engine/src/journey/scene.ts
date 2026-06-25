import { rollFeatWithModifier } from "../dice/featDie.js";
import { rollSuccessDie } from "../dice/successDie.js";
import { applyEyeAwarenessDelta, growthFromFeatDie } from "../eye/growth.js";
import { featFaceKey, type FaceKey } from "../oracles/types.js";
import type { JourneyConfigs, JourneySceneRow, SceneBias } from "./config.js";
import { runSkillCheck } from "./check.js";
import { applyEffects, fatigueWaived } from "./effects.js";
import type { Consequence, JourneyEvent, JourneyState } from "./state.js";

function biasToModifier(bias: SceneBias): "normal" | "favoured" | "ill_favoured" {
  return bias === "plain" ? "normal" : bias;
}

function matchSceneRow(rows: readonly JourneySceneRow[], face: FaceKey): JourneySceneRow {
  for (const row of rows) {
    if (row.face !== undefined && row.face === face) return row;
    if (row.range && typeof face === "number" && face >= row.range.min && face <= row.range.max) return row;
  }
  throw new Error(`resolveScene: no scene row matches face ${JSON.stringify(face)}`);
}

function consequenceFires(c: Consequence, outcome: "success" | "failure"): boolean {
  return (c.trigger === "on_success" && outcome === "success") || (c.trigger === "on_failure" && outcome === "failure");
}

/**
 * Resolve a single journey scene (kv.solo.journey_scenes + scene_details.*):
 *   1. Feat die with regional bias -> scene type.
 *   2. Success die -> detail row (specific scene + which skill, or a significant
 *      encounter with no check).
 *   3. The hero makes that skill check; the scene consequence fires when its
 *      trigger matches the outcome.
 *   4. Scene fatigue accrues unless waived; the Eye grows by 1 per Feat die that
 *      showed the Eye (out of combat).
 */
export function resolveScene(state: JourneyState, cfg: JourneyConfigs): JourneyState {
  const modifier = biasToModifier(cfg.scenes.bias[state.journey.route.region]);
  const [{ chosen }, rng1] = rollFeatWithModifier(cfg.dice.feat, modifier, state.rng);
  const sceneRow = matchSceneRow(cfg.scenes.rows, featFaceKey(chosen));

  let eyeDelta = growthFromFeatDie(chosen.isEye, false, cfg.eye);

  const detail = cfg.detailTables.get(sceneRow.sceneType);
  if (!detail) throw new Error(`resolveScene: no detail table for scene type "${sceneRow.sceneType}"`);
  const [detailDie, rng2] = rollSuccessDie(cfg.dice.success, rng1);
  const detailRow = detail.rows.find((r) => r.face === detailDie.face);
  if (!detailRow) throw new Error(`resolveScene: detail "${sceneRow.sceneType}" has no row for ${detailDie.face}`);

  const significant = detailRow.significantEncounter || detailRow.skill === null;
  let rng = rng2;
  let checkOutcome: "success" | "failure" | null = null;
  let applied: Consequence["effects"] = [];

  if (!significant && detailRow.skill !== null) {
    const [result, rngAfter] = runSkillCheck(state.hero, detailRow.skill, cfg, rng2);
    rng = rngAfter;
    checkOutcome = result.outcome;
    if (result.isEyeOnFeat) eyeDelta += growthFromFeatDie(true, false, cfg.eye);
    if (consequenceFires(sceneRow.consequence, result.outcome)) applied = sceneRow.consequence.effects;
  }

  const waived = fatigueWaived(applied);
  const fatigueGained = waived ? 0 : sceneRow.fatigueGain;

  // Thread state: eye growth from Feat dice, then consequence effects, then fatigue.
  let next: JourneyState = { ...state, rng };
  next = { ...next, hero: { ...next.hero, eye: applyEyeAwarenessDelta(next.hero.eye, eyeDelta) } };
  next = applyEffects(next, applied, cfg);
  next = { ...next, hero: { ...next.hero, fatigue: next.hero.fatigue + fatigueGained } };

  const event: JourneyEvent = {
    kind: "scene",
    sceneType: sceneRow.sceneType,
    detailScene: detailRow.scene,
    skill: significant ? null : detailRow.skill,
    significantEncounter: significant,
    checkOutcome,
    fatigueGained,
    appliedOps: applied.map((e) => e.op),
    eyeDelta,
  };
  return { ...next, log: [...next.log, event] };
}
