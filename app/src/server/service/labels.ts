// Human labels for the ids a turn's package shows (K4): every label is pack data, resolved here on
// the server from the verified pack -- no setting name is written in app source. An id without a
// pack label is shown as the id itself.
//
// Sources (all in content-packs/kv, read through loadPack):
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
//               extraordinary). The pack has no label for 'failure': it is shown as the id.
// Categories are separate maps because ids collide across them (a skill and an oracle table can
// share an id).
import 'server-only';

import type { CheckOutcome, NarrativePackage } from '@brodyazhnik/orchestrator';

/** The slice of a loaded pack this module reads (engine's Pack satisfies it). */
export interface LabelPack {
  getById(id: string): { readonly id: string; readonly raw: unknown } | undefined;
  listByType(type: string): readonly { readonly id: string; readonly raw: unknown }[];
}

export const LABEL_CATEGORIES = ['scenes', 'skills', 'conditions', 'outcomes'] as const;
export type LabelCategory = (typeof LABEL_CATEGORIES)[number];

/** category -> id -> label. */
export type Labels = { readonly [C in LabelCategory]: Readonly<Record<string, string>> };

const SCENES_CARD = 'kv.mechanics.journey.razygryvanie_stsen_puteshestviya';
const SKILLS_CARD = 'kv.mechanics.traits.spisok_navykov';
const CONDITION_PREFIX = 'kv.mechanics.conditions.';
const DEGREES_CARD = 'kv.mechanics.checks.degree_of_success';
const OUTCOME_BY_TIER: readonly CheckOutcome[] = ['weak', 'strong', 'extraordinary'];

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

/** The full label catalog of a pack. Throws loudly when a source card is missing or misshapen. */
export function packLabels(pack: LabelPack): Labels {
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

  return { scenes, skills, conditions, outcomes };
}

/** The ids of each category that a package shows. */
export function packageIds(pkg: NarrativePackage): { readonly [C in LabelCategory]: readonly string[] } {
  const scenes: string[] = [];
  const skills: string[] = [];
  const outcomes: string[] = [];
  if (pkg.oracle?.table === 'journey_scenes') scenes.push(pkg.oracle.result_ref);
  const skill = pkg.oracle?.detail?.row?.skill ?? pkg.oracle?.row?.skill;
  if (typeof skill === 'string') skills.push(skill);
  for (const o of [pkg.dice?.outcome, pkg.journey?.travel_check.outcome]) if (o !== undefined) outcomes.push(o);
  const conditions = [...(pkg.patch?.conditions_gained ?? []), ...(pkg.patch?.conditions_cleared ?? [])];
  return { scenes, skills, conditions, outcomes };
}

/** Labels for exactly the ids the packages show: the pack label, else the id itself. */
export function labelsFor(catalog: Labels, pkgs: readonly NarrativePackage[]): Labels {
  const out = { scenes: {}, skills: {}, conditions: {}, outcomes: {} } as { [C in LabelCategory]: Record<string, string> };
  for (const pkg of pkgs) {
    const ids = packageIds(pkg);
    for (const c of LABEL_CATEGORIES) {
      for (const id of ids[c]) out[c][id] = Object.hasOwn(catalog[c], id) ? (catalog[c][id] as string) : id;
    }
  }
  return out;
}
