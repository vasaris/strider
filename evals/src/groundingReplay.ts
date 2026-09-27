// NF1 acceptance replay (pure): run the grounding check over recorded full-cycle transcripts
// (the committed L4 records in evals/l4-records/) without any model call. Each prose is checked
// against the package its Keeper actually received; the stop-lists are NOT re-run here (their
// verdicts are already in the records) -- only the NF1 buckets are reported.
import { renderNarrativePackage, type NarrativePackage } from '@brodyazhnik/orchestrator';
import { scanRelativeBackstory, scanUngroundedNames } from './grounding.js';

export interface ReplayTranscript {
  readonly scenarioId: string;
  readonly package: NarrativePackage;
  readonly output: { readonly prose: string };
}

export interface ReplayRecord {
  /** Record name (the report file name without `.json`). */
  readonly name: string;
  readonly transcripts: readonly ReplayTranscript[];
}

export interface ReplayRow {
  readonly record: string;
  readonly scenarioId: string;
  /** nf1_name terms (BLOCK), in offset order. */
  readonly blocks: readonly string[];
  /** nf1_backstory terms (WARN), in offset order. */
  readonly warns: readonly string[];
}

/** One row per transcript, in record then transcript order. */
export function replayGrounding(records: readonly ReplayRecord[]): readonly ReplayRow[] {
  return records.flatMap((r) =>
    r.transcripts.map((t) => ({
      record: r.name,
      scenarioId: t.scenarioId,
      blocks: scanUngroundedNames(t.output.prose, renderNarrativePackage(t.package)).map((v) => v.term),
      warns: scanRelativeBackstory(t.output.prose, t.package).map((v) => v.term),
    })),
  );
}
