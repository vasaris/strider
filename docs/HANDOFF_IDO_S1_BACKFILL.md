# HANDOFF — Stage-0 exit: apply gate-2a fixes (S1 back-fill + Q2 + M1 + `mark_verified` filter)

**Prepared by the gate-2a REVIEWER session** (commit `647fd6b`, full verdicts in `docs/GATE2A_IDO_FINDINGS.md`), for a **fresh AUTHOR session**.
**ADR-001 boundary:** this is an AUTHOR task. It must NOT run in the gate-2a reviewer session (which found these) and NOT in the gate-3 session. Reviewer specifies; author applies; a later quick edge-confirm + gate-3 certify.
**Scope:** ИдО solo overlay only (`kv.mechanics.solo.*`, 49 cards, all `verified:false`). **Never touch the 140 КВ cards or the existing B-ИдО.3 edges** (except the one Q2 softening below). Scripts-only — JSON is derived. ASCII commit messages, `-m` only.

Gate-2a result this implements: **content 49/49 SUPPORTED**; **28/28 B-ИдО.3 edges correct**; the only structural gap is **S1** — the `related`→core convention (introduced "from B-ИдО.3 on") was never back-filled to the B-ИдО.1/.2 cards.

---

## TASK A — edit `tools/extraction/build_solo_overlay.py` (then regenerate + commit)

These cards are currently defined with `related=None` (→ `[]`). The B-ИдО.1/.2 card definitions live before the B-ИдО.3 combat block (which already passes explicit `related=[...]`).

### A1 · S1 back-fill — add these 14 `related` edges (all targets verified to exist)
```
predydushchiy_opyt              -> ["kv.mechanics.hero_creation.previous_experience"]
reyting_bratstva                -> ["kv.mechanics.hero_creation.fellowship_rating"]
vazhnyy_tovarishch              -> ["kv.mechanics.hero_creation.important_companion"]
kachestvo_strannik              -> ["kv.mechanics.traits.otlichitelnye_kachestva"]
osobennosti_solo                -> ["kv.mechanics.rewards_virtues.osobennosti"]
vypolnenie_deystviy             -> ["kv.mechanics.checks.when_required"]
rezultaty_na_kosti_ispytaniya   -> ["kv.mechanics.checks.feat_die_values"]
osobyy_uspekh_solo              -> ["kv.mechanics.checks.special_successes"]
oko_mordora_solo                -> ["kv.mechanics.eye.oko_mordora"]
nachalnyy_reyting_bditelnosti   -> ["kv.mechanics.eye.bditelnost_oka"]
rost_bditelnosti                -> ["kv.mechanics.eye.bditelnost_oka"]
sbros_bditelnosti               -> ["kv.mechanics.eye.bditelnost_oka"]
porog_presledovaniya            -> ["kv.mechanics.eye.presledovanie"]
sceny_obnaruzheniya             -> ["kv.mechanics.eye.presledovanie"]
```
Do **not** add edges to the cards the reviewer marked "correctly empty" (`primenenie_stepeney_riska` — no core «степени риска» card; the four intro cards; `glavnye_tablicy`/`sovmestnaya_igra`; `ispolzovanie_drugih_tablic`). The three "optional" overview edges (`sozdanie_geroya_obzor`, `pokrovitel`, `bezopasnoe_mesto`) are author's discretion — out of scope for this required pass unless you want them.

### A2 · Q2 — soften the one weak edge
`srazhayas_s_soboy` is an ADVICE card («принцип крутизны»), not a rule-modification. Change its `related` from `["kv.mechanics.combat.boy"]` to **`[]`** (keep the card; it stays valuable as narrative/RAG tone-context). If you want to preserve the pointer, move it to `notes` as prose — but not in `related`.

### A3 · M1 — refresh 2 stale forward-ref `notes`
Both now reference cards that exist (B-ИдО.3 landed). Remove the false «ещё не создана» wording:
- `faza_bratstva_obzor.notes` — the стр.22 target now exists (`duhovnoe_vosstanovlenie` / `faza_bratstva_solo`).
- `faza_priklyucheniy_obzor.notes` — the стр.17 target now exists (`manevrennaya_poziciya`).
Either clear the note or restate it as a resolved cross-reference. (`source_text`/`summary` must NOT change — gate-1 / independent_check.)

### Regenerate + commit (A)
```
cd ~/Downloads/brodyazhnik
python3 tools/extraction/build_solo_overlay.py          # rewrites the 49 solo JSON with the new edges
python3 tools/extraction/validate.py                    # expect OK 222
python3 tools/extraction/independent_check.py            # expect 676 / 0  (edges don't touch text)
python3 tools/extraction/check_param_numbers.py solo.    # expect 49 / 0  (no new ints)
python3 tools/extraction/check_determinism.py            # expect byte-identical (now reflects new edges)
git add tools/extraction/build_solo_overlay.py content-packs/kv/mechanics
git commit -m "solo overlay: backfill B-IDO.1/.2 related->core edges (S1), soften srazhayas_s_soboy edge, refresh stale notes"
```

