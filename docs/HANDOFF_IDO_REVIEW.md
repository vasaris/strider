# HANDOFF — Stage 0 exit review: «Игра для одного» solo overlay

Prepared 2026-06-24 at commit `b3ff49a` by the EXTRACTION author, for transfer to a FRESH review session.

## 0. ADR-001 boundary (read first)
This is a **task brief, not a review**. Per ADR-001 (author ≠ reviewer), gate-2a (semantics) and gate-3 (lynn-review) MUST run in a **fresh session by a non-author instance**. This document deliberately contains **no verdicts** ("correct/incorrect") — only WHAT to check and HOW, so the reviewer judges independently. Do not treat any framing here as a finding.

## 1. Current state
- **222 files**: 140 КВ mechanics rule_cards + **49 ИдО solo rule_cards** + 25 solo oracle/param tables + 8 lifepath tables.
- **Automated gates GREEN at HEAD**: `validate` 222 · `independent_check` 676/0 · `check_determinism` byte-identical · `check_param_numbers solo.` 49/0.
- **verified status**: 33 tables = `true` (done, Sessions 1/2). **189 rule_cards = `false`** (140 КВ + 49 ИдО) — this is what Stage-0 exit needs.

## 2. GUARANTEED by automated gates — do NOT re-verify
- `source_text` is **verbatim from the publisher text layer** (gate-1: every span occurs in the page blob). Text was **cut, not typed** — do not re-check transcription.
- Deterministic byte-identical rebuild.
- Every **integer in `parameters`** traces to a digit in that card's `source_text`.
- **No dangling `related`** refs to `kv.mechanics.*`.

## 3. NOT checked by gates — THIS IS THE REVIEW JOB
- **gate-2a (semantics):** is each `summary` a faithful, non-misleading engineering annotation? Is `subsystem`/`section` right? Do `related`→core edges point at the **correct** core rule (full map §6)? Terminology canon (Пандора Бокс) in summaries. Anti-slop on any prose.
- **gate-2b (vision, numbers-in-prose):** `check_param_numbers` covers only `parameters` integers. Numbers living **only in `source_text`** are unchecked → verify against page IMAGES. Precise worklist §5.
- **gate-3 (lynn-review):** final holistic pass.

