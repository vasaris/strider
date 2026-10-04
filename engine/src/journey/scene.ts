import type { CheckResult } from "../checks/types.js";
import { rollFeatWithModifier } from "../dice/featDie.js";
import { rollSuccessDie } from "../dice/successDie.js";
import type { FeatModifier } from "../dice/types.js";
import { applyEyeAwarenessDelta, growthFromFeatDie } from "../eye/growth.js";
import { featFaceKey, type FaceKey } from "../oracles/types.js";
import type { Rng } from "../rng/rng.js";
import type { JourneyConfigs, JourneySceneRow, SceneBias, SceneDetailRow } from "./config.js";
import { runSkillCheckWithRoll } from "./check.js";
import { applyEffects, fatigueWaived, shadowEyeGrowth } from "./effects.js";
import type { CheckRoll, Consequence, JourneyEvent, JourneyState, SceneDraw } from "./state.js";

function biasToModifier(bias: SceneBias): FeatModifier {
  return bias === "plain" ? "normal" : bias;
}

function matchSceneRow(rows: readonly JourneySceneRow[], face: FaceKey): JourneySceneRow {
  for (const row of rows) {
    if (row.face !== undefined && row.face === face) return row;
    if (row.range && typeof face === "number" && face >= row.range.min && face <= row.range.max) return row;
  }
  throw new Error(`resolveScene: no scene row matches face ${JSON.stringify(face)}`);
}

function sceneRowOf(cfg: JourneyConfigs, sceneType: string): JourneySceneRow {
  const row = cfg.scenes.rows.find((r) => r.sceneType === sceneType);
  if (!row) throw new Error(`resolveScene: no scene row for scene type "${sceneType}"`);
  return row;
}

function consequenceFires(c: Consequence, outcome: "success" | "failure"): boolean {
  return (c.trigger === "on_success" && outcome === "success") || (c.trigger === "on_failure" && outcome === "failure");
}

/** A detail row with no check: flagged significant, or naming no skill. */
export function isSignificantDetail(detail: SceneDetailRow): boolean {
  return detail.significantEncounter || detail.skill === null;
}

/**
 * Draw a journey scene (kv.solo.journey_scenes + scene_details.*): the Feat die under the
 * regional modifier picks the scene type, then a Success die picks the detail row. Draws
 * exactly these dice, in this order; nothing is resolved here.
 */
export function drawScene(state: JourneyState, cfg: JourneyConfigs): readonly [SceneDraw, Rng] {
  const modifier = biasToModifier(cfg.scenes.bias[state.journey.route.region]);
  const [{ chosen, candidates }, rng1] = rollFeatWithModifier(cfg.dice.feat, modifier, state.rng);
  const sceneRow = matchSceneRow(cfg.scenes.rows, featFaceKey(chosen));

  const detailTable = cfg.detailTables.get(sceneRow.sceneType);
  if (!detailTable) throw new Error(`resolveScene: no detail table for scene type "${sceneRow.sceneType}"`);
  const [detailDie, rng2] = rollSuccessDie(cfg.dice.success, rng1);
  const detail = detailTable.rows.find((r) => r.face === detailDie.face);
  if (!detail) throw new Error(`resolveScene: detail "${sceneRow.sceneType}" has no row for ${detailDie.face}`);

  const draw: SceneDraw = {
    sceneType: sceneRow.sceneType,
    detail,
    tableRoll: { feat: chosen.physicalFace, candidates: candidates.map((c) => c.physicalFace), modifier },
    detailDie: detailDie.face,
  };
  return [draw, rng2] as const;
}

/** What resolving a drawn scene changed: the next state and the Eye growth by source. */
export interface SceneResolution {
  readonly state: JourneyState;
  readonly checkEyeDelta: number; // Eye of the hero's scene check (0 on an encounter)
  readonly shadowEyeDelta: number; // growth from Shadow gained through the consequence
}

/**
 * The shared tail of every scene: Eye growth, then the consequence effects, then the scene
 * fatigue (unless waived), then the scene event. `check` is the hero's skill check, or null
 * for a significant encounter.
 */