### Edge re-confirm (gate-2a step 2 — run after A and paste output)
Save as `tools/extraction/confirm_s1_edges.py` (or run inline) — asserts the 14 edges are present at the right targets and the Q2 edge is gone:
```python
import json, glob
EXPECT = {
 "predydushchiy_opyt":"hero_creation.previous_experience","reyting_bratstva":"hero_creation.fellowship_rating",
 "vazhnyy_tovarishch":"hero_creation.important_companion","kachestvo_strannik":"traits.otlichitelnye_kachestva",
 "osobennosti_solo":"rewards_virtues.osobennosti","vypolnenie_deystviy":"checks.when_required",
 "rezultaty_na_kosti_ispytaniya":"checks.feat_die_values","osobyy_uspekh_solo":"checks.special_successes",
 "oko_mordora_solo":"eye.oko_mordora","nachalnyy_reyting_bditelnosti":"eye.bditelnost_oka",
 "rost_bditelnosti":"eye.bditelnost_oka","sbros_bditelnosti":"eye.bditelnost_oka",
 "porog_presledovaniya":"eye.presledovanie","sceny_obnaruzheniya":"eye.presledovanie"}
cards={json.load(open(p,encoding="utf-8"))["id"]:json.load(open(p,encoding="utf-8")) for p in glob.glob("content-packs/kv/mechanics/*.json")}
bad=0
for name,tgt in EXPECT.items():
    rel=cards["kv.mechanics.solo."+name]["payload"]["related"]
    if ("kv.mechanics."+tgt) not in rel: print("MISSING",name,"->",tgt,"(got",rel,")"); bad+=1
srz=cards["kv.mechanics.solo.srazhayas_s_soboy"]["payload"]["related"]
if srz!=[]: print("Q2 NOT applied: srazhayas_s_soboy related =",srz); bad+=1
print("S1 edge re-confirm:", "PASS 14/14 + Q2 ok" if bad==0 else f"FAIL ({bad})")
```

---

## TASK B — add `--id-prefix` to `tools/extraction/mark_verified.py` (tooling; needed before stamping)
Without it, `--dir content-packs/kv/mechanics` stamps all 189 cards (КВ + ИдО). Add an optional `--id-prefix`:
- argparse: `ap.add_argument("--id-prefix", default=None)`.
- Eligibility: a file is stamped iff `--id-prefix` is unset **or** `doc["id"].startswith("kv.mechanics." + args.id_prefix)`. So `--id-prefix solo.` ⇒ only `kv.mechanics.solo.*` (49); the 140 КВ cards are skipped. Keep the existing gate-1-rerun, idempotent already-verified skip, and the `verification:{method,date,gates}` block.
- Print a summary: eligible count + skipped count before stamping.

Verify B without stamping (idempotent, but confirm the count): run with a throwaway dir copy or read the eligibility print — `--id-prefix solo.` must report **49 eligible / 140 skipped**.

---

## /goal (ready to paste — Claude Code, auto mode, accept trust dialog)
```
/goal Apply gate-2a fixes to the ИдО solo overlay, scripts-only. In tools/extraction/build_solo_overlay.py:
(A1) add the 14 related->core edges from docs handoff HANDOFF_IDO_S1_BACKFILL.md §A1 to the named B-IDO.1/.2 cards;
(A2) set srazhayas_s_soboy related to []; (A3) remove the stale "ещё не создана" wording from faza_bratstva_obzor
and faza_priklyucheniy_obzor notes (do NOT touch any source_text or summary). Then regenerate by running
build_solo_overlay.py. DONE when, in the transcript: validate.py prints OK 222; independent_check.py prints
failures: 0; check_param_numbers.py solo. prints OK across 49; check_determinism.py prints byte-identical; and
the §A edge re-confirm snippet prints "PASS 14/14 + Q2 ok". CONSTRAINTS: never edit the 140 КВ cards or any
existing B-IDO.3 combat/journey/council/fellowship edge except the single A2 change; never hand-edit JSON
(only via the script); ASCII commit, -m only. STOP and ask if any target id does not resolve. Stop after 25 turns.
```
(TASK B may be the same session or a separate small one; it has no determinism interaction with TASK A.)

---

## After this brief
1. AUTHOR applies TASK A (+ edge re-confirm PASS) and TASK B; commits.
2. **gate-3 (lynn-review)** — a separate fresh session (ADR-001), reading the now-final 49 cards.
3. `python3 tools/extraction/mark_verified.py --dir content-packs/kv/mechanics --id-prefix solo. --gate2 "<2a:GATE2A_IDO_FINDINGS.md @647fd6b + S1 backfill; 2b:ido_manifest.md+verify_2b_ido 5/5>" --gate3 "<lynn evidence>"` — stamps the 49 ИдО cards only. КВ-140 await their own 2a/2b/3.
4. Also (separate, knowledge copy): apply F-док-1 — arch §2.2 line 86 `11 = Око, 12 = руна Гэндальфа`.