## 4. Stage-0 exit mechanism
After 2a + 2b + 3 PASS:
```
python3 tools/extraction/mark_verified.py --dir content-packs/kv/mechanics \
  --gate2 "<2a+2b evidence>" --gate3 "<lynn-review evidence>"
```
Re-runs gate-1 in-process (refuses if red), stamps `verified:true`, idempotent.
**Coordination caveat:** `--dir content-packs/kv/mechanics` stamps **all 189** rule_cards (КВ + ИдО), since they share the dir and none are yet verified (idempotent-skip won't spare them). Therefore the **140 КВ cards must ALSO have completed 2a/2b/3** before this runs. КВ already has gate-2b evidence in `content-packs/kv/gate2b_evidence/MANIFEST.md`; confirm КВ 2a/3 status (or add a per-id filter to mark_verified) — do not stamp ИдО-only and silently flip unreviewed КВ cards.

## 5. ИдО gate-2b vision worklist (precise — prose-only mechanical numbers)
Render the ИдО folio image (supplement bundle is **N.jpeg = folio N**, 1:1, no offset). Independently transcribe EXPECTED from the image (do **not** copy from the card), diff, and include a negative control (a deliberately wrong value must fail).
- **prodvinutsya** (folio 17): +1к к следующей дальней атаке; +1к за каждый знак
- **manevrennaya_poziciya_dalniy_boy** (folio 17): −1к врагам ближнего боя; −1к дальним атакам героя; выход из боя — дальняя атака без −1к
- **opredelenie_soprotivleniya** (folio 18): сопротивление 3 (разумная) / 6 (смелая) / 9 (дерзкая)
- **osobyy_uspekh_solo** (folio 11): 1 знак → 1 эффект (счёт)
- **detali_scen** (folio 19): рельеф: −1к (сложный) / +1к (дорога)

Lower priority (number is canonical in a **verified** table → gate-2b already done in Session 1; glance only to confirm the prose restatement matches the table): `predydushchiy_opyt` (15/10 → hero_adjustments), `reyting_bratstva` (3), `raschet_celevogo_chisla` (18/20), `nachalnyy_reyting_bditelnosti`/`rost_bditelnosti` (Eye mods → eye_of_mordor), `duhovnoe_vosstanovlenie` (1/2/3 → shadow_recovery).

## 6. The 49 ИдО card review map
Legend: PR = params_ref (number canonical in verified table); OR×n = n oracle_refs; related shows the КВ core (and any solo:) cards this overlay links to; flags: `2b` = on the §5 vision worklist, `Nsp` = N source_text spans.

| card | folio | section | params/oracle | related → core | flags |
|---|---|---|---|---|---|
| `bezopasnoe_mesto` | 6 | ваш искатель приключений | — | — |  |
| `chto_takoe_odinochnaya_igra` | 4 | в одиночку в диких краях | — | — |  |
| `detali_scen` | 19 | путешествия | OR×9 | journey.opisanie_stsen_puteshestviya | 2b |
| `deystviya_protivnikov` | 17 | сражение | — | combat.boy, combat.sovershenie_atak |  |
| `duhovnoe_vosstanovlenie` | 22 | фаза братства | PR:shadow_recovery | fellowship_phase.struktura_fazy_bratstva |  |
| `faza_bratstva_obzor` | 5 | введение | — | — |  |
| `faza_bratstva_solo` | 22 | фаза братства | OR×1 | fellowship_phase.struktura_fazy_bratstva, fellowship_phase.yol |  |
| `faza_priklyucheniy_obzor` | 5 | введение | OR×1 | — |  |
| `glavnye_tablicy` | 5 | введение | OR×4 | — |  |
| `ispolzovanie_drugih_tablic` | 30 | приложение | — | — |  |
| `kachestvo_strannik` | 7 | ваш искатель приключений | PR:hero_adjustments | — |  |
| `kak_ustroena_igra` | 5 | введение | — | — |  |
| `kogda_primenyat_pravila_puteshestviy` | 18 | путешествия | — | journey.puteshestvie, journey.poryadok_puteshestviya |  |
| `manevrennaya_poziciya` | 17 | сражение | — | combat.boy, combat.shagi_v_raunde_blizhnego_boya |  |
| `manevrennaya_poziciya_dalniy_boy` | 17 | сражение | — | combat.sovershenie_atak, combat.vyhod_iz_boya | 2b |
| `nachalnyy_reyting_bditelnosti` | 15 | система | PR:eye_of_mordor | — |  |
| `navstrechu_neizvedannomu` | 18 | путешествия | OR×2 | journey.karta |  |
| `oko_mordora_solo` | 15 | система | PR:eye_of_mordor | — |  |
| `opredelenie_soprotivleniya` | 18 | советы | OR×1 | council.zavershenie_soveta | 2b |
| `oslozhneniya_preimushchestva_solo` | 17 | сражение | — | combat.oslozhneniya_i_preimuschestva |  |
| `osnovnaya_ideya` | 5 | введение | — | — |  |
| `osobennosti_solo` | 7 | ваш искатель приключений | — | — |  |
| `osobyy_uron` | 17 | сражение | — | combat.sovershenie_atak, combat.raneniya |  |
| `osobyy_uspekh_solo` | 11 | система | OR×1 | — | 2b |
| `pokrovitel` | 7 | ваш искатель приключений | — | — |  |
| `porog_presledovaniya` | 15 | система | PR:eye_of_mordor | — |  |
| `predydushchiy_opyt` | 6 | ваш искатель приключений | PR:hero_adjustments | — |  |
| `primenenie_stepeney_riska` | 11 | система | OR×2 | — |  |
| `prodvinutsya` | 17 | сражение | — | combat.boevye_zadachi | 2b |
| `puteshestvie_solo` | 18 | путешествия | — | journey.puteshestvie, solo.kachestvo_strannik |  |
| `raschet_celevogo_chisla` | 10 | система | PR:hero_adjustments | — |  |
| `razygryvanie_peregovorov` | 18 | советы | OR×2 | council.sotsialnoe_vzaimodeystvie |  |
| `reyting_bratstva` | 6 | ваш искатель приключений | PR:hero_adjustments | — |  |
| `rezultaty_na_kosti_ispytaniya` | 10 | система | OR×2 | — |  |
| `roli_v_puteshestvii` | 18 | путешествия | — | journey.puteshestvuyuschiy_otryad |  |
| `rost_bditelnosti` | 15 | система | PR:eye_of_mordor, OR×1 | — |  |
| `sbros_bditelnosti` | 15 | система | PR:eye_of_mordor | — |  |
| `sceny_obnaruzheniya` | 16 | система | PR:eye_of_mordor, OR×1 | — |  |
| `sceny_puteshestviya_solo` | 19,22 | путешествия | OR×1 | journey.razygryvanie_stsen_puteshestviya, journey.opisanie_stsen_puteshestviya | 2sp |
| `sovet_solo` | 18 | советы | — | council.sovet |  |
| `sovmestnaya_igra` | 5 | введение | OR×2 | — |  |
| `sozdanie_geroya_obzor` | 6 | ваш искатель приключений | PR:hero_adjustments | — |  |
| `sposobnosti_vraga` | 17 | сражение | OR×1 | combat.boy |  |
| `srazhayas_s_soboy` | 18 | сражение | OR×2 | combat.boy |  |
| `srazhenie` | 17 | сражение | — | combat.boy | 2sp |
| `v_odinochku_v_dikih_krayah` | 4 | в одиночку в диких краях | — | — | 2sp |
| `vazhnyy_tovarishch` | 7 | ваш искатель приключений | PR:hero_adjustments | — |  |
| `vypolnenie_deystviy` | 10 | система | — | — |  |
| `zadaniya_pokrovitelya` | 7 | ваш искатель приключений | OR×8 | — |  |

## 7. Open judgment calls (consolidated from extraction self-assessments — rule independently)
1. **Sidebar handling.** «В меньшинстве, в неравном бою» (f17) folded as a 2nd span into `srazhenie`; «Сражаясь с собой» (f18) kept as its OWN card `srazhayas_s_soboy`. Right split?
2. **`srazhayas_s_soboy`** — borderline rule-vs-advice (GMing guidance, «принцип крутизны»). Keep / drop / merge?
3. **Eye of Mordor granularity.** Split into 5 cards (`oko_mordora_solo`, `nachalnyy_reyting_bditelnosti`, `rost_bditelnosti`, `sbros_bditelnosti`, `porog_presledovaniya`) mirroring the book's sub-headings and `eye_of_mordor` sub-fields. Right granularity, or one card?
4. **`related`→core convention (NEW, from B-ИдО.3).** Overlay cards link to the КВ core card they modify (45 edges; map in §6). Verify each edge targets the **correct** core rule — this is the highest-value semantic check and is the author's judgment, not the book's.
5. **`params_ref` / number sourcing.** Solo numbers are single-sourced in verified tables (hero_adjustments/eye_of_mordor/shadow_recovery), referenced not duplicated. Resistance **3/6/9** (`opredelenie_soprotivleniya`) are **core Council** values restated in prose (no solo table), left in `source_text` only — confirm that posture.
6. **`sceny_puteshestviya_solo`** — 2 spans: f19 (solo rule) + f22 (co-op tail), split by the interleaved scene tables on f19–21. Is the co-op tail correctly attributed here vs `sovmestnaya_igra`?
7. **Intro cards.** `v_odinochku_v_dikih_krayah`, `chto_takoe_odinochnaya_igra` (f4) are low-mechanics orientation prose — keep as cards or fold to summary?

## 8. Sources & tooling
- **Cut source:** `tools/extraction/source_pages/{4..30}.txt` (book `igra_dlya_odnogo`). **Page images:** ИдО bundle, `N.jpeg = folio N` (Ivan local; in `.gitignore`).
- **Source of truth = the build script.** All cut anchors, summaries, and `related`/`params` decisions live in `tools/extraction/build_solo_overlay.py`; JSON is derived (rebuild is byte-identical). To inspect why a span/edge exists, read the script, not the JSON.
- **Gates:** `validate.py`, `independent_check.py`, `check_determinism.py`, `check_param_numbers.py [solo.]`. **Verify, never author:** `mark_verified.py`.
- **gate-2b precedent (КВ):** `content-packs/kv/gate2b_evidence/MANIFEST.md` (sha256 + offsets + verification log; ADR-002 = vision-spotcheck on numbers).
- **Scope note:** this brief covers the **49 ИдО** cards. The 140 КВ cards are also `verified:false`; coordinate so `mark_verified` runs only after the full 189-card pack has cleared 2a/2b/3 (see §4 caveat).
