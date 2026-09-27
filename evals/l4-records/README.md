# L4 records, 2026-09-27 (reviewer-assembled)

Provenance of every file, for HANDOFF sec 7 ("numbers from files, not dialogue"):

- `full-cycle-report.v0.1.*.json` — the raw reports Ivan uploaded to the reviewer chat right after
  the v0.1 runs (keeper v0.1 / judge v0.1; self-attesting: each file carries the sha256 of the
  prompts and tone.md it ran with). Renamed with a version infix; content byte-identical to the
  uploads.
- `full-cycle-report.v0.3.*.json` — same for the final runs (keeper v0.2 / judge v0.3).
- `calibration.v0.1|v0.2|v0.3.stdout.txt` — verbatim stdout of `calibrate.mts` as pasted by Ivan
  from the keyed shell into the reviewer chat; the raw calibration-report.json of v0.1 and v0.2 was
  overwritten by the next run (calibrate.mts writes a fixed file name -- see DEFERRED note).
- June v0 calibration table: already recorded in docs/CALIBRATION_TONE_JUDGE.md.

Placement: `evals/l4-records/` (commit them: they are the primary record behind the Stage 2 exit
verdict). Add a DEFERRED note: calibrate.mts should suffix its report with the judge prompt version
or a timestamp so runs stop overwriting each other (code change, first evals commit of Stage 3).
