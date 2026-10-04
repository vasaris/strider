// Human labels for the ids the app shows (K4, K5.1, K5.2): every label is pack data, resolved here on
// the server from the verified pack -- no setting name is written in app source. Priority per
// (category, id): the STRUCTURED pack name -> the UI labels sidecar (uiLabels.ts) -> the id itself
// (the last step in labelsFor). A sidecar entry only fills a gap; it never overrides a structured
// name.
//
// Structured sources (content-packs/kv, read through loadPack):
//   scenes      journey scene types (oracle.result_ref of journey_scenes):
//               kv.mechanics.journey.razygryvanie_stsen_puteshestviya
//               payload.parameters.journey_scene_table.rows[<id>].name_ru
//   skills      skill ids (oracle.detail.row.skill): kv.mechanics.traits.spisok_navykov
//               payload.parameters.skills[<id>].name_ru
//   conditions  patch.conditions_gained / _cleared: the pack has no name_ru for conditions; the
//               title of the condition's rule card kv.mechanics.conditions.<id> is the label
//   outcomes    check degrees (dice.outcome, journey.travel_check.outcome):
//               kv.mechanics.checks.degree_of_success payload.parameters.tiers[i].label, tier i
//               mapped to the contract outcome the way the engine and orchestrator map it
//               (tier index -> success / great_success / extraordinary_success -> weak / strong /
//               extraordinary).
// The pack has no structured name for regions (session region), trackers (the patch's *_delta
// keys), the 'failure' outcome, the 'dying' condition, the roll modifiers (rolls: the dice's
// feat_modifier, favoured / ill_favoured) or the keeper role (roles: ROLE_IDS, named in UI text):
// those come from the sidecar content-packs/kv/ui_labels.json (group region / tracker / outcome /
// condition / roll / role). Every sidecar
// entry is checked here against the loaded pack (the evidence gate): its source card exists, is
// verified:true, and its evidence is a verbatim substring of the card's title or of an element of
// its payload.source_text -- else the catalog fails to build.
// Categories are separate maps because ids collide across them (a skill and an oracle table can
// share an id).
import 'server-only';

import type { CheckOutcome, NarrativePackage } from '@brodyazhnik/orchestrator';

import { ROLE_IDS, TRACKER_IDS } from '../../shared/api';
import type { UiLabelEntry, UiLabelGroup } from './uiLabels';

/** The slice of a loaded pack this module reads (engine's Pack satisfies it). */
export interface LabelPack {
  getById(id: string): { readonly id: string; readonly raw: unknown } | undefined;
  listByType(type: string): readonly { readonly id: string; readonly raw: unknown }[];
}

export const LABEL_CATEGORIES = ['scenes', 'skills', 'conditions', 'outcomes', 'regions', 'trackers', 'rolls', 'roles'] as const;
export type LabelCategory = (typeof LABEL_CATEGORIES)[number];

/** category -> id -> label. */
export type Labels = { readonly [C in LabelCategory]: Readonly<Record<string, string>> };

const SCENES_CARD = 'kv.mechanics.journey.razygryvanie_stsen_puteshestviya';
const SKILLS_CARD = 'kv.mechanics.traits.spisok_navykov';
const CONDITION_PREFIX = 'kv.mechanics.conditions.';
const DEGREES_CARD = 'kv.mechanics.checks.degree_of_success';
const OUTCOME_BY_TIER: readonly CheckOutcome[] = ['weak', 'strong', 'extraordinary'];

/** Sidecar group -> label category. */
export const CATEGORY_OF_GROUP: Readonly<Record<UiLabelGroup, LabelCategory>> = {
  region: 'regions',
  outcome: 'outcomes',
  condition: 'conditions',
  tracker: 'trackers',
  roll: 'rolls',
  role: 'roles',
};

type MutableLabels = { [C in LabelCategory]: Record<string, string> };
const emptyLabels = (): MutableLabels => Object.fromEntries(LABEL_CATEGORIES.map((c) => [c, {}])) as MutableLabels;

const obj = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

function fail(msg: string): never {
  throw new Error(`packLabels: ${msg}`);
}

function params(pack: LabelPack, id: string): Record<string, unknown> {
  const entry = pack.getById(id) ?? fail(`missing ${id}`);
  return obj(obj(obj(entry.raw)?.['payload'])?.['parameters']) ?? fail(`${id}: no payload.parameters`);
}

/** id -> name_ru over a map of objects (entries without a string name_ru are skipped). */
function nameRuMap(map: unknown, where: string): Record<string, string> {
  const m = obj(map) ?? fail(`${where}: not an object`);
  const out: Record<string, string> = {};
  for (const [id, v] of Object.entries(m)) {
    const name = obj(v)?.['name_ru'];
    if (typeof name === 'string' && name !== '') out[id] = name;
  }
  return out;
}

/**
 * The sidecar evidence gate: the entry's source card is in the pack, is verified:true, and the
 * evidence is a verbatim substring (no normalization) of its raw top-level title or of an element
 * of its raw payload.source_text (string[]; a single string is tolerated). Throws otherwise.
 */
