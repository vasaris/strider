"""Build rule cards for B6 (КВ глава «Тень», pages 136-141; subsystem shadow).

THROWAWAY STAGE-0 TOOLING. Same contract as build_mechanics_b4/b5: every
source_text quote is CUT from the КВ core text layer by a (start, end_incl)
anchor pair over whitespace-normalized text — never retyped (gate 1 /
ADR-002). summary/parameters are engine annotations; numbers trace to the cut
source_text (check_param_numbers); scrambled table columns are flagged ⚠ for
the human gate 2b and NOT self-certified here.

5 cards 1:1 with the rubricator sub-headings of «Тень» (ch.8):
  ТЕНЬ / Баллы Тени / Источники тени / Безумие / Использование Изъянов.
(«Закалка духа» lives in bally_teni; the 6x4 «Пути Тени» table lives in
ispolzovanie_izyanov.)

OWNS (subsystem shadow): shadow-points cap=Hope, miserable/overwhelmed
thresholds, shadow checks (valour/wisdom), bracing-the-spirit (scar); 4 sources
(fear/greed/misdeeds/sorcery) + fear & misdeeds tables; bout of madness;
6 Shadow Paths x 4 Flaws + succumbing + using-flaws.

JOIN CONTRACT — NO CHURN: Hope -> endurance_hope.nadezhda; VALOUR/WISDOM ->
valour_wisdom.*; Flaws are negative Distinctive Features -> traits.otlichitelnye_
kachestva; calling determines the Path -> hero_creation.callings; scar healing
at Yule -> fellowship_phase.nachinaniya (B5). Feat-die faces reuse eye/gandalf_
rune tokens. Forward refs (notes only): cursed treasure (стр.158, B8),
adversaries / Might (стр.142, B9).

COLUMN BLEEDS (gate-1 keeps them in source_text; params owned by concept):
bally_teni's block contains keeper NPC-modifier examples bled from стр.135-136;
bezumie's block contains the Misdeeds table (owned by istochniki_teni).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parents[1] / "content-packs" / "kv" / "mechanics"
LAYER = (HERE / "source_kv" / "kv_core.txt").read_text(encoding="utf-8")
NORM = re.sub(r"\s+", " ", LAYER.replace("\u0002", "")).strip()

SH = "kv.mechanics.shadow."
VAL = "kv.mechanics.valour_wisdom.doblest"
WIS = "kv.mechanics.valour_wisdom.mudrost"
HOPE = "kv.mechanics.endurance_hope.nadezhda"
DF = "kv.mechanics.traits.otlichitelnye_kachestva"
CALL = "kv.mechanics.hero_creation.callings"
YULE = "kv.mechanics.fellowship_phase.nachinaniya_fazy_bratstva"


def cut(start: str, end_incl: str) -> str:
    i = NORM.find(start)
    if i < 0:
        raise ValueError(f"start anchor not found: {start[:70]!r}")
    if NORM.count(start) > 1:
        raise ValueError(f"start anchor not unique ({NORM.count(start)}x): {start[:70]!r}")
    j = NORM.find(end_incl, i)
    if j < 0:
        raise ValueError(f"end anchor not found after start: {end_incl[:70]!r}")
    return NORM[i: j + len(end_incl)]


def envelope(id_, title, section, pages, payload, notes=""):
    return {
        "schema_version": "1.0", "id": id_, "type": "rule_card", "title": title,
        "source": {"book": "kv_core", "edition": "02_03_2026_с_рубрикатором",
                   "section": section, "pages": pages},
        "verified": False, "locale": "ru", "terminology": "pandora_box",
        "notes": notes, "payload": payload,
    }


CARDS = [
    {
        "id": SH + "ten", "title": "Тень",
        "subsystem": "shadow", "section": "Хранитель → ТЕНЬ", "pages": [136, 137],
        "quotes": [("тень «И это ещё одна причина, почему надо уничтожить Кольцо",
                    "использовать свою силу для личной выгоды или власти над другими.")],
        "summary": "Вступление к главе: Тень — порча Врага. Тень сеет страх и сомнения не только силой "
                   "оружия и делами слуг, но и искушениями: даже доблестные герои могут свернуть на "
                   "«кривую дорожку», поддавшись тёмным желаниям, и начать использовать силу для личной "
                   "выгоды или власти над другими.",
        "parameters": {"is_intro": True, "shadow_corrupts_via": ["fear_and_doubt", "temptation"]},
        "related": [SH + "bally_teni", SH + "istochniki_teni"],
        "notes": "",
    },
    {
        "id": SH + "bally_teni", "title": "Баллы Тени",
        "subsystem": "shadow", "section": "Хранитель → ТЕНЬ → Баллы Тени", "pages": [137, 138],
        "quotes": [("баллы тени Противостояние почти всемогущему Врагу",
                    "ни бесконечным километрам бесплодной земли.")],
        "summary": "Владелец баллов Тени. Баллы Тени накапливаются от страха и сомнений, отмечаются "
                   "рядом с Надеждой и не могут превысить максимальный рейтинг Надежды. Проверки Тени "
                   "(ДОБЛЕСТЬ или МУДРОСТЬ — в зависимости от причины) при успехе снижают полученные "
                   "баллы на 1 и ещё на 1 за каждый знак. Последствия: при Тени ≥ текущей Надежды герой "
                   "несчастен (выпавший знак на Кости испытания считается провалом); при Тени ≥ "
                   "максимальной Надежды герой подавлен страхами (все броски злополучны), и выйти из "
                   "этого можно лишь приступом безумия. Закалка духа: пока баллы не достигли максимума "
                   "Надежды, можно убрать все текущие баллы, заменив их одним шрамом Тени (постоянный "
                   "балл, снимаемый только на Йоль).",
        "parameters": {
            "shadow_points": {"cap": "max_hope_rating", "tracked_next_to": "hope"},
            "shadow_check": {"resisted_with": ["valour", "wisdom"], "which": "depends_on_cause",
                             "on_success": "reduce gained shadow by one, plus one per success sign"},
            "miserable_when": "shadow >= current_hope",
            "miserable_effect": "eye_on_feat_die = auto_failure",
            "overwhelmed_when": "shadow >= max_hope",
            "overwhelmed_effect": "all_rolls_ill_fated",
            "overwhelmed_escape": "bout_of_madness",
            "bracing_the_spirit": {"available_if": "shadow < max_hope",
                                   "effect": "remove_all_shadow_points", "cost": "one_shadow_scar",
                                   "scar": "permanent_shadow_point, removable only at Yule"},
        },
        "related": [SH + "istochniki_teni", SH + "bezumie", HOPE, VAL, WIS, YULE],
        "notes": "Владелец баллов Тени и Закалки духа. Шрам Тени снимается начинанием «Исцеление "
                 "шрамов» (Йоль) — fellowship_phase.nachinaniya (B5). В блок затекли примеры "
                 "ПХ-модификаторов (со стр.135-136) — артефакт склейки слоя. Колдовство/детали ужаса — "
                 "Противники (ф.142, B9).",
    },
    {
        "id": SH + "istochniki_teni", "title": "Источники тени",
        "subsystem": "shadow", "section": "Хранитель → ТЕНЬ → Источники тени", "pages": [137, 139],
        "quotes": [("источники тени Искатели приключений получают баллы Тени по-разному",
                    "Фродо сковала немота.")],
        "summary": "Владелец источников Тени. Четыре источника: Страх (свидетельство ужасного — "
                   "сопротивление проверкой ДОБЛЕСТИ), Жадность (осквернённые сокровища — МУДРОСТЬ), "
                   "Проступки (дурные по сути поступки независимо от цели — без сопротивления, но "
                   "непреднамеренный проступок можно исправить проверкой МУДРОСТИ), Колдовство (жертва "
                   "тёмных заклятий — МУДРОСТЬ, часто с дополнительными отрицательными последствиями). "
                   "Таблица Причины страха (баллы Тени): внезапное трагическое событие 1; чудовищное "
                   "убийство / работа орков 2; шок, пытки, одержимость 3; ощутить силу Врага (армия, Око "
                   "в палантире) 4. Таблица Проступков: жестокие угрозы и ложь 1; манипуляции, "
                   "злоупотребление властью 2; воровство, нарушение клятвы, трусость, предательство 3; "
                   "пытки, убийство сдавшихся 4; убийство, служение Врагу — 4 и 1 шрам.",
        "parameters": {
            "sources": {
                "fear": {"name_ru": "Страх", "resist": "valour"},
                "greed": {"name_ru": "Жадность", "resist": "wisdom", "trigger": "cursed_treasure_p158"},
                "misdeeds": {"name_ru": "Проступки", "resist": "none",
                             "unintentional": "may_amend_via_wisdom_check"},
                "sorcery": {"name_ru": "Колдовство", "resist": "wisdom",
                            "often": "extra_negative_effects"},
            },
            "fear_table": {"by_cause_shadow_points": {
                "sudden_tragic_event": 1, "monstrous_murder_or_orc_work": 2,
                "shocking_torture_or_possession": 3, "feeling_the_enemys_power": 4}},
            "misdeeds_table": {"by_action_shadow_points": {
                "cruel_threats_or_malicious_lies": 1, "manipulation_or_abuse_of_power": 2,
                "theft_oathbreaking_cowardice_betrayal": 3, "torture_or_killing_the_defenceless": 4,
                "murder_or_serving_the_enemy": "4 and 1 scar"}},
        },
        "related": [SH + "bally_teni", SH + "bezumie", VAL, WIS],
        "notes": "Владелец источников и таблиц Страха/Проступков. Текст таблицы Проступков физически "
                 "затёк в блок bezumie (склейка слоя); параметры здесь. ⚠ ГЕЙТ-2b (ф.138): значения "
                 "1/2/3/4 в обеих таблицах читаются — подтверждающий. Осквернённые сокровища — ф.158 "
                 "(B8). Ужас от существ/заклятий — Противники (ф.142, B9).",
    },
    {
        "id": SH + "bezumie", "title": "Безумие",
        "subsystem": "shadow", "section": "Хранитель → ТЕНЬ → Безумие", "pages": [139, 140],
        "quotes": [("безумие Как указано на стр. 137",
                    "сознательное служение Врагу 4 и 1 шрам Тени")],
        "summary": "Владелец приступа безумия. Когда рейтинг Тени достигает максимума Надежды, все "
                   "броски за героя злополучны; единственный выход — пережить приступ безумия. Игрок "
                   "описывает, как герой теряет контроль (примеры: Предательство, Испуг, Вожделение, "
                   "Ярость). После приступа герой перестаёт быть злополучным, все метки текущих баллов "
                   "Тени стираются, но он продвигается на один шаг по своему Пути Тени. Приступ нужно "
                   "разыграть в текущей Фазе приключений, иначе герой, завершивший её с Тенью, равной "
                   "максимуму Надежды, считается покинувшим отряд и выбывает из игры.",
        "parameters": {
            "trigger": "shadow == max_hope (all rolls ill-fated)",
            "only_escape_from_overwhelmed": True,
            "types": ["betrayal", "fright", "lust", "rage"],
            "after": {"no_longer_ill_fated": True, "erase_current_shadow_marks": True,
                      "advance_one_step_on_shadow_path": True},
            "must_roleplay_in_current_adventuring_phase": True,
            "else": "hero_leaves_the_game",
        },
        "related": [SH + "bally_teni", SH + "ispolzovanie_izyanov", CALL],
        "notes": "Владелец приступа безумия. В source_text затекла таблица Проступков (её владелец — "
                 "shadow.istochniki_teni). Путь Тени определяется призванием — hero_creation.callings; "
                 "ступени и Изъяны — shadow.ispolzovanie_izyanov.",
    },
    {
        "id": SH + "ispolzovanie_izyanov", "title": "Использование Изъянов",
        "subsystem": "shadow", "section": "Хранитель → ТЕНЬ → Пути Тени / Использование Изъянов",
        "pages": [140, 141],
        "quotes": [("ПУТИ ТЕНИ Помимо сброса рейтинга Тени",
                    "если есть хотя бы намёк на угрозу для него или его близких.")],
        "summary": "Владелец Путей Тени. Каждый приступ безумия продвигает героя по Пути Тени, "
                   "соответствующему его призванию; каждая ступень отмечена новым Изъяном — Отличительным "
                   "качеством с отрицательным оттенком. Уступивший Тени: получив все четыре Изъяна, при "
                   "следующем достижении Тенью максимума Надежды герой не становится злополучным, а "
                   "выбывает из игры (гибель от безумия или возвращение в Валинор для эльфов). "
                   "Использование Изъянов: если герой применяет навык, на который Изъян может "
                   "обоснованно повлиять, бросок становится злополучным. Таблица Путей Тени — шесть "
                   "Путей (Одержимость мщением, Драконья болезнь, Одержимость властью, Одержимость "
                   "тайнами, Путь отчаяния, Одержимость скитаниями) по четыре Изъяна.",
        "parameters": {
            "advance_on": "bout_of_madness",
            "path_determined_by": "calling",
            "step_grants": "a_flaw_negative_distinctive_feature",
            "shadow_paths": {
                "vengeance": {"name_ru": "Одержимость мщением",
                              "flaws": ["Озлобленность", "Агрессивность", "Жестокость", "Кровожадность"]},
                "dragon_sickness": {"name_ru": "Драконья болезнь",
                                    "flaws": ["Алчность", "Недоверчивость", "Бесчестность", "Вороватость"]},
                "power": {"name_ru": "Одержимость властью",
                          "flaws": ["Обидчивость", "Заносчивость", "Самонадеянность", "Деспотичность"]},
                "secrets": {"name_ru": "Одержимость тайнами",
                            "flaws": ["Важность", "Насмешливость", "Интриганство", "Вероломность"]},
                "despair": {"name_ru": "Путь отчаяния",
                            "flaws": ["Тревожность", "Нерешительность", "Одержимость виной", "Малодушие"]},
                "wandering": {"name_ru": "Одержимость скитаниями",
                              "flaws": ["Праздность", "Рассеянность", "Равнодушие", "Трусливость"]},
            },
            "succumbing": {"condition": "all_four_flaws_gained",
                           "then": "next_overwhelmed_leaves_game_instead_of_ill_fated",
                           "fates": ["death_by_madness", "return_to_valinor_for_elves"]},
            "using_flaws": "ill_fated_roll_on_skill_the_flaw_affects",
        },
        "related": [SH + "bezumie", DF, CALL],
        "notes": "Владелец Путей Тени. ⚠ ГЕЙТ-2b (ф.140): таблица Путей Тени — сетка 6 столбцов × 4 "
                 "строки; чтение по столбцам (4 Изъяна каждого Пути) — высокий риск рассинхрона при "
                 "линеаризации, подтвердить привязку Изъянов к Путям по скану. Изъяны = негативные "
                 "Отличительные качества → traits.otlichitelnye_kachestva. Путь по призванию → "
                 "hero_creation.callings.",
    },
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ids = [c["id"] for c in CARDS]
    assert len(ids) == len(set(ids)), "duplicate card ids"
    n = 0
    for c in CARDS:
        payload = {"subsystem": c["subsystem"], "title": c["title"],
                   "source_text": [cut(a, b) for a, b in c["quotes"]],
                   "summary": c["summary"], "parameters": c["parameters"], "related": c["related"]}
        doc = envelope(c["id"], c["title"], c["section"], c["pages"], payload, notes=c.get("notes", ""))
        name = c["id"].split("kv.mechanics.")[1]
        (OUT / f"{name}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
                                          encoding="utf-8")
        n += 1
    print(f"{n} B6 cards written; {len(list(OUT.glob('*.json')))} total in mechanics/")


if __name__ == "__main__":
    main()
