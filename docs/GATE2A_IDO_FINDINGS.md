# Gate-2a (semantic) — «Игра для одного» solo overlay — FINDINGS (running draft)

**Reviewer session** (ADR-001: author ≠ reviewer). This document is a **verdict record**, produced by a fresh non-author instance.
**Scope:** 49 ИдО `kv.mechanics.solo.*` rule_cards at HEAD `251c523`. The 140 КВ cards are a **separate 2a session** (no review map exists for them yet).
**Verdict vocabulary** (ADR-002 §2a): **SUPPORTED / PARTIAL / UNSUPPORTED** — does `summary` (+ `parameters`) follow from `source_text` with nothing added beyond the cut quotes; are `subsystem`/`section` right; do `related`→core edges hit the **correct** core rule (plus an **under-linking** audit on empty `related`)?
**Base gates GREEN at this HEAD:** `validate` 222 · `independent_check` 676/0 · `check_determinism` byte-identical · `check_param_numbers solo.` 49/0 · `verify_2b_ido` 5/5.
**Routing:** every PARTIAL/UNSUPPORTED item and every doc fix is for a future **AUTHOR** session — the reviewer does not edit content or scripts. Stale-`notes`/cosmetic items are **non-blocking** for `verified:true`.

---

## Document-level findings (outside the 189-card scope)

### F-док-1 — arch §2.2 Feat-die encoding reversed — **[RESOLVED · fix approved by Ivan]**
`brodyazhnik-architecture-v1.md` **line 86** had the two Feat-die icons reversed vs the book.
Authoritative canon (book grep recorded in `KNOWN_ISSUES.md`; schema `common.schema.json` → `$defs.featDieFace`): **11 = Око, 12 = руна Гэндальфа**.
Exact edit (line 86):
- **OLD:** `Кость испытания (d12: 11 = руна Гэндальфа, 12 = Око)`
- **NEW:** `Кость испытания (d12: 11 = Око, 12 = руна Гэндальфа)`

Line 203 names the icons without numbers → no change. Cards are **unaffected** (built on the correct canon; the schema encodes it). The arch doc is **not in the repo** (knowledge-only) → apply in the knowledge copy, not via a repo commit.

### F-док-2 — "45 related→core edges" in the brief ≠ the artifact — **[for the record]**
HANDOFF Q4 and the starter cite **45** `related`→core edges. The artifact has **28** `related` (27 →core, 1 →solo, 0 dangling) plus **41** `oracle_refs`; the §6 map itself sums to 28. "45" is stale/erroneous.
**Method consequence:** gates catch only *dangling* refs, never *missing* ones → an explicit **under-linking audit** runs on the 29 empty-`related` cards, Eye and checks clusters first (cluster ③).

---

## Cluster ① — intro / orientation — 8 cards (введение ×6, «в одиночку в диких краях» ×2)

| card | folio | verdict | notes |
|---|---|---|---|
| `chto_takoe_odinochnaya_igra` | 4 | **SUPPORTED** | faithful; "механики нет" correctly stated; `related` [] correct (no mechanics) |
| `v_odinochku_v_dikih_krayah` | 4 | **SUPPORTED** | faithful; «Колоброд» = Пандора-Бокс canon for Strider; `related` [] correct — see **M2** (source cut artifact) |
| `osnovnaya_ideya` | 5 | **SUPPORTED** | paraphrases «герой и хранитель»; drops the slop word «являетесь» in the summary (source keeps it verbatim — fine) |
| `kak_ustroena_igra` | 5 | **SUPPORTED** | faithful; orientation prose; `related` [] correct |
| `glavnye_tablicy` | 5 | **SUPPORTED** | faithful index of 4 tables; **руна/знак** ambiguity of the source preserved, **not** over-interpreted into rune→luck/Eye→misfortune; 4 `oracle_refs` → answers/lore/luck/misfortune all EXIST |
| `sovmestnaya_igra` | 5 | **SUPPORTED** | faithful co-op orientation; 2 `oracle_refs` → answers/lore EXIST |
| `faza_bratstva_obzor` | 5 | **SUPPORTED** | faithful overview; `related` [] acceptable (overview — detail cards carry the core edges) — see **M1** |
| `faza_priklyucheniy_obzor` | 5 | **SUPPORTED** | faithful overview of the 3 solo diffs; 1 `oracle_ref` → journey_scenes EXISTS — see **M-cons** |

