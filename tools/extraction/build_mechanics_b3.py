"""Build rule cards for B3 block (КВ ch. 4 "Отличия", pages 60–76, and ch. 5/6
"Доблесть и Мудрость", pages 78–90).

Subsystems: traits, endurance_hope, standard_of_living, equipment, valour_wisdom,
rewards_virtues. THROWAWAY TOOLING (stage 0, session 3a, batch 3). Same contract
as build_mechanics_b22.py: source_text quotes are CUT from the КВ core text layer
by (start, end_incl) anchor pairs over whitespace-normalized text — never retyped —
so gate 1 (text-fidelity, ADR-002) holds by construction. summary/parameters are
engine annotations (gate 2a); every number in parameters comes from the cut
source_text and is checked against the scans by gate 2b.

JOIN CONTRACT WITH B2.2 (hero_creation)
B3 OWNS the full taxonomies whose keys B2.2 provisionally committed. Those keys are
REUSED here verbatim (no key churn → pack joins at load time):
  - skills: SKILL_ORDER (18) — owned by traits.spisok_navykov;
  - weapon skills: spears/bows/swords/axes (4) — owned by traits.spisok_boevyh_umeniy;
    `brawling` in B2.2 combat_gear is an ATTACK MODE (unarmed/dagger/club), not a 5th
    rated skill — its rule (max weapon-skill rating −1d, КВ стр. 67) lives here, in
    spisok_boevyh_umeniy.parameters.brawling; no edit to build_mechanics_b22.py;
  - distinctive features (24) — owned by traits.spisok_otlichitelnyh_kachestv;
  - starting rewards (6) — owned by rewards_virtues.spisok_nagrad;
  - starting virtues (6) — owned by rewards_virtues.spisok_osobennostey;
  - standard of living (6) — owned by standard_of_living.*.
Cultural BLESSINGS (the 8 keys valour_favoured … the_long_defeat) are NOT here:
they are ch.3 content, fully defined on B2.2 culture cards. The rewards_virtues.
osobennosti_<culture> cards define a SEPARATE concept — buyable Cultural VIRTUES
(ch.5) — whose keys are NET-NEW provisional engine identifiers (canon-izable later
under the same one-edit-both-scripts rule).

FORWARD REFERENCES
validate.py flags dangling kv.mechanics.* in `related`. `related` holds only cards
that already exist (lifepaths / B2.1 / B2.2) or are built in THIS batch; pointers to
B4 (combat), B5 (council/journey/fellowship) and shadow live in `notes` only.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parents[1] / "content-packs" / "kv" / "mechanics"
LAYER = (HERE / "source_kv" / "kv_core.txt").read_text(encoding="utf-8")
NORM = re.sub(r"\s+", " ", LAYER.replace("\u0002", "")).strip()

CH4 = "отличия"                 # chapter 4
CH5 = "доблесть и мудрость"     # chapter 5/6


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


# --- canonical vocabularies (reused from B2.2 / build_mechanics_b22.py) -------
SKILL_ORDER = ["awe", "inspire", "persuade", "athletics", "travel", "stealth",
               "awareness", "insight", "search", "hunting", "healing",
               "exploration", "song", "courtesy", "riddle", "craft", "battle", "lore"]
SKILL_RU = {"awe": "Внушительность", "inspire": "Воодушевление", "persuade": "Убеждение",
            "athletics": "Атлетика", "travel": "Странствие", "stealth": "Скрытность",
            "awareness": "Бдительность", "insight": "Проницательность", "search": "Поиск",
            "hunting": "Охота", "healing": "Исцеление", "exploration": "Исследование",
            "song": "Выступление", "courtesy": "Учтивость", "riddle": "Загадки",
            "craft": "Ремесло", "battle": "Сражение", "lore": "Знания"}
# category = characteristic whose TN the skill is checked against (КВ стр. 60–61)
SKILL_CAT = {"awe": "strength", "song": "strength", "athletics": "strength",
             "awareness": "strength", "hunting": "strength", "craft": "strength",
             "inspire": "heart", "battle": "heart", "travel": "heart",
             "courtesy": "heart", "insight": "heart", "healing": "heart",
             "persuade": "wits", "stealth": "wits", "search": "wits",
             "exploration": "wits", "riddle": "wits", "lore": "wits"}
# group = activity grouping (КВ стр. 61): 6 groups × 3 skills
SKILL_GROUP = {"awe": "personality", "inspire": "personality", "persuade": "personality",
               "athletics": "movement", "travel": "movement", "stealth": "movement",
               "awareness": "perception", "insight": "perception", "search": "perception",
               "hunting": "survival", "healing": "survival", "exploration": "survival",
               "song": "social", "courtesy": "social", "riddle": "social",
               "craft": "professional", "battle": "professional", "lore": "professional"}
GROUP_RU = {"personality": "Личности", "movement": "Движения", "perception": "Восприятия",
            "survival": "Выживания", "social": "Социальные", "professional": "Профессии"}


def skills_registry():
    return {k: {"name_ru": SKILL_RU[k], "category": SKILL_CAT[k], "group": SKILL_GROUP[k]}
            for k in SKILL_ORDER}


# distinctive features (24): RU label per stable key committed by B2.2
FEAT_RU = {"noble": "Благородство", "swift": "Быстрота", "faithful": "Верность",
           "proud": "Гордость", "merry": "Жизнерадостность", "secretive": "Замкнутость",
           "conspicuous": "Заметность", "sincere": "Искренность", "fair": "Красота",
           "inquisitive": "Любознательность", "stubborn": "Несговорчивость",
           "courteous": "Обходительность", "keen_eyed": "Остроглазость", "witty": "Остроумие",
           "suspicious": "Подозрительность", "simple": "Простота", "ardent": "Пылкость",
           "fierce": "Свирепость", "bold": "Смелость", "grim": "Суровость",
           "patient": "Терпеливость", "refined": "Утончённость", "honest": "Честность",
           "generous": "Щедрость"}
CALLING_FEATS = ["folklore", "enemy_lore", "shadow_lore", "burglary", "rhymes_of_lore", "leadership"]

# weapon skills (4) + weapon groups (КВ стр. 65–67)
WEAPON_SKILLS = {
    "spears": {"name_ru": "Копья", "weapons": ["short_spear", "spear", "long_spear"]},
    "bows": {"name_ru": "Луки", "weapons": ["bow", "long_bow"]},
    "swords": {"name_ru": "Мечи", "weapons": ["sword", "short_sword", "long_sword"]},
    "axes": {"name_ru": "Топоры", "weapons": ["axe", "great_axe", "battle_axe", "mattock"]},
}

# starting rewards (6) — same keys/effects as B2.2 starting_rewards
REWARDS = [
    {"key": "fell", "name_ru": "Грозное", "target": "weapon", "effect": {"injury": 2, "both_modes": True}},
    {"key": "keen", "name_ru": "Острое", "target": "weapon", "effect": {"piercing_blow_on_feat_die": 9}},
    {"key": "close_fitting", "name_ru": "Тонкая работа", "target": "armour_helmet_shield", "effect": {"load": -2, "load_min": 0}},
    {"key": "grievous", "name_ru": "Ужасное", "target": "weapon", "effect": {"damage": 1}},
    {"key": "reinforced", "name_ru": "Усиленный", "target": "shield", "effect": {"parry_modifier": 1}},
    {"key": "well_fitted", "name_ru": "Хорошо подогнанная", "target": "armour_helmet", "effect": {"protection_check": 2}},
]
# starting virtues (6) — same keys as B2.2; effects given in FULL here (owner card)
VIRTUES = [
    {"key": "mastery", "name_ru": "Мастерство", "effect": {"make_skills_favoured": 2}},
    {"key": "nimbleness", "name_ru": "Проворство", "effect": {"parry": 1}},
    {"key": "hardiness", "name_ru": "Стойкость", "effect": {"endurance_max": "max(2, wisdom_rating)"}},
    {"key": "strong_grip", "name_ru": "Крепкие руки",
     "effect": {"crushing_blow_strength": 1, "piercing_feat_die": 1}},
    {"key": "confidence", "name_ru": "Уверенность", "effect": {"hope_max": 2}},
    {"key": "prowess", "name_ru": "Удаль", "effect": {"characteristic_tn": -1}},
]

# standard of living levels (КВ стр. 72–73): starting treasure per level
SOL_LEVELS = [
    {"key": "poor", "name_ru": "Бедный", "starting_treasure": None},
    {"key": "frugal", "name_ru": "Скромный", "starting_treasure": 0},
    {"key": "common", "name_ru": "Обычный", "starting_treasure": 30},
    {"key": "prosperous", "name_ru": "Зажиточный", "starting_treasure": 90},
    {"key": "rich", "name_ru": "Богатый", "starting_treasure": 180},
    {"key": "very_rich", "name_ru": "Очень богатый", "starting_treasure": None},
]
# improvement ladder (КВ стр. 73): treasure rating that raises SoL to each level
SOL_IMPROVE = {"frugal": 0, "common": 30, "prosperous": 90, "rich": 180, "very_rich": 300}


def cv(key, name_ru, **effect):
    return {"key": key, "name_ru": name_ru, "effect": effect}


# cultural virtues (6 per culture, КВ стр. 81–90). Net-new provisional keys.
# effect = terse mechanical tags only; verbatim wording lives in source_text.
CV_BARDINGS = [
    cv("great_destiny", "Великая судьба", endurance_max=1,
       on_first_deadly_wound="survive_wounded_and_hope_max_plus_1_once"),
    cv("friend_of_dwarves", "Друг гномов",
       dwarf_companion="mutual_protect_companion_as_extra_action_on_defensive_stance",
       dwarves_friendly_in_council=True),
    cv("cram", "Крам", journey_fatigue_per_scene=-1,
       short_rest_party_endurance_bonus="wisdom_rating"),
    cv("dragon_slayer", "Победитель драконов",
       attacks_favoured_vs="might_2_plus"),
    cv("furious_shot", "Яростный выстрел",
       on_ranged_piercing_blow="target_protection_check_ill_favoured"),
    cv("tongue_of_birds", "Язык птиц",
       talk_to_birds_via="courtesy_or_persuade_or_song",
       outdoors_inspired_once_per="battle_or_council_or_journey"),
]
CV_DWARVES = [
    cv("baruk_khazad", "Барук Кхазад!",
       once_per_battle_on_van="attack_favoured_and_intimidate_as_extra_action"),
    cv("indomitable_spirit", "Неукротимый дух", hope_max=1,
       shadow_check_vs_sorcery_bonus="1d"),
    cv("fragments_of_spells", "Обрывки заклинаний",
       mark_3_skills_rating_gt_0="spend_1_hope_for_magical_success"),
    cv("ways_of_durin", "Путь Дурина", parry_underground_or_cramped=2),
    cv("hard_as_stone", "Твёрдый как камень", endurance_max=1,
       protection_checks_favoured_if_not_miserable=True),
    cv("darkness_for_dark_deeds", "Темнота для тёмных дел",
       inspired_in_darkness=True),
]
CV_BREE = [
    cv("art_of_smoking", "Искусство обращения с трубкой",
       on_hope_recovery_extra=1),
    cv("defiance", "Непокорность", endurance_max=1,
       end_of_combat_endurance_recovery="max(heart,valour)_if_not_wounded_or_miserable"),
    cv("desperate_courage", "Отчаянная храбрость",
       spend_hope_then_gain_1_shadow_to_be_inspired=True),
    cv("bree_pony", "Пони из Бри", hope_max=1, pony_draught=4,
       pony_never_leaves=True),
    cv("at_ease_among_strangers", "Свой среди чужих",
       council_skill_checks_max_plus_1=True, all_encountered_friendly=True),
    cv("bree_news", "Чудно, как Бригорские новости",
       rumour_each_fellowship_phase=True,
       in_bree_bonus="1d_on_insight_or_riddle"),
]
CV_RANGERS = [
    cv("rangers_endurance", "Выносливость Следопыта", endurance_max=1,
       no_journey_fatigue_if="leather_no_helm_or_unarmoured_no_shield"),
    cv("life_in_the_wild", "Жизнь в глуши",
       spend_1_hope_for_magical_success_on="exploration_hunting_travel",
       multiple_journey_roles=True),
    cv("foresight", "Народное предвидение",
       uses_per_adventure_phase="wisdom_rating",
       effect_on_use="reroll_all_dice_of_one_check_self_or_targeting_enemy"),
    cv("heir_of_arnor", "Наследник Арнора",
       grants="wondrous_artefact_or_famous_weapon_1_magical_up_to_2_normal_rewards_p161"),
    cv("reveal_lineage", "Раскрыть происхождение",
       once_per_battle_on_centre="rally_comrades_as_extra_action",
       party_inspired_next_round=True),
    cv("strength_of_will", "Сила воли", shadow_check_vs_fear_bonus="1d"),
]
CV_HOBBITS = [
    cv("true_aim", "Точно в цель", ranged_attacks_favoured=True,
       thrown_stone_piercing_blow_on_feat_die_with_injury=12),
    cv("art_of_disappearing", "Искусство исчезновения",
       stealth_on_any_chance_to_hide="success_means_vanish"),
    cv("little_folk", "Маленький народец", parry_vs_larger_foe=2,
       can_take_ranged_stance_with_1_melee_member=True),
    cv("tough_as_old_roots", "Стойкий, как старые корни",
       injury_severity_roll_favoured=True, strength_doubled_for_rest_recovery=True),
    cv("three_is_a_crowd", "Трое — это уже толпа",
       fellowship_rating=1, second_important_companion=True),
    cv("brave_at_a_pinch", "Храбрый в трудную минуту",
       inspired_while="miserable_weary_or_wounded"),
]
CV_ELVES = [
    cv("gleam_of_wrath", "Блеск гнева",
       on_successful_attack="target_loses_1_hate_or_resolve_plus_1_per_success_icon"),
    cv("memory_of_ancient_days", "Память древних дней",
       journey_table_tier_shift="wild_as_border_dark_as_wild",
       always_scout_role=True),
    cv("against_the_unseen", "Против незримого",
       shadow_check_vs_fear_favoured_and_bonus_1d_vs="spirits_or_wraiths"),
    cv("deadly_archery", "Смертоносная стрельба из лука",
       bow_not_longbow_on_ranged_stance="ready_shot_as_extra_action"),
    cv("elbereth_gilthoniel", "Элберет Гилтониэль", hope_max=1,
       inspired_checks_per_adventure_phase="wisdom_rating"),
    cv("elven_dreams", "Эльфийские сновидения",
       no_sleep_needed_for_simple_tasks=True, short_rest_counts_as_long_rest=True),
]
CULTURAL_VIRTUES = {
    "bardings": CV_BARDINGS, "dwarves_of_durins_folk": CV_DWARVES,
    "men_of_bree": CV_BREE, "rangers_of_the_north": CV_RANGERS,
    "hobbits_of_the_shire": CV_HOBBITS, "elves_of_lindon": CV_ELVES,
}


def cvreg(culture):
    return {c["key"]: {"name_ru": c["name_ru"], "effect": c["effect"]}
            for c in CULTURAL_VIRTUES[culture]}


P = "kv.mechanics."
T = P + "traits."
EH = P + "endurance_hope."
SOL = P + "standard_of_living."
EQ = P + "equipment."
VW = P + "valour_wisdom."
RV = P + "rewards_virtues."
HC = P + "hero_creation."


CARDS = [
    # ============================ traits =================================
    {
        "id": T + "navyki", "title": "Навыки", "level": "section", "subsystem": "traits",
        "section": f"{CH4} → НАВЫКИ", "pages": [60],
        "quotes": [("«Еда в диких местах найдётся, — сказал Колоброд.",
                    "бросает две Кости испытания и выбирает лучший результат.")],
        "summary": "Почти каждое действие героя выполняется навыком; навык и его рейтинг отражают, что герой умеет и насколько хорошо. Проверка: 1 Кость испытания + Кости успеха по рейтингу (или только Кость испытания при рейтинге 0), сумма ≥ ЦЧ связанной характеристики. Любимые навыки — врождённые: их проверки благополучны (2 Кости испытания, берётся лучшая).",
        "parameters": {"check_dice": "1_feat_die_plus_success_dice_by_rating",
                       "unskilled_rating": 0, "favoured_skill": "roll_favoured_2_feat_dice_best",
                       "success_rule": "sum >= characteristic_tn"},
        "related": [T + "kategorii_navykov", T + "spisok_navykov",
                    HC + "skills_and_weapon_skills", P + "checks.which_ability"],
    },
    {
        "id": T + "kategorii_navykov", "title": "Категории навыков", "level": "leaf",
        "subsystem": "traits", "section": f"{CH4} → НАВЫКИ → Категории навыков", "pages": [60, 61],
        "quotes": [("Каждый навык относится к одной из трёх категорий в зависимости от того",
                    "Проверка навыка РАЗУМА совершается против ЦЧ РАЗУМА героя.")],
        "summary": "Каждый навык относится к одной из трёх категорий по характеристике, против ЦЧ которой совершается проверка; на бланке навыки размещены в три колонки под своими характеристиками. Навыки СИЛЫ проверяются против ЦЧ СИЛЫ, навыки СЕРДЦА — против ЦЧ СЕРДЦА, навыки РАЗУМА — против ЦЧ РАЗУМА.",
        "parameters": {"categories": {
            "strength": [k for k in SKILL_ORDER if SKILL_CAT[k] == "strength"],
            "heart": [k for k in SKILL_ORDER if SKILL_CAT[k] == "heart"],
            "wits": [k for k in SKILL_ORDER if SKILL_CAT[k] == "wits"]}},
        "related": [T + "navyki", T + "spisok_navykov", P + "checks.target_numbers"],
    },
    {
        "id": T + "spisok_navykov", "title": "Список навыков", "level": "leaf",
        "subsystem": "traits", "section": f"{CH4} → НАВЫКИ → Список навыков", "pages": [61, 65],
        "quotes": [("КАТЕГОРИИ НАВЫКОВ ГРУППЫ СИЛА СЕРДЦЕ РАЗУМ",
                    "«У тебя хорошие манеры для вора и лжеца», — заметил Дракон.")],
        "summary": "Канонический список из 18 навыков (в алфавитном порядке, с кратким описанием каждого) — владелец таксономии навыков движка. Навыки также объединяются в 6 групп по 3 (Личности, Движения, Восприятия, Выживания, Социальные, Профессии). Реестр ключей: 18 навыков с RU-названием, категорией (характеристика ЦЧ) и группой.",
        "parameters": {"count": 18, "skills": skills_registry(),
                       "group_labels": GROUP_RU},
        "related": [T + "navyki", T + "kategorii_navykov", HC + "skills_and_weapon_skills"],
        "notes": "Срез перерезан туго: 3 последних навыка (СТРАНСТВИЕ/УБЕЖДЕНИЕ/УЧТИВОСТЬ, стр. 65) авто-сегментатор увёл в скелет boevye_umeniya — здесь они на месте, единым диапазоном со всеми 18.",
    },
    {
        "id": T + "boevye_umeniya", "title": "Боевые умения", "level": "section",
        "subsystem": "traits", "section": f"{CH4} → БОЕВЫЕ УМЕНИЯ", "pages": [65],
        "quotes": [("боевые умения Леголас уложил двоих, попав точно в горло.",
                    "улучшаются только за баллы приключений (а не за баллы навыков).")],
        "summary": "Каждый герой вступает в игру с рейтингами Боевых умений по воинским традициям своей культуры. Проверка как у навыка (1 Кость испытания + Кости успеха по рейтингу; при рейтинге 0 — только Кость испытания), но всегда против ЦЧ СИЛЫ (проверка атаки). Боевые умения не делятся на категории, не бывают любимыми и улучшаются только за баллы приключений.",
        "parameters": {"check_vs": "strength_tn", "categorised": False,
                       "can_be_favoured": False, "improved_by": "adventure_points",
                       "unrated_rating": 0},
        "related": [T + "spisok_boevyh_umeniy", HC + "skills_and_weapon_skills",
                    P + "checks.target_numbers"],
        "notes": "Сама проверка атаки против ЦЧ СИЛЫ — глава «Бой» (стр. 93), B4.",
    },
    {
        "id": T + "spisok_boevyh_umeniy", "title": "Список Боевых умений", "level": "leaf",
        "subsystem": "traits", "section": f"{CH4} → БОЕВЫЕ УМЕНИЯ → Список Боевых умений",
        "pages": [65, 67],
        "quotes": [("В НРИ «Кольцо Всевластья» существует четыре разных Боевых умения",
                    "ТОПОРЫ топор, двуручный топор, секира и кирка ОТЛИЧИЯ 67")],
        "summary": "В КВ четыре Боевых умения — КОПЬЯ, ЛУКИ, МЕЧИ, ТОПОРЫ; каждое охватывает группу схожего оружия. Владелец таксономии Боевых умений движка (4 ключа с группами оружия). Атаки без оружия, кинжалом, дубиной или импровизированным оружием выполняются по правилу Драки (стр. 67): Кости успеха по наибольшему Боевому умению героя со штрафом −1к.",
        "parameters": {"count": 4, "weapon_skills": WEAPON_SKILLS,
                       "brawling": {
                           "weapons": ["unarmed", "dagger", "rod", "club", "improvised"],
                           "dice": "highest_weapon_skill_rating_minus_1",
                           "source_pages": [67]}},
        "related": [T + "boevye_umeniya", HC + "combat_gear"],
        "notes": "`brawling` — режим атаки оружием вне групп, не пятое умение; это дом для combat_gear-предметов с skill=brawling (B2.2). Дословный текст «Атаки в драке» лежит в spisok_otlichitelnyh_kachestv (соседний пассаж того же диапазона стр. 67).",
    },
    {
        "id": T + "otlichitelnye_kachestva", "title": "Отличительные качества", "level": "section",
        "subsystem": "traits", "section": f"{CH4} → ОТЛИЧИТЕЛЬНЫЕ КАЧЕСТВА", "pages": [67],
        "quotes": [("Отличительные качества описывают особенности телосложения или характера",
                    "Полное описание каждого качества дано ниже.")],
        "summary": "Отличительные качества описывают черты телосложения, характера или личности героя, помогая отыгрышу. Качество можно применить при проверке навыка, если из его описания явно следует преимущество, — тогда герой считается вдохновлённым (потратив 1 балл Надежды, получает 2к вместо 1к). Герой выбирает качества при создании; их можно менять.",
        "parameters": {"applied_effect": "inspired_on_relevant_check",
                       "applicability": "only_if_description_clearly_helps"},
        "related": [T + "spisok_otlichitelnyh_kachestv", HC + "distinctive_features_intro"],
        "notes": "Замена качества — начинание «Поведать историю» в Йоль (Фаза братства), B5. Вводная карточка в блоке культур (стр. 30) — distinctive_features_intro (B2.2), другой пассаж.",
    },
    {
        "id": T + "spisok_otlichitelnyh_kachestv", "title": "Список Отличительных качеств",
        "level": "leaf", "subsystem": "traits",
        "section": f"{CH4} → ОТЛИЧИТЕЛЬНЫЕ КАЧЕСТВА → Список Отличительных качеств", "pages": [67, 69],
        "quotes": [("В НРИ «Кольцо Всевластья» представлено 24 Отличительных качества.",
                    "ЩЕДРОСТЬ У вас щедрая рука и открытая душа, и вы всегда учитываете нужды других.")],
        "summary": "Канонический список 24 общедоступных Отличительных качеств (с описанием каждого) — владелец таксономии качеств движка. Ещё 6 качеств доступны только героям определённых призваний и описаны в создании героя (стр. 44). Реестр 24 ключей с RU-названиями.",
        "parameters": {"count": 24, "distinctive_features": {k: {"name_ru": FEAT_RU[k]} for k in FEAT_RU},
                       "calling_only_count": 6, "calling_only_keys": CALLING_FEATS,
                       "calling_only_source_pages": [44]},
        "related": [T + "otlichitelnye_kachestva", HC + "distinctive_features_intro", HC + "callings"],
        "notes": "Ключи 24 качеств = ключи, проставленные B2.2 в наборах культур. 6 качеств призваний определены в B2.2 callings (стр. 44). В этот же диапазон попадают сайдбары «Атаки в драке» (правило — в spisok_boevyh_umeniy) и «Изменение качеств» (через йольское начинание, B5).",
    },
    # ========================= endurance_hope ===========================
    {
        "id": EH + "vynoslivost_i_nadezhda", "title": "Выносливость и Надежда", "level": "section",
        "subsystem": "endurance_hope", "section": f"{CH4} → ВЫНОСЛИВОСТЬ И НАДЕЖДА", "pages": [69],
        "quotes": [("вот что поддерживает искателей приключений в пути, давая им запас жизненных сил",
                    "с помощью разноцветных жетонов или стекляшек).")],
        "summary": "Выносливость и Надежда — запас жизненных сил и внутренней решимости героя. Рейтинги рассчитываются при создании и зависят от культуры и СИЛЫ/СЕРДЦА; это максимумы. Выносливость теряется в игре от утомления и вреда, Надежда тратится добровольно; текущие значения отслеживаются отдельно от максимумов.",
        "parameters": {"derived_from": {"endurance": ["culture", "strength"],
                                         "hope": ["culture", "heart"]},
                       "ratings_are": "maximum", "tracks": ["current_endurance", "current_hope"]},
        "related": [EH + "vynoslivost", EH + "nadezhda", HC + "derived_characteristics"],
    },
    {
        "id": EH + "vynoslivost", "title": "Выносливость", "level": "leaf",
        "subsystem": "endurance_hope", "section": f"{CH4} → ВЫНОСЛИВОСТЬ И НАДЕЖДА → Выносливость",
        "pages": [69, 71],
        "quotes": [("Выносливость отражает стойкость героя игрока и учитывается",
                    "равное его рейтингу СИЛЫ, если в его бланке стоит отметка в поле «Ранение».")],
        "summary": "Выносливость учитывается при получении вреда и от изнуряющих усилий. При падении до 0 герой теряет сознание и через час приходит в себя с 1 баллом Выносливости (если не ранен). Усталость: герой усталый, пока текущая Выносливость ≤ общей Нагрузки (Изнурение в пути временно повышает Нагрузку). Отдых: короткий (≥1 ч) восстанавливает баллы по рейтингу СИЛЫ (раненый — 0); долгий восстанавливает все (раненый — по СИЛЕ).",
        "parameters": {"zero_endurance": "unconscious_recover_1_after_1h_if_not_wounded",
                       "weary_when": "current_endurance <= total_load",
                       "short_rest": {"min_hours": 1, "recover": "strength_rating", "wounded": 0},
                       "long_rest": {"recover": "all", "wounded": "strength_rating"},
                       "fatigue_scope": "journey_only"},
        "related": [EH + "vynoslivost_i_nadezhda", P + "conditions.weariness", HC + "ponies_and_horses"],
        "notes": "Нагрузка и снаряжение — стр. 47 (B2.2 combat_gear/ponies). Изнурение и сцены пути — стр. 108, B5 (journey).",
    },
    {
        "id": EH + "nadezhda", "title": "Надежда", "level": "leaf",
        "subsystem": "endurance_hope", "section": f"{CH4} → ВЫНОСЛИВОСТЬ И НАДЕЖДА → Надежда",
        "pages": [71, 72],
        "quotes": [("Надежда — это запас духовной стойкости и оптимизма персонажа.",
                    "об эффектах ранений и их тяжести).")],
        "summary": "Надежда — запас духовной стойкости; баллы тратят на бонус Надежды к броску или на эффекты Культурных особенностей. При Надежде 0 герой духовно истощён. Несчастье: герой становится несчастным, когда Тень ≥ его текущей Надежды, и остаётся им, пока Надежда снова не превысит Тень. Восстановление Надежды тремя способами: трата баллов братства при отдыхе; Фаза братства (по СЕРДЦУ, в Йоль — все); +1 при долгом отдыхе, если Надежда равна 0.",
        "parameters": {"spend_on": ["hope_bonus_to_roll", "cultural_virtue_effects"],
                       "zero_hope": "spiritually_exhausted",
                       "miserable_trigger": "shadow >= hope_current",
                       "miserable_clears_when": "hope_current > shadow",
                       "recovery": {"fellowship_points_on_rest": "spend_any_distribute_equal_hope",
                                    "fellowship_phase": "heart_rating", "yule": "all",
                                    "long_rest_if_zero": 1}},
        "related": [EH + "vynoslivost_i_nadezhda", P + "conditions.miserable",
                    HC + "fellowship_rating", P + "checks.bonus_dice_hope"],
        "notes": "Более тяжёлый порог Тень ≥ МАКСИМУМУ Надежды («подавлен страхами» → злополучны все броски) и приступ безумия — глава «Тень» (стр. 137/139), B-later (shadow), НЕ здесь. Серьёзные травмы / Пронзающий удар — стр. 93/101, B4.",
    },
    # ======================== standard_of_living ========================
    {
        "id": SOL + "obraz_zhizni", "title": "Образ жизни", "level": "section",
        "subsystem": "standard_of_living", "section": f"{CH4} → ОБРАЗ ЖИЗНИ", "pages": [72],
        "quotes": [("Бильбо был очень богат и эксцентричен, удивлял весь Шир",
                    "в большинстве случаев могут определить, что может себе позволить герой.")],
        "summary": "Чтобы избежать детальных экономических правил, каждому герою присваивается Образ жизни. Помимо влияния на стартовое снаряжение (стр. 47), Образ жизни определяет, может ли герой оплатить расходы из своего кармана (обед в трактире, аренда лодки и т.п.).",
        "parameters": {"affects": ["starting_equipment", "affordability"]},
        "related": [SOL + "opisaniya_obrazov_zhizni", SOL + "nakoplenie_bogatstva",
                    HC + "starting_equipment"],
    },
    {
        "id": SOL + "opisaniya_obrazov_zhizni", "title": "Описания Образов жизни", "level": "leaf",
        "subsystem": "standard_of_living", "section": f"{CH4} → ОБРАЗ ЖИЗНИ → Описания Образов жизни",
        "pages": [72, 73],
        "quotes": [("В игре существует шесть уровней Образа жизни: Бедный, Скромный, Обычный",
                    "позволить себе всё что пожелают.")],
        "summary": "Шесть уровней Образа жизни: Бедный, Скромный, Обычный, Зажиточный, Богатый, Очень богатый. Стартовый Образ жизни определяется культурой, и герою записывают соответствующий рейтинг сокровищ. Стартовые рейтинги сокровищ: Скромный 0, Обычный 30, Зажиточный 90, Богатый 180; для Бедного и Очень богатого стартового рейтинга нет (ни одна культура не начинает Очень богатой).",
        "parameters": {"levels": SOL_LEVELS},
        "related": [SOL + "obraz_zhizni", SOL + "nakoplenie_bogatstva"],
        "notes": "Числа стартовых сокровищ (0/30/90/180) — под gate 2b. Бедный/Очень богатый без стартового значения в слое (сверить по скану).",
    },
    {
        "id": SOL + "nakoplenie_bogatstva", "title": "Накопление богатства", "level": "leaf",
        "subsystem": "standard_of_living", "section": f"{CH4} → ОБРАЗ ЖИЗНИ → Накопление богатства",
        "pages": [73],
        "quotes": [("Когда под кроватью стоят сундуки, доверху набитые золотом",
                    "Очень богатый 300+")],
        "summary": "Стоимость найденных ценностей выражается в баллах сокровищ; герой записывает рейтинг сокровищ и улучшает Образ жизни по мере его роста. Старт — по культуре. Лестница улучшения (рейтинг сокровищ для перехода к уровню): Скромный 0, Обычный 30, Зажиточный 90, Богатый 180, Очень богатый 300+.",
        "parameters": {"treasure_unit": "treasure_points", "starting": "by_culture",
                       "improvement_thresholds": SOL_IMPROVE},
        "related": [SOL + "obraz_zhizni", SOL + "opisaniya_obrazov_zhizni"],
        "notes": "Лестница 0/30/90/180/300+ — под gate 2b. Семантика «Бедный → Скромный» и «300+» сверяется по скану.",
    },
    # ============================ equipment =============================
    {
        "id": EQ + "boevoe_snaryazhenie", "title": "Боевое снаряжение", "level": "section",
        "subsystem": "equipment", "section": f"{CH4} → БОЕВОЕ СНАРЯЖЕНИЕ", "pages": [73],
        "quotes": [("Отряд почти не взял боевого снаряжения, полагаясь больше на скрытность",
                    "Все герои начинают путь искателей приключений полностью снаряжёнными")],
        "summary": "Полная подглава о боевом снаряжении (оружие и броня героя). Все герои начинают полностью снаряжёнными; описания типов оружия и брони с их характеристиками приводятся далее.",
        "parameters": {"categories": ["weapons", "armour", "shields"]},
        "related": [EQ + "oruzhie", EQ + "bronya_i_schity", HC + "combat_gear"],
        "notes": "МЕЖБАТЧЕВЫЙ ФЛАГ 1 (разобран): числовые таблицы (Урон/Травма/Нагрузка/Защита) и правила выбора стартового снаряжения — combat_gear (B2.2, стр. 47); здесь описания типов. Требования Образа жизни к снаряжению (стр. 100) — в диапазоне главы «Бой», B4.",
    },
    {
        "id": EQ + "oruzhie", "title": "Оружие", "level": "leaf", "subsystem": "equipment",
        "section": f"{CH4} → БОЕВОЕ СНАРЯЖЕНИЕ → Оружие", "pages": [73, 75],
        "quotes": [("Далее приведены красочные описания каждого типа оружия",
                    "встречается на поясе у многих путешественников, выросших в лесу или близ него.")],
        "summary": "Красочные описания каждого типа оружия, доступного начинающим героям (двуручный топор, длинное копьё, длинный лук, длинный меч, дубина, жезл, кинжал, кирка, копьё, короткий меч, короткое копьё, лук, меч, секира, топор). Числовые характеристики — в таблице combat_gear.",
        "parameters": {"weapon_types": ["unarmed", "dagger", "rod", "club", "short_sword",
                                         "sword", "long_sword", "short_spear", "spear",
                                         "long_spear", "axe", "battle_axe", "great_axe",
                                         "mattock", "bow", "long_bow"],
                       "stats_in": "kv.mechanics.hero_creation.combat_gear"},
        "related": [EQ + "boevoe_snaryazhenie", HC + "combat_gear", T + "spisok_boevyh_umeniy"],
        "notes": "Описания (без чисел); числа Урон/Травма/Нагрузка/Боевое умение — combat_gear (B2.2).",
    },
    {
        "id": EQ + "bronya_i_schity", "title": "Броня и щиты", "level": "leaf", "subsystem": "equipment",
        "section": f"{CH4} → БОЕВОЕ СНАРЯЖЕНИЕ → Броня и щиты", "pages": [75, 76],
        "quotes": [("Доспехи и щиты — важнейшее снаряжение любого воина.",
                    "Обычный щит хорошо защищает от стрел и особенно полезен в ближнем бою.")],
        "summary": "Описания доспехов и щитов: герой начинает с одним доспехом и может взять щит и шлем. Кожаный доспех (рубаха или корслет), кольчужный доспех (рубаха или хауберк), шлем; щиты — баклеры, большие щиты и обычные щиты. Числовые характеристики (Защита, Нагрузка, модиф. Парирования) — в таблице combat_gear.",
        "parameters": {"armour_types": ["leather_shirt", "leather_corslet", "short_mail", "mail", "helm"],
                       "shield_types": ["buckler", "shield", "great_shield"],
                       "stats_in": "kv.mechanics.hero_creation.combat_gear"},
        "related": [EQ + "boevoe_snaryazhenie", HC + "combat_gear"],
        "notes": "Описания (без чисел); числа Защита/Нагрузка/Парирование — combat_gear (B2.2).",
    },
    # ========================== valour_wisdom ===========================
    {
        "id": VW + "doblest", "title": "Доблесть", "level": "leaf", "subsystem": "valour_wisdom",
        "section": f"{CH5} → Доблесть", "pages": [78],
        "quotes": [("дают героям особые способности и лучшее снаряжение, а также позволяют героям противиться опасному влиянию Тени",
                    "подобные тем, что есть у знаменитых героев или королей.")],
        "summary": "ДОБЛЕСТЬ и МУДРОСТЬ дают особые способности и лучшее снаряжение и позволяют противиться Тени. Проверки выполняются как обычно (1 Кость испытания + Кости успеха по рейтингу); сложность проверки ДОБЛЕСТИ — ЦЧ СЕРДЦА. ДОБЛЕСТЬ отражает храбрость и славу героя как вершителя великих дел; её развитие определяет положение героя через поступки и подвиги.",
        "parameters": {"valour_check_vs": "heart_tn",
                       "check_dice": "1_feat_die_plus_success_dice_by_rating",
                       "represents": "fame_through_deeds"},
        "related": [VW + "mudrost", HC + "starting_rewards_and_virtues", P + "checks.target_numbers"],
        "notes": "Сопротивление Тени — глава «Тень» (стр. 136), B-later (shadow).",
    },
    {
        "id": VW + "mudrost", "title": "Мудрость", "level": "leaf", "subsystem": "valour_wisdom",
        "section": f"{CH5} → Мудрость", "pages": [78],
        "quotes": [("МУДРОСТЬ выражает веру героя игрока в собственные силы",
                    "обретает зрелость и остроту ума, достойную Мудрых мира сего.")],
        "summary": "МУДРОСТЬ выражает веру героя в собственные силы, уверенность и здравомыслие; развивается через преодоление трудностей. Сложность проверки МУДРОСТИ — ЦЧ РАЗУМА. Развитие МУДРОСТИ меняет героя тонко, но глубоко: от наивного искателя приключений к зрелости и остроте ума.",
        "parameters": {"wisdom_check_vs": "wits_tn", "represents": "inner_growth_and_judgement"},
        "related": [VW + "doblest", HC + "starting_rewards_and_virtues"],
        "notes": "ЦЧ проверки МУДРОСТИ дан на соседней карточке doblest (общий пассаж стр. 78).",
    },
    # ========================= rewards_virtues ==========================
    {
        "id": RV + "nagrady", "title": "Награды", "level": "section", "subsystem": "rewards_virtues",
        "section": f"{CH5} → НАГРАДЫ", "pages": [78, 79],
        "quotes": [("В мире, где тьма сгущается, торговля в основном ограничена небольшими областями",
                    "как именно герой игрока получил подарок или как было улучшено его снаряжение.")],
        "summary": "Награда — собирательное название боевого снаряжения высокого качества, которое нельзя купить, а можно получить за заслуги. Механически Награды — улучшения, повышающие эффективность боевого снаряжения (каждая влияет на одно свойство). Создавая героя, игрок выбирает одну Награду и получает новую за каждый новый уровень ДОБЛЕСТИ.",
        "parameters": {"choose_at_creation": 1, "gain_per": "valour_level",
                       "nature": "combat_gear_upgrade"},
        "related": [RV + "spisok_nagrad", HC + "starting_rewards_and_virtues"],
    },
    {
        "id": RV + "spisok_nagrad", "title": "Список Наград", "level": "leaf", "subsystem": "rewards_virtues",
        "section": f"{CH5} → НАГРАДЫ → Список Наград", "pages": [79, 80],
        "quotes": [("Существует шесть типов Наград. В скобках указывается",
                    "Ведь Награда — это знак признания и славы героя, и её нельзя отнять или передать другому.")],
        "summary": "Шесть типов Наград (в скобках — применимый тип снаряжения); каждое улучшение применяется к одному предмету лишь раз. Владелец таксономии Наград движка (6 ключей, те же, что проставил B2.2). Улучшенное Наградой снаряжение обладает «сюжетной неуязвимостью»: не теряется, не ломается и не передаётся другим.",
        "parameters": {"count": 6, "rewards": {r["key"]: {"name_ru": r["name_ru"],
                       "target": r["target"], "effect": r["effect"]} for r in REWARDS},
                       "once_per_item": True, "narrative_invulnerability": True},
        "related": [RV + "nagrady", HC + "combat_gear"],
    },
    {
        "id": RV + "osobennosti", "title": "Особенности", "level": "section", "subsystem": "rewards_virtues",
        "section": f"{CH5} → ОСОБЕННОСТИ", "pages": [80],
        "quotes": [("Особенности дополняют арсенал героя из навыков и Боевых умений.",
                    "может выбрать новую за достижение героем каждого нового уровня МУДРОСТИ.")],
        "summary": "Особенности дополняют навыки и Боевые умения героя, описывая врождённые или приобретённые склонности и определяя героический облик персонажа. Создавая героя, игрок выбирает одну Особенность и получает новую за каждый новый уровень МУДРОСТИ.",
        "parameters": {"choose_at_creation": 1, "gain_per": "wisdom_level"},
        "related": [RV + "spisok_osobennostey", HC + "starting_rewards_and_virtues"],
    },
    {
        "id": RV + "spisok_osobennostey", "title": "Список Особенностей", "level": "leaf",
        "subsystem": "rewards_virtues", "section": f"{CH5} → ОСОБЕННОСТИ → Список Особенностей",
        "pages": [80, 81],
        "quotes": [("Игрокам доступно 6 Особенностей на выбор. Каждую можно получить только раз.",
                    "Снизьте ЦЧ одной характеристики на 1.")],
        "summary": "Шесть общедоступных Особенностей, каждую можно получить лишь раз. Владелец таксономии Особенностей движка (6 ключей, те же, что проставил B2.2; полные эффекты — здесь): Мастерство (2 навыка → любимые), Проворство (+1 Парирование), Стойкость (+2 Выносливости или баллы МУДРОСТИ, что выше), Крепкие руки (+1 СИЛЕ при Сокрушительном ударе, +1 к Кости испытания при Уколе), Уверенность (+2 Надежды), Удаль (−1 к ЦЧ одной характеристики).",
        "parameters": {"count": 6, "virtues": {v["key"]: {"name_ru": v["name_ru"],
                       "effect": v["effect"]} for v in VIRTUES}},
        "related": [RV + "osobennosti", HC + "starting_rewards_and_virtues"],
        "notes": "hardiness/strong_grip даны полным правилом (в B2.2 — упрощения для стартового выбора при МУДРОСТИ 1, где они эквивалентны). Ключи не менялись.",
    },
    {
        "id": RV + "kulturnye_osobennosti", "title": "Культурные особенности", "level": "section",
        "subsystem": "rewards_virtues", "section": f"{CH5} → КУЛЬТУРНЫЕ ОСОБЕННОСТИ", "pages": [81],
        "quotes": [("На следующих страницах описаны Культурные особенности, делающие героя более уникальным.",
                    "но только со 2-го уровня МУДРОСТИ.")],
        "summary": "Культурные особенности отражают скрытые таланты народов и позволяют совершать необыкновенное; особенность применяется в особой ситуации, за плату или после броска. Каждой культуре доступны шесть уникальных Культурных особенностей, которые можно получать вместо обычных Особенностей за уровень МУДРОСТИ, но только со 2-го уровня МУДРОСТИ.",
        "parameters": {"per_culture": 6, "taken_instead_of": "regular_virtue",
                       "min_wisdom_level": 2},
        "related": [RV + "osobennosti", RV + "osobennosti_bardingov", RV + "osobennosti_gnomov",
                    RV + "osobennosti_lyudey_bri", RV + "osobennosti_sledopytov_severa",
                    RV + "osobennosti_hobbitov", RV + "osobennosti_elfov"],
        "notes": "Отличать от Культурного дара (ch.3, всегда активного: Отважность и т.п.) — тот определён на карточках культур (B2.2). Здесь — отдельная сущность: покупаемые Культурные особенности.",
    },
    {
        "id": RV + "osobennosti_bardingov", "title": "Особенности бардингов", "level": "leaf",
        "subsystem": "rewards_virtues", "section": f"{CH5} → КУЛЬТУРНЫЕ ОСОБЕННОСТИ → Особенности бардингов",
        "pages": [81, 82],
        "quotes": [("Бардинги — это северяне благороднейших кровей, отважный народ",
                    "С удивлением он обнаружил, что понимает язык птиц...»")],
        "summary": "Шесть Культурных особенностей бардингов: Великая судьба, Друг гномов, Крам, Победитель драконов, Яростный выстрел, Язык птиц. Реестр ключей с RU-названиями и краткими механическими тегами эффектов.",
        "parameters": {"culture_id": "bardings", "count": 6, "cultural_virtues": cvreg("bardings")},
        "related": [RV + "kulturnye_osobennosti", HC + "bardings"],
        "notes": "Ключи Культурных особенностей — провизорные движок-идентификаторы (net-new, B3 канонизирует).",
    },
    {
        "id": RV + "osobennosti_gnomov", "title": "Особенности гномов", "level": "leaf",
        "subsystem": "rewards_virtues", "section": f"{CH5} → КУЛЬТУРНЫЕ ОСОБЕННОСТИ → Особенности гномов",
        "pages": [82, 84],
        "quotes": [("Замкнутость и суровость гномов нередко ошибочно принимают за враждебность",
                    "До рассвета ещё много часов».")],
        "summary": "Шесть Культурных особенностей гномов: Барук Кхазад!, Неукротимый дух, Обрывки заклинаний, Путь Дурина, Твёрдый как камень, Темнота для тёмных дел. Реестр ключей с RU-названиями и краткими механическими тегами эффектов.",
        "parameters": {"culture_id": "dwarves_of_durins_folk", "count": 6,
                       "cultural_virtues": cvreg("dwarves_of_durins_folk")},
        "related": [RV + "kulturnye_osobennosti", HC + "dwarves_of_durins_folk"],
        "notes": "Ключи Культурных особенностей — провизорные движок-идентификаторы (net-new, B3 канонизирует).",
    },
    {
        "id": RV + "osobennosti_lyudey_bri", "title": "Особенности людей Бри", "level": "leaf",
        "subsystem": "rewards_virtues", "section": f"{CH5} → КУЛЬТУРНЫЕ ОСОБЕННОСТИ → Особенности людей Бри",
        "pages": [84, 85],
        "quotes": [("Да, жители Бри живут спокойной жизнью, но именно любовь к домашнему очагу",
                    "вести с Севера, Юга и Востока…")],
        "summary": "Шесть Культурных особенностей людей Бри: Искусство обращения с трубкой, Непокорность, Отчаянная храбрость, Пони из Бри, Свой среди чужих, Чудно, как Бригорские новости. Реестр ключей с RU-названиями и краткими механическими тегами эффектов.",
        "parameters": {"culture_id": "men_of_bree", "count": 6, "cultural_virtues": cvreg("men_of_bree")},
        "related": [RV + "kulturnye_osobennosti", HC + "men_of_bree"],
        "notes": "Ключи Культурных особенностей — провизорные движок-идентификаторы (net-new, B3 канонизирует).",
    },
    {
        "id": RV + "osobennosti_sledopytov_severa", "title": "Особенности Следопытов Севера", "level": "leaf",
        "subsystem": "rewards_virtues",
        "section": f"{CH5} → КУЛЬТУРНЫЕ ОСОБЕННОСТИ → Особенности Следопытов Севера", "pages": [85, 87],
        "quotes": [("Следопыты — это всё, что осталось на Севере от великого народа, пришедшего в Средиземье с Запада",
                    "«Разве ему не страшно?» — пробормотал гном.")],
        "summary": "Шесть Культурных особенностей Следопытов Севера: Выносливость Следопыта, Жизнь в глуши, Народное предвидение, Наследник Арнора, Раскрыть происхождение, Сила воли. Реестр ключей с RU-названиями и краткими механическими тегами эффектов.",
        "parameters": {"culture_id": "rangers_of_the_north", "count": 6,
                       "cultural_virtues": cvreg("rangers_of_the_north")},
        "related": [RV + "kulturnye_osobennosti", HC + "rangers_of_the_north"],
        "notes": "Ключи Культурных особенностей — провизорные движок-идентификаторы (net-new, B3 канонизирует). «Наследник Арнора» отсылает к артефактам стр. 161 — B3+/treasure.",
    },
    {
        "id": RV + "osobennosti_hobbitov", "title": "Особенности хоббитов", "level": "leaf",
        "subsystem": "rewards_virtues", "section": f"{CH5} → КУЛЬТУРНЫЕ ОСОБЕННОСТИ → Особенности хоббитов",
        "pages": [87, 88],
        "quotes": [("Хоббиты редко проявляют Особенности, которые в других культурах считают героическими",
                    "свиреп, как загнанный в угол дракон».")],
        "summary": "Шесть Культурных особенностей хоббитов: Точно в цель, Искусство исчезновения, Маленький народец, Стойкий как старые корни, Трое — это уже толпа, Храбрый в трудную минуту. Реестр ключей с RU-названиями и краткими механическими тегами эффектов.",
        "parameters": {"culture_id": "hobbits_of_the_shire", "count": 6,
                       "cultural_virtues": cvreg("hobbits_of_the_shire")},
        "related": [RV + "kulturnye_osobennosti", HC + "hobbits_of_the_shire"],
        "notes": "Ключи Культурных особенностей — провизорные движок-идентификаторы (net-new, B3 канонизирует).",
    },
    {
        "id": RV + "osobennosti_elfov", "title": "Особенности эльфов", "level": "leaf",
        "subsystem": "rewards_virtues", "section": f"{CH5} → КУЛЬТУРНЫЕ ОСОБЕННОСТИ → Особенности эльфов",
        "pages": [88, 90],
        "quotes": [("Для большинства жителей Средиземья эльфы — синоним волшебства.",
                    "погружая свой разум в странные эльфийские грёзы».")],
        "summary": "Шесть Культурных особенностей эльфов: Блеск гнева, Память древних дней, Против незримого, Смертоносная стрельба из лука, Элберет Гилтониэль, Эльфийские сновидения. Реестр ключей с RU-названиями и краткими механическими тегами эффектов.",
        "parameters": {"culture_id": "elves_of_lindon", "count": 6,
                       "cultural_virtues": cvreg("elves_of_lindon")},
        "related": [RV + "kulturnye_osobennosti", HC + "elves_of_lindon"],
        "notes": "Ключи Культурных особенностей — провизорные движок-идентификаторы (net-new, B3 канонизирует).",
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
    print(f"{written} B3 cards written; {len(list(OUT.glob('*.json')))} total in mechanics/")


if __name__ == "__main__":
    main()
