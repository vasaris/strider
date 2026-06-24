"""gate-2b vision verifier for the ИдО solo overlay (prose-only mechanical numbers).

Numbers that live ONLY in source_text (not in a verified params table) cannot be
checked by check_param_numbers. This verifier locks them against the page IMAGES:
the EXPECTED phrases below were transcribed INDEPENDENTLY from the ИдО folio scans
(bundle N.jpeg = folio N), NOT copied from the cards. The test asserts each EXPECTED
phrase occurs in its card's source_text, and that a deliberately-wrong NEGATIVE
control does NOT — proving the check can fail. PASS == card prose matches the page.

Author of the cards ran this as the gate-2b vision pass (ADR-002 posture: vision
spot-check on numbers). It is NOT gate-2a/3 (those are fresh non-author sessions).
"""
from __future__ import annotations
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MECH = HERE.parents[1] / "content-packs" / "kv" / "mechanics"

# (card, folio, [EXPECTED present], [NEGATIVE absent]) — EXPECTED transcribed from scans
CHECKS = [
    ("prodvinutsya", 17,
     ["получает 1к к своей следующей атаке дальнего боя",
      "плюс ещё 1к за каждый выпавший знак"],
     ["получает 2к к своей следующей"]),
    ("manevrennaya_poziciya_dalniy_boy", 17,
     ["оружием ближнего боя, убирается 1к",
      "атак дальнего боя героя убирается 1к",
      "не убирая 1к"],
     ["убирается 2к"]),
    ("opredelenie_soprotivleniya", 18,
     ["3 для разумной просьбы, 6 для смелой и 9 для дерзкой"],
     ["4 для разумной просьбы"]),
    ("osobyy_uspekh_solo", 11,
     ["выпадает 1 знак или больше",
      "Выберите 1 эффект для каждого выпавшего знака"],
     ["Выберите 2 эффекта"]),
    ("detali_scen", 19,
     ["уберите 1к при этой проверке, а если на дороге", "получите 1к"],
     ["уберите 2к при этой проверке"]),
]


def main() -> int:
    fails = 0
    for name, folio, present, absent in CHECKS:
        src = " ".join(json.loads((MECH / f"{name}.json").read_text(encoding="utf-8"))
                       ["payload"]["source_text"])
        for ph in present:
            if ph not in src:
                print(f"FAIL [{name} f{folio}] EXPECTED not in source_text: {ph!r}")
                fails += 1
        for ph in absent:
            if ph in src:
                print(f"FAIL [{name} f{folio}] NEGATIVE control present: {ph!r}")
                fails += 1
        if all(p in src for p in present) and all(a not in src for a in absent):
            print(f"ok   [{name} f{folio}] {len(present)} number-phrase(s) match scan; neg-control absent")
    n = len(CHECKS)
    if fails:
        print(f"\ngate-2b ИдО: {fails} failure(s) across {n} cards")
        return 1
    print(f"\nOK: gate-2b ИдО vision — {n}/{n} cards, prose numbers match scans, 0 discrepancies")
    return 0


if __name__ == "__main__":
    sys.exit(main())
