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

PILOT (committed 20a5021) = 4 cards (folios 158-161): sokrovishcha / klady /
sozdanie_dragocennosti / spisok_sokrovishch. REMAINDER (this extension, folios
161-168) = 4 cards: divnye_artefakty_chudesnye_predmety (6 skill-group tables) /
znamenitoe_oruzhie_bronya (5-step creation + how-they-work) / volshebnye_nagrady
(the ~20 magic-reward catalog, split out of the «Знаменитое оружие» section for
size/lookup) / proklyatye_predmety (creation + 9 example curses). 8 cards total.

The cursed-effects tail (ВРАЖДЕБНОСТЬ, ЧУЖАЯ СОБСТВЕННОСТЬ, ТЁМНАЯ СКВЕРНА,
ОСЛАБЛЕНИЕ) sits on folio 169 (not separately rendered) but is inline prose, not
a scrambled table, so its numbers are reliable in the text layer.

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
    {
        "id": TR + "divnye_artefakty_chudesnye_predmety",
        "title": "Дивные артефакты и Чудесные предметы",
        "subsystem": "treasure", "section": "Сокровища → Дивные артефакты и Чудесные предметы",
        "pages": [161, 162],
        "quotes": [("дивные артефакты и чудесные предметы В эту категорию",
                    "ЗНАНИЯ (зеркало, книга, палантир)")],
        "summary": "Владелец Дивных артефактов и Чудесных предметов. Это предметы с чудесными "
                   "особенностями (плащи, скрывающие владельца от чужих глаз; боевые рога, внушающие "
                   "страх врагам и радость союзникам; посохи, облегчающие поиск, и т.п.). Одна чудесная "
                   "особенность делает предмет Дивным артефактом, две — Чудесным предметом. Каждая "
                   "особенность позволяет владельцу влиять на результат всех проверок одного навыка "
                   "(две особенности — двух разных навыков): при использовании игрок добавляет 2к к "
                   "броскам проверки этого навыка и может получить волшебный успех. Чтобы определить "
                   "навык, хранитель дважды бросает Кость успеха — первый бросок задаёт группу навыков, "
                   "второй сам навык (для Чудесного предмета процесс повторяется для каждой особенности). "
                   "Шесть групп (d6): 1 Навыки личности (внушительность/воодушевление/убеждение), 2 "
                   "Навыки движения (атлетика/странствие/скрытность), 3 Навыки восприятия "
                   "(бдительность/проницательность/поиск), 4 Навыки выживания (охота/исцеление/"
                   "исследование), 5 Социальные навыки (учтивость/выступление/загадки), 6 Навыки "
                   "профессии (ремесло/сражение/знания). В скобках на скане — типичные предметы-носители.",
        "parameters": {
            "artefact": "1 wondrous quality", "marvellous_item": "2 wondrous qualities",
            "quality_effect": "lets owner affect all checks of one related skill (two qualities -> two skills)",
            "magic_bonus_dice": 2, "magic_success_ref": "стр.21",
            "determine_skill": "roll success die twice: group, then skill in group (repeat per quality)",
            "skill_group_tables": {
                "1": {"group": "personality",
                      "skills": {"1-2": "внушительность", "3-4": "воодушевление", "5-6": "убеждение"}},
                "2": {"group": "movement",
                      "skills": {"1-2": "атлетика", "3-4": "странствие", "5-6": "скрытность"}},
                "3": {"group": "perception",
                      "skills": {"1-2": "бдительность", "3-4": "проницательность", "5-6": "поиск"}},
                "4": {"group": "survival",
                      "skills": {"1-2": "охота", "3-4": "исцеление", "5-6": "исследование"}},
                "5": {"group": "social",
                      "skills": {"1-2": "учтивость", "3-4": "выступление", "5-6": "загадки"}},
                "6": {"group": "profession",
                      "skills": {"1-2": "ремесло", "3-4": "сражение", "5-6": "знания"}},
            },
        },
        "related": [TR + "spisok_sokrovishch", TR + "znamenitoe_oruzhie_bronya", PATRON_UNDERTAKING],
        "notes": "Владелец Дивных артефактов и Чудесных предметов. Vision-assisted (ф.161-162): шесть "
                 "d6-таблиц навыков (группа→навык) сверены по скану. +2к → волшебный успех (checks). "
                 "Навыки — по канону SKILL_ORDER. «Встреча с покровителем» → fellowship_phase.nachinaniya "
                 "(B5).",
    },
    {
        "id": TR + "znamenitoe_oruzhie_bronya", "title": "Знаменитое оружие и броня",
        "subsystem": "treasure", "section": "Сокровища → Знаменитое оружие и броня", "pages": [162, 164],
        "quotes": [("знаменитое оружие и броня Оружие, выполненное с необычайным",
                    "может отправиться в подходящее место и выбрать начинание «Встреча с покровителем» "
                    "во время Фазы братства в Йоль (стр. 121).")],
        "summary": "Владелец Знаменитого оружия и брони (создание + как действуют; каталог улучшений — в "
                   "treasure.volshebnye_nagrady). Создание — 5 шагов: 1) выбор типа предмета (оружие или "
                   "защитное снаряжение); 2) определение, чья работа (эльфийская/гномья/нуменорская — "
                   "определяет доступ к свойству «гибельное» и набор улучшений; эльфы — Гламдринг, "
                   "Оркрист, Жало; гномы — Тельхар, Нарсил и шлем Хадора; нуменорцы — клинки из "
                   "могильников); 3) выбор гибельности (только для эльфийского или нуменорского оружия — "
                   "наделяется гибельными свойствами против типов существ: нуменорское обычно против "
                   "двух типов, эльфийское — против одного; типы: волки, недобрые люди, нежить, орки, "
                   "тролли, пауки; древнейшие эльфийские клинки — против самого Врага); 4) добавление "
                   "улучшений (через Награды и Волшебные награды); 5) поименование (у Знаменитого оружия "
                   "часто есть имя). Гибельное оружие эффективнее и разрушительнее против своего типа "
                   "врага, и враги узнают его с первого взгляда. Как действуют: при первом получении "
                   "раскрывается только первое улучшение из списка, остальные «спящие» и раскрываются по "
                   "порядку — либо повышением уровня ДОБЛЕСТИ (вместо Награды за рост Доблести можно "
                   "пробудить одно качество), либо посещением сокровищницы своего народа (начинание "
                   "«Встреча с покровителем»: число Наград на подаренном снаряжении можно обменять на "
                   "пробуждение равного числа улучшений).",
        "parameters": {
            "creation_steps": {
                "1_item_type": "weapon or protective gear",
                "2_whose_work": {"options": ["elvish", "dwarvish", "numenorean"],
                                 "determines": ["access_to_deadly_property", "available_improvements"]},
                "3_deadly": {"only_for": "elvish_or_numenorean_weapons",
                             "enemy_types": ["wolves", "evil_men", "undead", "orcs", "trolls", "spiders"],
                             "numenorean_usually": 2, "elvish_usually": 1,
                             "ancient_elvish": "may_be_against_the_Enemy_himself"},
                "4_improvements": "via Награды (стр.79) and Волшебные награды (this chapter)",
                "5_naming": "famous weapons/armour usually have a name",
            },
            "deadly_weapon": "more effective and destructive vs its enemy type; enemies recognise it on sight",
            "how_they_work": {
                "on_first_taking": "only the first-listed improvement is revealed; others 'sleeping'",
                "awaken_by": {
                    "valour_level": "instead of a Reward for a new Valour level, awaken one quality",
                    "treasury_visit": "Встреча с покровителем: exchange Rewards on gifted gear for awakening equal number of improvements",
                },
            },
        },
        "related": [TR + "volshebnye_nagrady", TR + "spisok_sokrovishch",
                    "kv.mechanics.valour_wisdom.doblest", PATRON_UNDERTAKING],
        "notes": "Владелец Знаменитого оружия и брони (создание + как действуют). Vision-assisted "
                 "(ф.162-164). Каталог Волшебных наград вынесен в treasure.volshebnye_nagrady (поддел "
                 "этой секции, отступление от 1:1-рубрикатора ради размера/справочности). «Гибельное»/"
                 "Травма → combat (B4); Награды → rewards_virtues; Доблесть → valour_wisdom.doblest; "
                 "«Встреча с покровителем» → fellowship_phase.nachinaniya (B5); типы врагов → adversaries "
                 "(B9, форвард-реф).",
    },
    {
        "id": TR + "volshebnye_nagrady", "title": "Волшебные награды",
        "subsystem": "treasure", "section": "Сокровища → Знаменитое оружие и броня → ВОЛШЕБНЫЕ НАГРАДЫ",
        "pages": [165, 167],
        "quotes": [("Описанные ниже награды выделяют предмет среди других",
                    "обычно дающих штраф при проверке атаки (все модификаторы затруднений игнорируются).")],
        "summary": "Владелец каталога Волшебных наград — улучшений Знаменитого оружия и брони (поддел "
                   "секции «Знаменитое оружие и броня»). У каждой награды указаны требования: РАБОТА "
                   "(для какой работы мастеров), ПРЕДМЕТ (к какому снаряжению), ОСОБЕННОСТЬ (гибельность). "
                   "Знаменитому оружию или броне можно добавить не более 3 Наград (волшебных или "
                   "обычных), при этом не менее 1 обязательно Волшебная; все Волшебные награды уникальны "
                   "(по разу на предмет). Первые 6 Волшебных наград — усиленные версии наград со стр.79; "
                   "улучшения с одинаковым описанием нельзя совмещать; эльфийскому или нуменорскому "
                   "оружию нужна не менее 1 Волшебной награды с параметром Гибельность. Каталог наград "
                   "(работа / предмет / эффект) приведён в parameters и сверен по скану.",
        "parameters": {
            "framing": {"max_rewards_total": 3, "min_magic": 1, "magic_rewards_unique": True,
                        "first_6_are": "enhanced versions of rewards on стр.79",
                        "elvish_or_numenorean_weapon_needs": "at least 1 magic reward with Deadliness"},
            "rewards": {
                "drevnyaya_tonkaya_rabota": {"work": ["elvish", "dwarvish"], "item": "armour/helm/shield",
                    "effect": "reduces item Load by 3 or by VALOUR (whichever higher; min 0)"},
                "drevnyaya_horoshaya_podgonka": {"work": ["elvish", "dwarvish"], "item": "armour/helm",
                    "effect": "+3 to PROTECTION checks or VALOUR bonus (whichever higher)"},
                "neobychayno_groznoe": {"work": ["elvish", "numenorean"], "item": "any weapon",
                    "deadly_if": "numenorean",
                    "effect": "+4 Wound rating (elvish) / +2 or VALOUR bonus (numenorean, if deadly for target)"},
                "neobychayno_ostroe": {"work": ["elvish", "dwarvish"], "item": "any weapon",
                    "deadly_if": "elvish",
                    "effect": "Piercing blow at 8+ on Feat die (dwarvish) / at 9+ or at 10-VALOUR (elvish, if deadly)"},
                "neobychayno_uzhasnoe": {"work": ["dwarvish", "numenorean"], "item": "any weapon",
                    "deadly_if": "numenorean",
                    "effect": "+2 damage (dwarvish) / +1 or VALOUR bonus (numenorean, if deadly)"},
                "neobychayno_usilennoe": {"work": ["any"], "item": "shield",
                    "deadly_if": "elvish_or_numenorean",
                    "effect": "shield Parry +2; numenorean/elvish +1 or VALOUR bonus vs deadly target"},
                "blesk_uzhasa": {"work": ["dwarvish"], "item": "melee weapon",
                    "effect": "on hit, target loses 2 Hatred/Resolve"},
                "istreblenie_vragov": {"work": ["elvish", "numenorean"], "item": "any weapon", "deadly": True,
                    "effect": "Piercing blow vs deadly target -> defence check ill-fated; if already ill-fated, Piercing auto-wounds"},
                "kusayushchaya_strela": {"work": ["elvish"], "item": "ranged weapon", "deadly": True,
                    "effect": "target loses 1 Hatred/Resolve, or 3 if deadly"},
                "mifrilnaya_bronya": {"work": ["dwarvish"], "item": "mail armour",
                    "effect": "short mail / mithril mail have Load 3 and 6 respectively"},
                "moshchnyy_udar": {"work": ["any"], "item": "melee weapon",
                    "effect": "target losing Endurance >= 2x its attribute is knocked back and loses its next action to rise"},
                "pokrytaya_runami_bronya": {"work": ["dwarvish"], "item": "armour",
                    "effect": "PROTECTION checks ignore misfortune/weariness"},
                "pokrytoe_runami_oruzhie": {"work": ["dwarvish", "elvish"], "item": "any weapon",
                    "effect": "attacks ignore misfortune/weariness"},
                "pokrytyy_runami_shlem": {"work": ["dwarvish"], "item": "helm",
                    "effect": "any skill check in a combat task ignores misfortune/weariness"},
                "pokrytyy_runami_shchit": {"work": ["dwarvish"], "item": "shield",
                    "effect": "attacks on the hero treated as if the attacker is weary"},
                "plamya_nadezhdy": {"work": ["dwarvish"], "item": "melee weapon",
                    "effect": "on hit, all fellowship (incl. self) recover 1 Endurance, +1 per success-sign"},
                "polaya_stal": {"work": ["numenorean"], "item": "bows", "deadly": "never",
                    "effect": "always one extra first volley (unless caught unawares)"},
                "rassekanie": {"work": ["any"], "item": "melee weapon",
                    "effect": "on killing an enemy, immediately attack another engaged enemy"},
                "svechenie": {"work": ["elvish"], "item": "melee weapon", "deadly": True,
                    "effect": "blade glows near a deadly-type creature; fellowship auto-avoids ambush from them"},
                "stremitelnyy_polyot": {"work": ["any"], "item": "ranged weapon",
                    "effect": "always shoots true even vs wind/darkness; attack difficulty modifiers ignored"},
            },
        },
        "related": [TR + "znamenitoe_oruzhie_bronya", "kv.mechanics.valour_wisdom.doblest",
                    "kv.mechanics.endurance_hope.vynoslivost", FEAT],
        "notes": "Каталог Волшебных наград (улучшений Знаменитого оружия/брони); поддел секции "
                 "«Знаменитое оружие и броня». Vision-assisted (ф.165-167): эффекты и числа (-3 Нагрузка; "
                 "+3 Защита; +4/+2 Травма; Пронзающий 8+/9+/10-Доблесть; +2/+1 урон; Парирование +2; -2 "
                 "Ненависть; Нагрузка 3/6; +1 Выносливость; +1 залп) сверены по скану. Эффекты — прозой "
                 "(числа внутри строк); проверяемые гейтом — рамочные 3/1/6. Доблесть → valour_wisdom; "
                 "Травма/Пронзающий/урон/Ненависть/Решимость → combat (B4) и adversaries (B9, форвард-реф); "
                 "Выносливость → endurance_hope; знак успеха → checks.feat_die_values.",
    },
    {
        "id": TR + "proklyatye_predmety", "title": "Проклятые предметы",
        "subsystem": "treasure", "section": "Сокровища → Проклятые предметы", "pages": [167, 168],
        "quotes": [("проклятые предметы Предметы, веками лежавшие во тьме",
                    "ЦЧ этой характеристики у носителя повышается на 2.")],
        "summary": "Владелец проклятых предметов. Предметы, веками лежавшие во тьме, Тень может наделить "
                   "зловещим предназначением; хранитель может дополнительно пометить найденное волшебное "
                   "сокровище как проклятое (по свойствам не уступает обычному). Создание проклятия: "
                   "добавляет предмету ещё одно качество, аналогичное чудесной особенности или Награде, "
                   "но с отрицательным эффектом; проявляется при определённых обстоятельствах (уход из "
                   "места находки; лунный свет; первая пролитая кровь; присутствие существа; пересечение "
                   "границы земель Тьмы); хранитель тайно решает, как снять проклятие — это нелёгкое "
                   "испытание, достойное стать центральным событием Фазы приключений; снятое проклятие "
                   "превращает предмет обратно в обычный волшебный. Примеры проклятий: ПРОКЛЯТИЕ СЛАБОСТИ "
                   "(проявляется наиболее выраженный Изъян по Пути Тени — Трусливость, Малодушие, "
                   "Кровожадность, Вороватость, Деспотичность, Вероломность; Изъян временный, не "
                   "учитывается при поддаче Тени); ПОМРАЧЕНИЕ (когда предмет виден, тьма гуще, зрение "
                   "владельца ухудшается, все подходящие проверки убирают 1к); ПОГОНЯ (враги — орки, "
                   "недобрые люди, Враг — чувствуют предмет); НЕВЕЗЕНИЕ (Око на Кости испытания при любой "
                   "проверке → автопровал, как у несчастного); ЗЛОВЕЩИЙ ЗНАК (мрачные знамения и дурные "
                   "вести; на Совете убирается 1к); ВРАЖДЕБНОСТЬ (запрещено тратить Надежду на бонусные "
                   "кости при бросках, связанных с предметом); ЧУЖАЯ СОБСТВЕННОСТЬ (предмет принадлежит "
                   "другому существу; в присутствии владельца теряет все особые качества); ТЁМНАЯ СКВЕРНА "
                   "(рейтинг Тени носителя растёт: +1 при одной особенности, +2 при двух, либо вдвое от "
                   "числа Волшебных наград — нельзя снять или исцелить); ОСЛАБЛЕНИЕ (хранитель выбирает "
                   "характеристику — СИЛУ, СЕРДЦЕ или РАЗУМ; её ЦЧ повышается на 2).",
        "parameters": {
            "keeper_may_mark": "any found magic treasure as cursed (no worse in properties)",
            "curse_is": "an extra quality like a wondrous-quality or Reward but with a negative effect",
            "trigger_examples": ["leaving the find-place", "moonlight", "first blood",
                                 "presence of a creature", "crossing into the lands of Shadow"],
            "lifting": "keeper secretly decides; a hard challenge, central to an Adventuring phase; once lifted the item becomes a normal magic item",
            "curse_examples": {
                "proklyatie_slabosti": {
                    "effect": "the most pronounced Flaw (per Shadow Path) manifests; temporary, not counted when succumbing to Shadow",
                    "flaws": ["Трусливость", "Малодушие", "Кровожадность", "Вороватость",
                              "Деспотичность", "Вероломность"]},
                "pomrachenie": {"effect": "item visible -> shadows thicken, owner's sight worsens, all suitable checks -1 die"},
                "pogonya": {"effect": "enemies (orcs, evil men, the Enemy) feel the item nearby; travel events may relate"},
                "nevezenie": {"effect": "the Eye on the Feat die in any check -> automatic failure for the owner (as if ill-fated)"},
                "zloveshchiy_znak": {"effect": "dark omens and ill news; all Council checks -1 die"},
                "vrazhdebnost": {"effect": "cannot spend Hope for bonus dice on rolls involving the item"},
                "chuzhaya_sobstvennost": {"effect": "item belongs to another being; in that owner's presence it loses all qualities"},
                "tyomnaya_skverna": {"effect": "wearer's Shadow rating increases (+1 for 1 quality, +2 for 2; famous gear = twice the number of Magic rewards); cannot be removed or healed"},
                "oslablenie": {"effect": "keeper picks an attribute (STRENGTH/HEART/WITS); its TN increases by 2"},
            },
        },
        "related": [TR + "znamenitoe_oruzhie_bronya", "kv.mechanics.shadow.ispolzovanie_izyanov",
                    "kv.mechanics.council.zavershenie_soveta", FEAT, TR + "sozdanie_dragocennosti"],
        "notes": "Владелец проклятых предметов (создание + 9 примеров проклятий). Vision-assisted: "
                 "ф.167-168 сверены по скану; хвост (ВРАЖДЕБНОСТЬ, ЧУЖАЯ СОБСТВЕННОСТЬ, ТЁМНАЯ СКВЕРНА, "
                 "ОСЛАБЛЕНИЕ) — на ф.169 (не рендерилась), но это inline-проза, числа сверены по "
                 "текст-слою. Эффекты прозой (числа в строках). Изъяны/Пути Тени → "
                 "shadow.ispolzovanie_izyanov (B6); Совет −1к → council (B5); Око/несчастье → "
                 "checks.feat_die_values; враги → adversaries (B9, форвард-реф); проклятые драгоценности "
                 "→ treasure.sozdanie_dragocennosti (стр.160). Врезка ОБРЕТЕНИЕ КОЛЬЦА вклинилась слоем в "
                 "текст ЗЛОВЕЩЕГО ЗНАКА — оставлена в спане как есть.",
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
    print(f"{n} B8 cards written; {len(list(OUT.glob('*.json')))} total in mechanics/")


if __name__ == "__main__":
    main()