export function checkEvidence(pack: LabelPack, e: UiLabelEntry): void {
  const what = `sidecar ${e.group}:${e.id}`;
  const card = pack.getById(e.source_card) ?? fail(`${what}: source card ${e.source_card} is not in the pack`);
  const raw = obj(card.raw) ?? fail(`${what}: source card ${e.source_card} is not an object`);
  if (raw['verified'] !== true) fail(`${what}: source card ${e.source_card} is not verified`);
  const st = obj(raw['payload'])?.['source_text'];
  const texts = [raw['title'], ...(Array.isArray(st) ? st : [st])].filter((t): t is string => typeof t === 'string');
  if (!texts.some((t) => t.includes(e.evidence))) {
    fail(`${what}: evidence is not a verbatim substring of the title or payload.source_text of ${e.source_card}`);
  }
}

/**
 * The full label catalog of a pack: structured pack names, gaps filled from the UI labels sidecar
 * (each sidecar entry evidence-checked first). Throws loudly when a source card is missing or
 * misshapen, or when a sidecar entry fails the evidence gate.
 */
export function packLabels(pack: LabelPack, uiLabels: readonly UiLabelEntry[]): Labels {
  const scenes = nameRuMap(obj(params(pack, SCENES_CARD)['journey_scene_table'])?.['rows'], `${SCENES_CARD} rows`);
  const skills = nameRuMap(params(pack, SKILLS_CARD)['skills'], `${SKILLS_CARD} skills`);

  const conditions: Record<string, string> = {};
  for (const e of pack.listByType('rule_card')) {
    if (!e.id.startsWith(CONDITION_PREFIX)) continue;
    const title = obj(e.raw)?.['title'];
    if (typeof title === 'string' && title !== '') conditions[e.id.slice(CONDITION_PREFIX.length)] = title;
  }

  const tiers = params(pack, DEGREES_CARD)['tiers'];
  if (!Array.isArray(tiers)) fail(`${DEGREES_CARD}: tiers is not an array`);
  const outcomes: Record<string, string> = {};
  tiers.forEach((t: unknown, i) => {
    const label = obj(t)?.['label'];
    const outcome = OUTCOME_BY_TIER[i];
    if (outcome !== undefined && typeof label === 'string' && label !== '') outcomes[outcome] = label;
  });

  const out: MutableLabels = { ...emptyLabels(), scenes, skills, conditions, outcomes };
  for (const e of uiLabels) {
    checkEvidence(pack, e);
    const cat = out[CATEGORY_OF_GROUP[e.group]];
    if (!Object.hasOwn(cat, e.id)) cat[e.id] = e.name_ru; // a structured name wins
  }
  return out;
}

/** The ids of each category that a package shows (regions and roles are not in packages: []).
 *  Trackers: the non-zero numeric `<id>_delta` keys of the patch, id = the key without `_delta`.
 *  Rolls: the feat_modifier of the scene check and of the travel roll (deduplicated). */
export function packageIds(pkg: NarrativePackage): { readonly [C in LabelCategory]: readonly string[] } {
  const scenes: string[] = [];
  const skills: string[] = [];
  const outcomes: string[] = [];
  if (pkg.oracle?.table === 'journey_scenes') scenes.push(pkg.oracle.result_ref);
  const skill = pkg.oracle?.detail?.row?.skill ?? pkg.oracle?.row?.skill;
  if (typeof skill === 'string') skills.push(skill);
  for (const o of [pkg.dice?.outcome, pkg.journey?.travel_check.outcome]) if (o !== undefined) outcomes.push(o);
  const conditions = [...(pkg.patch?.conditions_gained ?? []), ...(pkg.patch?.conditions_cleared ?? [])];
  const patch = (pkg.patch ?? {}) as Readonly<Record<string, unknown>>;
  const trackers = TRACKER_IDS.filter((id) => {
    const v = patch[`${id}_delta`];
    return typeof v === 'number' && v !== 0;
  });
  const rolls: string[] = [];
  for (const m of [pkg.dice?.feat_modifier, pkg.journey?.travel_check.feat_modifier]) if (m !== undefined && !rolls.includes(m)) rolls.push(m);
  return { scenes, skills, conditions, outcomes, regions: [], trackers, rolls, roles: [] };
}

/** Labels for exactly the ids the packages show, plus the given region ids, plus EVERY role of
 *  ROLE_IDS (so every response that carries labels names the keeper): the catalog label, else the
 *  id itself. */
export function labelsFor(catalog: Labels, pkgs: readonly NarrativePackage[], regions: readonly string[] = []): Labels {
  const out = emptyLabels();
  const put = (c: LabelCategory, id: string) => {
    out[c][id] = Object.hasOwn(catalog[c], id) ? (catalog[c][id] as string) : id;
  };
  for (const pkg of pkgs) {
    const ids = packageIds(pkg);
    for (const c of LABEL_CATEGORIES) for (const id of ids[c]) put(c, id);
  }
  for (const id of regions) put('regions', id);
  for (const id of ROLE_IDS) put('roles', id);
  return out;
}