**Cluster ① result: 8 / 8 SUPPORTED.** No PARTIAL, no UNSUPPORTED. Minor doc-hygiene items below.

### Open question **Q7** — intro cards: keep as cards, or fold to summary? → **VERDICT: KEEP as cards**
1. They carry verbatim `source_text` + page provenance — the pack's core asset, exactly what gate-1 protects. Folding to a bare summary **discards the prose→page link**.
2. Zero `parameters`, ~0 edges → they do **not** pollute the mechanical graph; the narrative/RAG layer (§2.3 / §3 lore) genuinely wants the "what is solo play / Strider framing" orientation text as tone context.
3. Consistency: the overview cards (`faza_*_obzor`) are already cards with forward-refs; folding only *some* intro cards would split the taxonomy.
4. The purist "mechanics-only cards" alternative loses provenance and RAG value for no real benefit.
*Optional Stage-1 refinement (defer — schema change):* a `role:"orientation"` marker so the engine routes these to RAG, not the rules graph.

### Findings → AUTHOR session (all non-blocking for stamping)
- **M1 · MINOR · stale forward-ref notes.** `faza_bratstva_obzor.notes` says the стр.22 card «ещё не создана» — it now exists (`duhovnoe_vosstanovlenie`, `faza_bratstva_solo`). `faza_priklyucheniy_obzor.notes` says the стр.17 maneuver card «ещё не создана» — it now exists (`manevrennaya_poziciya`). Both notes were correct at B-ИдО.1 build time (forward-ref convention) but are **stale now that B-ИдО.3 landed**. Action: refresh/clear in `build_solo_overlay.py`; optionally graduate the forward-refs to intra-solo cross-refs (overview→detail). Scripts-only; rebuild must stay byte-identical.
- **M2 · INFO · source_text relinearization artifact.** `v_odinochku_v_dikih_krayah` span 1: «…зовут Колобродом». момента нашего знакомства…» — a dropped capital «С» of «С момента», from column linearization. It is **in-layer** (gate-1 pass) → faithful-as-cut, **not** a card defect; logged per the F5 / KNOWN_ISSUES precedent (text layer can drop words). No action required unless you want the cut re-anchored.
- **M-cons · INFO · oracle_refs on overview cards.** `faza_priklyucheniy_obzor` (an overview) carries an `oracle_ref` to `journey_scenes`, while the operative cards are `sceny_puteshestviya_solo` / `detali_scen`. Not wrong (the overview names the table), but pick a convention: bindings on overviews too, or only on operative cards. Mechanically inert until Stage-1 wiring.

---

## Verdict model (clusters ②–⑥)
Two **independent** axes per card, because a faithful summary and a correct edge are different properties:
- **Content** (ADR-002 §2a): SUPPORTED / PARTIAL / UNSUPPORTED — `summary`+`parameters` follow from `source_text`, nothing added; Пандора-Бокс canon; anti-slop; `params_ref`/`oracle_refs` resolve; rune-canon & effect-signs where relevant.
- **Edges**: OK / under-linked → [recommended target] / mis-targeted → [correction]. (Gates guarantee *no dangling* refs; correctness and *completeness* are this review.)

---

## STRUCTURAL FINDING **S1** — `related`→core convention not back-filled to B-ИдО.1/.2 (the central edge finding)
`build_solo_overlay.py` (l.14, l.42–44): the convention "overlay cards carry `related` edges to the КВ core cards they modify" was introduced **"From B-ИдО.3 on"**; for the earlier batches «`related` is empty … these intro/setup cards cross-reference only core-book pages (in prose) and the param/oracle tables». That rationale holds for genuine intro/setup/advice cards, but **14 B-ИдО.1/.2 cards are mechanical modifications of a core rule that exists as a core card** — they are under-linked relative to the now-standard convention, and the prose page-refs they rely on are *not machine-readable* (which is the whole reason `related` exists). All B-ИдО.3 edges (28) are correctly targeted; the gap is purely the un-retrofitted earlier batches.

