# HANDOFF — Stage-0 exit, gate-3 (lynn-review): КВ-ядро (140 cards)

**Prepared by the AUTHOR/orchestration side at HEAD `92c1016`, for a FRESH lynn-review (gate-3) session.**

## 0. ADR-001 boundary + MODE (read first)
This is a **task brief, not a review**. Per ADR-001 (author ≠ reviewer), gate-3 MUST run in a **fresh session by a non-author instance** — one that did NOT build these cards and did NOT run the gate-2a or gate-2a-re-confirm sessions. This document contains **no verdicts** — only WHAT to check and HOW. Judge independently against the **book** (КВ in project knowledge) + `brodyazhnik-architecture-v1.md`, **not** against this brief or any prior session's claims.

**MODE: REVIEW ONLY.** Do NOT modify, do NOT commit, do NOT fix, do NOT flip `verified`. Output **PASS/FAIL per checklist item with `file:line` evidence**. If something is wrong, **report it — do not repair it** (routing: every fix is a future AUTHOR task; non-blocking items → `KNOWN_ISSUES.md` with severity). Only the `mark_verified.py` stamping step (run by Ivan/author **after** a PASS) flips `verified` — see §6. lynn-review is **LAST** so it sees exactly what will become `verified`.

**This is the final review gate before Stage-0 exit.** The 33 tables (Sessions 1/2) and 49 ИдО cards (gate-3 PASS 24.06) are already `verified:true`. The 140 КВ-core cards are the **sole remaining unverified content**; a gate-3 PASS here + the §6 stamp closes Stage 0.

---

## 1. What changed since the gate-2a review (`docs/GATE2A_KV_FINDINGS.md` @ `4b616ac`)
The 140 КВ cards cleared gate-2a (**138/140 SUPPORTED, 2 PARTIAL, 0 UNSUPPORTED**) and then had the gate-2a fixes applied + independently re-confirmed. You are reviewing the **post-fix, post-re-confirm** result. Deltas on top of the gate-2a findings:

1. **F1/F2/F3/J5 applied** (`636171d`, AUTHOR session, all in `build_mechanics_b*.py`; rebuild byte-identical):
   - **F1** `eye.bditelnost_oka` — `growth.eyes_gaze.trigger` corrected from a glossary success-sign referent to `"eye_on_feat_die out_of_combat"`; misleading `notes` rewritten to the Eye resolution. `source_text`/`summary` untouched.
   - **F2** `shadow.bally_teni` — `miserable_effect` corrected from the self-contradictory `success_sign_on_feat_die…` to `"eye_on_feat_die = auto_failure"` (exact mirror of `conditions.miserable.parameters.effect`).
   - **F3** under-linking — `checks.who_rolls.related += checks.assistance` (STRONG); `checks.which_ability.related += traits.navyki, traits.boevye_umeniya, valour_wisdom.doblest, valour_wisdom.mudrost` (MODERATE); `checks.retry.related` left `[]` (WEAK, defensible).
   - **J5** cosmetic — `combat.vyhod_iz_boya.section` register normalized («Фаза»→«фаза»). Semantics unaffected.
2. **F4 applied** (`0becd6b`, numbers by scan, gate-2b) — `fellowship_phase.struktura_fazy_bratstva`: the `training_cost.status=pending_gate_2b` stub was resolved into the full table by the folio-119 scan (`gate2b_evidence/MANIFEST.md` + `verify_gate2b_training_cost.py`). C1 «уровень навыка/умения» = pictogram pips 1–6, C2 «уровень Доблести/Мудрости» = `null`,2,3,4,5,6, C3 «цена» = 4/8/12/20/26/30; binding per row.
3. **gate-2a re-confirm PASS** (`92c1016`, FRESH NON-AUTHOR session, `docs/GATE2A_KV_RECONFIRM.md`) — independently re-derived the «знак»→Око referent from the source (grep 6/6 «выпада* знак» = Eye, 0 success-sign counterexamples; book self-definition «знак = наихудший = 0»; result-independence of the ВЗОР ОКА sentence) and confirmed: 2 ex-PARTIAL now SUPPORTED, F3 edges correct (targets exist, not dangling), F4 table consistent with the folio-119 evidence. **Post-re-confirm content-fidelity is 140/140 SUPPORTED.**

