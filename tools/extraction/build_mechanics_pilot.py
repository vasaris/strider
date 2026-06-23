"""Build pilot rule cards (subsystem `checks`) from the КВ core text layer.

THROWAWAY TOOLING (stage 0, session 3a pilot). Quotes are CUT from the layer
by (start, end_inclusive) anchor pairs over whitespace-normalized text — never
retyped — so gate 1 (text-fidelity) holds by construction. summary/parameters
are engine annotations, verified semantically by gate 2a (ADR-002).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parents[1] / "content-packs" / "kv" / "mechanics"
LAYER = (HERE / "source_kv" / "kv_core.txt").read_text(encoding="utf-8")
NORM = re.sub(r"\s+", " ", LAYER.replace("\u0002", "")).strip()


def cut(start: str, end_incl: str) -> str:
    i = NORM.find(start)
    if i < 0:
        raise ValueError(f"start anchor not found: {start[:60]!r}")
    j = NORM.find(end_incl, i)
    if j < 0:
        raise ValueError(f"end anchor not found after start: {end_incl[:60]!r}")
    return NORM[i: j + len(end_incl)]


def envelope(id_: str, title: str, section: str, pages: list[int], payload: dict,
             notes: str = "") -> dict:
    return {
        "schema_version": "1.0",
        "id": id_,
        "type": "rule_card",
        "title": title,
        "source": {"book": "kv_core", "edition": "02_03_2026_с_рубрикатором",
                   "section": section, "pages": pages},
        "verified": False,
        "locale": "ru",
        "terminology": "pandora_box",
        "notes": notes,
        "payload": payload,
    }


SEC = "Выполнение действий → Выполнение проверок"

CARDS = [
    {
        "id": "kv.mechanics.checks.who_rolls",
        "title": "Кто выполняет проверку", "section": f"{SEC} → Кто выполняет проверку",
        "pages": [17], "subsystem": "checks",
        "quotes": [("Если проверка вызвана действиями героя игрока",
                    "правилами помощи («Помощь», стр. 20).")],
        "summary": "Кости бросает игрок действующего героя; при реакции на события хранителя проверку выполняет один игрок за лучше всего подходящего героя, кроме случаев, касающихся всего отряда.",
        "parameters": {},
        "related": [],  # kv.mechanics.checks.help добавится при полном прогоне 3a
    },
    {
        "id": "kv.mechanics.checks.which_ability",
        "title": "Какая способность проверяется", "section": f"{SEC} → Какая способность проверяется",
        "pages": [17], "subsystem": "checks",
        "quotes": [("В целом выбор способности зависит от типа проверки.",
                    "чтобы не поддаться Страху, Колдовству и Жадности.")],
        "summary": "Три типа проверок: навыка (18 навыков бланка), боевая (Боевые умения: атака и ЗАЩИТА), Тени (ДОБЛЕСТЬ и МУДРОСТЬ против Страха, Колдовства, Жадности).",
        "parameters": {"check_types": ["skill", "combat", "shadow"]},
        "related": [],
    },
    {
        "id": "kv.mechanics.checks.procedure",
        "title": "Ход проверки", "section": f"{SEC} → Ход проверки",
        "pages": [17], "subsystem": "checks",
        "quotes": [("После выбора нужной способности выполняется бросок",
                    "а о дополнительных правилах последствий провала — в главе 8 «Хранитель».")],
        "summary": "Бросок: 1 Кость испытания + Кости успеха по рейтингу способности (рейтинг 0 — только Кость испытания); сумма сравнивается с ЦЧ; сумма ≥ ЦЧ — успех, иначе провал.",
        "parameters": {"feat_dice": 1, "success_dice": "ability_rating",
                        "ability_rating_range": [1, 6], "zero_rating": "feat_die_only",
                        "success_condition": "total >= target_number"},
        "related": ["kv.mechanics.checks.target_numbers", "kv.mechanics.checks.degree_of_success"],
    },
    {
        "id": "kv.mechanics.checks.retry",
        "title": "Повторная проверка", "section": f"{SEC} → Повторная проверка",
        "pages": [17], "subsystem": "checks",
        "quotes": [("Как правило, у героев есть лишь одна попытка",
                    "(«Последствия провала», стр. 130).")],
        "summary": "Одна попытка на задачу; повтор проваленного действия — только другим навыком (иной подход) с разрешения хранителя, последствия первого провала остаются.",
        "parameters": {"retry": "different_skill_with_keeper_permission"},
        "related": [],
    },
    {
        "id": "kv.mechanics.checks.feat_die_values",
        "title": "Значения Костей испытания", "section": f"{SEC} → Значение Костей испытания",
        "pages": [17], "subsystem": "checks",
        "quotes": [("На гранях каждой Кости испытания указаны числа от 1 до 10",
                    "результат броска данной кости равен 0.")],
        "summary": "Кость испытания: 1–10, руна Гэндальфа и Око Саурона. Руна — автоуспех независимо от суммы; Око — значение кости равно 0.",
        "parameters": {"faces": "1-10, gandalf_rune, eye",
                        "gandalf_rune": "auto_success", "eye_numeric_value": 0},
        "related": ["kv.mechanics.checks.success_die_values"],
    },
    {
        "id": "kv.mechanics.checks.success_die_values",
        "title": "Значение Костей успеха", "section": f"{SEC} → Значение Костей успеха",
        "pages": [18], "subsystem": "checks",
        "quotes": [("Кости успеха — это особые шестигранники",
                    "(см. «Степень успеха» справа).")],
        "summary": "Кость успеха — d6; рядом с 6 — знак успеха (эльфийская 1). Результаты складываются с Костью испытания; знаки успеха повышают степень успеха.",
        "parameters": {"die": "d6", "success_icon_on": 6},
        "related": ["kv.mechanics.checks.degree_of_success"],
    },
    {
        "id": "kv.mechanics.checks.target_numbers",
        "title": "Целевые числа (ЦЧ)", "section": f"{SEC} → Целевые числа",
        "pages": [18], "subsystem": "checks",
        "quotes": [("С каждой способностью в игре соотносится определённое целевое число",
                    "Каждое ЦЧ характеристики равно 20 минус рейтинг этой характеристики."),
                   ("При расчёте ЦЧ путём вычитания рейтинга характеристик из 20",
                    "вычитая рейтинг характеристики героев из 18, а не из 20.")],
        "summary": "Большинство проверок — против ЦЧ характеристики (СИЛА, СЕРДЦЕ или РАЗУМ): ЦЧ = 20 − рейтинг. Вариант для коротких кампаний: ЦЧ = 18 − рейтинг (его использует «Игра для одного»).",
        "parameters": {"tn_formula": "20 - attribute_rating",
                        "short_campaign_variant": "18 - attribute_rating",
                        "attributes": ["strength", "heart", "wits"]},
        "related": ["kv.mechanics.checks.procedure"],
        "notes": "Связь с kv.solo.hero_adjustments: соло-режим фиксирует вариант 18 − рейтинг.",
    },
    {
        "id": "kv.mechanics.checks.degree_of_success",
        "title": "Степень успеха", "section": f"{SEC} → Степень успеха",
        "pages": [18], "subsystem": "checks",
        "quotes": [("Результат броска, при котором сумма выпавших на костях значений будет равна ЦЧ",
                    "(выдающийся успех).")],
        "summary": "Знаки успеха в успешном броске повышают степень: 0 знаков — успех; 1 — большой успех; 2+ — выдающийся успех.",
        "parameters": {"tiers": [
            {"success_icons": 0, "label": "успех"},
            {"success_icons": 1, "label": "большой успех"},
            {"success_icons": "2+", "label": "выдающийся успех"}]},
        "related": ["kv.mechanics.checks.special_successes"],
    },
    {
        "id": "kv.mechanics.checks.special_successes",
        "title": "Особые успехи при проверках навыков", "section": f"{SEC} → Степень успеха → Особые успехи",
        "pages": [18, 19], "subsystem": "checks",
        "quotes": [("При проверках навыков, чтобы добавить подробностей более значимому успеху",
                    "даже если знак успеха используется для получения особого успеха."),
                   ("Отменить провал Если в проверке навыка участвует несколько героев",
                    "герой повлиял на целый десяток.")],
        "summary": "Каждый выпавший знак успеха можно потратить на один особый успех из перечня стр. 19; трата знака не снижает числовой результат и степень успеха. Базовый перечень КВ: отменить провал, +1 дополнительный успех, узнать что-то, быть бесшумным, быть быстрым, расширить влияние.",
        "parameters": {"spend": "1 icon = 1 special success",
                        "options": ["cancel_failure", "extra_success", "learn_something",
                                     "be_silent", "be_swift", "widen_influence"]},
        "related": ["kv.mechanics.checks.degree_of_success"],
        "notes": "Соло-альтернатива перечня — kv.solo.special_successes (ИдО, стр. 11).",
    },
    {
        "id": "kv.mechanics.checks.favoured_ill_favoured",
        "title": "Благополучный и злополучный броски", "section": "Выполнение действий → Модификаторы броска",
        "pages": [20], "subsystem": "checks",
        "quotes": [("Бросок считается благополучным, когда у героя игрока есть особая склонность",
                    "(«Особенности», стр. 80)."),
                   ("Являясь противоположностью благополучного броска",
                    "(«Использование Изъянов», стр. 140).")],
        "summary": "Благополучный бросок: 2 Кости испытания, берётся лучший результат (любимые навыки, Культурные особенности). Злополучный: 2 Кости испытания, берётся худший (способности врагов, Безумие, Изъяны).",
        "parameters": {"favoured": {"feat_dice": 2, "pick": "best"},
                        "ill_favoured": {"feat_dice": 2, "pick": "worst"}},
        "related": ["kv.mechanics.checks.feat_die_values"],
    },
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for c in CARDS:
        payload = {
            "subsystem": c["subsystem"],
            "title": c["title"],
            "source_text": [cut(a, b) for a, b in c["quotes"]],
            "summary": c["summary"],
            "parameters": c["parameters"],
            "related": c["related"],
        }
        doc = envelope(c["id"], c["title"], c["section"], c["pages"], payload,
                       notes=c.get("notes", ""))
        name = c["id"].split("kv.mechanics.")[1]
        p = OUT / f"{name}.json"
        p.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"  wrote {p.name} ({len(payload['source_text'])} quote(s))")
    print(f"\n{len(list(OUT.glob('*.json')))} rule cards")


if __name__ == "__main__":
    main()
