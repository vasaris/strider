"""Build rule cards for B4 (КВ ch. «Фаза приключений» → БОЙ, pages 93–104).

Subsystem: combat. THROWAWAY STAGE-0 TOOLING. Same contract as
build_mechanics_b3.py: every source_text quote is CUT from the КВ core text
layer by a (start, end_incl) anchor pair over whitespace-normalized text —
never retyped — so gate 1 (text-fidelity, ADR-002) holds by construction.
summary/parameters are engine annotations (gate 2a); every number in
parameters comes from the cut source_text and is checked against the page
scans by gate 2b (NOT self-certified here — see notes flagged ⚠).

CANONICAL VOCABULARIES OWNED BY B4 (net-new engine identifiers, like
SKILL_ORDER in B3; canon-izable later under the one-edit-both-scripts rule):
  - STANCES (4): forward / open / defensive / ranged  (card shagi_v_raunde…)
  - COMBAT TASKS (4): cow / rally / protect / prepare_shot  (card boevye_zadachi)
  - SPECIAL DAMAGE (4): heavy_blow / fend_off / pierce / shield_thrust  (card sovershenie_atak)

JOIN CONTRACT — NO CHURN to B2.2/B3 (only validate.py count is bumped):
  - weapon/armour/shield REGISTRY is NOT redefined here: hero_creation.combat_gear
    (B2.2) owns it; B4 references weapon-skill / armour / shield IDS verbatim and
    only ADDS the datum combat_gear deferred — the min standard-of-living for
    short_mail/mail/shield/great_shield (КВ стр. 100);
  - tasks reference SKILL_ORDER keys (awe/inspire/athletics/search) — B3 traits;
  - special-damage parry mods reference weapon-skill keys (swords/spears/axes/
    brawling) — B3 traits.spisok_boevyh_umeniy;
  - feat-die faces use the existing tokens `gandalf_rune` / `eye` (eye numeric
    value 0) per checks.feat_die_values — NOT a 11/12 numeric encoding.

CONTOUR BOUNDARY (D3): the SOLO `skirmish` stance (манёвренная) and its task
`advance` (Продвинуться) are «Игра для одного» content (ИдО стр. 17), NOT in
kv_core — deferred to a future solo-overlay batch, recorded in `notes` only.

FORWARD REFERENCES: validate.py flags dangling kv.mechanics.* in `related`;
`related` holds only cards that already exist (B2.1/B2.2/B3) or are built in
THIS batch. Pointers to shadow (стр. 134/136), adversaries (стр. 142) and the
ИдО solo overlay live in `notes`.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parents[1] / "content-packs" / "kv" / "mechanics"
LAYER = (HERE / "source_kv" / "kv_core.txt").read_text(encoding="utf-8")
NORM = re.sub(r"\s+", " ", LAYER.replace("\u0002", "")).strip()

CH = "фаза приключений → БОЙ"
CM = "kv.mechanics.combat."


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


CARDS = [
    {
        "id": CM + "boy", "title": "Бой",
        "subsystem": "combat", "section": CH, "pages": [93],
        "quotes": [("Со звоном и лязгом отряд обнажил мечи. Во все времена",
                    "напряжённое столкновение героев с их врагами.")],
        "summary": "Бой прерывает обычный ход игры и разворачивается отдельной процедурой "
                   "напряжённого столкновения; в среднем отряд участвует в бою примерно раз в две "
                   "сессии, и даже победный бой редко обходится без последствий.",
        "parameters": {"interrupts_normal_play": True, "phase": "adventuring"},
        "related": [CM + "nachalo_boya", CM + "posledovatelnost_boya"],
        "notes": "",
    },
    {
        "id": CM + "nachalo_boya", "title": "Начало боя",
        "subsystem": "combat", "section": CH + " → Начало боя", "pages": [93, 94],
        "quotes": [("Бой — это напряжённое и значимое событие для любой",
                    "противников из числа доступных целей (стр. 96).")],
        "summary": "До начала боя хранитель задаёт уникальные условия сцены (место, погода, "
                   "местность, защищаемый персонаж и т.п.), и эти условия влияют на ход боя — в "
                   "частности на число первых залпов и на то, какие противники доступны как цели.",
        "parameters": {"keeper_sets_scene": True,
                       "scene_conditions_affect": ["first_volleys_count", "available_targets"]},
        "related": [CM + "posledovatelnost_boya"],
        "notes": "В source_text присутствует OCR-врезка бегущего колонтитула "
                 "(«ГЕРОИЧЕСКИЕ СВЕРШЕНИЯ» / «ГЛАВА 6 94») — артефакт линеаризации слоя, "
                 "узаконен ADR-002 (как game_terms).",
    },
    {
        "id": CM + "posledovatelnost_boya", "title": "Последовательность боя",
        "subsystem": "combat", "section": CH + " → Последовательность боя", "pages": [94, 95],
        "quotes": [("После начала боя происходящее делится на следующие",
                    "любых боевых проверках за них убирается 1к.")],
        "summary": "Бой идёт двумя шагами: первые залпы, затем раунды ближнего боя. На шаге первых "
                   "залпов хранитель решает, сколько дальних атак разрешить (обычно ≥1, при большой "
                   "дистанции лучникам 2+); герои со щитом удваивают модификатор парирования, если "
                   "знают об атаке, и обычно стреляют первыми. Внезапная атака (засада) пропускается, "
                   "если все стороны знают о враге, иначе разрешается проверками БДИТЕЛЬНОСТИ "
                   "(отряд в засаде) или СКРЫТНОСТИ (враги в засаде).",
        "parameters": {
            "steps": ["first_volleys", "melee_rounds"],
            "first_volleys": {
                "default_volleys": 1,
                "large_distance_bow_volleys": "2+",
                "resolved_as": "ranged_attack",
                "shield_parry_doubled_if_aware": True,
                "heroes_volley_first_by_default": True,
            },
            "surprise_attack": {
                "skipped_if_all_aware": True,
                "party_ambushed": {"check": "awareness", "per": "hero",
                                   "on_fail": ["no_initial_volley", "no_action_first_melee_round"]},
                "enemies_ambushed": {"check": "stealth", "per": "hero", "requires": "all_heroes_succeed",
                                     "on_success_enemy": ["no_initial_volley",
                                                          "minus_1d_all_combat_checks_first_round"]},
                "ambush_skill_alternatives": {
                    "avoid_being_surprised": ["battle", "hunting"],
                    "surprising_enemies": {"large_groups": "battle",
                                           "unplanned_wilderness": "hunting",
                                           "indoors_quiet": "stealth"},
                },
            },
        },
        "related": [CM + "shagi_v_raunde_blizhnego_boya", CM + "sovershenie_atak",
                    "kv.mechanics.traits.spisok_navykov"],
        "notes": "Текст «Навыки для засады» (СРАЖЕНИЕ/ОХОТА/СКРЫТНОСТЬ) физически лежит в блоке "
                 "shagi_v_raunde (склейка колонок слоя); правило отнесено сюда, в внезапную атаку.",
    },
    {
        "id": CM + "shagi_v_raunde_blizhnego_boya", "title": "Шаги в раунде ближнего боя",
        "subsystem": "combat", "section": CH + " → Шаги в раунде ближнего боя", "pages": [95, 98],
        "quotes": [("Каждый раунд ближнего боя разделён на следующие",
                    "хоббитов, а не просто биться до последнего.")],
        "summary": "Раунд ближнего боя: 1) позиция, 2) схватка, 3) совершение действий (в порядке "
                   "позиций от передовой к стрелковой). Владелец канон-словаря из четырёх боевых "
                   "позиций (передовая/средняя/оборонительная/стрелковая) с их модификаторами и "
                   "привязанной боевой задачей; задаёт правила схватки (соотношения и лимиты числа "
                   "противников) и экономику действий (одно основное + одно дополнительное).",
        "parameters": {
            "round_steps": ["position", "grapple", "take_actions"],
            "action_order": "by_stance: forward -> open -> defensive -> ranged",
            "stances": {
                "forward": {"name_ru": "Передовая", "type": "melee",
                            "hero_attack_mod_dice": 1, "enemy_melee_vs_hero_mod_dice": 1,
                            "task": "cow"},
                "open": {"name_ru": "Средняя", "type": "melee",
                         "hero_attack_mod_dice": 0, "enemy_melee_vs_hero_mod_dice": 0,
                         "task": "rally"},
                "defensive": {"name_ru": "Оборонительная", "type": "melee",
                              "hero_attack_mod_dice_per_engaged_enemy": -1,
                              "enemy_melee_vs_hero_mod_dice": -1, "task": "protect"},
                "ranged": {"name_ru": "Стрелковая", "type": "ranged",
                           "hero_ranged_only": True, "targetable_only_by_ranged": True,
                           "task": "prepare_shot",
                           "eligibility": {"max_total_enemies_factor_of_heroes": 2,
                                           "min_melee_heroes_per_ranged_hero": 2}},
            },
            "stance_order": ["forward", "open", "defensive", "ranged"],
            "grapple": {
                "ranged_heroes_cannot_be_grappled": True,
                "max_enemies_per_hero": {"human_size": 3, "large": 2},
                "max_heroes_per_enemy": {"human_size": 3, "large": 6},
            },
            "actions": {"per_turn": {"main": 1, "secondary": 1},
                        "secondary_timing": "before_or_after_main"},
        },
        "related": [CM + "posledovatelnost_boya", CM + "boevye_zadachi", CM + "sovershenie_atak"],
        "notes": "Владелец канон-словаря позиций (forward/open/defensive/ranged). СОЛО-позиция "
                 "`skirmish` (манёвренная) и её задача `advance` (Продвинуться) — контур «Игры для "
                 "одного» (ИдО стр. 17), вводится соло-оверлей-батчем, здесь НЕ определяется. Лимиты "
                 "схватки даны для отряда; соло-режим переопределит соотношения через ИдО. Тактика и "
                 "Способности врагов — гл. «Тень» (стр. 136), B-later.",
    },
    {
        "id": CM + "sovershenie_atak", "title": "Совершение атак",
        "subsystem": "combat", "section": CH + " → Совершение атак", "pages": [98, 101],
        "quotes": [("Герои игроков атакуют врагов, используя основное",
                    "Большой щит +3 6 Зажиточный ФАЗА ПРИКЛЮЧЕНИЙ 101")],
        "summary": "Проверка атаки — бросок Боевого умения: сложность за героя = ЦЧ его СИЛЫ, "
                   "изменённое рейтингом парирования цели, а за врага против героя = рейтинг "
                   "ПАРИРОВАНИЯ героя. Успех снимает Выносливость, равную Урону оружия; знаки успеха "
                   "тратятся на особый урон (Сокрушительный удар/Отражение атаки/Укол/Толчок щитом). "
                   "Пронзающий удар (10 или Око на Кости испытания) проверяется броском Защиты против "
                   "Травмы оружия; провал — ранение. Сюда же отнесён минимальный Образ жизни для "
                   "снаряжения со стр. 100.",
        "parameters": {
            "attack_check": {
                "uses": "weapon_skill",
                "hero_attacking_tn": "hero_strength_tn + target_parry_modifier",
                "enemy_vs_hero_tn": "hero_parry_rating",
            },
            "endurance_loss": {
                "amount": "weapon_damage_rating",
                "hero_weary_if": "endurance <= load",
                "hero_unconscious_if": "endurance == 0",
                "enemy_destroyed_if": "endurance == 0",
            },
            "driven_back": {"available_to": "hero_only", "times_per_round": 1,
                            "effect": "halve_endurance_loss_round_up",
                            "cost": "next_main_action_restores_stance"},
            "special_damage": {
                "trigger": "spend_success_signs",
                "effects": {
                    "heavy_blow": {"name_ru": "Сокрушительный удар", "weapons": "any",
                                   "cost_signs": 1,
                                   "effect": {"extra_endurance_loss": "hero_strength_rating",
                                              "two_handed_bonus": 1}},
                    "fend_off": {"name_ru": "Отражение атаки", "weapons": "any_melee",
                                 "cost_signs": 1,
                                 "effect": {"parry_modifier_this_round": {"axes": 1, "brawling": 1,
                                                                          "swords": 2, "spears": 3}}},
                    "pierce": {"name_ru": "Укол", "weapons": ["bows", "spears", "swords"],
                               "cost_signs": 1,
                               "effect": {"feat_die_result_bonus": {"swords": 1, "bows": 2, "spears": 3},
                                          "cap": 10, "may_cause_piercing_blow": True}},
                    "shield_thrust": {"name_ru": "Толчок щитом", "weapons": "shields", "cost_signs": 1,
                                      "condition": "hero_strength_rating > target_attribute_level",
                                      "effect": {"target_minus_1d_until_round_end": True}},
                },
            },
            "piercing_blow": {
                "trigger_feat_die": [10, "eye"],
                "roll": {"feat_dice": 1, "success_dice": "armour_protection_rating",
                         "protection_roll_before_weariness_applied": True},
                "tn": "attacker_weapon_injury_rating",
                "on_fail": "wound",
            },
            "equipment_min_standard_of_living": {
                "short_mail": "common", "mail": "prosperous",
                "shield": "common", "great_shield": "prosperous",
            },
        },
        "related": [CM + "raneniya", CM + "shagi_v_raunde_blizhnego_boya", CM + "boevye_zadachi",
                    "kv.mechanics.hero_creation.combat_gear", "kv.mechanics.traits.spisok_boevyh_umeniy",
                    "kv.mechanics.standard_of_living.obraz_zhizni", "kv.mechanics.endurance_hope.vynoslivost"],
        "notes": "Реестр оружия/брони/щитов НЕ дублируется — владелец hero_creation.combat_gear "
                 "(B2.2), здесь ссылки по id; добавлен лишь датум мин. Образа жизни снаряжения "
                 "(стр. 100), отложенный combat_gear'ом. Грани Кости испытания — токены 10/`eye` по "
                 "checks.feat_die_values (eye=0). «Разговор с врагом» — нарративный выход из боя, без "
                 "числовой механики. Травма по иной причине (стр. 134) и Способности врагов (стр. 136) "
                 "— B-later (shadow).",
    },
    {
        "id": CM + "raneniya", "title": "Ранения",
        "subsystem": "combat", "section": CH + " → Ранения", "pages": [101],
        "quotes": [("Большинство противников погибает после первого",
                    "например шрам, хромоту, потерю пальца и т.п.).")],
        "summary": "Первое ранение отмечается на бланке, затем бросается Кость испытания по таблице "
                   "«Тяжесть ранения»: руна Гэндальфа — Лёгкая (снимается после боя), 1–10 — Серьёзная "
                   "(дни лечения равны выпавшему числу), Око — Ужасная (умирающий). Второе ранение "
                   "обнуляет Выносливость и делает героя умирающим. Первая помощь (ИСЦЕЛЕНИЕ) "
                   "сокращает срок на 1 день +1 за знак (мин. 1 день, один раз). Умирающему нужна "
                   "успешная помощь примерно за час.",
        "parameters": {
            "first_wound": {"marks_wound": True, "roll": "feat_die",
                            "consult": "wound_severity", "slows_endurance_recovery": True},
            "wound_severity": {
                "by_feat_die": {
                    "gandalf_rune": {"key": "light", "name_ru": "Лёгкая",
                                     "effect": "clear_mark_after_combat_recover_in_hours"},
                    "1-10": {"key": "serious", "name_ru": "Серьёзная",
                             "heal_days": "equal_to_feat_die_result"},
                    "eye": {"key": "terrible", "name_ru": "Ужасная",
                            "effect": "unconscious_0_endurance_dying"},
                },
            },
            "second_wound": {"effect": "lose_all_endurance_unconscious_dying",
                             "marked": False, "severity_roll": False},
            "first_aid": {"check": "healing", "reduces_severity_days": 1, "per_success_sign": 1,
                          "min_days": 1, "once_per_wound": True, "retry_after_days_on_fail": 1},
            "dying": {"triggers": ["second_wound", "eye_on_severity", "other_cause_p134"],
                      "rescue": {"check": "healing", "within": "≈1 hour",
                                 "on_success": "revive_in_1h_with_1_endurance", "else": "death"},
                      "if_wound_marked_add_recovery_days": 10, "permanent_mark": True},
        },
        "related": [CM + "sovershenie_atak", "kv.mechanics.endurance_hope.vynoslivost",
                    "kv.mechanics.conditions.wounded", "kv.mechanics.traits.spisok_navykov"],
        "notes": "Владелец таблицы «Тяжесть ранения». Грани — токены gandalf_rune/eye (eye=0). "
                 "⚠ ГЕЙТ-2b (ф. 101): привязка Лёгкая=руна Гэндальфа / Ужасная=Око взята из прозы этой "
                 "карты (Око→умирающий — явно; Лёгкая=руна — по исключению), но колонку «Кость "
                 "испытания» в самой таблице слой переколонил (текст таблицы лёг в блок oslozhneniya) — "
                 "подтвердить по скану. Восстановление Выносливости с отметкой ранения — Отдых, стр. 71 "
                 "(endurance_hope). Травма по иной причине — стр. 134 (shadow, B-later).",
    },
    {
        "id": CM + "oslozhneniya_i_preimuschestva", "title": "Осложнения и преимущества",
        "subsystem": "combat", "section": CH + " → Осложнения и преимущества", "pages": [101, 102],
        "quotes": [("Сложность атаки может увеличиться по разным причинам",
                    "распространить на пользу ещё одному герою игрока.")],
        "summary": "Хранитель может задать уровни осложнения или преимущества, дающие штраф или бонус "
                   "ко всем проверкам сражающихся: умеренное — 1к, серьёзное — 2к (для дальних атак "
                   "примеры — дистанция, погода, укрытие, возвышенность). Герой может потратить "
                   "основное действие на проверку СРАЖЕНИЯ, чтобы снять осложнение или получить "
                   "преимущество к следующей атаке, распространяя эффект на +1 героя за каждый знак.",
        "parameters": {
            "applies_to": "all_combatants_checks",
            "tiers": {
                "complication": {"moderate": {"dice": -1}, "serious": {"dice": -2}},
                "advantage": {"moderate": {"dice": 1}, "serious": {"dice": 2}},
            },
            "manipulate_action": {"check": "battle", "cost": "main_action",
                                  "on_success": "gain_advantage_or_remove_complication_next_attack",
                                  "per_success_sign": "extend_to_one_more_hero"},
        },
        "related": [CM + "boevye_zadachi", CM + "sovershenie_atak", "kv.mechanics.traits.spisok_navykov"],
        "notes": "Владелец таблицы осложнений/преимуществ дальней атаки. Текст ЭТОЙ таблицы физически "
                 "лёг в блок boevye_zadachi (склейка колонок слоя) — числа отнесены сюда. Обратно: "
                 "текст таблицы «Тяжесть ранения» (стр. 101) лёг в ЭТОТ блок — её владелец "
                 "combat.raneniya. Примеры обстоятельств — нарративные, не нормируются.",
    },
    {
        "id": CM + "boevye_zadachi", "title": "Боевые задачи",
        "subsystem": "combat", "section": CH + " → Боевые задачи", "pages": [102, 104],
        "quotes": [("Здесь описан ряд особых задач, часто выполняемых",
                    "ударом, нанося 12 баллов урона и Пронзающий удар!")],
        "summary": "Владелец канон-словаря из четырёх боевых задач, каждая привязана к позиции и "
                   "навыку: Запугать врага (передовая, ВНУШИТЕЛЬНОСТЬ), Сплотить соратников (средняя, "
                   "ВООДУШЕВЛЕНИЕ, один герой за раунд), Защитить товарища (оборонительная, АТЛЕТИКА), "
                   "Подготовить выстрел (стрелковая, ПОИСК). Эффект усиливается выпавшими знаками успеха.",
        "parameters": {
            "tasks": {
                "cow": {"name_ru": "Запугать врага", "stance": "forward", "check": "awe",
                        "effect": {"on_success": "enemies_might_1_weary_next_attack",
                                   "one_sign": "include_might_2", "two_signs": "all_enemies"}},
                "rally": {"name_ru": "Сплотить соратников", "stance": "open", "check": "inspire",
                          "max_per_round": 1,
                          "effect": {"on_success": "forward_heroes_plus_1d_attack_next_round",
                                     "one_sign": "include_open_stance", "two_signs": "all_melee_stances"}},
                "protect": {"name_ru": "Защитить товарища", "stance": "defensive", "check": "athletics",
                            "effect": {"on_success": "enemy_minus_1d_next_attack_vs_protected",
                                       "per_sign": "plus_1d"}},
                "prepare_shot": {"name_ru": "Подготовить выстрел", "stance": "ranged", "check": "search",
                                 "effect": {"on_success": "plus_1d_next_ranged_attack",
                                            "per_sign": "plus_1d"}},
            },
        },
        "related": [CM + "shagi_v_raunde_blizhnego_boya", CM + "sovershenie_atak",
                    "kv.mechanics.traits.spisok_navykov"],
        "notes": "Владелец канон-словаря боевых задач; привязки к позициям (B4) и навыкам SKILL_ORDER "
                 "(B3). СОЛО-задача `advance` (Продвинуться, манёвренная позиция) — контур ИдО, "
                 "вводится соло-оверлей-батчем. Рейтинг Мощи врага — статблоки противников (стр. 136/142, "
                 "shadow/adversaries, B-later). Пример при Азанулбизаре — иллюстрация, не правило. "
                 "⚠ ГЕЙТ-2b: пороги Мощи 1/2 в `cow` читаются в прозе (подтверждающий пункт).",
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
        doc = envelope(c["id"], c["title"], c["section"], c["pages"], payload,
                       notes=c.get("notes", ""))
        name = c["id"].split("kv.mechanics.")[1]
        p = OUT / f"{name}.json"
        p.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        written += 1
    print(f"{written} B4 cards written; {len(list(OUT.glob('*.json')))} total in mechanics/")


if __name__ == "__main__":
    main()