**Recommended back-fill (author session — scripts-only, rebuild stays deterministic; all targets verified to exist):**

| under-linked card | batch | recommended `related`→core |
|---|---|---|
| `predydushchiy_opyt` | B1 | `hero_creation.previous_experience` |
| `reyting_bratstva` | B1 | `hero_creation.fellowship_rating` |
| `vazhnyy_tovarishch` | B1 | `hero_creation.important_companion` |
| `kachestvo_strannik` | B1 | `traits.otlichitelnye_kachestva` |
| `osobennosti_solo` | B1 | `rewards_virtues.osobennosti` |
| `vypolnenie_deystviy` | B2 | `checks.when_required` |
| `rezultaty_na_kosti_ispytaniya` | B2 | `checks.feat_die_values` |
| `osobyy_uspekh_solo` | B2 | `checks.special_successes` |
| `oko_mordora_solo` | B2 | `eye.oko_mordora` |
| `nachalnyy_reyting_bditelnosti` | B2 | `eye.bditelnost_oka` |
| `rost_bditelnosti` | B2 | `eye.bditelnost_oka` |
| `sbros_bditelnosti` | B2 | `eye.bditelnost_oka` |
| `porog_presledovaniya` | B2 | `eye.presledovanie` |
| `sceny_obnaruzheniya` | B2 | `eye.presledovanie` |

**Correctly empty `related` (no back-fill):** the four intro cards + `glavnye_tablicy`/`sovmestnaya_igra` (orientation/index); `primenenie_stepeney_riska` (**no** core «степени риска» card exists — verified); `ispolzovanie_drugih_tablic` (appendix pointer).
**Optional (overview/setup — empty defensible, edge would be nice-to-have):** `sozdanie_geroya_obzor`→`hero_creation.creating_heroes`, `pokrovitel`→`hero_creation.patron`, `bezopasnoe_mesto`→`hero_creation.safe_place`, `faza_*_obzor`→fellowship/overview.

---

## Cluster ② — «ваш искатель приключений» — 8 cards (folios 6–7)
Content **8/8 SUPPORTED** (every `params_ref`→`hero_adjustments`; prose numbers 15/10·3·18 match the verified table per HANDOFF §5 glance).

| card | content | edges |
|---|---|---|
| `sozdanie_geroya_obzor` | SUPPORTED | [] — optional → `hero_creation.creating_heroes` |
| `predydushchiy_opyt` | SUPPORTED | **under-linked → `hero_creation.previous_experience`** (S1) |
| `reyting_bratstva` | SUPPORTED | **under-linked → `hero_creation.fellowship_rating`** (S1) |
| `kachestvo_strannik` | SUPPORTED | **under-linked → `traits.otlichitelnye_kachestva`** (S1); is itself the target of `puteshestvie_solo`'s solo→solo edge ✔ |
| `vazhnyy_tovarishch` | SUPPORTED | **under-linked → `hero_creation.important_companion`** (S1) |
| `osobennosti_solo` | SUPPORTED | **under-linked → `rewards_virtues.osobennosti`** (S1); summary correctly flags "no exhaustive list — runtime judgment" |
| `pokrovitel` | SUPPORTED | [] — optional → `hero_creation.patron` |
| `bezopasnoe_mesto` | SUPPORTED | [] — optional → `hero_creation.safe_place` |

## Cluster ③ — «система» + Око — 11 cards (folios 10–16)
Content **11/11 SUPPORTED**. Rune-canon verified on `rezultaty_na_kosti_ispytaniya`: руна(Гэндальф)→таблица удачи, знак/Око→таблица неудачи ✔. Effect-signs on `rost_bditelnosti`: знак Ока вне боя +1, баллы Тени +N, таблица неудачи +2 ✔ (matches KNOWN_ISSUES canon).

