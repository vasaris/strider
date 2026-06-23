# Ready-to-paste /goal conditions  (Claude Code v2.1.139+, accept trust dialog, pair with auto mode)

General guardrails baked into every condition below:
- finish line = the machine-checkable gates (no adjectives the evaluator can't verify);
- a turn cap (no hard $ limit exists — keep it; be ready to Ctrl+C);
- a "don't touch prior batches" constraint;
- one goal PER BATCH, never "build the whole project".

## B4 — combat
/goal Build batch B4 (combat). Write tools/extraction/build_mechanics_b4.py in the
style of build_mechanics_b3.py: cut every source_text via (start,end_incl) anchors over
source_kv/kv_core.txt; transfer all tools/extraction/staging_3a/combat.*.json skeletons,
deleting each skeleton file after transfer; bump expected_count in validate.py. DONE
when ALL hold and the proof is in the transcript: `python3 tools/extraction/validate.py`
prints "OK" at the new count; `python3 tools/extraction/independent_check.py` prints
"failures: 0"; a second run of all build_mechanics_*.py leaves `git status --porcelain`
empty. CONSTRAINTS: never hand-edit existing B2.1/B2.2/B3 card JSON (only via scripts);
forward-refs to unbuilt cards go in `notes`, not `related`. STOP and ask if any anchor is
non-unique in a way that needs a scoping decision, or if a join key conflicts with B2.2/B3.
Stop after 30 turns.

## B5 — council + journey + fellowship_phase (+2 keeper_tools orphans)
/goal Build batch B5 (council, journey, fellowship_phase, the 2 keeper_tools skeletons),
same rules as B4. DONE when validate.py prints "OK" at the new count, independent_check.py
prints "failures: 0", and a second full rebuild leaves `git status --porcelain` empty.
CONSTRAINTS: scripts-only edits; honour the B4 join contract in HANDOFF; "Поведать историю"
(feature swap) + "Изменение качеств" land here. Stop after 30 turns.

## NOT a /goal: gate 2b (vision) and gate 3 (lynn-review)
The evaluator only reads the transcript and cannot see rendered pages — letting it
self-certify "the numbers match" is the documented failure mode. Run these as normal
human-in-the-loop sessions: Claude renders the page(s) from the local КВ PDF (offset
PDF = folio + 1) and reports value-vs-image; Ivan confirms; only then mark_verified.py.
Remaining 2b targets are enumerated in HANDOFF_3A.md.
