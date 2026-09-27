// NF1 grounding replay over the committed L4 records. OFFLINE: no API call, no key, no network --
// it reads evals/l4-records/full-cycle-report.*.json and re-checks every recorded Keeper prose
// against the package that Keeper received (src/grounding.ts via src/groundingReplay.ts).
//
//     cd evals && npx tsx grounding-replay.mts
//
// Prints one line per prose (record / scenario / blocks / warns) and the totals. Writes nothing.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayGrounding, type ReplayRecord, type ReplayTranscript } from './src/groundingReplay.js';

const here = dirname(fileURLToPath(import.meta.url)); // evals/
const dir = resolve(here, 'l4-records');

const records: ReplayRecord[] = readdirSync(dir)
  .filter((f) => f.startsWith('full-cycle-report.') && f.endsWith('.json'))
  .sort()
  .map((f) => {
    const json = JSON.parse(readFileSync(resolve(dir, f), 'utf8')) as {
      report: { transcripts: readonly ReplayTranscript[] };
    };
    return { name: f.slice(0, -'.json'.length), transcripts: json.report.transcripts };
  });

const rows = replayGrounding(records);
for (const r of rows) {
  const blocks = r.blocks.length > 0 ? r.blocks.join(', ') : '-';
  const warns = r.warns.length > 0 ? r.warns.join(', ') : '-';
  console.log(`${r.record}  ${r.scenarioId.padEnd(22)}  block: ${blocks}  |  warn: ${warns}`);
}
const blocked = rows.filter((r) => r.blocks.length > 0).length;
const warnCount = rows.reduce((n, r) => n + r.warns.length, 0);
console.log(`\n${rows.length} prose(s) from ${records.length} record(s); ${blocked} with blocks; ${warnCount} warn(s).`);
