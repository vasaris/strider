"""Gate-2b (ADR-002) vision spotcheck for the 6 cultural stat blocks, folios 32-43.

The EXPECTED values below were transcribed INDEPENDENTLY from the rendered page
images (КВ core PDF, page = folio + 1), NOT copied from the JSON cards. This script
diffs every number in each culture card (6 characteristic sets, 3 derived stats, 18
skills, base + free weapon skills) against those scan values and fails on any mismatch.

It makes the gate-2b culture pass reproducible and guards against future drift if a
build change ever touches a culture number. Run:  python3 verify_gate2b_cultures.py

NB: this does NOT set verified:true (only mark_verified.py does, after gate 2a + 3).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

MECH = Path(__file__).parent.parents[1] / "content-packs" / "kv" / "mechanics"

SKILL_ORDER = [
    "awe", "inspire", "persuade", "athletics", "travel", "stealth",
    "awareness", "insight", "search", "hunting", "healing", "exploration",
    "song", "courtesy", "riddle", "craft", "battle", "lore",
]

# EXPECTED values read off the page scans (folios 32-43).
EXPECTED = {
    "bardings": {  # folios 32-33
        "chars": [(5, 7, 2), (4, 7, 3), (5, 6, 3), (4, 6, 4), (5, 5, 4), (6, 6, 2)],
        "derived": ("strength+20", "heart+8", "wits+12"),
        "skills": [1, 2, 3, 1, 1, 0, 0, 2, 1, 2, 0, 1, 1, 2, 0, 1, 2, 1],
        "wbase": (["bows", "swords"], 2), "wfree": (1, 1),
    },
    "dwarves_of_durins_folk": {  # folios 34-35
        "chars": [(7, 2, 5), (7, 3, 4), (6, 3, 5), (6, 4, 4), (5, 4, 5), (6, 2, 6)],
        "derived": ("strength+22", "heart+8", "wits+10"),
        "skills": [2, 0, 0, 1, 3, 0, 0, 0, 3, 0, 0, 2, 1, 1, 2, 2, 1, 1],
        "wbase": (["axes", "swords"], 2), "wfree": (1, 1),
    },
    "men_of_bree": {  # folios 36-37
        "chars": [(2, 5, 7), (3, 4, 7), (3, 5, 6), (4, 4, 6), (4, 5, 5), (2, 6, 6)],
        "derived": ("strength+20", "heart+10", "wits+10"),
        "skills": [0, 2, 2, 1, 1, 1, 1, 2, 1, 1, 0, 1, 1, 3, 2, 2, 0, 0],
        "wbase": (["axes", "spears"], 2), "wfree": (1, 1),
    },
    "rangers_of_the_north": {  # folios 38-39
        "chars": [(7, 5, 2), (7, 4, 3), (6, 5, 3), (6, 4, 4), (5, 5, 4), (6, 6, 2)],
        "derived": ("strength+20", "heart+6", "wits+14"),
        "skills": [1, 0, 0, 2, 2, 2, 2, 0, 1, 2, 2, 2, 0, 0, 0, 0, 2, 2],
        "wbase": (["spears", "swords"], 2), "wfree": (1, 1),
    },
    "hobbits_of_the_shire": {  # folios 40-41
        "chars": [(3, 6, 5), (3, 7, 4), (2, 7, 5), (4, 6, 4), (4, 5, 5), (2, 6, 6)],
        "derived": ("strength+18", "heart+10", "wits+12"),
        "skills": [0, 0, 2, 0, 0, 3, 2, 2, 0, 0, 1, 0, 2, 2, 3, 1, 0, 0],
        "wbase": (["bows", "swords"], 2), "wfree": (1, 1),
    },
    "elves_of_lindon": {  # folios 42-43
        "chars": [(5, 2, 7), (4, 3, 7), (5, 3, 6), (4, 4, 6), (5, 4, 5), (6, 2, 6)],
        "derived": ("strength+20", "heart+8", "wits+12"),
        "skills": [2, 1, 0, 2, 0, 3, 2, 0, 0, 0, 1, 0, 2, 0, 0, 2, 0, 3],
        "wbase": (["bows", "spears"], 2), "wfree": (1, 1),
    },
}


def main() -> int:
    issues = 0
    checked = 0
    for cid, e in EXPECTED.items():
        p = MECH / f"hero_creation.{cid}.json"
        d = json.loads(p.read_text(encoding="utf-8"))["payload"]["parameters"]
        tag = f"[{cid}]"
        cs = d["characteristic_sets"]
        for i, (s, h, w) in enumerate(e["chars"]):
            a = cs[i]; checked += 3
            if (a["strength"], a["heart"], a["wits"]) != (s, h, w):
                print(f"{tag} CHAR roll{i + 1}: card={a['strength']}/{a['heart']}/{a['wits']} scan={s}/{h}/{w}")
                issues += 1
        der = d["derived"]; checked += 3
        if (der["endurance"], der["hope"], der["parry"]) != e["derived"]:
            print(f"{tag} DERIVED: card={der} scan={e['derived']}"); issues += 1
        for k, val in zip(SKILL_ORDER, e["skills"]):
            checked += 1
            if d["skills"][k] != val:
                print(f"{tag} SKILL {k}: card={d['skills'][k]} scan={val}"); issues += 1
        wb = d["weapon_skills"]["base"]; wf = d["weapon_skills"]["free_choice"]; checked += 2
        if (sorted(wb["choose_one_of"]), wb["rating"]) != (sorted(e["wbase"][0]), e["wbase"][1]):
            print(f"{tag} WEAPON base: card={wb} scan={e['wbase']}"); issues += 1
        if (wf["count"], wf["rating"]) != e["wfree"]:
            print(f"{tag} WEAPON free: card={wf} scan={e['wfree']}"); issues += 1

    if issues:
        print(f"\nFAIL: {issues} discrepancy(ies) across {len(EXPECTED)} cultures "
              f"({checked} numbers checked vs scans).")
        return 1
    print(f"OK: 6 cultural stat blocks match the page scans; "
          f"{checked} numbers checked, 0 discrepancies (folios 32-43).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
