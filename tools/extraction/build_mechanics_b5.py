"""Build rule cards for B5 (КВ: keeper_tools, council, journey, fellowship_phase).

Pages 92-123. THROWAWAY STAGE-0 TOOLING. Same contract as build_mechanics_b4.py:
every source_text quote is CUT from the КВ core text layer by a (start, end_incl)
anchor pair over whitespace-normalized text — never retyped — so gate 1
(text-fidelity, ADR-002) holds by construction. summary/parameters are engine
annotations; every number in parameters traces to the cut source_text (gate
check_param_numbers); table-column attributions pdftotext scrambled are flagged
⚠ for the human gate 2b and NOT self-certified here.

16 cards = 15 rubricator skeletons (council×3, journey×6, fellowship_phase×4,
keeper_tools×2) 1:1, PLUS one card recovered from a segmentation gap:
`combat.vyhod_iz_boya` (КВ стр.105 «БЕГИТЕ, ГЛУПЦЫ!» — leaving combat), whose
text had bled into council.zavershenie_soveta's block. zavershenie_soveta is
therefore re-cut to start at "ОПРЕДЕЛЕНИЕ СОПРОТИВЛЕНИЯ" (council content only).

CANONICAL VOCABULARIES OWNED BY B5:
  - journey: roles (guide/hunter/look_out/scout), journey-event roll, fatigue
    accrual/reduction, journey_scene_table, scene_target_table, danger zones;
  - council: resistance {reasonable3/bold6/audacious9}, duration, attitude
    {cold-1/neutral0/friendly+1}, outcomes;
  - fellowship: phase structure (4 steps), training_cost (⚠2b), spiritual
    recovery, Yule, undertakings list, song types.

JOIN CONTRACT — NO CHURN to prior batches (only validate count bumped):
  - Fatigue: endurance_hope.vynoslivost (B2.1) owns the concept + combined weary
    threshold; B5 owns journey accrual/reduction only;
  - council/journey/fellowship skills reference SKILL_ORDER (B3);
  - fellowship undertakings reference existing cards: hero_creation.calling_*,
    traits.otlichitelnye_kachestva, valour_wisdom.*, hero_creation.patron,
    standard_of_living.*, endurance_hope.nadezhda, ponies_and_horses;
  - feat-die faces reuse tokens eye/1-10/gandalf_rune (checks.feat_die_values).

CONTOUR BOUNDARY (D2): B5 digitizes the CORE multi-hero rules; the «Игра для
одного» solo overlay (solo journey via answer tables, solo council/fellowship)
is deferred to a solo-overlay batch — recorded in notes. Solo journey TABLES
already live in tables/solo (different source); journey cards reference them.

FORWARD REFERENCES (notes only, not `related`): Shadow points/scars & «Тень»
(стр.136-137), keeper chapter 8, adversaries (стр.142).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parents[1] / "content-packs" / "kv" / "mechanics"
LAYER = (HERE / "source_kv" / "kv_core.txt").read_text(encoding="utf-8")
NORM = re.sub(r"\s+", " ", LAYER.replace("\u0002", "")).strip()

CM = "kv.mechanics.combat."
KT = "kv.mechanics.keeper_tools."
CO = "kv.mechanics.council."
JO = "kv.mechanics.journey."
FP = "kv.mechanics.fellowship_phase."
SK = "kv.mechanics.traits.spisok_navykov"


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


CARDS = [
    # ---------------- keeper_tools (2) ----------------
    {
        "id": KT + "kak_ustroena_faza_priklyucheniy", "title": "Как устроена Фаза приключений",
        "subsystem": "keeper_tools", "section": "Фаза приключений → Как устроена Фаза приключений",
        "pages": [92],
        "quotes": [("«Как я понял, вы попали в приключения, и без меня",
                    "Фазе братства, сказано в главе 8 «Хранитель»).")],
        "summary": "Игровой процесс — это серия Фаз приключений (где происходят приключения) и Фаз "
                   "братства (что между ними). В Фазе приключений задача хранителя — испытывать героев; "
                   "повествование строится как динамичный обмен: игроки описывают действия, хранитель "
                   "отвечает, и так далее.",
        "parameters": {"game_loop": ["adventuring_phase", "fellowship_phase"],
                       "adventuring_phase": "keeper_challenges_heroes",
                       "fellowship_phase": "between_adventures"},
        "related": [KT + "sessii_fazy_priklyucheniy", FP + "kak_ustroena_faza_bratstva"],
        "notes": "Глава 8 «Хранитель» — за пределами пака (B-later).",
    },
    {
        "id": KT + "sessii_fazy_priklyucheniy", "title": "Сессии Фазы приключений",
        "subsystem": "keeper_tools", "section": "Фаза приключений → Сессии Фазы приключений",
        "pages": [92, 93],
        "quotes": [("В среднем Фаза приключений длится две-три игровые",
                    "оставшегося на игру (глава 7 «Фаза братства»).")],
        "summary": "Фаза приключений в среднем занимает две-три сессии по ~3 часа. Сессия строится по "
                   "схеме: 1) вступление (когда/где/что/почему), 2) сцены, 3) конец сессии. Сцена может "
                   "длиться от менее часа до целой сессии (Совет). Если сюжетная линия не завершена — "
                   "продолжение в новой сессии; если завершена — далее Фаза братства.",
        "parameters": {"sessions_per_phase": "two_to_three", "session_hours": "about_3",
                       "session_structure": ["intro", "scenes", "session_end"],
                       "max_session_hours": "three_to_four"},
        "related": [KT + "kak_ustroena_faza_priklyucheniy", CO + "sovet"],
        "notes": "",
    },
    # ---------------- council (3) ----------------
    {
        "id": CO + "sovet", "title": "Совет",
        "subsystem": "council", "section": "Фаза приключений → СОВЕТ", "pages": [104],
        "quotes": [("«Скоро узнаешь всё, что тебя интересует, – ответил",
                    "отслеживания хода встречи и её последствий.")],
        "summary": "Официальная встреча одного или нескольких персонажей хранителя с отрядом героев "
                   "называется Советом. Хотя большую часть можно разыгрывать как свободный диалог, "
                   "правила этой подглавы хорошо подходят для отслеживания хода встречи и её последствий.",
        "parameters": {"definition": "formal_meeting_with_npcs",
                       "rules_optional_over_freeform": True},
        "related": [CO + "sotsialnoe_vzaimodeystvie", CO + "zavershenie_soveta"],
        "notes": "",
    },
    {
        "id": CO + "sotsialnoe_vzaimodeystvie", "title": "Социальное взаимодействие",
        "subsystem": "council", "section": "Фаза приключений → СОВЕТ → Социальное взаимодействие",
        "pages": [104, 108],
        "quotes": [("Советы — это социальные события большой значимости,",
                    "финальный этап для оценки его результатов («")],
        "summary": "Совет — социальное событие с высокими ставками, где отряд может получить или "
                   "потерять нечто ценное; обычные разговоры разыгрываются по простым проверкам. Чтобы "
                   "достичь цели, отряд набирает число успехов, равное рейтингу сопротивления, за "
                   "ограниченное число попыток (длительность Совета). Порядок: определение "
                   "сопротивления, знакомство, переговоры; затем — завершение.",
        "parameters": {"is_council_if": "formal_high_stakes_meeting",
                       "goal": "accumulate_successes >= resistance",
                       "attempts_limited_by": "council_duration",
                       "stages": ["determine_resistance", "introduction", "negotiations"],
                       "final_stage": "completion"},
        "related": [CO + "zavershenie_soveta", CO + "sovet"],
        "notes": "",
    },
    {
        "id": CO + "zavershenie_soveta", "title": "Завершение совета",
        "subsystem": "council",
        "section": "Фаза приключений → СОВЕТ → Определение сопротивления / Знакомство / Переговоры / Завершение",
        "pages": [105, 108],
        "quotes": [("ОПРЕДЕЛЕНИЕ СОПРОТИВЛЕНИЯ Когда герои отправляются",
                    "бросить в темницу или даже просто атаковать.")],
        "summary": "Владелец механики Совета. Рейтинг сопротивления: разумная просьба 3, смелая 6, "
                   "дерзкая 9. Знакомство: представитель совершает проверку — при провале длительность "
                   "Совета 3, при успехе 4 плюс 1 за знак (навыки ВНУШИТЕЛЬНОСТЬ/ЗАГАДКИ/УЧТИВОСТЬ). "
                   "Переговоры: накопить успехи до рейтинга сопротивления; отношение ПХ даёт модификатор "
                   "(холодное −1к, нейтральное 0, дружественное +1к); навыки "
                   "ВООДУШЕВЛЕНИЕ/ВЫСТУПЛЕНИЕ/ЗАГАДКИ/ПРОНИЦАТЕЛЬНОСТЬ/УБЕЖДЕНИЕ; хороший отыгрыш "
                   "даёт +1к или +2к. Три исхода: успех, провал-или-успех-с-оговоркой, катастрофа.",
        "parameters": {
            "resistance": {"reasonable": 3, "bold": 6, "audacious": 9},
            "introduction": {
                "representative_check": True,
                "duration_on_fail": 3,
                "duration_on_success": "4 + 1 per success sign",
                "useful_skills": ["awe", "riddle", "courtesy"],
            },
            "negotiations": {
                "accumulate_successes_to": "resistance",
                "attitude_modifier_dice": {"cold": -1, "neutral": 0, "friendly": 1},
                "useful_skills": ["inspire", "song", "riddle", "insight", "persuade"],
                "good_roleplay_bonus_dice": [1, 2],
            },
            "outcomes": {
                "success": "goal_achieved",
                "failure_or_success_with_cost": "insufficient_successes: refusal or goal_at_a_price",
                "catastrophe": "all_checks_failed_or_failed_introduction: party_seen_as_threat",
            },
        },
        "related": [CO + "sotsialnoe_vzaimodeystvie", CO + "sovet", SK],
        "notes": "Владелец механики Совета; навыки → SKILL_ORDER (B3). Боевая врезка «БЕГИТЕ, ГЛУПЦЫ!» "
                 "(ф.105), ранее склеенная в начало этого блока слоем, вынесена в combat.vyhod_iz_boya; "
                 "source_text здесь перенарезан со старта «Определение сопротивления».",
    },
    # ---------------- journey (6) ----------------
    {
        "id": JO + "puteshestvie", "title": "Путешествие",
        "subsystem": "journey", "section": "Фаза приключений → ПУТЕШЕСТВИЕ", "pages": [108],
        "quotes": [("Затем он подробно рассказал об их путешествии с",
                    "рассказывающими об успехах отряда искателей приключений.")],
        "summary": "Путешествие — больше чем способ добраться до цели; по сути оно синоним приключения. "
                   "Игровой процесс в пути менее детален, правила вплетаются в повествование. Применение "
                   "правил требует карты региона и совместных решений; удобен журнал путешествий (стр.240).",
        "parameters": {"requires": ["region_map", "journey_log"], "journey_log_page": 240},
        "related": [JO + "karta", JO + "poryadok_puteshestviya"],
        "notes": "",
    },
    {
        "id": JO + "karta", "title": "Карта",
        "subsystem": "journey", "section": "Фаза приключений → ПУТЕШЕСТВИЕ → Карта", "pages": [108, 109],
        "quotes": [("Правила путешествий в НРИ «Кольцо Всевластья» предполагают,",
                    "неё посещённые места. ФАЗА ПРИКЛЮЧЕНИЙ 109")],
        "summary": "Правила предполагают, что отряд стремится к конкретному пункту назначения; если "
                   "целей несколько, путь к каждой — отдельное путешествие. Карта игрока (на форзаце) "
                   "отражает географические знания; целью может быть любой отмеченный пункт, но не все "
                   "поселения отмечены. Знания можно пополнять в игре, нанося посещённые места.",
        "parameters": {"destination_required": True, "multiple_destinations": "separate_journeys",
                       "player_map_location": "endpaper"},
        "related": [JO + "puteshestvie", JO + "poryadok_puteshestviya"],
        "notes": "",
    },
    {
        "id": JO + "puteshestvuyuschiy_otryad", "title": "Путешествующий отряд",
        "subsystem": "journey", "section": "Фаза приключений → ПУТЕШЕСТВИЕ → Путешествующий отряд",
        "pages": [109],
        "quotes": [("В путешествии члены отряда берут на себя разные",
                    "игре, когда случается сцена путешествия (см. «")],
        "summary": "В путешествии члены отряда берут на себя разные роли. Роль в общих чертах указывает, "
                   "чем герой занимается в пути, и учитывается в игре, когда случается сцена путешествия.",
        "parameters": {"members_take_roles": True, "role_matters_on": "journey_scene"},
        "related": [JO + "poryadok_puteshestviya", JO + "razygryvanie_stsen_puteshestviya"],
        "notes": "",
    },
    {
        "id": JO + "poryadok_puteshestviya", "title": "Порядок путешествия",
        "subsystem": "journey", "section": "Фаза приключений → ПУТЕШЕСТВИЕ → Порядок путешествия",
        "pages": [109, 112],
        "quotes": [("»). В путешествии есть четыре роли: проводник,",
                    "путешествия для конкретных опасных зон. ГЛАВА 6 112")],
        "summary": "Владелец процедуры путешествия. Четыре роли: проводник (маршрут/отдых/припасы, "
                   "только один), охотник (пропитание), дозорный (стража), разведчик (лагерь/тропы). "
                   "Порядок: выбор маршрута, Испытания похода, завершение. Испытание похода — проверка "
                   "СТРАНСТВИЯ проводником: при провале сцена через 2 гекса (лето/весна) или 1 (зима/"
                   "осень); при успехе через 3 гекса плюс 1 за знак. Путешествие завершается, когда "
                   "результат проверки ≥ числа оставшихся гексов. Изнурение копится в сценах и снимается "
                   "в конце: сначала на рейтинг Тяги скакунов, затем проверкой СТРАНСТВИЯ (−1 и ещё −1 за "
                   "знак), и по −1 за каждый последующий долгий отдых в безопасном месте. Длительность = "
                   "гексы плюс 1 за каждый сложный гекс (верхом — пополам, округляя вверх). Марш-бросок: "
                   "2 гекса в день, но +1 балл Изнурения за день. Опасные зоны требуют числа сцен, "
                   "равного степени опасности.",
        "parameters": {
            "roles": {
                "guide": {"name_ru": "Проводник", "duty": "route_rest_supplies", "max": 1},
                "hunter": {"name_ru": "Охотник", "duty": "foraging"},
                "look_out": {"name_ru": "Дозорный", "duty": "keeping_watch"},
                "scout": {"name_ru": "Разведчик", "duty": "camp_and_finding_paths"},
            },
            "role_assignment": {"all_four_required": True, "guide_unique": True,
                                "fewer_than_4_heroes": "combine_roles",
                                "more_than_4_heroes": "multiple_per_role_except_guide"},
            "long_journey_split_over_hexes": 20,
            "order": ["choose_route", "journey_events", "end_journey"],
            "journey_event_roll": {
                "check": "travel", "performed_by": "guide",
                "on_fail": {"summer_spring_hexes": 2, "winter_autumn_hexes": 1},
                "on_success": {"hexes": 3, "per_success_sign_hexes": 1},
            },
            "end_when": "journey_roll_result >= remaining_hexes",
            "fatigue": {
                "accrued_during": "scenes",
                "cannot_remove_until_journey_end": True,
                "end_of_journey": ["reduce_by_mount_carry_rating",
                                   "travel_check: -1 and -1 per success sign"],
                "per_safe_long_rest": -1,
            },
            "duration_days": {"base": "hexes + 1 per difficult_terrain_hex",
                              "mounted": "halve_round_up"},
            "forced_march": {"hexes_per_day": 2, "extra_fatigue_per_day": 1},
            "danger_zones": {"party_stops_on_entry": True, "scenes_to_clear": "peril_rating"},
        },
        "related": [JO + "razygryvanie_stsen_puteshestviya", JO + "puteshestvuyuschiy_otryad",
                    SK, "kv.mechanics.endurance_hope.vynoslivost",
                    "kv.mechanics.hero_creation.ponies_and_horses"],
        "notes": "Владелец процедуры и ролей. Концепт Изнурения и комбинированный порог усталости — "
                 "endurance_hope.vynoslivost (B2.1); здесь только накопление/снятие в пути. Тяга "
                 "скакунов — hero_creation.ponies_and_horses (стр.50). СТРАНСТВИЕ — SKILL_ORDER. "
                 "Соло-режим переопределит роли/сцены через ИдО.",
    },
    {
        "id": JO + "razygryvanie_stsen_puteshestviya", "title": "Разыгрывание сцен путешествия",
        "subsystem": "journey",
        "section": "Фаза приключений → ПУТЕШЕСТВИЕ → Разыгрывание сцен путешествия", "pages": [112, 114],
        "quotes": [("Путешествия могут быть долгими, но спокойными либо",
                    "баллов Изнурения получит каждый герой в отряде.")],
        "summary": "Владелец таблиц сцены. Три шага: выбор цели, определение сцены, определение "
                   "результата. Таблица целей (Кость успеха): 1–2 разведчики (ИССЛЕДОВАНИЕ), 3–4 "
                   "дозорные (БДИТЕЛЬНОСТЬ), 5–6 охотники (ОХОТА). Таблица сцен путешествия (Кость "
                   "испытания) задаёт тип сцены, последствия провала/успеха проверки и получаемые "
                   "баллы Изнурения: Ужасная неудача (цель ранена, Изн.3), Отчаяние (все +1 Тень-Страх, "
                   "Изн.2), Плохой выбор (цель +1 Тень-Страх, Изн.2), Неприятность (+1 день, цель +1 "
                   "Изнурение, Изн.2), Короткий путь (−1 день, Изн.1), Случайная встреча (Изнурение не "
                   "начисляется, благоприятная встреча, Изн.1), Вдохновляющий вид (все +1 Надежда).",
        "parameters": {
            "steps": ["choose_target", "determine_scene", "determine_outcome"],
            "scene_target_table": {
                "rolled_with": "success_die",
                "by_value": {
                    "1-2": {"target": "scout", "check": "exploration"},
                    "3-4": {"target": "look_out", "check": "awareness"},
                    "5-6": {"target": "hunter", "check": "hunting"},
                },
            },
            "journey_scene_table": {
                "rolled_with": "feat_die",
                "rows": {
                    "terrible_misfortune": {"name_ru": "Ужасная неудача", "feat_die": "eye",
                                            "on_fail": "target_wounded", "fatigue": 3},
                    "despair": {"name_ru": "Отчаяние", "feat_die": "1",
                                "on_fail": "all_gain_1_shadow_fear", "fatigue": 2},
                    "bad_choice": {"name_ru": "Плохой выбор", "feat_die": "2-3",
                                   "on_fail": "target_gains_1_shadow_fear", "fatigue": 2},
                    "mishap": {"name_ru": "Неприятность", "feat_die": "4-7",
                               "on_fail": "plus_1_day_and_target_plus_1_fatigue", "fatigue": 2},
                    "short_cut": {"name_ru": "Короткий путь", "feat_die": "8-9",
                                  "on_success": "minus_1_day", "fatigue": 1},
                    "chance_meeting": {"name_ru": "Случайная встреча", "feat_die": "10",
                                       "on_success": "no_fatigue_favourable_encounter", "fatigue": 1},
                    "inspiring_sight": {"name_ru": "Вдохновляющий вид", "feat_die": "gandalf_rune",
                                        "on_success": "all_gain_1_hope", "fatigue": 0},
                },
            },
        },
        "related": [JO + "poryadok_puteshestviya", JO + "opisanie_stsen_puteshestviya", SK,
                    "kv.mechanics.checks.feat_die_values"],
        "notes": "Владелец таблиц сцены. Грани Кости испытания — токены eye/1-10/gandalf_rune. "
                 "⚠ ГЕЙТ-2b (ф.113): средние грани (1, 2-3, 4-7, 8-9, 10) и баллы Изнурения читаются в "
                 "тексте, но привязка eye=Ужасная неудача / gandalf_rune=Вдохновляющий вид выведена по "
                 "исключению (их метки грани слой потерял), а колонка Изнурения переколочена — "
                 "подтвердить по скану. Баллы Тени (Страх) — гл. «Тень» (B-later). Соло-таблицы сцен — "
                 "tables/solo (ИдО), иной источник.",
    },
    {
        "id": JO + "opisanie_stsen_puteshestviya", "title": "Описание сцен путешествия",
        "subsystem": "journey",
        "section": "Фаза приключений → ПУТЕШЕСТВИЕ → Описание сцен путешествия", "pages": [114, 116],
        "quotes": [("При разыгрывании сцены хранитель должен быть готов",
                    "Кхелед-зарам». ФАЗА ПРИКЛЮЧЕНИЙ 115 ГЛАВА 7")],
        "summary": "Указания для импровизации каждого из типов сцен путешествия. Хранитель придумывает "
                   "короткий эпизод, опираясь на роль цели, проверяемый навык и текущую ситуацию, "
                   "вплетая дорожные события в общее повествование. Перечислены типы: Ужасная неудача, "
                   "Отчаяние, Плохой выбор, Неприятность, Короткий путь, Случайная встреча, "
                   "Вдохновляющий вид.",
        "parameters": {
            "scene_types": ["terrible_misfortune", "despair", "bad_choice", "mishap",
                            "short_cut", "chance_meeting", "inspiring_sight"],
            "improvised_from": ["target_role", "checked_skill", "current_situation"],
        },
        "related": [JO + "razygryvanie_stsen_puteshestviya"],
        "notes": "Описания нарративные; механика — в razygryvanie_stsen. Цитаты в source_text — из "
                 "книги (фиделити слоя).",
    },
    # ---------------- fellowship_phase (4) ----------------
    {
        "id": FP + "kak_ustroena_faza_bratstva", "title": "Как устроена Фаза братства",
        "subsystem": "fellowship_phase", "section": "ФАЗА БРАТСТВА → Как устроена Фаза братства",
        "pages": [118],
        "quotes": [("В этом гостеприимном доме они пробыли долго, не",
                    "или предшествовать новой Фазе приключений.")],
        "summary": "В Фазе братства управление переходит к игрокам: они сами развивают повествование с "
                   "учётом стремлений героев, а хранитель наблюдает. Фаза ограничена временем и "
                   "территорией; нельзя вводить новые места или незнакомых персонажей (это для Фазы "
                   "приключений). Фаза братства завершает каждую Фазу приключений.",
        "parameters": {"narrative_control": "players",
                       "constraints": ["limited_duration", "limited_territory",
                                       "no_new_places_or_npcs"],
                       "ends_each_adventuring_phase": True},
        "related": [FP + "struktura_fazy_bratstva"],
        "notes": "",
    },
    {
        "id": FP + "struktura_fazy_bratstva", "title": "Структура Фазы братства",
        "subsystem": "fellowship_phase", "section": "ФАЗА БРАТСТВА → Структура Фазы братства",
        "pages": [118, 120],
        "quotes": [("Любая Фаза братства устроена следующим образом.",
                    "года («Начинания Фазы братства», стр. 121).")],
        "summary": "Владелец структуры Фазы братства: 1) определение длительности (от недели до сезона; "
                   "самая долгая — Йоль), 2) выбор места (безопасное, уже посещённое), 3) улучшение "
                   "параметров, 4) выбор начинаний. Улучшение: обучение тратит баллы навыков по таблице "
                   "стоимости (каждый навык не больше чем на 1 уровень за фазу); рост тратит баллы "
                   "приключения на Доблесть/Мудрость или Боевые умения (новый уровень Доблести или "
                   "Мудрости даёт новую Награду или Особенность; за фазу можно поднять либо Доблесть, "
                   "либо Мудрость, и каждое Боевое умение не больше чем на 1). Духовное восстановление: "
                   "Надежда восстанавливается на рейтинг СЕРДЦА (в Йоль — полностью); при успехе против "
                   "Тени можно убрать от 1 до 3 баллов Тени.",
        "parameters": {
            "steps": ["determine_duration", "choose_place", "improve_stats", "choose_undertakings"],
            "duration": {"min": "one_week", "max": "a_season", "longest": "yule"},
            "place": ["safe", "previously_visited"],
            "improve_stats": {
                "skills": {"spend": "skill_points", "max_per_skill_per_phase": 1},
                "growth": {"spend": "adventure_points",
                           "raises": ["valour", "wisdom", "weapon_skill"],
                           "new_valour_or_wisdom_level_grants": "reward_or_virtue",
                           "max_per_weapon_skill_per_phase": 1,
                           "valour_or_wisdom_per_phase": "one_only"},
                "training_cost": {
                    "spend": {"skill_or_weapon_skill": "skill_points",
                              "valour_or_wisdom": "adventure_points"},
                    "rows": [
                        {"new_skill_or_weapon_skill_level": 1, "new_valour_or_wisdom_level": None, "cost": 4},
                        {"new_skill_or_weapon_skill_level": 2, "new_valour_or_wisdom_level": 2, "cost": 8},
                        {"new_skill_or_weapon_skill_level": 3, "new_valour_or_wisdom_level": 3, "cost": 12},
                        {"new_skill_or_weapon_skill_level": 4, "new_valour_or_wisdom_level": 4, "cost": 20},
                        {"new_skill_or_weapon_skill_level": 5, "new_valour_or_wisdom_level": 5, "cost": 26},
                        {"new_skill_or_weapon_skill_level": 6, "new_valour_or_wisdom_level": 6, "cost": 30},
                    ],
                },
            },
            "spiritual_recovery": {
                "hope_recovered": "heart_rating", "yule": "full_hope",
                "shadow_reduction_on_success": {"minor": 1, "active": 2, "great_deeds": 3},
            },
        },
        "related": [FP + "nachinaniya_fazy_bratstva", FP + "yol",
                    "kv.mechanics.valour_wisdom.doblest", "kv.mechanics.valour_wisdom.mudrost",
                    "kv.mechanics.endurance_hope.nadezhda"],
        "notes": "Владелец структуры и роста. Таблица СТОИМОСТЬ ОБУЧЕНИЯ разрешена по скану ф.119 "
                 "(gate2b_evidence/MANIFEST.md): C1 «уровень навыка/умения» — пиктограммные пипсы 1-6 "
                 "(текст-слой их роняет), C2 «уровень Доблести/Мудрости» — none,2,3,4,5,6, C3 «цена» — "
                 "4/8/12/20/26/30; цена привязана к строке (навык/умение N и Доблесть/Мудрость N делят "
                 "цену строки; у Доблести/Мудрости нет строки уровня 1). Награды/Особенности (стр.78) - "
                 "rewards_virtues (B3). Баллы Тени - гл. «Тень» (B-later).",
    },
    {
        "id": FP + "yol", "title": "Йоль",
        "subsystem": "fellowship_phase", "section": "ФАЗА БРАТСТВА → Йоль", "pages": [120, 121],
        "quotes": [("Примерно раз в три Фазы братства наступает зима,",
                    "следующую Фазу приключений. 4 ФАЗА БРАТСТВА 121")],
        "summary": "Примерно раз в три Фазы братства наступает зима — Йоль, обычно самая долгая Фаза "
                   "братства; чаще всего отряд расходится по домам. Течение лет: все герои становятся на "
                   "год старше. В Йоль герои восстанавливают всю Надежду и получают бонусные баллы "
                   "навыков, равные рейтингу РАЗУМА, добавляя их к накопленным. Хранитель может "
                   "рассказать отряду о переменах в мире.",
        "parameters": {"frequency": "about_every_3rd_fellowship_phase", "party_disperses": True,
                       "aging": "plus_one_year", "full_hope": True,
                       "bonus_skill_points": "wits_rating"},
        "related": [FP + "struktura_fazy_bratstva", FP + "nachinaniya_fazy_bratstva"],
        "notes": "",
    },
    {
        "id": FP + "nachinaniya_fazy_bratstva", "title": "Начинания Фазы братства",
        "subsystem": "fellowship_phase", "section": "ФАЗА БРАТСТВА → Начинания Фазы братства",
        "pages": [121, 123],
        "quotes": [("В этом разделе перечислены разные занятия, доступные",
                    "командир, это начинание можно выбрать бесплатно.")],
        "summary": "Владелец списка начинаний — занятий, доступных в Фазе братства. Выбор: в обычную "
                   "Фазу отряд выбирает одно общее начинание плюс одно бесплатное, связанное с "
                   "призваниями героев (до двух всего); в Йоль каждый игрок выбирает по одному своему "
                   "начинанию плюс одно общее. Начинания обычно разные, кроме йольских. Список: "
                   "Взращивание наследника (Йоль; до 5 баллов сокровищ и до 5 баллов приключения в запас "
                   "опыта наследника), Встреча с покровителем (бесплатно вестнику), Изучение волшебных "
                   "предметов (бесплатно искателю сокровищ), Изучение карт (+1 к броскам Кости испытания "
                   "в пути; бесплатно учёному), Изменение полезных предметов (в пределах Образа жизни), "
                   "Исполнение песен (ВЫСТУПЛЕНИЕ — игнорировать усталость; раз за песню за Фазу "
                   "приключений), Исцеление шрамов (Йоль; 5 баллов приключения — убрать 1 шрам Тени), "
                   "Написать песню (бесплатно воителю; типы: баллада/Совет, песнь победы/бой, походная "
                   "песня/путешествие), Поведать историю (Йоль; заменить одно Отличительное качество), "
                   "Собирать слухи (бесплатно стражу), Укрепить братство (+1 к рейтингу братства; "
                   "бесплатно командиру).",
        "parameters": {
            "selection": {
                "normal_phase": {"party_common": 1, "free_calling_undertaking": 1, "max_total": 2},
                "yule": {"per_hero": 1, "plus_party_common": 1},
                "must_be_distinct_except": "yule_tagged",
            },
            "undertakings": {
                "raise_heir": {"name_ru": "Взращивание наследника", "yule": True,
                               "spend": {"treasure_points_max": 5, "adventure_points_max": 5},
                               "effect": "add_to_heir_starting_experience: +1 per adventure point"},
                "meet_patron": {"name_ru": "Встреча с покровителем", "free_if_calling": "messenger"},
                "study_magic_items": {"name_ru": "Изучение волшебных предметов",
                                      "free_if_calling": "treasure_hunter"},
                "study_maps": {"name_ru": "Изучение карт", "free_if_calling": "scholar",
                               "effect": "+1 to journey feat-die rolls until next phase"},
                "change_useful_items": {"name_ru": "Изменение полезных предметов",
                                        "effect": "within_standard_of_living_max"},
                "perform_songs": {"name_ru": "Исполнение песен", "check": "song",
                                  "effect": "ignore_weariness_for_the_heroic_venture",
                                  "limit": "once_per_song_per_adventuring_phase"},
                "heal_scars": {"name_ru": "Исцеление шрамов", "yule": True,
                               "spend": {"adventure_points": 5}, "effect": "remove_1_shadow_scar"},
                "write_song": {"name_ru": "Написать песню", "free_if_calling": "warrior",
                               "song_types": {"ballad": "council", "victory_song": "combat",
                                              "marching_song": "journey"}},
                "tell_a_tale": {"name_ru": "Поведать историю", "yule": True,
                                "effect": "replace_one_distinctive_feature"},
                "gather_rumours": {"name_ru": "Собирать слухи", "free_if_calling": "warden",
                                   "effect": "learn_one_rumour"},
                "strengthen_fellowship": {"name_ru": "Укрепить братство", "free_if_calling": "captain",
                                          "effect": "+1 fellowship rating until next phase"},
            },
        },
        "related": [FP + "struktura_fazy_bratstva",
                    "kv.mechanics.hero_creation.callings", "kv.mechanics.hero_creation.patron",
                    "kv.mechanics.traits.otlichitelnye_kachestva",
                    "kv.mechanics.standard_of_living.obraz_zhizni"],
        "notes": "Владелец списка начинаний. Теги free_if_calling → hero_creation.calling_* "
                 "(messenger/treasure_hunter/scholar/warrior/warden/captain). «Поведать историю» → "
                 "traits.otlichitelnye_kachestva (стр.67). Наследник → hero_creation (стр.56). Шрамы "
                 "Тени / «Закалка духа» (стр.137) — гл. «Тень» (B-later). Песни — список отряда; "
                 "ВЫСТУПЛЕНИЕ → SKILL_ORDER.",
    },
    # ---------------- combat (1) — recovered segmentation gap ----------------
    {
        "id": CM + "vyhod_iz_boya", "title": "Выход из боя",
        "subsystem": "combat", "section": "фаза приключений → БОЙ → Выход из боя", "pages": [105],
        "quotes": [("БЕГИТЕ, ГЛУПЦЫ! У героев, вступивших в сражение",
                    "боец остаётся вовлечённым в схватку.")],
        "summary": "У героя, вступившего в непреодолимый бой, есть два способа покинуть его. Первый: "
                   "занять стрелковую позицию, и тогда в свой ход выйти из боя без бросков (то же "
                   "относится к врагам, оставшимся позади и не вступившим в схватку). Второй: занять "
                   "оборонительную позицию и совершить обычную проверку атаки — при успехе вместо "
                   "нанесения урона герой покидает поле боя, при провале остаётся вовлечённым в схватку.",
        "parameters": {
            "methods": {
                "ranged_exit": {"name_ru": "Через стрелковую позицию", "requires_stance": "ranged",
                                "roll": False, "timing": "on_your_turn",
                                "also_applies_to": "enemies_left_behind"},
                "defensive_exit": {"name_ru": "Через оборонительную позицию",
                                   "requires_stance": "defensive", "roll": "attack_check",
                                   "on_success": "leave_field_instead_of_damage",
                                   "on_fail": "remain_engaged"},
            },
        },
        "related": [CM + "shagi_v_raunde_blizhnego_boya", CM + "sovershenie_atak"],
        "notes": "Найдено при нарезке B5: врезка «БЕГИТЕ, ГЛУПЦЫ!» (ф.105) лежала в блоке "
                 "council.zavershenie_soveta из-за склейки колонок слоя — вынесено в combat. "
                 "Стрелковая/оборонительная позиции — combat.shagi_v_raunde_blizhnego_boya.",
    },
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ids = [c["id"] for c in CARDS]
    assert len(ids) == len(set(ids)), "duplicate card ids"
    written = 0
    for c in CARDS:
        payload = {
            "subsystem": c["subsystem"],
            "title": c["title"],
            "source_text": [cut(a, b) for a, b in c["quotes"]],
            "summary": c["summary"],
            "parameters": c["parameters"],
            "related": c["related"],
        }
        doc = envelope(c["id"], c["title"], c["section"], c["pages"], payload, notes=c.get("notes", ""))
        name = c["id"].split("kv.mechanics.")[1]
        (OUT / f"{name}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
                                          encoding="utf-8")
        written += 1
    print(f"{written} B5 cards written; {len(list(OUT.glob('*.json')))} total in mechanics/")


if __name__ == "__main__":
    main()