function applyScene(
  state: JourneyState,
  draw: SceneDraw,
  check: CheckResult | null,
  cfg: JourneyConfigs,
): SceneResolution {
  const sceneRow = sceneRowOf(cfg, draw.sceneType);
  const significant = check === null;
  // R2 (3.3a): Eye Awareness grows ONLY for an Eye on a HERO check -- here the scene skill
  // check (the Travel check is handled in travelBeat). The scene-table Feat die never grows it,
  // nor does any other table roll (answers, detection). Grounds:
  //   KV p.113  the Keeper (not the player) rolls the journey-scenes Feat die;
  //   KV p.170  Awareness +1 each time an Eye shows on a roll BY A PLAYER out of combat,
  //             regardless of the check result;
  //   IdO p.10  an Eye on the luck table LOWERS Awareness by 1 (a table Eye is not a +1);
  //   IdO p.15  an Eye on the misfortune table adds +2 "on top of" the Eye that triggered the
  //             roll -- the table roll's own Eye does not add +1.
  // Danger zones (runDangerZone -> resolveScene) inherit this.
  const eyeDelta = check !== null && check.isEyeOnFeat ? growthFromFeatDie(true, false, cfg.eye) : 0;
  const applied: Consequence["effects"] =
    check !== null && consequenceFires(sceneRow.consequence, check.outcome) ? sceneRow.consequence.effects : [];

  const waived = fatigueWaived(applied);
  const fatigueGained = waived ? 0 : sceneRow.fatigueGain;

  // Thread state: eye growth from the check, then consequence effects, then fatigue.
  let next: JourneyState = { ...state, hero: { ...state.hero, eye: applyEyeAwarenessDelta(state.hero.eye, eyeDelta) } };
  next = applyEffects(next, applied, cfg);
  next = { ...next, hero: { ...next.hero, fatigue: next.hero.fatigue + fatigueGained } };

  const event: JourneyEvent = {
    kind: "scene",
    sceneType: draw.sceneType,
    detailScene: draw.detail.scene,
    detail: draw.detail, // SD1 (Fork A): surface the full rolled row; numbers/RNG unchanged
    skill: significant ? null : draw.detail.skill,
    significantEncounter: significant,
    checkOutcome: check === null ? null : check.outcome,
    fatigueGained,
    appliedOps: applied.map((e) => e.op),
    eyeDelta,
  };
  return {
    state: { ...next, log: [...next.log, event] },
    checkEyeDelta: eyeDelta,
    shadowEyeDelta: shadowEyeGrowth(applied, cfg),
  };
}

/** Resolve a drawn significant encounter: no check, no consequence; scene fatigue applies. */
export function resolveEncounter(state: JourneyState, draw: SceneDraw, cfg: JourneyConfigs): SceneResolution {
  if (!isSignificantDetail(draw.detail)) throw new Error(`resolveEncounter: "${draw.sceneType}" detail ${draw.detailDie} has a check`);
  return applyScene(state, draw, null, cfg);
}

/**
 * Resolve a drawn scene from the hero's (already rolled) skill check: the consequence fires
 * when its trigger matches the outcome.
 */
export function resolveSceneCheck(state: JourneyState, draw: SceneDraw, check: CheckResult, cfg: JourneyConfigs): SceneResolution {
  if (isSignificantDetail(draw.detail)) throw new Error(`resolveSceneCheck: "${draw.sceneType}" detail ${draw.detailDie} has no check`);
  return applyScene(state, draw, check, cfg);
}

/**
 * Resolve a single journey scene (kv.solo.journey_scenes + scene_details.*):
 *   1. Feat die with regional bias -> scene type.
 *   2. Success die -> detail row (specific scene + which skill, or a significant
 *      encounter with no check).
 *   3. The hero makes that skill check; the scene consequence fires when its
 *      trigger matches the outcome.
 *   4. Scene fatigue accrues unless waived; the Eye grows by 1 when the hero's check
 *      showed the Eye (out of combat).
 */
export function resolveScene(state: JourneyState, cfg: JourneyConfigs): readonly [JourneyState, CheckResult | null] {
  const [next, check] = resolveSceneWithRoll(state, cfg);
  return [next, check] as const;
}

/**
 * resolveScene that also returns the raw dice of the scene's skill check (CheckRoll; null
 * exactly when the check is null). One code path: resolveScene delegates here, and the
 * journey beats (travelBeat / checkBeat) use the same drawScene / resolveEncounter /
 * resolveSceneCheck, so the RNG draws and the resulting state are identical.
 */
export function resolveSceneWithRoll(
  state: JourneyState,
  cfg: JourneyConfigs,
): readonly [JourneyState, CheckResult | null, CheckRoll | null] {
  const [draw, rng] = drawScene(state, cfg);
  const drawn: JourneyState = { ...state, rng };
  if (isSignificantDetail(draw.detail) || draw.detail.skill === null) {
    return [resolveEncounter(drawn, draw, cfg).state, null, null] as const;
  }
  const [check, checkRoll, rngAfter] = runSkillCheckWithRoll(state.hero, draw.detail.skill, cfg, rng);
  return [resolveSceneCheck({ ...drawn, rng: rngAfter }, draw, check, cfg).state, check, checkRoll] as const;
}