| card | content | edges |
|---|---|---|
| `vypolnenie_deystviy` | SUPPORTED | **under-linked → `checks.when_required`** (S1) |
| `rezultaty_na_kosti_ispytaniya` | SUPPORTED | **under-linked → `checks.feat_die_values`** (S1); `oracle_refs` luck/misfortune ✔ |
| `osobyy_uspekh_solo` | SUPPORTED | **under-linked → `checks.special_successes`** (S1); `oracle_refs` special_successes ✔; 2b-closed |
| `primenenie_stepeney_riska` | SUPPORTED | **[] CORRECT** — no core «степени риска» card exists; `oracle_refs` answers/risk_degrees ✔ |
| `oko_mordora_solo` | SUPPORTED | **under-linked → `eye.oko_mordora`** (S1) |
| `nachalnyy_reyting_bditelnosti` | SUPPORTED | **under-linked → `eye.bditelnost_oka`** (S1) |
| `rost_bditelnosti` | SUPPORTED | **under-linked → `eye.bditelnost_oka`** (S1); `oracle_refs` misfortune ✔ |
| `sbros_bditelnosti` | SUPPORTED | **under-linked → `eye.bditelnost_oka`** (S1) |
| `porog_presledovaniya` | SUPPORTED | **under-linked → `eye.presledovanie`** (S1); card states the rule is *identical* to core — edge is exact |
| `sceny_obnaruzheniya` | SUPPORTED | **under-linked → `eye.presledovanie`** (S1); `oracle_refs` detection_scenes ✔ |

### Open question **Q3** — Eye granularity (split vs one card) → **VERDICT: KEEP the split** (6 cards incl. `sceny_obnaruzheniya`)
The book uses these sub-headings; the cards map to distinct `eye_of_mordor` sub-fields (initial_rating / growth_triggers / fellowship reset / pursuit_thresholds / detection) the engine dispatches separately; once S1 is applied they carry **distinct** core edges (`eye.bditelnost_oka` vs `eye.presledovanie`) and distinct `oracle_refs` — a merged card couldn't. Matches one-rule-one-card granularity used in combat/journey. Merge rejected.

## Cluster ④ — «сражение» — 9 cards (folio 17–18) · B-ИдО.3 edges
Content **9/9 SUPPORTED**. **All 13 combat edges correctly targeted** (incl. `manevrennaya_poziciya`→`shagi_v_raunde_blizhnego_boya` for opening volleys; `manevrennaya_poziciya_dalniy_boy`→`sovershenie_atak`+`vyhod_iz_boya`; `prodvinutsya`→`boevye_zadachi`; `osobyy_uron`→`sovershenie_atak`+`raneniya`; `oslozhneniya_preimushchestva_solo`→`oslozhneniya_i_preimuschestva`).
**Soft edge refinements (not defects):** `sposobnosti_vraga`→`combat.boy` is fine but enemy Abilities/Resolve/Hate arguably live in `adversaries.protivniki` — consider adding. `srazhenie` 2nd span (the «В меньшинстве» sidebar about exiting) — optionally + `combat.vyhod_iz_boya`.

### **Q1** — sidebar split → **VERDICT: ACCEPT (asymmetry justified).** «В меньшинстве, в неравном бою» (f17) is combat-*overview* framing tightly coupled to the maneuver/exit tools → correctly folded as `srazhenie`'s 2nd span. «Сражаясь с собой» (f18) is a standalone GMing-advice topic on a different folio → correctly its own card. The asymmetry tracks a real content difference (overview-framing vs standalone-advice), not an inconsistency.
### **Q2** — `srazhayas_s_soboy` keep/drop/merge (rule-vs-advice) → **VERDICT: KEEP as a card, but reclassify as ADVICE and soften its edge.** It is pure GMing guidance («принцип крутизны»), no mechanics — but it carries verbatim source+provenance and is exactly the tone-context the narrative layer wants (combat intent = *cinematic*, not win-optimised), so KEEP, consistent with Q7. Its `related→combat.boy` is the one **weak** edge in B-ИдО.3 (an advice card shouldn't claim to modify the Бой *rule*) → recommend dropping/softening it. Don't merge (different folio, distinct topic).

## Cluster ⑤ — «путешествия» — 6 cards (folios 18–22) · B-ИдО.3 edges
Content **6/6 SUPPORTED**. **All journey edges correctly targeted** (`kogda_primenyat…`→`puteshestvie`+`poryadok_puteshestviya`; `roli_v_puteshestvii`→`puteshestvuyuschiy_otryad` — roles removed; `puteshestvie_solo`→`puteshestvie`+solo `kachestvo_strannik` ✔; `detali_scen`→`opisanie_stsen_puteshestviya`, 9 `oracle_refs` incl. 7 `scene_details.*` all EXIST; terrain −1к/+1к ✔ 2b-closed).

