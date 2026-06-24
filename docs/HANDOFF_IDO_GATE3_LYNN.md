# HANDOFF — Stage-0 exit, gate-3 (lynn-review): «Игра для одного» solo overlay (49 cards)

**Prepared by the AUTHOR session at HEAD `e1c1845`, for a FRESH lynn-review (gate-3) session.**

## 0. ADR-001 boundary + MODE (read first)
This is a **task brief, not a review**. Per ADR-001 (author ≠ reviewer), gate-3 MUST run in a **fresh session by a non-author instance**. This document contains **no verdicts** — only WHAT to check and HOW. Judge independently against the **books** (project knowledge) + `brodyazhnik-architecture-v1.md`, **not** against this brief or the build session's claims.

**MODE: REVIEW ONLY.** Do NOT modify, do NOT commit, do NOT fix, do NOT flip `verified`. Output **PASS/FAIL per checklist item with `file:line` evidence**. If something is wrong, **report it — do not repair it** (routing: every fix is a future AUTHOR task; non-blocking items → `known_issues` with severity). Only the `mark_verified.py` stamping step (run by Ivan/author **after** a PASS) flips `verified` — see §6. lynn-review is LAST so it sees exactly what will become `verified`.

---

## 1. What changed since the prior review brief (`docs/HANDOFF_IDO_REVIEW.md` @ `b3ff49a`)
The 49 ИдО cards have already cleared gate-2a and had the gate-2a fixes applied. You are reviewing the result. Deltas on top of that brief:

1. **gate-2a CLOSED** — `docs/GATE2A_IDO_FINDINGS.md` @ `647fd6b`: **49/49 SUPPORTED**, **28/28 B-ИдО.3 edges correct**; the single structural gap was **S1** (the `related`→core convention introduced in B-ИдО.3 was never back-filled to the B-ИдО.1/.2 setup cards). That file is a verdict record; read it if useful, but judge independently.
2. **S1 back-fill applied** (`522d4cb`): **+14** `related`→core edges on the B-ИдО.1/.2 setup cards; `srazhayas_s_soboy` softened to `related:[]` (advice card, not a rule-mod); two stale forward-ref `notes` restated as resolved cross-refs (`source_text`/`summary` untouched). `confirm_s1_edges.py` asserts this: **PASS 14/14 + Q2 ok**.
3. **`mark_verified.py --id-prefix`** (`59276f7`): RESOLVES the prior brief's §4 coordination caveat — stamping can now scope to `--id-prefix solo.` (49 ИдО only; the 140 КВ cards skipped). See §6.
4. **Docstring refresh + regression gate** (`f7f431d`): `build_solo_overlay.py` docstring corrected post-S1 (content-neutral; 0 JSON change); `confirm_s1_edges.py` now tracked.
5. **F-док-1 applied** (`e1c1845`): arch §2.2 line 86 → `Кость испытания (d12: 11 = Око, 12 = руна Гэндальфа)` (verified vs `tools/extraction/source_kv/kv_core.txt` L699 + `content-packs/schemas/common.schema.json $defs.featDieFace`). **NB:** the gate-2a record framed the arch doc as "knowledge-only, not a repo commit"; it is now **tracked in the repo** (deliberate — un-versioned source-of-truth is fragile). The cards were already built on the correct canon — your job is to confirm no card payload/prose encodes the reversed order.

Edge-state summary now: **40 `related`→core + 1 `related`→solo, 41 `oracle_refs`, 16 correctly-empty `related`** (was 28/1/41/29 pre-S1).

---

## 2. Current state @ `e1c1845`
- **222 files**: 140 КВ + **49 ИдО** rule_cards + 25 solo tables + 8 lifepaths.
- **Automated gates GREEN**: `validate` 222 · `independent_check` 676/0 · `check_determinism` byte-identical · `check_param_numbers solo.` 49/0 · `confirm_s1_edges` PASS 14/14 + Q2 ok. gate-2b: `verify_2b_ido` 5/5 (per gate-2a record).
- **verified status**: 33 tables = `true` (Sessions 1/2). **189 rule_cards = `false`** (140 КВ + 49 ИдО). **This brief covers the 49 ИдО cards.**

---

## 3. GUARANTEED upstream — do NOT re-derive cell-by-cell (re-confirm independently only if you wish)
- **gate-1 (automated):** `source_text` is **verbatim** from the publisher text layer (cut, not typed); byte-identical rebuild; every `parameters` integer traces to a digit in that card's `source_text`; no dangling `related`→`kv.mechanics.*`.
- **gate-2a (closed @ `647fd6b`):** each `summary` follows from `source_text` with nothing added; `subsystem`/`section` correct; `related`→core hit the correct rule (+ under-linking audit on empty `related`). Verdicts in `docs/GATE2A_IDO_FINDINGS.md`.
- **gate-2b (5/5):** the prose-only mechanical numbers (prior brief §5 worklist), vision-checked via `tools/extraction/verify_2b_ido.py`.

