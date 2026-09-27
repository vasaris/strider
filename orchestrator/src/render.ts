// Package renderer: NarrativePackage -> the sectioned text body of the Keeper's user message.
//
// Lives here (package side) rather than in evals/ because the Stage 3.1.b server route
// reuses it: one rendering of the package for the harness and for production.
//
// Rules (narrative contract 2.1):
//   - LOSSLESS: every PRESENT field appears with its value.
//   - ABSENT -> OMITTED: a null/undefined field, an empty object (e.g. an unchanged-turn
//     patch `{}`) or an empty list emits nothing -- no heading, no "none"/"-" placeholder --
//     so the Keeper is never shown mechanics the package does not carry.
//   - OPAQUE VALUES VERBATIM, SPOOF-PROOF (A2.1, A3.1): every string value (scene/prompt/text/
//     notes/journal text/list elements...) passes through unquoted, unescaped and untrimmed. A
//     value with no line terminator renders inline (`key: value`, `- value`). A value containing
//     ANY of the 8 Unicode line terminators (CRLF, LF, CR, VT, FF, NEL, LS, PS -- see
//     LINE_TERMINATOR) renders as a block scalar: `key: |` / `- |`, then every value line (the
//     first included) indented by exactly 4 spaces, each terminator becoming a line boundary --
//     so no value line can start at column 0 and pass for package structure, for any consumer
//     (the model included) that breaks lines on any of them (section-spoof guard). Decoding
//     (strip the 4-space indent, join with '\n') returns the source with its terminators
//     normalized to '\n': the terminator KIND is the only reversibility loss.
//   - DETERMINISTIC: sections and fields follow a fixed order declared in code (contract
//     declaration order), never Object.keys of the input.
//
// Content-clean: ASCII structure only; VK content arrives at runtime as opaque values.

import type { DiceResult, NarrativePackage, OracleResult, StatePatchSummary } from './contract.js';

type Scalar = string | number | boolean | null | undefined;

const BLOCK_INDENT = '    ';

/** The 8 Unicode line terminators: CRLF (one terminator -- listed first so the alternation takes
 *  it whole), LF, CR, VT (U+000B), FF (U+000C), NEL (U+0085), LS (U+2028), PS (U+2029). So
 *  'a\r\nb' is one boundary and 'a\n\rb' is two. No `g` flag: test() stays stateless. */
const LINE_TERMINATOR = /\r\n|[\n\r\v\f\u0085\u2028\u2029]/;

/** The ONE path for every rendered value: `<prefix> <value>` when it has no line terminator;
 *  otherwise a block scalar `<prefix> |` followed by each value line (split on LINE_TERMINATOR)
 *  indented by BLOCK_INDENT. Never trims. */
function scalar(prefix: string, value: string): string[] {
  return LINE_TERMINATOR.test(value)
    ? [`${prefix} |`, ...value.split(LINE_TERMINATOR).map((l) => BLOCK_INDENT + l)]
    : [`${prefix} ${value}`];
}

/** A `key: value` field (via scalar), or nothing when the value is undefined. null renders as `null`. */
function field(key: string, value: Scalar): string[] {
  if (value === undefined) return [];
  return scalar(`${key}:`, value === null ? 'null' : String(value));
}

/** A scalar list joined with ', ' (via field); nothing when absent or empty. */
function listField(key: string, values: readonly (string | number)[] | undefined): string[] {
  if (values === undefined || values.length === 0) return [];
  return field(key, values.join(', '));
}

/** A heading followed by its body, or nothing when the body is empty. */
function section(heading: string, body: readonly string[]): string[] {
  return body.length === 0 ? [] : [heading, ...body];
}

function renderDice(d: DiceResult): string[] {
  return [
    ...field('feat_die', d.feat_die),
    ...field('feat_symbol', d.feat_symbol),
    ...listField('success_dice', d.success_dice),
    ...field('success_icons', d.success_icons),
    ...field('total', d.total),
    ...field('target_number', d.target_number),
    ...field('outcome', d.outcome),
  ];
}

/** Oracle body at a given nesting depth (0 = top level). The row comes before any detail
 *  block; a detail's heading gains one '#' per level ('### detail', '#### detail', ...). */
function renderOracle(o: OracleResult, depth: number): string[] {
  const lines = [...field('table', o.table), ...field('result_ref', o.result_ref)];
  const row = o.row;
  if (row !== null && row !== undefined) {
    lines.push(
      ...field('row.face', row.face),
      ...field('row.scene', row.scene),
      ...field('row.prompt', row.prompt),
      ...field('row.skill', row.skill),
      ...field('row.significant_encounter', row.significantEncounter),
    );
  }
  const detail = o.detail;
  if (detail !== null && detail !== undefined) {
    lines.push(...section(`${'#'.repeat(depth + 3)} detail`, renderOracle(detail, depth + 1)));
  }
  return lines;
}

function renderPatch(p: StatePatchSummary): string[] {
  const notes = p.notes ?? [];
  return [
    ...field('endurance_delta', p.endurance_delta),
    ...field('fatigue_delta', p.fatigue_delta),
    ...field('hope_delta', p.hope_delta),
    ...field('shadow_delta', p.shadow_delta),
    ...field('eye_delta', p.eye_delta),
    ...listField('conditions_gained', p.conditions_gained),
    ...listField('conditions_cleared', p.conditions_cleared),
    ...(notes.length > 0 ? ['notes:', ...notes.flatMap((n) => scalar('-', n))] : []),
  ];
}

/**
 * Render a NarrativePackage as sectioned text: `## turn`, `## dice`, `## oracle`, `## patch`,
 * `## lore`, `## journal` in that fixed order, each emitted only when it has a body line.
 * Lines are joined with '\n'; no blank lines (an empty line inside a block value is exactly
 * BLOCK_INDENT), no trailing newline. Pure and deterministic.
 */
export function renderNarrativePackage(pkg: NarrativePackage): string {
  const lt = pkg.length_target;
  const lines = [
    ...section('## turn', [
      ...field('intent', pkg.intent),
      ...field('scene', pkg.scene),
      `length_target: ${lt.min_chars}..${lt.max_chars} chars`,
    ]),
    ...section('## dice', pkg.dice ? renderDice(pkg.dice) : []),
    ...section('## oracle', pkg.oracle ? renderOracle(pkg.oracle, 0) : []),
    ...section('## patch', pkg.patch ? renderPatch(pkg.patch) : []),
    ...section(
      '## lore',
      (pkg.lore_chunks ?? []).flatMap((c) => [...field('chunk_id', c.chunk_id), ...field('text', c.text)]),
    ),
    ...section('## journal', (pkg.journal_facts ?? []).flatMap((f) => field(f.kind, f.text))),
  ];
  return lines.join('\n');
}
