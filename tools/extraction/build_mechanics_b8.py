"""Build rule cards for B8 PILOT (КВ глава «Сокровища», folios 158-161; subsystem treasure).

VISION-ASSISTED extraction: the Treasure chapter's text layer is heavily column-
scrambled (tables/sidebars interleaved across folios), so structure and tables
were established from rendered PAGE IMAGES (folios 158-161), then source_text was
CUT verbatim from kv_core.txt (gate-1 / ADR-002 fidelity preserved — the layer
stays the provenance source; images only tell which text -> which card and the
correct table structure). Parameters were verified against the page scans, which
folds gate-2b into extraction. Where a table/sidebar is displaced mid-section in
the layer, source_text uses multiple verbatim spans so every parameter number
traces to its own card without duplication.

PILOT = 4 complete cards (folios 158-161):
  sokrovishcha (intro) / klady / sozdanie_dragocennosti / spisok_sokrovishch.
Deferred to the next render: divnye_artefakty_chudesnye_predmety (starts f.161,
finishes f.162), znamenitoe_oruzhie_bronya (f.162-167), proklyatye_predmety
(f.167-168).

JOIN CONTRACT — NO CHURN: Greed shadow -> shadow.istochniki_teni (B6); rolling
the Eye/Gandalf rune -> checks.feat_die_values; Load -> endurance_hope.vynoslivost
(B2.1); «Встреча с покровителем» -> fellowship_phase.nachinaniya (B5).

NOTE relevant to B7: the magic-treasure table column «ЕСЛИ ВЫПАЛ ЗНАК [Eye glyph]»
and the sidebar «руна [glyph] и знак [Eye glyph]» show that bare «знак» here means
the EYE (the Eye glyph drops out of the text layer). Cross-evidence that B7's
ВЗОР ОКА «знак» is likely the Eye — to confirm against folio 170 at gate-2a.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parents[1] / "content-packs" / "kv" / "mechanics"
LAYER = (HERE / "source_kv" / "kv_core.txt").read_text(encoding="utf-8")
NORM = re.sub(r"\s+", " ", LAYER.replace("\u0002", "")).strip()

TR = "kv.mechanics.treasure."
SHADOW_SRC = "kv.mechanics.shadow.istochniki_teni"
FEAT = "kv.mechanics.checks.feat_die_values"
LOAD = "kv.mechanics.endurance_hope.vynoslivost"
PATRON_UNDERTAKING = "kv.mechanics.fellowship_phase.nachinaniya_fazy_bratstva"


def cut(start: str, end_incl: str) -> str:
    i = NORM.find(start)
    if i < 0:
        raise ValueError(f"start anchor not found: {start[:70]!r}")
    if NORM.count(start) > 1:
        raise ValueError(f"start anchor not unique ({NORM.count(start)}x): {start[:70]!r}")
    j = NORM.find(end_incl, i)
    if j < 0:
        raise ValueError(f"end anchor not found after start: {end_incl[:70]!r}")
    if NORM.count(end_incl) > 1:
        raise ValueError(f"end anchor not unique ({NORM.count(end_incl)}x): {end_incl[:70]!r}")
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
        "id": TR + "sokrovishcha", "title": "Сокровища",
        "subsystem": "treasure", "section": "Сокровища → (вступление)", "pages": [158],
        "quotes": [("Путешествуя по земле, пережившей три эпохи",
                    "принести проклятие и погубить нового хозяина!")],
        "summary": "Вступление к главе. Странствуя по Средиземью, искатели приключений рано или поздно "
                   "находят сокровища — забытые богатства дракона, груды золота под охраной троллей, "
                   "добычу гоблинов-грабителей; сокровища становятся целью приключений и способом "
                   "повысить благосостояние. В прежние эпохи люди, эльфы и гномы создавали удивительные "
                   "предметы, которые передавались, собирались и похищались, а в итоге были утеряны и "
                   "позабыты. Такие вещи не теряются навечно: достойный меч однажды будет найден в "
                   "кургане. Но слишком долго пролежавшее во тьме сокровище может принести проклятие.",
        "parameters": {"is_intro": True,
                       "treasure_is": ["goal_of_adventures", "way_to_raise_standard_of_living"],
                       "long_buried_treasure": "may_become_cursed"},
        "related": [TR + "klady", TR + "sozdanie_dragocennosti"],
        "notes": "Vision-assisted (фолио 158).",
    },
    {
        "id": TR + "klady", "title": "Клады",
        "subsystem": "treasure", "section": "Сокровища → КЛАДЫ", "pages": [158, 159],
        "quotes": [
            ("Любой источник баллов сокровищ, на который натыкается",
             "спрятать клад неподалёку от места находки, чтобы вернуться за ним позже."),
            ("ВОЛШЕБНЫЕ СОКРОВИЩА РЕЗУЛЬТАТ БРОСКА КОСТИ УСПЕХА",
             "Оружие или доспехи искусной работы Даёт 3 балла Тени (Жадность)"),
        ],
        "summary": "Владелец кладов. Любой источник баллов сокровищ в пещерах, логовах или руинах "
                   "считается кладом; клады делятся на малый, большой и дивный. В среднем за Фазу "
                   "приключений отряд находит не более двух кладов (один малый и один большой) либо один "
                   "дивный. Стоимость клада в баллах сокровищ — это бросок 1, 2 или 3 Костей успеха (по "
                   "типу), умноженный на число героев в отряде. Таблица КЛАД: малый (добыча одинокого "
                   "тролля, трофеи гоблинов, клад бандитов — 1 Кость успеха, 2 броска Кости испытания на "
                   "волшебные сокровища), большой (старый/гномий клад — 2 Кости успеха, 4 броска), "
                   "дивный (древний клад, город гномов, клад дракона — 3 Кости успеха, 6 бросков). "
                   "Определение волшебных сокровищ: бросить Кости испытания указанное число раз; каждая "
                   "выпавшая руна Гэндальфа или Око указывает на волшебный предмет; затем бросок Кости "
                   "успеха по таблице ВОЛШЕБНЫЕ СОКРОВИЩА — 1–3 Дивный артефакт, 4–5 Чудесный предмет, 6 "
                   "Знаменитое оружие или броня; если предмет найден по Оку, герой получает баллы Тени "
                   "(Жадность): 1, 2 или 3 по типу находки. Перевозка: каждый балл сокровищ и каждый "
                   "Дивный артефакт или Чудесный предмет = 1 балл Нагрузки; Знаменитое оружие и броня "
                   "имеют свой рейтинг Нагрузки.",
        "parameters": {
            "hoard_categories": ["minor", "great", "wondrous"],
            "max_per_phase": "two (one minor + one great) OR one wondrous",
            "hoard_value": "value_success_dice rolled, multiplied by number of heroes",
            "hoard_table": {
                "minor": {"name_ru": "Малый", "examples": "lone_troll / goblins / bandits",
                          "value_success_dice": 1, "magic_feat_die_rolls": 2},
                "great": {"name_ru": "Большой", "examples": "old_hoard / dwarf_hoard",
                          "value_success_dice": 2, "magic_feat_die_rolls": 4},
                "wondrous": {"name_ru": "Дивный", "examples": "ancient / dwarf_city / dragon_hoard",
                             "value_success_dice": 3, "magic_feat_die_rolls": 6},
            },
            "determine_magic_treasure": {
                "roll": "feat_dice, magic_feat_die_rolls times",
                "magic_item_indicated_by": ["gandalf_rune", "eye"],
                "then_success_die_table": {
                    "1-3": {"find": "wondrous_artefact", "shadow_greed_if_eye": 1},
                    "4-5": {"find": "marvellous_item", "shadow_greed_if_eye": 2},
                    "6": {"find": "famous_weapon_or_armour", "shadow_greed_if_eye": 3},
                },
            },
            "transport_load": {"per_treasure_point": 1, "per_artefact_or_marvellous_item": 1,
                               "famous_weapon_or_armour": "own_load_rating"},
        },
        "related": [TR + "sokrovishcha", TR + "sozdanie_dragocennosti", SHADOW_SRC, FEAT, LOAD],
        "notes": "Владелец кладов и определения волшебных сокровищ. Vision-assisted (фолио 158-159): "
                 "таблицы КЛАД (1/2/3 Кости успеха ×герои; 2/4/6 бросков) и ВОЛШЕБНЫЕ СОКРОВИЩА "
                 "(1-3/4-5/6; Око→Тень 1/2/3) сверены по скану. «ЕСЛИ ВЫПАЛ ЗНАК [глиф Ока]» = Око "
                 "(глиф теряется в текст-слое). source_text — 2 спана: таблица ВОЛШЕБНЫЕ СОКРОВИЩА "
                 "смещена слоем в регион sozdanie, взята отдельным спаном, чтобы её числа трассировались "
                 "здесь. Жадность → shadow.istochniki_teni (B6); Нагрузка → endurance_hope.vynoslivost "
                 "(B2.1).",
    },
    {
        "id": TR + "sozdanie_dragocennosti", "title": "Создание драгоценности",
        "subsystem": "treasure", "section": "Сокровища → Создание драгоценности", "pages": [159, 160],
        "quotes": [
            ("создание драгоценности Драгоценности — это самоцветы",
             "кто способен распознать в ней реликвию из известного прошлого. Если"),
            ("НЕОБЫЧАЙНАЯ ЦЕННОСТЬ ИЗ ЛЕГЕНД Ниже даны примеры",
             "6 эльфийская, Белерианд"),
        ],
        "summary": "Владелец создания драгоценностей. Драгоценность — это самоцвет, украшение или иной "
                   "ценный предмет, значимый как фамильная реликвия или антиквариат либо необыкновенной "
                   "красоты; её стоимость в баллах сокровищ определяет хранитель и вычитает из общего "
                   "рейтинга клада. Если передать такую вещь представителям народа, чьи традиции "
                   "восходят к эпохе её создания, герой получает дополнительное вознаграждение за её "
                   "эмоциональную ценность. Примеры легендарных ценностей: Кольцо Барахира, Ожерелье "
                   "Гириона, Аркенстон. Таблицы создания (бросок Кости успеха по каждой): ФОРМА (1 "
                   "самоцвет, 2 брошь, 3 ожерелье, 4 диадема или корона, 5 пояс/цепочка/браслет, 6 "
                   "кольцо); ОСНОВНОЙ МАТЕРИАЛ (1 жемчуг, 2 сапфир, 3 рубин, 4 аметист, 5 — переброс: 1–2 "
                   "адамант, 3–4 «белый камень», 5–6 бесцветный кристалл; 6 — переброс: 1–2 изумруд, 3–4 "
                   "«зелёный камень», 5–6 зелёный кристалл); ЧЬЯ РАБОТА (1 человеческая Запад, 2 "
                   "эльфийская Эрегион, 3 гномья Кхазад-Дум, 4 гномья Эребор, 5 гномья Белерианд, 6 "
                   "эльфийская Белерианд).",
        "parameters": {
            "value_set_by": "keeper, subtracted from hoard total",
            "emotional_value_reward": "extra_reward_if_given_to_a_people_whose_traditions_date_to_its_making",
            "legendary_examples": ["Кольцо Барахира", "Ожерелье Гириона", "Аркенстон"],
            "creation_tables_roll": "success_die_per_table",
            "tables": {
                "form": {"1": "Самоцвет", "2": "Брошь", "3": "Ожерелье", "4": "Диадема или корона",
                         "5": "Пояс, цепочка или браслет", "6": "Кольцо"},
                "main_material": {"1": "Жемчуг", "2": "Сапфир", "3": "Рубин", "4": "Аметист",
                                  "5": "reroll: 1-2 адамант; 3-4 белый камень; 5-6 бесцветный кристалл",
                                  "6": "reroll: 1-2 изумруд; 3-4 зелёный камень; 5-6 зелёный кристалл"},
                "whose_work": {"1": "человеческая, Запад", "2": "эльфийская, Эрегион",
                               "3": "гномья, Кхазад-Дум", "4": "гномья, Эребор",
                               "5": "гномья, Белерианд (Ногрод или Белегост)", "6": "эльфийская, Белерианд"},
            },
        },
        "related": [TR + "klady", TR + "spisok_sokrovishch", PATRON_UNDERTAKING],
        "notes": "Владелец создания драгоценностей. Vision-assisted (фолио 159-160): три d6-таблицы "
                 "(Форма/Материал/Работа) сверены по скану. source_text — 2 спана в обход смещённой "
                 "слоем таблицы ВОЛШЕБНЫЕ СОКРОВИЩА (её владелец — treasure.klady). «Встреча с "
                 "покровителем» → fellowship_phase.nachinaniya (B5).",
    },
    {
        "id": TR + "spisok_sokrovishch", "title": "Список сокровищ",
        "subsystem": "treasure", "section": "Сокровища → Список сокровищ", "pages": [160, 161],
        "quotes": [("список сокровищ В НРИ «Кольцо Всевластья» найти волшебное",
                    "Хранители могут создавать собственные списки, учитывая состав отряда "
                    "в их приключениях.")],
        "summary": "Владелец списка сокровищ. Найти волшебное кольцо или знаменитый меч — это "
                   "поворотный момент кампании, а не просто необычная находка. Хранитель заранее "
                   "составляет список сокровищ — перечень всех магических предметов кампании, чтобы "
                   "строго контролировать уровень магии и заранее «планировать» появление предметов. При "
                   "составлении магические предметы делятся на Дивные артефакты, Чудесные предметы и "
                   "Знаменитое оружие и броню: Дивных артефактов можно включить сколько угодно, но "
                   "Чудесные предметы и Знаменитое снаряжение требуют точного перечня (оптимально 1–3 "
                   "Чудесных предмета и 1–3 предмета боевого снаряжения на каждого героя). Формы списков "
                   "доступны на сайте.",
        "parameters": {
            "treasure_list_is": "predefined_list_of_all_magic_items_in_the_campaign",
            "purpose": ["control_magic_level", "plan_item_appearances"],
            "categories": ["wondrous_artefacts", "marvellous_items", "famous_weapons_and_armour"],
            "counts": {"wondrous_artefacts": "unlimited",
                       "marvellous_items": "exact_list_1-3_per_hero",
                       "famous_weapons_and_armour": "exact_list_1-3_per_hero"},
        },
        "related": [TR + "klady", TR + "sozdanie_dragocennosti"],
        "notes": "Владелец списка сокровищ. Vision-assisted (фолио 160-161). Категории детализируются в "
                 "treasure.divnye_artefakty_chudesnye_predmety (следующий рендер, ф.161-162) и "
                 "treasure.znamenitoe_oruzhie_bronya (ф.162-167).",
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
    print(f"{n} B8 pilot cards written; {len(list(OUT.glob('*.json')))} total in mechanics/")


if __name__ == "__main__":
    main()