**You are NOT bound by the re-confirm's PASS** — re-confirm them holistically if you wish; the 5 touched cards (`eye.bditelnost_oka`, `shadow.bally_teni`, `checks.who_rolls`, `checks.which_ability`, `fellowship_phase.struktura_fazy_bratstva`, + the `conditions.miserable` mirror reference) are the highest-churn surface and the natural spot-check.

Edge-state now: **342 `related`→core edges** across 140 cards, **1 correctly-empty `related`** (`checks.retry`). (Pre-F3 it was 337 edges / 3 empty in the `checks` cluster; F3 added 5 edges and filled 2 of the 3 empties.)

---

## 2. Current state @ `92c1016`
- **222 files**: **140 КВ** + 49 ИдО rule_cards + 25 solo tables + 8 lifepaths.
- **Automated gates GREEN** (re-run them — expect these exact lines):
  - `validate.py` → `OK: 222 files pass schema + structural validation`
  - `independent_check.py` → `cells checked: 676; failures: 0`
  - `check_param_numbers.py` → `OK: every parameter number traces to source_text across 9 'combat.*' cards`
  - `check_determinism.py` → `OK: content byte-identical across 222 files (stamp ignored; working tree untouched)`
  - `confirm_kv_gate2a_fixes.py` → `KV gate-2a re-confirm: PASS F1+F2+F3 ok`
  - `verify_gate2b_training_cost.py` → `RESULT: PASS (0 mismatches)`
- **verified status**: **82 = `true`** (33 tables Sessions 1/2 + 49 ИдО gate-3 24.06); **140 КВ rule_cards = `false`**. **This brief covers those 140.**

---

## 3. GUARANTEED upstream — do NOT re-derive cell-by-cell (re-confirm independently only if you wish)
- **gate-1 (automated):** every КВ `source_text` cell is **verbatim** from `tools/extraction/source_kv/kv_core.txt` (cut by anchor pairs, not typed) — `independent_check.py` 676/0; byte-identical rebuild; every `parameters` integer in `combat.*` traces to a digit in its own `source_text` (`check_param_numbers.py`); no dangling `related`→`kv.mechanics.*`.
- **gate-2a (closed @ `4b616ac`, re-confirmed @ `92c1016`):** each `summary` follows from `source_text` with nothing added; `subsystem`/`section` correct; the 2 PARTIAL (F1/F2) fixed and re-confirmed; the F3 under-links land on the correct cards. Verdicts in `docs/GATE2A_KV_FINDINGS.md`; re-confirm in `docs/GATE2A_KV_RECONFIRM.md`.
- **gate-2b (closed, ADR-002 = vision-spotcheck on numbers only):** ALL `parameters`/statblock numbers + tables vision-checked against the **real КВ PDF** scans — `content-packs/kv/gate2b_evidence/MANIFEST.md`, 0 mismatches, **including the F4 training_cost** (folio 119, `verify_gate2b_training_cost.py`). Prose is NOT scan-checked (no page scans of КВ prose in knowledge — this is the documented ADR-002 residual risk).

gate-3 is the **final holistic pass**, not a per-cell re-run of 1/2a/2b.

---