### **Q6** — `sceny_puteshestviya_solo` 2-span (f19 solo + f22 co-op tail): co-op tail here vs `sovmestnaya_igra`? → **VERDICT: correctly attributed here.** The f22 tail is *journey-scene-specific* co-op guidance (which scene table a 3+ party uses, how to pick the scene's target hero) — a qualification of the journey-scene rule, not general co-op orientation. `sovmestnaya_igra` (f5) is the *general* co-op intro. The journey-scene-specific tail belongs on the journey-scene card, not the general one. Split is right.

## Cluster ⑥ — «советы» (3) + «фаза братства» (2) + «приложение» (1) — folios 18, 22, 30 · B-ИдО.3 edges
Content **6/6 SUPPORTED**. **All council/fellowship edges correctly targeted** (`sovet_solo`→`council.sovet`; `razygryvanie_peregovorov`→`council.sotsialnoe_vzaimodeystvie`; `opredelenie_soprotivleniya`→`council.zavershenie_soveta` — **verified correct**: that core card is the «владелец механики Совета» holding the 3/6/9 ratings; `faza_bratstva_solo`→`struktura_fazy_bratstva`+`yol`, `oracle_refs` milestones ✔).
**Soft refinement:** `duhovnoe_vosstanovlenie`→`fellowship_phase.struktura_fazy_bratstva` is fine; since it modifies *Shadow* removal, optionally + a `shadow.*` edge. `ispolzovanie_drugih_tablic` (appendix) → `[]` correct.

### **Q5** — resistance 3/6/9 left in `source_text` only (no solo table) → **VERDICT: posture CORRECT.** 3/6/9 are **core** Council values, canonical in `council.zavershenie_soveta`, merely restated in the solo card's prose. There is no solo *adjustment* to single-source, so no `params_ref` and no duplicated integer — `check_param_numbers solo.` correctly has nothing to trace here. (Side-note for the КВ 2a session: confirm 3/6/9 are carried as `parameters` in the core council card, not summary-only.)

---

## GATE-2A BOTTOM LINE (49 ИдО cards)
- **Content fidelity: 49 / 49 SUPPORTED.** No PARTIAL, no UNSUPPORTED. Summaries faithful, Пандора-Бокс canon, anti-slop clean, every `params_ref`/`oracle_ref` resolves, rune-canon & effect-signs correct.
- **Edges:** **28 / 28 B-ИдО.3 edges correctly targeted.** **14 B-ИдО.1/.2 cards under-linked (S1)** — recommend back-fill (map above). 4 soft refinements (advisory). 1 weak edge (`srazhayas_s_soboy`→`combat.boy`, per Q2).
- **Open questions: 7 / 7 resolved** — Q1 accept-with-rationale · Q2 keep-as-advice+soften-edge · Q3 keep-split · Q4→S1 · Q5 posture-correct · Q6 attribution-correct · Q7 keep-as-cards.
- **Doc-level:** F-док-1 (rune §2.2) RESOLVED · F-док-2 (45→28) recorded. **Minor:** M1 stale notes · M2 relinearization (in-layer, non-defect) · M-cons oracle-on-overview.

### Recommended path to stamp (this is a coordination call, not a reviewer action)
1. **Author session** applies S1 back-fill (14 edges) + Q2 edge-softening + M1 note refresh in `build_solo_overlay.py`; rebuild must stay byte-identical-to-itself (deterministic).
2. **Quick gate-2a edge re-confirm** (the 14 new edges hit the listed targets — cheap).
3. **gate-3 (lynn-review)** — separate fresh session (ADR-001).
4. `mark_verified.py --dir content-packs/kv/mechanics --id-prefix solo. …` — stamps the 49 ИдО cards only (the agreed filter; КВ-140 awaits its own 2a/3).

*Alternative:* stamp now and carry **S1 as tracked debt** — defensible since content is 49/49 SUPPORTED, but it bakes the inconsistent edge graph into "verified". Reviewer recommendation: **fix S1 first** (consistency + Stage-1 engine reads these edges).

