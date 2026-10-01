# evals/records — keyed-run audit trail (from Stage 3.1 on)

Successor of `evals/l4-records/` (which stays frozen as the Stage 2 exit record). Keyed reports
written since RP1 (3.1-C1, `be08b85`) carry their own provenance in the file NAME — prompt
version(s), model, UTC stamp — and are created exclusively (never overwritten), so a flat folder
is enough. Each report also carries the prompt paths + sha256 it ran with.

These are deliberate COPIES of the gitignored working reports in `evals/` (byte-identical, `cmp`),
committed because they back a reviewer verdict. No report contains a key: `calibrate.mts` and
`full-cycle.mts` read `ANTHROPIC_API_KEY` from `process.env` only and never write it.
`evals/.gitignore` re-includes this folder (`!records/**`) and keeps `.env` ignored inside it.

## 3.1, 2026-09-27 — keeper v0.3 + judge v0.4 (code HEAD `877340d`)

Run by Ivan in his keyed shell after 3.1-C3; verdict: `docs/CALIBRATION_TONE_JUDGE.md`,
section «3.1, 27.09: keeper v0.3 + judge v0.4».

- `calibration-report.judge-v0.4.claude-opus-4-8.20260927T221611Z.json` — the 13-case judge
  calibration (judge v0.4 + tone.md `fe569c02…`). The deterministic slice
  (`rows[].antiSlopBlocking` + `raw[].verdict.antiSlop`) hashes to
  `4920a8af74acef5fe0077e67f1ecceaafdb05de6e115a320096ab60f7c9609c0` — the pin in
  `evals/test/calibrationRunner.test.ts` (computed by Ivan from this file; recomputed at docs-I).
- `calibration.judge-v0.4.stdout.txt` — the stdout of that run as pasted by Ivan; it equals
  `formatReport()` of the JSON above byte for byte (the paste omits the final
  "Do NOT tune…" line, like the l4-records captures).
- `full-cycle-report.keeper-v0.3.judge-v0.4.claude-sonnet-5.20260927T222434Z.json` — full cycle,
  11 suite seeds, Keeper `claude-sonnet-5`, judge `claude-opus-4-8`.
- `full-cycle-report.keeper-v0.3.judge-v0.4.claude-opus-4-8.20260927T223309Z.json` — full cycle,
  11 suite seeds, Keeper `claude-opus-4-8`, judge `claude-opus-4-8` (`sameModel: true`).