## 4. THE gate-3 (lynn-review) checklist (each → PASS/FAIL + `file:line`)
1. **SCOPE.** Exactly **140** `kv.mechanics.*` rule_cards that are NOT `…solo.*`, in `content-packs/kv/mechanics/`; zero ВК content outside `content-packs/` (no rules text leaked into `tools/` beyond the gate-1 source layer; `engine/` does not exist yet). All 140 currently `verified:false`.
2. **RUNE CANON (highest-care).** Кость испытания d12: **Око = 11, руна Гэндальфа = 12** (КВ «Выполнение проверок»; `content-packs/schemas/common.schema.json $defs.featDieFace`). Confirm it is **not inverted** anywhere in the 140 payloads/summaries/prose and **not encoded as a raw integer**. Anchor card: `checks.scene_structure` (carries the canonical statement). The reversed order was an early-brief error caught at source — confirm no card re-encodes it reversed.
3. **GLYPH RESOLUTION (КВ-specific — the F1/F2 surface).** The text layer drops the feat-die pictograms; bare «знак» in a mechanical context = **Око** (not «знак успеха»). Confirm this resolution is consistent **pack-wide**, not just on the 5 re-confirmed cards: spot every card that reasons about a feat-die glyph — `eye.bditelnost_oka`, `shadow.bally_teni`, `conditions.miserable`, `reference.procedure_steps`, `adversaries.format_opisaniya` (the last correctly encodes the **enemy** feat-die inversion: Око→auto-success, руна→0 — proof the author distinguishes glyphs) — and confirm none reverts to a success-sign referent for bare «знак», and `eye_on_feat_die` is used as the canonical token. The re-confirm method (grep 6/6 + self-definition + result-independence) is in `GATE2A_KV_RECONFIRM.md` §2 / `GATE2A_KV_FINDINGS.md` §«Метод разрешения глифов БЕЗ скана» — verify it independently if you wish (greps over `source_kv/kv_core.txt`).
4. **PACK-LEVEL COHERENCE** (the holistic layer above 2a's per-card pass). Does the 140-card set read as one coherent rulebook extraction? Terminology canon (Пандора Бокс: Хранитель, Кость испытания, Кости успеха, Изнурение, баллы Тени, Надежда, ЦЧ, благополучный/злополучный бросок, Бдительность Ока, Фаза братства) used consistently; no two cards contradict (e.g. miserable/overwhelmed thresholds agree between `shadow.bally_teni`, `conditions.miserable`, `conditions.overview`; Council resistance 3/6/9 lives once in `council.zavershenie_soveta`); each `summary` is a faithful engineering annotation, not embellishment.
5. **ANTI-SLOP on added prose.** `summary`/`notes` are technical annotations. Flag any stop-list drift («данный», «является», «поистине», «безусловно», «стоит отметить», Толкин-пастиш) introduced **beyond** the verbatim `source_text` (the source itself may legitimately contain such words — only added prose is in scope).
6. **`related`→core correctness — the high-value under-linking audit.** Using `docs/HANDOFF_KV_REVIEW.md` §6 (per-cluster map) + **Appendix A** (full `related` ids per card), confirm each of the **342** edges targets the **correct** core rule, and that the **1 empty-`related`** card (`checks.retry`) is correctly empty. Gates catch *dangling* refs, never *missing* ones, so this audit is human-only. Priority: the **hubs** — `cultures`×12, `creating_heroes`×8, `sovershenie_atak`×7, `kulturnye_osobennosti`×7, `callings`×6, `bally_teni`×6 — plus the **F3 sub-links** (`who_rolls→[assistance]`, `which_ability→4 ability cards`). `confirm_kv_gate2a_fixes.py` asserts ONLY the F3 1+4 targets; the remaining ~337 edges need a read.
7. **JUDGMENT CALLS — see §4a.** Rule on the consolidated open questions holistically.
8. **CIRCULARITY.** Re-confirm via an independent path (your own code / `independent_check.py` / `confirm_kv_gate2a_fixes.py` / `verify_gate2b_training_cost.py`) — not by trusting this brief, the findings, or the re-confirm.
9. **NO-DRIFT.** Every `subsystem` value used by the 140 cards is present in the `rule_card.schema.json` enum; no unsanctioned payload extensions beyond `parameters` / `related` / (`params_ref`/`oracle_refs` where applicable). `combat_gear` remains the **sole owner** of weapon/armor numbers (no number duplicated elsewhere — `check_param_numbers` green is the guarantee, but eyeball the single-source posture).
10. **GATES & DOCS.** Re-run the six gates (expect §2 lines). `KNOWN_ISSUES.md` / `HANDOFF_KV_REVIEW.md` / `GATE2A_KV_FINDINGS.md` / `GATE2A_KV_RECONFIRM.md` consistent with the tree; the in-repo arch doc is the corrected (`11 = Око, 12 = руна Гэндальфа`) version. **NB:** `HANDOFF_KV_REVIEW.md` per-cluster empty/edge counts predate F3 (it shows `checks … пустых 3`); the current state is **342 edges / 1 empty** — confirm against the tree, treat the map's counts as the pre-F3 snapshot.

---

## 4a. Open judgment calls (checklist item 7 — rule independently; from `GATE2A_KV_FINDINGS.md` §7 + the glyph method + F4)
1. **`hero_creation` granularity (J1).** 38 cards, one-rule-one-card. Each carries verbatim `source_text` + page provenance; hubs route correctly; no number duplication. Right granularity, or merge? (Findings argued KEEP split — provenance/RAG value, consistent with the rest of the pack.)
2. **`checks.retry` empty `related` (J2).** Self-contained meta-rule («one attempt; retry only with a different skill, by the Keeper's leave»). Optional links (`procedure`/`which_ability`) are nice-to-have, not required. Empty defensible, or under-linked?
3. **Hub edges (J3).** The six dense hubs above — all targets correct?
4. **`adversaries` location (J4).** 7 cards live in `mechanics/`, not a separate `adversaries/` catalog (an `adversary.schema.json` exists). Keep for Stage-0 (migration = a Stage-1 refactor), or move now?
5. **`combat` section register (J5 — APPLIED).** «Фаза приключений»→«фаза приключений» normalized in `combat.vyhod_iz_boya`. Confirm register is now consistent across the 9 combat cards (cosmetic; non-blocking).
6. **Glyph resolution without scan (F1/F2 method).** Is the no-scan «знак»→Око resolution sound as a holistic convention (not just per-card)? See checklist item 3.
7. **`training_cost` numbers (F4).** Resolved from the folio-119 scan, not the degraded text layer; `notes` flag C1 as a scan-only pictogram column. Accept the scan-sourced numbers + the row-binding (Valour/Wisdom has no level-1 row → `null`)?

---

## 5. The 140 КВ card map
The authoritative edge/cluster map is **`docs/HANDOFF_KV_REVIEW.md`** — §6 (clusters) + **Appendix A** (full `related` ids per card). Do not reproduce it; read it. Cluster totals (per that map; empty/edge counts are the **pre-F3** snapshot — current is 342 edges / 1 empty):

| cluster | cards | edges (pre-F3) | notes |
|---|---|---|---|
| hero_creation | 38 | 81 | hubs cultures×12, creating_heroes×8, callings×6; combat_gear = sole number-owner |
| checks | 19 | 23 | **3 empty pre-F3 → 1 now** (F3 filled who_rolls, which_ability; retry stays empty) |
| eye | 3 | 11 | F1 card `bditelnost_oka` re-confirmed |
| shadow | 5 | 18 | hub bally_teni×6; F2 card re-confirmed |
| combat | 9 | 28 | hub sovershenie_atak×7; J5 register normalized |
| journey | 6 | 16 | poryadok_puteshestviya×5 |
| council | 3 | 7 | resistance 3/6/9 single-sourced in zavershenie_soveta |
| fellowship_phase | 4 | 13 | F4 card `struktura_fazy_bratstva` (training_cost scan-closed) |
| adversaries | 7 | 18 | format_opisaniya encodes enemy feat-die inversion (glyph-distinguishing proof) |
| traits | 7 | 20 | 18 skills + 24+6 features + 4 weapon-skills |
| treasure | 8 | 28 | all 28 edges checked in 2a |
| rewards_virtues | 11 | 27 | hub kulturnye_osobennosti×7 |
| standard_of_living | 3 | 7 | |
| valour_wisdom | 2 | 5 | doblest, mudrost (F3 which_ability targets) |
| equipment | 3 | 8 | descriptions only; numbers in combat_gear |
| endurance_hope | 3 | 10 | |
| conditions | 4 | 7 | miserable = F2 mirror reference |
| keeper_tools | 2 | 4 | |
| reference | 3 | 6 | procedure_steps reads «знак»=Око correctly |
| **TOTAL** | **140** | **337 (pre-F3) → 342 now** | **1 empty-related now (`checks.retry`)** |

The 5 freshly re-confirmed cards (highest-churn, natural spot-check): `eye.bditelnost_oka`, `shadow.bally_teni`, `checks.who_rolls`, `checks.which_ability`, `fellowship_phase.struktura_fazy_bratstva` (+ `conditions.miserable` as the F2 mirror).

---

## 6. Stage-0 exit / stamping (run by Ivan/author AFTER a gate-3 PASS — NOT by the reviewer)
```
python3 tools/extraction/mark_verified.py --dir content-packs/kv/mechanics \
  --gate2 "2a:GATE2A_KV_FINDINGS.md @4b616ac + F1/F2/F3/J5 @636171d, F4 @0becd6b; re-confirm GATE2A_KV_RECONFIRM.md @92c1016; 2b:gate2b_evidence/MANIFEST.md incl. training_cost(F4)" \
  --gate3 "<lynn-review PASS evidence>"
```
**NO `--id-prefix`.** The script builds the eligibility prefix as `"kv.mechanics." + <arg>` and matches `startswith`. With no `--id-prefix` it stamps every file in `--dir`; the **49 ИдО cards are already `verified:true` → idempotent-skip**, so only the **140 КВ** flip. Expect: `verified flipped: 140, already verified: 49`.

> ⚠ **DO NOT use `--id-prefix kv.`** — it resolves to prefix `kv.mechanics.kv.`, which matches **0** ids (`eligible 0`) and stamps **nothing**. (No КВ id begins `kv.mechanics.kv.`; КВ ids are `kv.mechanics.<cluster>.*` across 19 clusters, with no single prefix selecting exactly the 140 — hence the no-prefix + idempotent-skip path.) This corrects an erroneous hint that appeared in an earlier draft of the re-confirm handoff.

`mark_verified.py` re-runs gate-1 in-process (refuses if red), stamps `verified:true` + a `verification:{method,date,gates}` block, and is idempotent. The reviewer's PASS verdict string is the `--gate3` evidence — the reviewer does NOT run this command. After this: all 189 cards `verified` → **Stage 0 exit** (then `manifest.json` + the lore/tone scope decision per `STAGE0_REMAINING.md` §8–9).

---

## 7. Sources & tooling (КВ-specific)
- **gate-1 cut source:** `tools/extraction/source_kv/kv_core.txt` — degraded 1 MB text layer; **stays** the gate-1 cut source (rebasing onto the real PDF is rejected: real PDF linearization reorders ~60% of multi-column cells, would break gate-1 for zero content gain — see `ADR-002` + `MANIFEST.md`). All «знак» glyph greps run over this file.
- **gate-2b vision source:** the **real КВ PDF** (`КВ_02_03_2026_с_рубрикатором__1_.pdf`, Ivan local, gitignored; `sha256` + page offset in `gate2b_evidence/MANIFEST.md`). 242 pp, `%PDF-1.7`; PDF page = book folio + 1. Used for numbers only (ADR-002). Scans for F1/F2/F3 are **not needed** (glyph resolved by book logic); F4 is covered by scan + `verify_gate2b_training_cost.py`.
- **Source of truth = the build scripts** `tools/extraction/build_mechanics_b*.py`: all cut anchors, summaries, and `related`/`parameters` decisions live there; JSON is **derived** (rebuild byte-identical). To inspect why a span/edge exists, read the script, not the JSON. Fixes (if any) go to the script, never to JSON.
- **Gates:** `validate.py`, `independent_check.py`, `check_param_numbers.py`, `check_determinism.py`, `confirm_kv_gate2a_fixes.py`, `verify_gate2b_training_cost.py`. **Verify-only:** `mark_verified.py`.
- **gate-2b evidence:** `content-packs/kv/gate2b_evidence/MANIFEST.md` (+ folio JPGs in that dir; full PDF is Ivan-local).
- **Prior records (read as MAP, NOT as truth):** `docs/HANDOFF_KV_REVIEW.md` (gate-2a review map, §6 clusters + Appendix A edges), `docs/GATE2A_KV_FINDINGS.md` (2a verdicts @4b616ac, F1–F4 + J1–J5), `docs/GATE2A_KV_RECONFIRM.md` (re-confirm PASS @92c1016), `KNOWN_ISSUES.md`, `ADR-001`, `ADR-002`, `STAGE0_REMAINING.md`.

**Output:** Verdict PASS/FAIL; per checklist item; blockers with exact `file:line`. Non-blocking → `KNOWN_ISSUES.md` with severity. Do NOT merge / do NOT flip `verified` — that is `mark_verified.py` (§6), run by Ivan after PASS.

---

## /goal (ready to paste — Claude Code, auto mode)
```
/goal Run the gate-3 (lynn-review) of the 140 KV-core cards per docs/HANDOFF_KV_GATE3_LYNN.md.
You are a FRESH NON-AUTHOR review instance (ADR-001): do NOT edit any JSON or scripts, do NOT set
verified, do NOT run mark_verified. This is the final review before Stage-0 exit; the 33 tables and
49 ИдО cards are already verified, the 140 KV-core cards are the only unverified content.
First re-run the six gates and paste output: validate.py (OK 222), independent_check.py (failures: 0),
check_param_numbers.py (no dupes), check_determinism.py (byte-identical), confirm_kv_gate2a_fixes.py
(PASS F1+F2+F3 ok), verify_gate2b_training_cost.py (PASS 0 mismatches). Then judge HOLISTICALLY against
the book: rune canon (Eye=11, Gandalf=12) not inverted/not raw-integer anywhere; the bare-«знак»=Eye
glyph resolution consistent pack-wide (spot bditelnost_oka, bally_teni, conditions.miserable,
procedure_steps, adversaries.format_opisaniya); pack-level coherence + terminology canon; anti-slop on
added summary/notes; related→core under-linking audit over the 342 edges using HANDOFF_KV_REVIEW.md §6 +
Appendix A (priority: the 6 hubs + the F3 sub-links; confirm checks.retry empty is defensible); the 7
judgment calls in §4a. Output PASS/FAIL per checklist item with file:line evidence. CONSTRAINTS: review
only, never edit; if anything fails, record a finding with exact file:line and route to the author; do
NOT flip verified. Stop after 25 turns.
```

---
*Author/orchestration self-assessment (110/100, honest weak spots): (1) gate-3 is correctly the LAST review and sees the exact to-be-verified state — но pack-level coherence is judgment-heavy and the 337 non-F3 edges are not script-asserted, so the under-linking audit (item 6) is the real load-bearing work and depends on the reviewer actually reading HANDOFF_KV_REVIEW Appendix A, not skimming. (2) The glyph resolution (item 3) is sound but rests on the same no-scan method as F1/F2; it is independently re-derivable by grep over kv_core.txt, but a reviewer who only trusts the re-confirm verdict adds little — re-grep is cheap, do it. (3) КВ prose is NEVER scan-checked (ADR-002 residual): a dropped/garbled word in `source_text` prose outside numbers would pass all gates; gate-3 reads prose against the book by eye, which is the only net for this, but it is by-eye, not exhaustive. (4) The 5 re-confirmed cards are the safest part of the pack — spend the budget on the other 135, especially the hubs and any card whose `summary` paraphrases rather than restates.*
