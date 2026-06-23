"""Gate-2b (ADR-002) vision spotcheck for the 36 cultural features (virtues), folios 81-90.

6 culture cards x 6 virtues. Effects mix prose semantics (verified by eye against the
scans, gate-2a-adjacent) with numeric magnitudes. This script makes the NUMERIC part
reproducible: it asserts each card has exactly 6 virtues with the expected Russian
names, and diffs every numeric effect-magnitude against the value read off the scans.

EXPECTED values were transcribed independently from the rendered page images, NOT
copied from the cards. Negative-control: see verify_gate2b_cultures.py for the pattern.
Run:  python3 verify_gate2b_cultural_features.py

NB: does NOT set verified:true (only mark_verified.py does, after gate 2a + 3).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

MECH = Path(__file__).parent.parents[1] / "content-packs" / "kv" / "mechanics"

# card stem -> (expected 6 virtue name_ru, {name_ru: {effect_key: int_value}} numeric checks)
EXPECTED = {
    "osobennosti_bardingov": (
        ["Великая судьба", "Друг гномов", "Крам", "Победитель драконов",
         "Яростный выстрел", "Язык птиц"],
        {"Великая судьба": {"endurance_max": 1},
         "Крам": {"journey_fatigue_per_scene": -1}},
    ),
    "osobennosti_gnomov": (
        ["Барук Кхазад!", "Неукротимый дух", "Обрывки заклинаний", "Путь Дурина",
         "Твёрдый как камень", "Темнота для тёмных дел"],
        {"Неукротимый дух": {"hope_max": 1},
         "Путь Дурина": {"parry_underground_or_cramped": 2},
         "Твёрдый как камень": {"endurance_max": 1}},
    ),
    "osobennosti_lyudey_bri": (
        ["Искусство обращения с трубкой", "Непокорность", "Отчаянная храбрость",
         "Пони из Бри", "Свой среди чужих", "Чудно, как Бригорские новости"],
        {"Искусство обращения с трубкой": {"on_hope_recovery_extra": 1},
         "Непокорность": {"endurance_max": 1},
         "Пони из Бри": {"hope_max": 1, "pony_draught": 4}},
    ),
    "osobennosti_sledopytov_severa": (
        ["Выносливость Следопыта", "Жизнь в глуши", "Народное предвидение",
         "Наследник Арнора", "Раскрыть происхождение", "Сила воли"],
        {"Выносливость Следопыта": {"endurance_max": 1}},
    ),
    "osobennosti_hobbitov": (
        ["Точно в цель", "Искусство исчезновения", "Маленький народец",
         "Стойкий, как старые корни", "Трое — это уже толпа", "Храбрый в трудную минуту"],
        {"Точно в цель": {"thrown_stone_piercing_blow_on_feat_die_with_injury": 12},
         "Маленький народец": {"parry_vs_larger_foe": 2},
         "Трое — это уже толпа": {"fellowship_rating": 1}},
    ),
    "osobennosti_elfov": (
        ["Блеск гнева", "Память древних дней", "Против незримого",
         "Смертоносная стрельба из лука", "Элберет Гилтониэль", "Эльфийские сновидения"],
        {"Элберет Гилтониэль": {"hope_max": 1}},
    ),
}


def main() -> int:
    issues = 0
    nums = 0
    for stem, (names, numeric) in EXPECTED.items():
        p = MECH / f"rewards_virtues.{stem}.json"
        params = json.loads(p.read_text(encoding="utf-8"))["payload"]["parameters"]
        tag = f"[{stem}]"
        cv = params["cultural_virtues"]
        if params.get("count") != 6:
            print(f"{tag} count: card={params.get('count')} expected=6"); issues += 1
        by_name = {v["name_ru"]: v["effect"] for v in cv.values()}
        if set(by_name) != set(names):
            print(f"{tag} virtue names mismatch:\n  card={sorted(by_name)}\n  scan={sorted(names)}")
            issues += 1
        for vname, checks in numeric.items():
            eff = by_name.get(vname, {})
            for key, val in checks.items():
                nums += 1
                if eff.get(key) != val:
                    print(f"{tag} «{vname}» {key}: card={eff.get(key)} scan={val}"); issues += 1

    if issues:
        print(f"\nFAIL: {issues} discrepancy(ies) across 6 cultures / 36 virtues "
              f"({nums} numeric magnitudes checked vs scans).")
        return 1
    print(f"OK: 6 cultural-feature cards match the page scans; 36 virtues (names + count) "
          f"and {nums} numeric magnitudes checked, 0 discrepancies (folios 81-90).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
