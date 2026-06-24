# gate-2b evidence — «Игра для одного» solo overlay (prose-only mechanical numbers)

Pass run at commit `b3ff49a` by the EXTRACTION author (ADR-002 posture: vision
spot-check on numbers). Scope: the in-prose mechanical numbers that `check_param_numbers`
cannot see (they live in `source_text`, not in `parameters`). All other ИдО numbers are
canonical in the verified solo tables (`hero_adjustments` / `eye_of_mordor` /
`shadow_recovery`), already gate-2b'd in Session 1.

**Method.** EXPECTED phrases transcribed INDEPENDENTLY from the ИдО folio scans (bundle
`N.jpeg = folio N`, 1:1, no offset), NOT copied from the cards. Reproducible verifier:
`tools/extraction/verify_2b_ido.py` — asserts each EXPECTED phrase is in the card's
`source_text` and that a deliberately-wrong NEGATIVE control is absent (proving the check
can fail). Result: **5/5 cards, 0 discrepancies.**

| card | folio | number(s) verified vs scan | result |
|---|---|---|---|
| `prodvinutsya` | 17 | success → **+1к** to next ranged attack; **+1к** per success sign | MATCH |
| `manevrennaya_poziciya_dalniy_boy` | 17 | melee attackers **−1к**; hero's ranged attacks **−1к**; exit-combat ranged check **not** −1к | MATCH |
| `opredelenie_soprotivleniya` | 18 | resistance **3** (reasonable) / **6** (bold) / **9** (daring) | MATCH |
| `osobyy_uspekh_solo` | 11 | **1** sign or more → significant; choose **1** effect per sign | MATCH |
| `detali_scen` | 19 | terrain: difficult **−1к** / road **+1к** | MATCH |

**Negative controls** (asserted ABSENT, all confirmed absent): `получает 2к…`,
`убирается 2к`, `4 для разумной просьбы`, `Выберите 2 эффекта`, `уберите 2к…`.

**Boundary.** This is gate-2b (vision/numbers) only. gate-2a (semantics) and gate-3
(lynn-review) remain separate fresh non-author sessions (ADR-001); `verified:true` is set
by `mark_verified.py` only after 2a+3. Verify command: `python3 tools/extraction/verify_2b_ido.py`.