gate-3 is the **final holistic pass**, not a per-cell re-run of 2a/2b.

---

## 4. THE gate-3 (lynn-review) checklist (each → PASS/FAIL + `file:line`)
1. **SCOPE.** Exactly **49** `kv.mechanics.solo.*` rule_cards in `content-packs/kv/mechanics/`; zero ВК content outside `content-packs/`; all 49 currently `verified:false`.
2. **RUNE CANON (highest-care).** Око = 11, руна Гэндальфа = 12 (КВ «Значения Костей испытания»; `common.schema.json $defs.featDieFace`). Confirm it is **not inverted** anywhere in the 49 payloads/summaries/prose and **not encoded as a raw integer**. (Arch doc fixed in `e1c1845`; the cards are the remaining surface.)
3. **PACK-LEVEL COHERENCE** (the holistic layer above 2a's per-card pass). Does the 49-card set read as one coherent overlay? Terminology canon (Пандора Бокс: Хранитель, Кость испытания, Кости успеха, Изнурение, баллы Тени, Надежда, ЦЧ, благополучный/злополучный бросок, Бдительность Ока, Фаза братства) used consistently; no two cards contradict; each `summary` is a faithful engineering annotation, not embellishment.
4. **ANTI-SLOP on prose.** `summary`/`notes` are technical annotations. Flag any stop-list drift («данный», «является», «поистине», «безусловно», «стоит отметить», Толкин-пастиш) introduced **beyond** the verbatim `source_text` (the source itself may legitimately contain such words — only added prose is in scope).
5. **`related`→core correctness (post-S1) — the high-value check.** Using the §5 map, confirm each of the **40 →core** (and **1 →solo**) edges targets the **correct** core rule, and that the **16 empty-`related`** cards are correctly empty. Gates catch *dangling* refs, never *missing* ones, so this **under-linking audit** is human-only. `confirm_s1_edges.py` asserts only the 14 S1 targets + the Q2 removal — the remaining ~27 edges need a read.
6. **JUDGMENT CALLS — see §4a.** Rule on the consolidated open questions holistically.
7. **CIRCULARITY.** Re-confirm via an independent path (your own code / `independent_check.py` / `confirm_s1_edges.py`) — not by trusting this brief or the build report.
8. **NO-DRIFT.** `subsystem:"solo"` is present in the `rule_card.schema.json` enum; no unsanctioned payload extensions beyond `params_ref` / `oracle_refs` / `related`.
9. **GATES & DOCS.** Re-run the five gates (expect §2 numbers). `KNOWN_ISSUES.md` / `HANDOFF_*` / this brief consistent with the tree; the in-repo arch doc is the corrected (`11 = Око, 12 = руна Гэндальфа`) version.

---

## 4a. Open judgment calls (checklist item 6 — rule independently; from §7 of the prior brief + gate-2a open items)
1. **Sidebar split.** «В меньшинстве» (f17) folded as a 2nd span into `srazhenie`; «Сражаясь с собой» (f18) kept as its own `srazhayas_s_soboy`. Right split?
2. **`srazhayas_s_soboy`** — rule-vs-advice (GMing «принцип крутизны»). After S1 it carries `related:[]` and stays as RAG tone-context. Keep / drop / merge?
3. **Eye of Mordor granularity** — split into 5 cards (`oko_mordora_solo`, `nachalnyy_reyting_bditelnosti`, `rost_bditelnosti`, `sbros_bditelnosti`, `porog_presledovaniya`) mirroring the book sub-headings + `eye_of_mordor` sub-fields. Right granularity, or fewer cards?
4. **`related`→core convention.** 40 →core edges (map §5) — the highest-value semantic check; author's judgment, not the book's.
5. **`params_ref` posture.** Solo numbers single-sourced in verified tables (`hero_adjustments` / `eye_of_mordor` / `shadow_recovery`), referenced not duplicated. Resistance **3/6/9** (`opredelenie_soprotivleniya`) are core-Council values restated in prose (no solo table), left in `source_text` only — confirm that posture.
6. **`sceny_puteshestviya_solo`** — 2 spans: f19 (solo rule) + f22 (co-op tail). Co-op tail correctly attributed here vs `sovmestnaya_igra`?
7. **Intro cards.** `v_odinochku_v_dikih_krayah`, `chto_takoe_odinochnaya_igra` (f4) are low-mechanics orientation prose — keep as cards or fold to summary?

---

## 5. The 49 ИдО card map (current state @ `e1c1845`)
Legend: PR = `params_ref` (number canonical in a verified table); OR×n = n `oracle_refs`; "related →" lists the core (and any `solo.`) cards this overlay links to; spans = number of `source_text` cuts.

**TOTALS: 49 cards · 40 related→core · 1 related→solo · 41 oracle_refs · 16 empty-related.**

| card | folio | section | params/oracle | related → | spans |
|---|---|---|---|---|---|
| `bezopasnoe_mesto` | 6 | ваш искатель приключений | — | — | 1 |
| `chto_takoe_odinochnaya_igra` | 4 | в одиночку в диких краях | — | — | 1 |
| `detali_scen` | 19 | путешествия | OR×9 | journey.opisanie_stsen_puteshestviya | 1 |
| `deystviya_protivnikov` | 17 | сражение | — | combat.boy, combat.sovershenie_atak | 1 |
| `duhovnoe_vosstanovlenie` | 22 | фаза братства | PR | fellowship_phase.struktura_fazy_bratstva | 1 |
| `faza_bratstva_obzor` | 5 | введение | — | — | 1 |
| `faza_bratstva_solo` | 22 | фаза братства | OR×1 | fellowship_phase.struktura_fazy_bratstva, fellowship_phase.yol | 1 |
| `faza_priklyucheniy_obzor` | 5 | введение | OR×1 | — | 1 |
| `glavnye_tablicy` | 5 | введение | OR×4 | — | 1 |
| `ispolzovanie_drugih_tablic` | 30 | приложение | — | — | 1 |
| `kachestvo_strannik` | 7 | ваш искатель приключений | PR | traits.otlichitelnye_kachestva | 1 |
| `kak_ustroena_igra` | 5 | введение | — | — | 1 |
| `kogda_primenyat_pravila_puteshestviy` | 18 | путешествия | — | journey.puteshestvie, journey.poryadok_puteshestviya | 1 |
| `manevrennaya_poziciya` | 17 | сражение | — | combat.boy, combat.shagi_v_raunde_blizhnego_boya | 1 |
| `manevrennaya_poziciya_dalniy_boy` | 17 | сражение | — | combat.sovershenie_atak, combat.vyhod_iz_boya | 1 |
| `nachalnyy_reyting_bditelnosti` | 15 | система | PR | eye.bditelnost_oka | 1 |
| `navstrechu_neizvedannomu` | 18 | путешествия | OR×2 | journey.karta | 1 |
| `oko_mordora_solo` | 15 | система | PR | eye.oko_mordora | 1 |
| `opredelenie_soprotivleniya` | 18 | советы | OR×1 | council.zavershenie_soveta | 1 |
| `oslozhneniya_preimushchestva_solo` | 17 | сражение | — | combat.oslozhneniya_i_preimuschestva | 1 |
| `osnovnaya_ideya` | 5 | введение | — | — | 1 |
| `osobennosti_solo` | 7 | ваш искатель приключений | — | rewards_virtues.osobennosti | 1 |
| `osobyy_uron` | 17 | сражение | — | combat.sovershenie_atak, combat.raneniya | 1 |
| `osobyy_uspekh_solo` | 11 | система | OR×1 | checks.special_successes | 1 |
| `pokrovitel` | 7 | ваш искатель приключений | — | — | 1 |
| `porog_presledovaniya` | 15 | система | PR | eye.presledovanie | 1 |
| `predydushchiy_opyt` | 6 | ваш искатель приключений | PR | hero_creation.previous_experience | 1 |
| `primenenie_stepeney_riska` | 11 | система | OR×2 | — | 1 |
| `prodvinutsya` | 17 | сражение | — | combat.boevye_zadachi | 1 |
| `puteshestvie_solo` | 18 | путешествия | — | journey.puteshestvie, solo.kachestvo_strannik | 1 |
| `raschet_celevogo_chisla` | 10 | система | PR | — | 1 |
| `razygryvanie_peregovorov` | 18 | советы | OR×2 | council.sotsialnoe_vzaimodeystvie | 1 |
| `reyting_bratstva` | 6 | ваш искатель приключений | PR | hero_creation.fellowship_rating | 1 |
| `rezultaty_na_kosti_ispytaniya` | 10 | система | OR×2 | checks.feat_die_values | 1 |
| `roli_v_puteshestvii` | 18 | путешествия | — | journey.puteshestvuyuschiy_otryad | 1 |
| `rost_bditelnosti` | 15 | система | PR+OR×1 | eye.bditelnost_oka | 1 |
| `sbros_bditelnosti` | 15 | система | PR | eye.bditelnost_oka | 1 |
| `sceny_obnaruzheniya` | 16 | система | PR+OR×1 | eye.presledovanie | 1 |
| `sceny_puteshestviya_solo` | 19/22 | путешествия | OR×1 | journey.razygryvanie_stsen_puteshestviya, journey.opisanie_stsen_puteshestviya | 2 |
| `sovet_solo` | 18 | советы | — | council.sovet | 1 |
| `sovmestnaya_igra` | 5 | введение | OR×2 | — | 1 |
| `sozdanie_geroya_obzor` | 6 | ваш искатель приключений | PR | — | 1 |
| `sposobnosti_vraga` | 17 | сражение | OR×1 | adversaries.format_opisaniya | 1 |
| `srazhayas_s_soboy` | 18 | сражение | OR×2 | — | 1 |
| `srazhenie` | 17 | сражение | — | combat.boy | 2 |
| `v_odinochku_v_dikih_krayah` | 4 | в одиночку в диких краях | — | — | 2 |
| `vazhnyy_tovarishch` | 7 | ваш искатель приключений | PR | hero_creation.important_companion | 1 |
| `vypolnenie_deystviy` | 10 | система | — | checks.when_required | 1 |
| `zadaniya_pokrovitelya` | 7 | ваш искатель приключений | OR×8 | — | 1 |

The 16 empty-`related` cards (for the under-linking audit): `bezopasnoe_mesto`, `chto_takoe_odinochnaya_igra`, `faza_bratstva_obzor`, `faza_priklyucheniy_obzor`, `glavnye_tablicy`, `ispolzovanie_drugih_tablic`, `kak_ustroena_igra`, `osnovnaya_ideya`, `pokrovitel`, `primenenie_stepeney_riska`, `raschet_celevogo_chisla`, `sovmestnaya_igra`, `sozdanie_geroya_obzor`, `srazhayas_s_soboy`, `v_odinochku_v_dikih_krayah`, `zadaniya_pokrovitelya`.

---

## 6. Stage-0 exit / stamping (UPDATED — `--id-prefix` now exists)
After a gate-3 PASS, **Ivan/author** (not the reviewer) runs:
```
python3 tools/extraction/mark_verified.py --dir content-packs/kv/mechanics --id-prefix solo. \
  --gate2 "<2a: GATE2A_IDO_FINDINGS.md @647fd6b + S1 backfill; 2b: verify_2b_ido 5/5>" \
  --gate3 "<lynn-review evidence>"
```
It re-runs gate-1 in-process (refuses if red), stamps `verified:true` + a `verification:{method,date,gates}` block, and is idempotent. **`--id-prefix solo.` stamps ONLY the 49 ИдО cards** (it prints `eligible 49 / skipped 140`); the **140 КВ cards are untouched** and await their own 2a/2b/3. The reviewer's PASS verdict is the `--gate3` evidence string — the reviewer does not run this command.

---

## 7. Sources & tooling
- **Cut source:** `tools/extraction/source_pages/{4..30}.txt` (book `igra_dlya_odnogo`). **Page images:** ИдО bundle `N.jpeg = folio N`, 1:1, no offset (Ivan local; gitignored). **Books + arch doc:** project knowledge (arch doc also now in repo @ `e1c1845`).
- **Source of truth = the build script** `tools/extraction/build_solo_overlay.py`: all cut anchors, summaries, and `related`/`params` decisions live there; JSON is derived (rebuild byte-identical). To inspect why a span/edge exists, read the script, not the JSON.
- **Gates:** `validate.py`, `independent_check.py`, `check_determinism.py`, `check_param_numbers.py [solo.]`, `confirm_s1_edges.py`. **Verify-only:** `mark_verified.py`. **gate-2b precedent (КВ):** `content-packs/kv/gate2b_evidence/MANIFEST.md` (ADR-002 = vision-spotcheck on numbers).
- **Prior records (read as map, NOT as truth):** `docs/HANDOFF_IDO_REVIEW.md` (b3ff49a brief, has §5 vision worklist + §7 judgment calls), `docs/GATE2A_IDO_FINDINGS.md` (2a verdicts @647fd6b), `docs/lynn_review_brief_stage0_session1.md`/`_session2.md` (lynn format for the tables/lifepaths layers), `KNOWN_ISSUES.md`, `ADR-001`, `ADR-002`.

**Output:** Verdict PASS/FAIL; per checklist item; blockers with exact `file:line`. Non-blocking → `known_issues` with severity. Do NOT merge / do NOT flip `verified` — that is `mark_verified.py` (§6), run by Ivan after PASS.
