"""Gate-2b (ADR-002) vision spotcheck for the starting-gear tables, folios 49-51.

Covers three hero_creation cards:
  useful_items (49)                 — count-by-standard-of-living, max per roll
  ponies_and_horses (50)            — mount draught by standard of living, pack capacity
  starting_rewards_and_virtues (51) — valour/wisdom start, the 6 starting Rewards
                                      and 6 starting Virtues (cross-checks the same
                                      effects verified on folios 79-80)

EXPECTED values were transcribed independently from the rendered page images, NOT
copied from the cards. Run:  python3 verify_gate2b_starting_gear.py

NB: does NOT set verified:true (only mark_verified.py does, after gate 2a + 3).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

MECH = Path(__file__).parent.parents[1] / "content-packs" / "kv" / "mechanics"
SOL = ["poor", "frugal", "common", "prosperous", "rich", "very_rich"]


def load(stem):
    return json.loads((MECH / f"hero_creation.{stem}.json").read_text(encoding="utf-8"))["payload"]["parameters"]


def main() -> int:
    issues = 0
    nums = 0

    def eq(tag, got, exp):
        nonlocal issues, nums
        nums += 1
        if got != exp:
            print(f"{tag}: card={got} scan={exp}"); issues += 1

    # --- useful_items (folio 49) ---
    ui = load("useful_items")
    eq("[useful_items] max_per_roll", ui["max_per_roll"], 1)
    eq("[useful_items] count_by_sol", [ui["count_by_standard_of_living"][k] for k in SOL], [0, 1, 2, 3, 4, 4])

    # --- ponies_and_horses (folio 50) ---
    ph = load("ponies_and_horses")
    eq("[ponies] pack_treasure_capacity", ph["pack_treasure_capacity"], 10)
    eq("[ponies] mount_draught_by_sol", [ph["mount_draught_by_standard_of_living"][k] for k in SOL], [0, 0, 1, 2, 3, 3])

    # --- starting_rewards_and_virtues (folio 51) ---
    sv = load("starting_rewards_and_virtues")
    eq("[start] valour_start", sv["valour_start"], 1)
    eq("[start] wisdom_start", sv["wisdom_start"], 1)
    eq("[start] rating_min", sv["rating_min"], 1)
    eq("[start] rating_max", sv["rating_max"], 6)
    eq("[start] starting_choice", (sv["starting_choice"]["rewards"], sv["starting_choice"]["virtues"]), (1, 1))

    rewards = {r["name_ru"]: r["effect"] for r in sv["starting_rewards"]}
    exp_rewards = {
        "Грозное": {"injury": 2}, "Острое": {"piercing_blow_on": 9},
        "Тонкая работа": {"load": -2}, "Ужасное": {"damage": 1},
        "Усиленный": {"parry_modifier": 1}, "Хорошо подогнанная": {"protection_check": 2},
    }
    if set(rewards) != set(exp_rewards):
        print(f"[start] reward names: card={sorted(rewards)} scan={sorted(exp_rewards)}"); issues += 1
    for nm, eff in exp_rewards.items():
        for k, v in eff.items():
            eq(f"[start] reward «{nm}» {k}", rewards.get(nm, {}).get(k), v)

    virtues = {v["name_ru"]: v["effect"] for v in sv["starting_virtues"]}
    exp_virtues = {
        "Крепкие руки": {"heavy_blow_damage": 1, "pierce_feat_die": 1},
        "Мастерство": {"favoured_skills": 2}, "Проворство": {"parry": 1},
        "Стойкость": {"endurance": 2}, "Уверенность": {"hope": 2},
        "Удаль": {"characteristic_tn": -1},
    }
    if set(virtues) != set(exp_virtues):
        print(f"[start] virtue names: card={sorted(virtues)} scan={sorted(exp_virtues)}"); issues += 1
    for nm, eff in exp_virtues.items():
        for k, v in eff.items():
            eq(f"[start] virtue «{nm}» {k}", virtues.get(nm, {}).get(k), v)

    if issues:
        print(f"\nFAIL: {issues} discrepancy(ies) across 3 starting-gear cards "
              f"({nums} numbers checked vs scans).")
        return 1
    print(f"OK: 3 starting-gear cards match the page scans; {nums} numbers checked, "
          f"0 discrepancies (folios 49-51).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
