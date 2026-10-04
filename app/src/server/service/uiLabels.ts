// The pack's UI labels sidecar (K5.1): content-packs/kv/ui_labels.json. Russian names for ids the
// app shows that have no STRUCTURED name in the pack (the pack names them only inside rule text):
// regions, trackers, the failure outcome, the dying condition (K5.1), the favoured / ill-favoured
// roll modifiers and the keeper role (K5.2). Each entry carries verbatim evidence
// from a verified card; labels.ts checks that evidence against the loaded pack when it builds the
// catalog, and a structured pack name always wins over a sidecar entry.
//
// Like tone.stoplist.json the sidecar is NOT in manifest.content[]: loadPack never indexes it, it
// is read here by path and does not affect pack_version. Structural validation only; any shape
// error, and anything but verified:true, throws (unverified data never loads).
import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const UI_LABELS_FILE = 'ui_labels.json';

export const UI_LABEL_GROUPS = ['region', 'outcome', 'condition', 'tracker', 'roll', 'role'] as const;
export type UiLabelGroup = (typeof UI_LABEL_GROUPS)[number];

export interface UiLabelEntry {
  readonly group: UiLabelGroup;
  readonly id: string;
  readonly name_ru: string;
  readonly source_card: string;
  readonly evidence: string;
}

const ENTRY_KEYS = ['group', 'id', 'name_ru', 'source_card', 'evidence'] as const;

function fail(msg: string): never {
  throw new Error(`ui labels: ${msg}`);
}

const obj = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Validate a parsed ui_labels.json document and return its entries. Throws loudly on any error. */
export function loadUiLabels(doc: unknown): readonly UiLabelEntry[] {
  const o = obj(doc) ?? fail('not an object');
  if (o['type'] !== 'ui_labels') fail('type must be "ui_labels"');
  if (o['verified'] !== true) fail('verified must be true (unverified labels never load)');
  const entries = obj(o['payload'])?.['entries'];
  if (!Array.isArray(entries) || entries.length === 0) fail('payload.entries must be a non-empty array');
  const seen = new Set<string>();
  return entries.map((e: unknown, i): UiLabelEntry => {
    const eo = obj(e) ?? fail(`entries[${i}] is not an object`);
    const keys = Object.keys(eo);
    const extra = keys.filter((k) => !(ENTRY_KEYS as readonly string[]).includes(k));
    if (extra.length > 0) fail(`entries[${i}] has unknown field(s) ${extra.join(', ')}`);
    for (const k of ENTRY_KEYS) {
      const v = eo[k];
      if (typeof v !== 'string' || v === '') fail(`entries[${i}].${k} must be a non-empty string`);
    }
    const group = eo['group'] as string;
    if (!(UI_LABEL_GROUPS as readonly string[]).includes(group)) fail(`entries[${i}].group "${group}" is not one of ${UI_LABEL_GROUPS.join(', ')}`);
    const id = eo['id'] as string;
    const key = `${group}:${id}`;
    if (seen.has(key)) fail(`entries[${i}] duplicates ${key}`);
    seen.add(key);
    return {
      group: group as UiLabelGroup,
      id,
      name_ru: eo['name_ru'] as string,
      source_card: eo['source_card'] as string,
      evidence: eo['evidence'] as string,
    };
  });
}

/** Load `<packRoot>/ui_labels.json`. */
export function loadUiLabelsFromPack(packRoot: string): readonly UiLabelEntry[] {
  return loadUiLabels(JSON.parse(readFileSync(join(packRoot, UI_LABELS_FILE), 'utf8')));
}
