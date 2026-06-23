# Ready-to-paste /goal conditions  (Claude Code v2.1.139+, accept trust dialog, pair with auto mode)

General guardrails baked into every condition below:
- finish line = the machine-checkable gates (no adjectives the evaluator can't verify);
- a turn cap (no hard $ limit exists — keep it; be ready to Ctrl+C);
- a "don't touch prior batches" constraint;
- one goal PER BATCH, never "build the whole project";
- determinism finish-line = `python3 tools/extraction/check_determinism.py` prints
  byte-identical (this supersedes the older "second rebuild -> git status --porcelain
  empty" wording; it is the same property, now checked non-destructively by the tool).

## B4 — combat
/goal Build batch B4 (combat). Write tools/extraction/build_mechanics_b4.py in the
style of build_mechanics_b3.py: cut every source_text via (start,end_incl) anchors over
source_kv/kv_core.txt; transfer all tools/extraction/staging_3a/combat.*.json skeletons,
deleting each skeleton file after transfer; bump expected_count in validate.py. DONE
when ALL hold and the proof is in the transcript: `python3 tools/extraction/validate.py`
prints "OK" at the new count; `python3 tools/extraction/independent_check.py` prints
"failures: 0"; `python3 tools/extraction/check_determinism.py` prints byte-identical. CONSTRAINTS: never hand-edit existing B2.1/B2.2/B3 card JSON (only via scripts);
forward-refs to unbuilt cards go in `notes`, not `related`. STOP and ask if any anchor is
non-unique in a way that needs a scoping decision, or if a join key conflicts with B2.2/B3.
Stop after 30 turns.

## B5 — council + journey + fellowship_phase (+2 keeper_tools orphans)
/goal Build batch B5 (council, journey, fellowship_phase, the 2 keeper_tools skeletons),
same rules as B4. DONE when validate.py prints "OK" at the new count, independent_check.py
prints "failures: 0", and `check_determinism.py` prints byte-identical.
CONSTRAINTS: scripts-only edits; honour the B4 join contract in HANDOFF; "Поведать историю"
(feature swap) + "Изменение качеств" land here. Stop after 30 turns.

## NOT a /goal: gate 2b (vision) and gate 3 (lynn-review)
The evaluator only reads the transcript and cannot see rendered pages — letting it
self-certify "the numbers match" is the documented failure mode. Run these as normal
human-in-the-loop sessions: Claude renders the page(s) from the local КВ PDF (offset
PDF = folio + 1) and reports value-vs-image; Ivan confirms; only then mark_verified.py.
Remaining 2b targets are enumerated in HANDOFF_3A.md.

## B-ИдО.1 — «Игра для одного» solo overlay: intro + setup (folios 4–7)
Built by tools/extraction/build_solo_overlay.py (NOT a skeleton transfer — cut net-new
verbatim from source_pages/, book igra_dlya_odnogo). Sections A «В одиночку в диких
краях», B «Введение», C «Ваш искатель приключений» = 17 rule_cards, subsystem "solo",
ids kv.mechanics.solo.<name>, written to content-packs/kv/mechanics. DONE when, in the
transcript: `python3 tools/extraction/validate.py` prints "OK: 190 files";
`independent_check.py` prints "failures: 0"; `check_determinism.py` prints byte-identical;
`python3 tools/extraction/check_param_numbers.py solo.` prints OK across 17 cards. The
overlay carries NO duplicated integers: every solo number stays canonical in the verified
kv.solo.hero_adjustments / kv.solo.eye_of_mordor and is referenced via
parameters.params_ref. CONSTRAINTS: scripts-only edits; never re-declare a number that a
kv.solo.* table already holds; oracle bindings go in parameters.oracle_refs (build-time
existence-checked against tables/solo); forward-refs to B-ИдО.2/.3 cards live in `notes`,
not `related`. Gate 2a (semantics) + gate 3 (lynn-review) remain separate fresh sessions;
mark_verified.py only after them.
