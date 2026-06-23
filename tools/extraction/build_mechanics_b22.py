"""Build rule cards for B2.2 block (subsystem `hero_creation`, КВ ch. 3 "Искатели
приключений", pages 28–58).

THROWAWAY TOOLING (stage 0, session 3a, batch 2.2). Same contract as
build_mechanics_b21.py: quotes are CUT from the КВ core text layer by
(start, end_incl) anchor pairs over whitespace-normalized text — never retyped —
so gate 1 (text-fidelity, ADR-002) holds by construction. summary/parameters are
engine annotations (gate 2a); every number in parameters is taken from the cut
source_text and is checked against the scans by gate 2b.

PRODUCT-GRADE KEY VOCABULARY
The engine joins content across cards by stable identifiers, so this block fixes a
single canonical key vocabulary, reconciled with the already-shipped packs:
  - characteristics strength/heart/wits and derived endurance/hope/parry match the
    lifepaths attribute keys;
  - the 18 skill keys (SKILL_ORDER) extend the solo pack's hunting/exploration/
    awareness; B3 (traits.spisok_navykov) MUST reuse SKILL_ORDER;
  - culture ids match kv.lifepaths culture_id (bardings, dwarves_of_durins_folk, …)
    so hero_creation culture cards join lifepath backgrounds;
  - calling / standard_of_living / weapon-skill keys are TOR-2e canonical.
Keys for distinctive features, cultural blessings, shadow paths, starting rewards
and virtues are STABLE ENGINE IDENTIFIERS (not claims about the book's English
text); the full taxonomies are owned by B3+ (traits / valour_wisdom /
rewards_virtues / shadow) and MUST reuse these keys.

FORWARD REFERENCES
validate.py flags dangling kv.mechanics.* entries in `related`. B2.2 depends
heavily on B3 (skills taxonomy, full distinctive-feature / blessing / virtue / SoL
rules). Those dependencies are carried as RESOLVABLE KEYS in `parameters` (joined
at pack-load time), never as `related` edges. `related` holds only cards that
already exist (lifepaths / B2.1) or are built in this batch; B3 pointers live in
`notes` as human-readable hints. Same rule the B2.1 cards follow.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parents[1] / "content-packs" / "kv" / "mechanics"
LAYER = (HERE / "source_kv" / "kv_core.txt").read_text(encoding="utf-8")
NORM = re.sub(r"\s+", " ", LAYER.replace("\u0002", "")).strip()

CH = "искатели приключений"  # chapter 3


def cut(start: str, end_incl: str) -> str:
    i = NORM.find(start)
    if i < 0:
        raise ValueError(f"start anchor not found: {start[:60]!r}")
    if NORM.count(start) > 1:
        raise ValueError(f"start anchor not unique ({NORM.count(start)}x): {start[:60]!r}")
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


# --- canonical vocabulary ---------------------------------------------------
SKILL_ORDER = ["awe", "inspire", "persuade", "athletics", "travel", "stealth",
               "awareness", "insight", "search", "hunting", "healing",
               "exploration", "song", "courtesy", "riddle", "craft", "battle", "lore"]


def skills(*v):
    assert len(v) == 18, f"need 18 skill ratings, got {len(v)}"
    return dict(zip(SKILL_ORDER, v))


def csets(*rows):
    return [{"roll": i + 1, "strength": r[0], "heart": r[1], "wits": r[2]}
            for i, r in enumerate(rows)]


def wskill(base_a, base_b):
    # culture weapon-skill line: "X ИЛИ Y 2 / выберите одно 1"
    return {"base": {"choose_one_of": [base_a, base_b], "rating": 2},
            "free_choice": {"count": 1, "rating": 1}}


P = "kv.mechanics.hero_creation."

CARDS = [
    # ===================== chapter overview =====================
    {
        "id": P + "creating_heroes", "title": "Ваши герои", "level": "leaf",
        "section": f"{CH} → Ваши герои", "pages": [28, 29],
        "quotes": [("При создании персонажа каждый игрок сначала выбирает культуру героя",
                    "будет определяться выбором культур героев и их призваний.")],
        "summary": "Порядок создания героя: выбрать культуру, пройти 7 шагов её описания (Культурный дар; характеристики набором или броском; ЦЧ = 20 минус характеристика; производные; навыки и Боевые умения; Отличительные качества; имя и возраст), затем откликнуться на зов (призвание, баллы предыдущего опыта, снаряжение, ДОБЛЕСТЬ/МУДРОСТЬ рейтинга 1 со стартовой Наградой и Особенностью) и собрать отряд.",
        "parameters": {
            "culture_steps": ["cultural_blessing", "characteristics", "target_numbers",
                              "derived_characteristics", "skills_and_weapon_skills",
                              "distinctive_features", "name_and_age"],
            "target_number_formula": "20 - characteristic",
            "call_steps": ["choose_calling", "spend_previous_experience", "choose_equipment",
                           "valour_wisdom_rating_1_with_starting_reward_and_virtue"],
            "then": "form_company",
        },
        "related": [P + "cultures", P + "callings", P + "previous_experience",
                    P + "starting_equipment", P + "starting_rewards_and_virtues",
                    P + "company", P + "experience", P + "further_adventures"],
    },
    # ===================== cultures: shared pattern =====================
    {
        "id": P + "cultures", "title": "Культуры героев", "level": "section",
        "section": f"{CH} → КУЛЬТУРЫ ГЕРОЕВ", "pages": [29],
        "quotes": [("В мире Средиземья культура, к которой принадлежит герой",
                    "построены по единому образцу и приводятся далее.")],
        "summary": "Культура происхождения — ключевой выбор при создании героя: она влияет на героя глубже обычаев и традиций. Описания всех доступных культур построены по единому образцу.",
        "parameters": {"count": 6, "culture_ids": [
            "bardings", "dwarves_of_durins_folk", "men_of_bree",
            "rangers_of_the_north", "hobbits_of_the_shire", "elves_of_lindon"]},
        "related": [P + "characteristics", P + "distinctions", P + "derived_characteristics",
                    P + "skills_and_weapon_skills", P + "distinctive_features_intro",
                    P + "languages_and_names", P + "bardings", P + "dwarves_of_durins_folk",
                    P + "men_of_bree", P + "rangers_of_the_north", P + "hobbits_of_the_shire",
                    P + "elves_of_lindon"],
    },
    {
        "id": P + "characteristics", "title": "Характеристики", "level": "leaf",
        "section": f"{CH} → КУЛЬТУРЫ ГЕРОЕВ → Характеристики", "pages": [29],
        "quotes": [("В НРИ «Кольцо Всевластья» есть три характеристики: СИЛА, СЕРДЦЕ и РАЗУМ.",
                    "справиться с эффектами Колдовства и Жадности.")],
        "summary": "Три характеристики — СИЛА (тело и здоровье), СЕРДЦЕ (эмоции, страсть), РАЗУМ (сообразительность, мудрость). Каждое целевое число равно 20 минус рейтинг характеристики: ЦЧ СИЛЫ — для навыков СИЛЫ и проверок атаки; ЦЧ СЕРДЦА — для навыков СЕРДЦА и проверок ДОБЛЕСТИ; ЦЧ РАЗУМА — для навыков РАЗУМА и проверок МУДРОСТИ.",
        "parameters": {
            "characteristics": ["strength", "heart", "wits"],
            "target_number_formula": "20 - rating",
            "tn_usage": {"strength": ["strength_skills", "attack_checks"],
                         "heart": ["heart_skills", "valour"],
                         "wits": ["wits_skills", "wisdom"]},
        },
        "related": [P + "derived_characteristics", P + "cultures",
                    "kv.mechanics.checks.target_numbers"],
    },
    {
        "id": P + "distinctions", "title": "Отличия", "level": "leaf",
        "section": f"{CH} → КУЛЬТУРЫ ГЕРОЕВ → Отличия", "pages": [29],
        "quotes": [("Далее приводятся сведения о типичной внешности, возрасте для приключений",
                    "Бедный, Скромный, Обычный, Зажиточный, Богатый и Очень богатый.")],
        "summary": "Раздел описывает внешность, возраст для приключений и военные традиции культур, а также Культурные дары (с возможными слабостями) и начальный Образ жизни. В игре шесть уровней экономического положения: Бедный, Скромный, Обычный, Зажиточный, Богатый и Очень богатый.",
        "parameters": {"standard_of_living_levels": [
            "poor", "frugal", "common", "prosperous", "rich", "very_rich"]},
        "related": [P + "cultures"],
        "notes": "Полные правила Образа жизни — в B3 (standard_of_living, стр. 72/100). Культурные дары раскрываются на карточках культур и в B3 (rewards_virtues).",
    },
    {
        "id": P + "derived_characteristics", "title": "Производные характеристики",
        "level": "leaf", "section": f"{CH} → КУЛЬТУРЫ ГЕРОЕВ → Производные характеристики",
        "pages": [29, 30],
        "quotes": [("Рейтинги характеристик героев используются для определения трёх производных характеристик",
                    "всех проверок атаки, выполняемых против героя игрока.")],
        "summary": "Из характеристик выводятся три производные: максимум Выносливости, максимум Надежды и рейтинг Парирования. Выносливость и Надежда — ключевые ресурсы героя; рейтинг Парирования задаёт ЦЧ всех проверок атаки против героя. Формулы прибавок к производным зависят от культуры.",
        "parameters": {"derived": ["endurance", "hope", "parry"],
                       "parry_role": "target_number_of_incoming_attacks"},
        "related": [P + "characteristics", P + "cultures"],
    },
    {
        "id": P + "skills_and_weapon_skills", "title": "Навыки и Боевые умения",
        "level": "leaf", "section": f"{CH} → КУЛЬТУРЫ ГЕРОЕВ → Навыки и Боевые умения",
        "pages": [30],
        "quotes": [("Навыки — это способности, которые искатели приключений используют чаще всего",
                    "Исключительный Мастерский Поразительный Легендарный")],
        "summary": "Навыки применяются чаще всего, Боевые умения — в сражениях. Компетентность выражается рейтингом от 0 (наименьший) до 6 (наибольший); каждому рейтингу соответствует свой словесный уровень для навыков и для Боевых умений.",
        "parameters": {
            "rating_min": 0, "rating_max": 6,
            "skill_rating_labels": ["Неумелый", "Слабый", "Средний", "Хороший",
                                    "Выдающийся", "Исключительный", "Поразительный"],
            "weapon_skill_rating_labels": ["Необученный", "Начинающий", "Средний", "Опытный",
                                           "Закалённый", "Мастерский", "Легендарный"],
        },
        "related": [P + "cultures", "kv.mechanics.checks.which_ability"],
        "notes": "Словесные уровни даны для рейтингов 0–6 по порядку; в слое таблица без явных чисел рейтинга (сверить по скану под gate 2b). Полный список 18 навыков и Боевых умений — B3 (traits).",
    },
    {
        "id": P + "distinctive_features_intro", "title": "Отличительные качества",
        "level": "leaf", "section": f"{CH} → КУЛЬТУРЫ ГЕРОЕВ → Отличительные качества",
        "pages": [30],
        "quotes": [("Три характеристики: СИЛА, СЕРДЦЕ и РАЗУМ — неплохо описывают искателей приключений, но их недостаточно",
                    "придающие их личностям глубину и индивидуальность.")],
        "summary": "Отличительные качества — это черты, присущие героям определённых культур, придающие их личностям глубину. Каждой культуре доступен свой набор из восьми качеств, из которых герой выбирает два.",
        "parameters": {"choose_per_culture": 2, "options_per_culture": 8},
        "related": [P + "cultures"],
        "notes": "Вводная карточка в блоке культур (МЕЖБАТЧЕВЫЙ ФЛАГ 2, разобран): полные правила механики качеств и канонический список — отдельный пассаж B3 (traits.otlichitelnye_kachestva, стр. 67); это другой текст, не дубль. Ключи качеств в наборах культур заданы провизорно, B3 канонизирует.",
    },
    {
        "id": P + "languages_and_names", "title": "Языки и типичные имена",
        "level": "leaf", "section": f"{CH} → КУЛЬТУРЫ ГЕРОЕВ → Языки и типичные имена",
        "pages": [30, 32],
        "quotes": [("Любому читателю Толкина известно, как сильно Профессор увлекался языками",
                    "без сомнения найдут его достойным внимания.")],
        "summary": "Для каждой культуры даны родной язык и список традиционных имён; имя рекомендуется выбирать согласованно с культурой героя. Большинство народов Средиземья владеют всеобщим языком (вестроном), что позволяет обойти языковые различия без ущерба для игры.",
        "parameters": {"common_tongue": "common", "language_play": "optional"},
        "related": [P + "cultures"],
        "notes": "Списки имён по культурам (мужские/женские/фамилии) не включены в карточки культур — отложены как отдельный data-ассет генерации имён.",
    },
    # ===================== cultures: six stat-blocks =====================
    {
        "id": P + "bardings", "title": "Бардинги", "level": "section",
        "section": f"{CH} → БАРДИНГИ", "pages": [32, 34],
        "quotes": [("Он был потомком старинного рода Гириона",
                    "Лифстан, сын Лейкнира, или Ингрит, дочь Ингольфа).")],
        "summary": "Бардинги — благородные северяне из Глухоманья, заново отстроившие Дейл после гибели Смауга; предпочитают мечи топорам и любят луки. Культурный дар Отважность делает проверки ДОБЛЕСТИ благополучными; стартовый Образ жизни — Зажиточный.",
        "parameters": {
            "culture_id": "bardings",
            "cultural_blessing": {"key": "valour_favoured", "name_ru": "Отважность"},
            "standard_of_living": "prosperous",
            "characteristic_sets": csets([5, 7, 2], [4, 7, 3], [5, 6, 3], [4, 6, 4], [5, 5, 4], [6, 6, 2]),
            "derived": {"endurance": "strength+20", "hope": "heart+8", "parry": "wits+12"},
            "skills": skills(1, 2, 3, 1, 1, 0, 0, 2, 1, 2, 0, 1, 1, 2, 0, 1, 2, 1),
            "weapon_skills": wskill("bows", "swords"),
            "distinctive_features": {"choose": 2, "from": ["proud", "conspicuous", "fair",
                "stubborn", "ardent", "fierce", "bold", "generous"]},
            "languages": ["dalish"],
        },
        "related": [P + "cultures"],
        "notes": "Дар, навыки и качества раскрываются полнее в B3 (rewards_virtues / traits).",
    },
    {
        "id": P + "dwarves_of_durins_folk", "title": "Гномы народа Дурина", "level": "section",
        "section": f"{CH} → ГНОМЫ НАРОДА ДУРИНА", "pages": [34, 36],
        "quotes": [("Только на Тракте можно было встретить путников, чаще всего — гномов",
                    "например, Торин Дубощит или Даин Железностоп).")],
        "summary": "Гномы — древний гордый народ, сильный и стойкий, плохо поддающийся соблазну, предпочитающий короткое оружие. Культурный дар Несгибаемость вдвое снижает Нагрузку доспехов (кроме щитов, с округлением вверх); ограничение Нугрим запрещает длинный лук, длинное копьё и большой щит; Образ жизни — Зажиточный.",
        "parameters": {
            "culture_id": "dwarves_of_durins_folk",
            "cultural_blessing": {"key": "armour_load_halved", "name_ru": "Несгибаемость"},
            "weapon_restrictions": {"forbidden": ["long_bow", "long_spear", "great_shield"]},
            "standard_of_living": "prosperous",
            "characteristic_sets": csets([7, 2, 5], [7, 3, 4], [6, 3, 5], [6, 4, 4], [5, 4, 5], [6, 2, 6]),
            "derived": {"endurance": "strength+22", "hope": "heart+8", "parry": "wits+10"},
            "skills": skills(2, 0, 0, 1, 3, 0, 0, 0, 3, 0, 0, 2, 1, 1, 2, 2, 1, 1),
            "weapon_skills": wskill("axes", "swords"),
            "distinctive_features": {"choose": 2, "from": ["noble", "proud", "secretive",
                "stubborn", "witty", "suspicious", "fierce", "grim"]},
            "languages": ["common", "khuzdul_secret"],
        },
        "related": [P + "cultures"],
        "notes": "Несгибаемость округляет дробную Нагрузку доспехов вверх; weapon_restrictions использует id из combat_gear. Полное описание дара — B3.",
    },
    {
        "id": P + "men_of_bree", "title": "Люди Бри", "level": "section",
        "section": f"{CH} → ЛЮДИ БРИ", "pages": [36, 38],
        "quotes": [("километров через шесть по этой дороге, вы выйдете к деревне Бри",
                    "хоббиты Шира (хотя сами хоббиты, разумеется, с этим не согласны).")],
        "summary": "Люди Бри — потомки древнего народа Эриадора, простые, дружелюбные и независимые, нечасто становящиеся искателями приключений. Культурный дар Кровь Бри повышает рейтинг братства на 1 за каждого человека Бри в отряде; Образ жизни — Обычный.",
        "parameters": {
            "culture_id": "men_of_bree",
            "cultural_blessing": {"key": "bree_blood", "name_ru": "Кровь Бри",
                                  "effect": {"fellowship_rating_bonus_per_member": 1}},
            "standard_of_living": "common",
            "characteristic_sets": csets([2, 5, 7], [3, 4, 7], [3, 5, 6], [4, 4, 6], [4, 5, 5], [2, 6, 6]),
            "derived": {"endurance": "strength+20", "hope": "heart+10", "parry": "wits+10"},
            "skills": skills(0, 2, 2, 1, 1, 1, 1, 2, 1, 1, 0, 1, 1, 3, 2, 2, 0, 0),
            "weapon_skills": wskill("axes", "spears"),
            "distinctive_features": {"choose": 2, "from": ["faithful", "sincere", "inquisitive",
                "courteous", "witty", "simple", "patient", "generous"]},
            "languages": ["common"],
        },
        "related": [P + "cultures"],
    },
    {
        "id": P + "rangers_of_the_north", "title": "Следопыты Севера", "level": "section",
        "section": f"{CH} → СЛЕДОПЫТЫ СЕВЕРА", "pages": [38, 40],
        "quotes": [("в диких местах за Бри встречались таинственные скитальцы",
                    "Следопыты дают детям имена на этом красивом языке.")],
        "summary": "Следопыты — последние потомки дунэдайн Севера, высокие, суровые и долго сохраняющие силу. Культурный дар Короли среди людей даёт +1 к одной характеристике на выбор; Верность дунэдайн ограничивает восстановление Надежды в Фазу братства (не в Йоль) половиной рейтинга СЕРДЦА с округлением вверх; Образ жизни — Скромный.",
        "parameters": {
            "culture_id": "rangers_of_the_north",
            "cultural_blessing": {"key": "kings_of_men", "name_ru": "Короли среди людей",
                                  "effect": {"characteristic_bonus": 1, "choice": "any_one"}},
            "secondary_blessing": {"key": "allegiance_of_dunedain", "name_ru": "Верность дунэдайн",
                                   "effect": "fellowship_phase_non_yule_hope_recovery_max_half_heart_round_up"},
            "standard_of_living": "frugal",
            "characteristic_sets": csets([7, 5, 2], [7, 4, 3], [6, 5, 3], [6, 4, 4], [5, 5, 4], [6, 6, 2]),
            "derived": {"endurance": "strength+20", "hope": "heart+6", "parry": "wits+14"},
            "skills": skills(1, 0, 0, 2, 2, 2, 2, 0, 1, 2, 2, 2, 0, 0, 0, 0, 2, 2),
            "weapon_skills": wskill("spears", "swords"),
            "distinctive_features": {"choose": 2, "from": ["swift", "conspicuous", "secretive",
                "sincere", "bold", "grim", "refined", "honest"]},
            "languages": ["common", "sindarin"],
        },
        "related": [P + "cultures"],
        "notes": "Верность дунэдайн — постоянное ограничение восстановления Надежды; полные правила Фазы братства — B5.",
    },
    {
        "id": P + "hobbits_of_the_shire", "title": "Хоббиты Шира", "level": "section",
        "section": f"{CH} → ХОББИТЫ ШИРА", "pages": [40, 42],
        "quotes": [("ему захотелось отправиться в путь и самому увидеть эти огромные горы",
                    "давать героические и звучные имена из времён до основания Шира.")],
        "summary": "Хоббиты — маленький жизнерадостный народ, на удивление стойкий, выбирающий короткие мечи и охотничьи луки. Культурный дар Хоббичье чутьё делает проверки МУДРОСТИ благополучными и даёт +1к ко всем проверкам Тени при сопротивлении Жадности; ограничение Полурослики запрещает крупное оружие и большой щит; Образ жизни — Обычный.",
        "parameters": {
            "culture_id": "hobbits_of_the_shire",
            "cultural_blessing": {"key": "hobbit_sense", "name_ru": "Хоббичье чутьё",
                                  "effect": {"wisdom_checks": "favoured",
                                             "shadow_check_vs_greed_bonus": "1d"}},
            "weapon_restrictions": {"allowed": ["axe", "bow", "club", "rod", "dagger",
                                                "short_sword", "short_spear", "spear"],
                                    "forbidden": ["great_shield"]},
            "standard_of_living": "common",
            "characteristic_sets": csets([3, 6, 5], [3, 7, 4], [2, 7, 5], [4, 6, 4], [4, 5, 5], [2, 6, 6]),
            "derived": {"endurance": "strength+18", "hope": "heart+10", "parry": "wits+12"},
            "skills": skills(0, 0, 2, 0, 0, 3, 2, 2, 0, 0, 1, 0, 2, 2, 3, 1, 0, 0),
            "weapon_skills": wskill("bows", "swords"),
            "distinctive_features": {"choose": 2, "from": ["faithful", "merry", "inquisitive",
                "courteous", "keen_eyed", "simple", "ardent", "honest"]},
            "languages": ["common"],
        },
        "related": [P + "cultures"],
    },
    {
        "id": P + "elves_of_lindon", "title": "Эльфы Линдона", "level": "section",
        "section": f"{CH} → ЭЛЬФЫ ЛИНДОНА", "pages": [42, 44],
        "quotes": [("Да, это эльфы, — сказал Фродо",
                    "В большинстве своём эльфы Линдона носят имена на этом языке.")],
        "summary": "Эльфы — Перворождённые Серых Гаваней, не болеющие и не стареющие, владеющие луками, копьями и мечами. Культурный дар Эльфийские навыки позволяет герою, если он не несчастен, потратить 1 балл Надежды на волшебный успех при проверке навыка рейтинга выше 0; Долгое поражение ограничивает снятие Тени в Фазу братства одним баллом; Образ жизни — Скромный.",
        "parameters": {
            "culture_id": "elves_of_lindon",
            "cultural_blessing": {"key": "elven_skill", "name_ru": "Эльфийские навыки",
                                  "effect": "spend_1_hope_for_magical_success_if_not_miserable_skill_rating_gt_0"},
            "secondary_blessing": {"key": "the_long_defeat", "name_ru": "Долгое поражение",
                                   "effect": "fellowship_phase_remove_at_most_1_shadow"},
            "standard_of_living": "frugal",
            "characteristic_sets": csets([5, 2, 7], [4, 3, 7], [5, 3, 6], [4, 4, 6], [5, 4, 5], [6, 2, 6]),
            "derived": {"endurance": "strength+20", "hope": "heart+8", "parry": "wits+12"},
            "skills": skills(2, 1, 0, 2, 0, 3, 2, 0, 0, 0, 1, 0, 2, 0, 0, 2, 0, 3),
            "weapon_skills": wskill("bows", "spears"),
            "distinctive_features": {"choose": 2, "from": ["noble", "swift", "merry", "fair",
                "keen_eyed", "suspicious", "patient", "refined"]},
            "languages": ["common", "sindarin"],
        },
        "related": [P + "cultures"],
        "notes": "Эльфийские навыки = тот же волшебный успех, что в checks.magical_success (B2.1); связь по ключу. Спиритуальное восстановление (Долгое поражение) — стр. 119, B5.",
    },
    # ===================== callings =====================
    {
        "id": P + "callings", "title": "Призвания", "level": "section",
        "section": f"{CH} → ПРИЗВАНИЯ", "pages": [44],
        "quotes": [("Временами, особенно по осени, он ловил себя на том",
                    "к которой обычно приводит призвание, если герой не сможет противостоять влиянию Тени.")],
        "summary": "Призвание — исходный импульс, толкнувший героя в путь (не профессия). Есть шесть призваний; каждое сочетание призвания с культурой даёт 36 комбинаций. Каждое описано единообразно: Любимые навыки (выбрать 2 из 3), Дополнительное отличительное качество, Путь Тени.",
        "parameters": {"count": 6, "culture_combinations": 36,
                       "choose_favoured": 2, "favoured_options": 3,
                       "calling_ids": ["messenger", "warrior", "treasure_hunter",
                                       "captain", "warden", "scholar"]},
        "related": [P + "calling_messenger", P + "calling_warrior", P + "calling_warden",
                    P + "calling_treasure_hunter", P + "calling_scholar", P + "calling_captain"],
    },
    {
        "id": P + "calling_messenger", "title": "Вестник", "level": "leaf",
        "section": f"{CH} → ПРИЗВАНИЯ → Вестник", "pages": [44],
        "quotes": [("Элронд посылает эльфов, чтобы связаться со Следопытами",
                    "Бежит дорога всё вперёд, это правда, но куда же она ведёт?")],
        "summary": "Вестник несёт вести и предупреждения в дальние края, чтобы вольные народы были едины перед тьмой. Любимые навыки: 2 из ВЫСТУПЛЕНИЕ, СТРАНСТВИЕ, УЧТИВОСТЬ. Дополнительное качество — Фольклор; Путь Тени — Одержимость скитаниями.",
        "parameters": {"calling_id": "messenger",
                       "favoured_skills": {"choose": 2, "from": ["song", "travel", "courtesy"]},
                       "additional_distinctive_feature": "folklore",
                       "shadow_path": "wandering_madness"},
        "related": [P + "callings"],
    },
    {
        "id": P + "calling_warrior", "title": "Воитель", "level": "leaf",
        "section": f"{CH} → ПРИЗВАНИЯ → Воитель", "pages": [44, 45],
        "quotes": [("Войне — быть, пока мы защищаем свою жизнь",
                    "что ведёт к всё более жестоким поступкам.")],
        "summary": "Воитель противостоит Тени силой оружия и идёт туда, где таятся враги. Любимые навыки: 2 из АТЛЕТИКА, ВНУШИТЕЛЬНОСТЬ, ОХОТА. Дополнительное качество — Знания о враге (выбрать врага: недобрые люди, орки, пауки, тролли, варги или нежить); Путь Тени — Одержимость мщением.",
        "parameters": {"calling_id": "warrior",
                       "favoured_skills": {"choose": 2, "from": ["athletics", "awe", "hunting"]},
                       "additional_distinctive_feature": "enemy_lore",
                       "enemy_lore_choices": ["evil_men", "orcs", "spiders", "trolls", "wargs", "undead"],
                       "shadow_path": "vengeance"},
        "related": [P + "callings"],
    },
    {
        "id": P + "calling_warden", "title": "Страж", "level": "leaf",
        "section": f"{CH} → ПРИЗВАНИЯ → Страж", "pages": [45, 46],
        "quotes": [("Путники глядят на нас с подозрением",
                    "или моя неудача обречёт невинных на поражение?")],
        "summary": "Страж поклялся защищать тех, кто не может защититься сам, и потому кажется чужаком даже тем, кого бережёт. Любимые навыки: 2 из БДИТЕЛЬНОСТЬ, ИСЦЕЛЕНИЕ, ПРОНИЦАТЕЛЬНОСТЬ. Дополнительное качество — Знание о Тени; Путь Тени — Путь отчаяния.",
        "parameters": {"calling_id": "warden",
                       "favoured_skills": {"choose": 2, "from": ["awareness", "healing", "insight"]},
                       "additional_distinctive_feature": "shadow_lore",
                       "shadow_path": "despair"},
        "related": [P + "callings"],
    },
    {
        "id": P + "calling_treasure_hunter", "title": "Искатель сокровищ", "level": "leaf",
        "section": f"{CH} → ПРИЗВАНИЯ → Искатель сокровищ", "pages": [45],
        "quotes": [("Далеко за Мглистые горы холодные, в пещеры глубокие",
                    "тем важнее для них становятся они сами и их драгоценные сокровища.")],
        "summary": "Искатель сокровищ стремится найти утраченное наследие былых королей, хранимое злыми тварями. Любимые навыки: 2 из ИССЛЕДОВАНИЕ, ПОИСК, СКРЫТНОСТЬ. Дополнительное качество — Взлом и проникновение; Путь Тени — Драконья болезнь.",
        "parameters": {"calling_id": "treasure_hunter",
                       "favoured_skills": {"choose": 2, "from": ["exploration", "search", "stealth"]},
                       "additional_distinctive_feature": "burglary",
                       "shadow_path": "dragon_sickness"},
        "related": [P + "callings"],
    },
    {
        "id": P + "calling_scholar", "title": "Учёный", "level": "leaf",
        "section": f"{CH} → ПРИЗВАНИЯ → Учёный", "pages": [46],
        "quotes": [("Вслух не секретничайте! Тут знаток древнего языка",
                    "ведь желание знать их может поглотить сердце.")],
        "summary": "Учёный видит в знаниях способ сделать дикий мир менее пугающим и освещает путь спутникам. Любимые навыки: 2 из ЗАГАДКИ, ЗНАНИЯ, РЕМЕСЛО. Дополнительное качество — Рифмы знаний; Путь Тени — Одержимость тайнами.",
        "parameters": {"calling_id": "scholar",
                       "favoured_skills": {"choose": 2, "from": ["riddle", "lore", "craft"]},
                       "additional_distinctive_feature": "rhymes_of_lore",
                       "shadow_path": "secrets"},
        "related": [P + "callings"],
    },
    {
        "id": P + "calling_captain", "title": "Командир", "level": "leaf",
        "section": f"{CH} → ПРИЗВАНИЯ → Командир", "pages": [45],
        "quotes": [("Он поднялся и словно бы стал выше. Его взгляд сверкнул пронзительно и властно.",
                    "открывающее Тени путь в сердце того, кто эту власть жаждет.")],
        "summary": "Командир выходит вперёд и ведёт других в мрачный час, желая, чтобы за ним шли по вере, а не из страха. Любимые навыки: 2 из ВООДУШЕВЛЕНИЕ, СРАЖЕНИЕ, УБЕЖДЕНИЕ. Дополнительное качество — Лидерство; Путь Тени — Одержимость властью.",
        "parameters": {"calling_id": "captain",
                       "favoured_skills": {"choose": 2, "from": ["inspire", "battle", "persuade"]},
                       "additional_distinctive_feature": "leadership",
                       "shadow_path": "power"},
        "related": [P + "callings"],
    },
    # ===================== previous experience =====================
    {
        "id": P + "previous_experience", "title": "Предыдущий опыт", "level": "section",
        "section": f"{CH} → ПРЕДЫДУЩИЙ ОПЫТ", "pages": [46, 47],
        "quotes": [("Уровень способностей всех только что созданных героев можно повысить",
                    "От до 6 баллов")],
        "summary": "Перед игрой герою даётся 10 баллов на повышение навыков и Боевых умений (в том числе тех, которых не было, и нескольких уровней подряд при поочерёдной оплате). Стоимость уровня навыка: 1/2/3/5 балла за уровни 1/2/3/4; стоимость уровня Боевого умения: 2/4/6 балла за уровни 1/2/3.",
        "parameters": {"points": 10,
                       "skill_cost_by_target_level": {"1": 1, "2": 2, "3": 3, "4": 5},
                       "weapon_skill_cost_by_target_level": {"1": 2, "2": 4, "3": 6}},
        "related": [P + "creating_heroes", P + "adventuring_path"],
        "notes": "В слое уровни в обеих таблицах стоимости утрачены (прочерки); значения стоимостей (1/2/3/5 и 2/4/6) присутствуют в слое, привязка к уровням восстановлена по примеру в том же пассаже (ЗНАНИЯ с 1 до 4 = 2+3+5 = 10) — СВЕРИТЬ числа уровней по скану под gate 2b.",
    },
    # ===================== starting equipment =====================
    {
        "id": P + "starting_equipment", "title": "Стартовое снаряжение", "level": "section",
        "section": f"{CH} → СТАРТОВОЕ СНАРЯЖЕНИЕ", "pages": [47],
        "quotes": [("Каждый герой вступает на путь искателя приключений полностью экипированным",
                    "это боевое снаряжение, походное снаряжение и полезные предметы.")],
        "summary": "Каждый герой начинает путь полностью экипированным. Стартовое снаряжение делится на три вида: боевое снаряжение, походное снаряжение и полезные предметы.",
        "parameters": {"categories": ["combat_gear", "travelling_gear", "useful_items"]},
        "related": [P + "combat_gear", P + "travelling_gear", P + "useful_items",
                    P + "ponies_and_horses"],
    },
    {
        "id": P + "combat_gear", "title": "Боевое снаряжение", "level": "leaf",
        "section": f"{CH} → СТАРТОВОЕ СНАРЯЖЕНИЕ → Боевое снаряжение", "pages": [47, 49],
        "quotes": [("Приключения — дело непростое, которое часто требует от героев долгих походов",
                    "* оружие для атак при Драке (стр. 67).")],
        "summary": "До игры герой выбирает одно оружие на каждое своё Боевое умение с рейтингом, а также броню, шлем и щит. ЗАЩИТА брони и шлема записываются отдельно (шлем можно сбросить в бою ради Нагрузки); щит даёт бонус Парирования, записываемый отдельно. Перечень даёт характеристики оружия (Урон, Травма, Нагрузка, Боевое умение), брони (Защита, Нагрузка) и щитов (модиф. Парирования, Нагрузка).",
        "parameters": {
            "weapons": [
                {"id": "unarmed", "name_ru": "Без оружия", "damage": 1, "injury": None, "load": 0, "skill": "brawling", "flags": ["brawling_only", "no_piercing_blow"]},
                {"id": "dagger", "name_ru": "Кинжал", "damage": 2, "injury": 14, "load": 0, "skill": "brawling", "flags": ["piercing_blow"]},
                {"id": "rod", "name_ru": "Жезл", "damage": 3, "injury": 12, "load": 0, "skill": "brawling", "flags": []},
                {"id": "club", "name_ru": "Дубина", "damage": 4, "injury": 14, "load": 1, "skill": "brawling", "flags": []},
                {"id": "short_sword", "name_ru": "Короткий меч", "damage": 3, "injury": 16, "load": 1, "skill": "swords", "flags": []},
                {"id": "sword", "name_ru": "Меч", "damage": 4, "injury": 16, "load": 2, "skill": "swords", "flags": []},
                {"id": "long_sword", "name_ru": "Длинный меч", "damage": 5, "injury": {"one_handed": 16, "two_handed": 18}, "load": 3, "skill": "swords", "flags": ["versatile"]},
                {"id": "short_spear", "name_ru": "Короткое копьё", "damage": 3, "injury": 14, "load": 2, "skill": "spears", "flags": ["thrown"]},
                {"id": "spear", "name_ru": "Копьё", "damage": 4, "injury": {"one_handed": 14, "two_handed": 16}, "load": 3, "skill": "spears", "flags": ["versatile", "thrown"]},
                {"id": "long_spear", "name_ru": "Длинное копьё", "damage": 5, "injury": 16, "load": 4, "skill": "spears", "flags": ["two_handed"]},
                {"id": "axe", "name_ru": "Топор", "damage": 5, "injury": 18, "load": 2, "skill": "axes", "flags": []},
                {"id": "battle_axe", "name_ru": "Секира", "damage": 6, "injury": {"one_handed": 18, "two_handed": 20}, "load": 3, "skill": "axes", "flags": ["versatile"]},
                {"id": "great_axe", "name_ru": "Двуручный топор", "damage": 7, "injury": 20, "load": 4, "skill": "axes", "flags": ["two_handed"]},
                {"id": "mattock", "name_ru": "Кирка", "damage": 7, "injury": 18, "load": 3, "skill": "axes", "flags": ["two_handed"]},
                {"id": "bow", "name_ru": "Лук", "damage": 3, "injury": 14, "load": 2, "skill": "bows", "flags": ["ranged", "two_handed"]},
                {"id": "long_bow", "name_ru": "Длинный лук", "damage": 4, "injury": 16, "load": 4, "skill": "bows", "flags": ["ranged", "two_handed"]},
            ],
            "armour": [
                {"id": "leather_shirt", "name_ru": "Кожаная рубаха", "protection": 1, "load": 3, "type": "leather"},
                {"id": "leather_corslet", "name_ru": "Кожаный корслет", "protection": 2, "load": 6, "type": "leather"},
                {"id": "short_mail", "name_ru": "Короткая кольчуга", "protection": 3, "load": 9, "type": "mail"},
                {"id": "mail", "name_ru": "Кольчуга", "protection": 4, "load": 12, "type": "mail"},
                {"id": "helm", "name_ru": "Шлем", "protection": 1, "protection_is_modifier": True, "load": 4, "type": "helmet"},
            ],
            "shields": [
                {"id": "buckler", "name_ru": "Баклер", "parry_modifier": 1, "load": 2},
                {"id": "shield", "name_ru": "Щит", "parry_modifier": 2, "load": 4},
                {"id": "great_shield", "name_ru": "Большой щит", "parry_modifier": 3, "load": 6},
            ],
            "protection_unit": "d6_successes",
            "starting_weapons_rule": "one_weapon_per_rated_weapon_skill",
        },
        "related": [P + "starting_equipment"],
        "notes": "МЕЖБАТЧЕВЫЙ ФЛАГ 1 (разобран): полная подглава «Боевое снаряжение» (стр. 73, требования Образа жизни стр. 100, qualities оружия) — отдельный пассаж B3 (equipment), это другой текст, не дубль. Травма с вариантами 1р/2р = одноручный/двуручный хват.",
    },
    {
        "id": P + "travelling_gear", "title": "Походное снаряжение", "level": "leaf",
        "section": f"{CH} → СТАРТОВОЕ СНАРЯЖЕНИЕ → Походное снаряжение", "pages": [49],
        "quotes": [("Походное снаряжение героя — это вещи, которые искатели приключений берут с собой",
                    "и оно не имеет рейтинга Нагрузки.")],
        "summary": "Походное снаряжение — это всё, кроме оружия и доспехов: зимой сапоги и тёплая одежда, летом лёгкая одежда и плащ. Его не обязательно подробно вписывать в бланк, и оно не имеет рейтинга Нагрузки.",
        "parameters": {"has_load": False},
        "related": [P + "starting_equipment"],
    },
    {
        "id": P + "useful_items", "title": "Полезные предметы", "level": "leaf",
        "section": f"{CH} → СТАРТОВОЕ СНАРЯЖЕНИЕ → Полезные предметы", "pages": [49, 50],
        "quotes": [("Любой инструмент, приспособление или устройство, которое у героя с собой",
                    "Богатый и Очень богатый — 4 предмета")],
        "summary": "Полезный предмет связывается с навыком: если вне боя проверяется этот навык и хранитель считает предмет уместным, герой получает +1к (не больше одного предмета за бросок). Число стартовых полезных предметов зависит от Образа жизни: Бедный — 0, Скромный — 1, Обычный — 2, Зажиточный — 3, Богатый и Очень богатый — 4.",
        "parameters": {"bonus": "1d_success", "max_per_roll": 1,
                       "count_by_standard_of_living": {"poor": 0, "frugal": 1, "common": 2,
                                                       "prosperous": 3, "rich": 4, "very_rich": 4}},
        "related": [P + "starting_equipment", P + "ponies_and_horses"],
    },
    {
        "id": P + "ponies_and_horses", "title": "Пони хоббитов и лошади", "level": "leaf",
        "section": f"{CH} → СТАРТОВОЕ СНАРЯЖЕНИЕ → Пони хоббитов и лошади", "pages": [50, 51],
        "quotes": [("Общая Нагрузка героя не может превышать его рейтинга Выносливости.",
                    "рейтинг Нагрузки сразу же изменяется, отражая увеличение или уменьшение тяжести ноши."),
                   ("пони хоббитов и лошади Лучшее подспорье опытному отряду путешественников",
                    "Богатый или Очень богатый У героя хороший конь или пони 3")],
        "summary": "Общая Нагрузка героя не может превышать рейтинга Выносливости; учитывается Нагрузка лишь боевого снаряжения и сокровищ. Скакуны — общее имущество отряда; в конце путешествия герой со скакуном снижает Изнурение на рейтинг Тяги, а вьючное животное несёт сокровищ не больше 10 баллов Нагрузки. Тяга скакуна по Образу жизни: Бедный/Скромный — 0, Обычный — 1, Зажиточный — 2, Богатый/Очень богатый — 3.",
        "parameters": {"load_cap": "endurance", "load_counts": ["combat_gear", "treasure"],
                       "pack_treasure_capacity": 10, "fatigue_reduction": "draught_rating",
                       "mount_draught_by_standard_of_living": {"poor": 0, "frugal": 0, "common": 1,
                                                               "prosperous": 2, "rich": 3, "very_rich": 3}},
        "related": [P + "useful_items", P + "starting_equipment"],
        "notes": "Изнурение в пути и скорость скакунов — B5 (journey, стр. 108).",
    },
    # ===================== starting rewards & virtues =====================
    {
        "id": P + "starting_rewards_and_virtues", "title": "Стартовые награды и особенности",
        "level": "section", "section": f"{CH} → СТАРТОВЫЕ НАГРАДЫ И ОСОБЕННОСТИ", "pages": [51],
        "quotes": [("Рост силы и славы героя в игре отслеживается с помощью двух показателей",
                    "одну Особенность и одну Награду из тех, что перечислены в главе 5."),
                   ("СТАРТОВЫЕ НАГРАДЫ (стр. 79) 1. Грозное (оружие): увеличивает рейтинг Травмы оружия на 2.",
                    "снизьте ЦЧ одной характеристики на 1.")],
        "summary": "ДОБЛЕСТЬ и МУДРОСТЬ имеют значения от 1 до 6 и на старте равны 1; повышение МУДРОСТИ даёт Особенности (умения народов), повышение ДОБЛЕСТИ — Награды (улучшения боевого снаряжения). На старте каждый герой выбирает одну Особенность и одну Награду из главы 5; ниже приведены шесть стартовых Наград и шесть стартовых Особенностей.",
        "parameters": {
            "valour_start": 1, "wisdom_start": 1, "rating_min": 1, "rating_max": 6,
            "starting_choice": {"rewards": 1, "virtues": 1},
            "starting_rewards": [
                {"key": "fell", "name_ru": "Грозное", "target": "weapon", "effect": {"injury": 2}},
                {"key": "keen", "name_ru": "Острое", "target": "weapon", "effect": {"piercing_blow_on": 9}},
                {"key": "close_fitting", "name_ru": "Тонкая работа", "target": "armour_helmet_shield", "effect": {"load": -2}},
                {"key": "grievous", "name_ru": "Ужасное", "target": "weapon", "effect": {"damage": 1}},
                {"key": "reinforced", "name_ru": "Усиленный", "target": "shield", "effect": {"parry_modifier": 1}},
                {"key": "well_fitted", "name_ru": "Хорошо подогнанная", "target": "armour_helmet", "effect": {"protection_check": 2}},
            ],
            "starting_virtues": [
                {"key": "strong_grip", "name_ru": "Крепкие руки", "effect": {"heavy_blow_damage": 1, "pierce_feat_die": 1}},
                {"key": "mastery", "name_ru": "Мастерство", "effect": {"favoured_skills": 2}},
                {"key": "nimbleness", "name_ru": "Проворство", "effect": {"parry": 1}},
                {"key": "hardiness", "name_ru": "Стойкость", "effect": {"endurance": 2}},
                {"key": "confidence", "name_ru": "Уверенность", "effect": {"hope": 2}},
                {"key": "prowess", "name_ru": "Удаль", "effect": {"characteristic_tn": -1}},
            ],
        },
        "related": [P + "creating_heroes"],
        "notes": "Полные списки Наград и Особенностей — глава 5, B3 (valour_wisdom / rewards_virtues, стр. 78–80); ключи провизорны, B3 канонизирует. Сайдбар стартовых Наград/Особенностей в слое стоит внутри текста ОТРЯДА — отнесён сюда по смыслу.",
    },
    # ===================== company =====================
    {
        "id": P + "company", "title": "Отряд", "level": "section",
        "section": f"{CH} → ОТРЯД", "pages": [51, 52],
        "quotes": [("«Я ищу участника приключения, которое устраиваю, но его не так-то легко найти».",
                    "Игроки должны представить своих героев остальным и определить обстоятельства,"),
                   ("которые свели их вместе; в целом лучше, чтобы к началу игры отряд уже какое-то время «существовал».",
                    "4. Выберите Важных товарищей.")],
        "summary": "Герои объединяются в отряд с общей целью; отряд создают в конце сессии создания героев или перед первой Фазой приключений. Процедура: 1) выбрать покровителя; 2) выбрать безопасное место; 3) определить рейтинг братства; 4) выбрать Важных товарищей.",
        "parameters": {"creation_steps": ["choose_patron", "choose_safe_place",
                                          "determine_fellowship_rating", "choose_important_companions"]},
        "related": [P + "patron", P + "safe_place", P + "fellowship_rating", P + "important_companion"],
    },
    {
        "id": P + "patron", "title": "Покровитель", "level": "leaf",
        "section": f"{CH} → ОТРЯД → Покровитель", "pages": [52, 53],
        "quotes": [("Отряд может собраться как по воле случая, так и по чьему-то замыслу.",
                    "Защищать землю, находить и сохранять то, что было потеряно.")],
        "summary": "Покровитель — влиятельная личность, дающая отряду зацепки для приключений и встречающаяся с героями в Фазу братства через начинание «Встреча с покровителем». На старте отряд выбирает одного из шести покровителей; все дают бонус братства и особые преимущества, обычно связанные с тратой баллов братства.",
        "parameters": {"patrons": [
            {"name_ru": "Балин, сын Фундина", "favoured_callings": ["captain", "warrior"], "fellowship_bonus": 1},
            {"name_ru": "Бильбо Торбинс", "favoured_callings": ["treasure_hunter", "scholar"], "fellowship_bonus": 2},
            {"name_ru": "Гильраэн, дочь Дирхаэля", "favoured_callings": ["warrior", "warden"], "fellowship_bonus": 0},
            {"name_ru": "Гэндальф Серый", "favoured_callings": ["messenger", "captain"], "fellowship_bonus": 2},
            {"name_ru": "Кирдан Корабел", "favoured_callings": ["messenger", "scholar"], "fellowship_bonus": 1},
            {"name_ru": "Том Бомбадил и Леди Златеника", "favoured_callings": ["treasure_hunter", "warden"], "fellowship_bonus": 2},
        ]},
        "related": [P + "company", P + "fellowship_rating"],
        "notes": "Дополнительные преимущества и задачи покровителей даны прозой (в source_text). Полные таблицы заданий покровителей (d6) — в solo-паке (kv.tables.solo); начинание «Встреча с покровителем» — B5 (fellowship_phase, стр. 121).",
    },
    {
        "id": P + "safe_place", "title": "Безопасное место", "level": "leaf",
        "section": f"{CH} → ОТРЯД → Безопасное место", "pages": [53, 54],
        "quotes": [("Безопасное место — это база, служащая отправной точкой для действий отряда",
                    "может поведать что-то о его способностях и стремлениях.")],
        "summary": "Безопасное место — база и убежище отряда, куда герои возвращаются отдыхать в Фазу братства, обычно там, где впервые собрались. Идеальное стартовое место в Эриадоре — деревня Бри на перекрёстке трактов; со временем отряд может добавить Тарбад и Ривенделл.",
        "parameters": {"starting_safe_place_suggestion": "bree"},
        "related": [P + "company"],
        "notes": "Бри и его трактир — глава 9; правила отдыха в Фазе братства — B5.",
    },
    {
        "id": P + "fellowship_rating", "title": "Рейтинг братства", "level": "leaf",
        "section": f"{CH} → ОТРЯД → Рейтинг братства", "pages": [54, 55],
        "quotes": [("Отряд героев — это не просто шайка скитающихся наёмников",
                    "любые траты этих баллов должны согласовываться всеми членами отряда.")],
        "summary": "Рейтинг братства — общий запас баллов отряда, расходуемый в основном на восстановление Надежды при отдыхе и на эффекты покровителя. Стартовый рейтинг равен числу героев в отряде и может быть увеличен Особенностями, Культурными дарами и бонусом покровителя; баллы полностью восстанавливаются в конце каждой сессии, и любая трата согласуется всем отрядом.",
        "parameters": {"starting_rating": "hero_count", "spend_on": ["restore_hope", "patron_effects"],
                       "restored": "end_of_session", "shared_pool": True,
                       "increased_by": ["virtues", "cultural_blessings", "patron_bonus"]},
        "related": [P + "company", P + "patron", "kv.mechanics.checks.bonus_dice_hope"],
        "notes": "Восстановление Надежды при отдыхе — стр. 71, B3 (endurance_hope).",
    },
    {
        "id": P + "important_companion", "title": "Важный товарищ", "level": "leaf",
        "section": f"{CH} → ОТРЯД → Важный товарищ", "pages": [55],
        "quotes": [("Рейтинг братства отряда отражает преданность, которую испытывают искатели приключений друг к другу.",
                    "хоббит-взломщик получил бы 2к вместо 1к.")],
        "summary": "Каждый игрок может выбрать одного члена отряда Важным товарищем (связь не обязана быть взаимной). Помогая Важному товарищу, герой даёт 2к вместо 1к; но за это герой получает 1 балл Тени каждый раз, когда его Важный товарищ получает ранение, впадает в безумие или серьёзно страдает (этот балл нельзя предотвратить проверкой Тени).",
        "parameters": {"help_bonus": "2d_success", "normal_help_bonus": "1d_success",
                       "shadow_cost": 1, "shadow_cost_preventable": False, "mutual": False},
        "related": [P + "company", P + "fellowship_rating", "kv.mechanics.checks.assistance"],
        "notes": "Проверка Тени — стр. 137, B-later (shadow).",
    },
    # ===================== experience =====================
    {
        "id": P + "experience", "title": "Опыт", "level": "section",
        "section": f"{CH} → ОПЫТ", "pages": [55, 56],
        "quotes": [("В этой НРИ герои развиваются по ходу игры.",
                    "получения новых уровней ДОБЛЕСТИ или МУДРОСТИ.")],
        "summary": "Герои получают особые баллы в конце каждой сессии и Фазы приключений и тратят их в Фазу братства. Есть два типа: баллы навыков — на новые уровни любых навыков; баллы приключений — на улучшение Боевых умений и получение уровней ДОБЛЕСТИ или МУДРОСТИ.",
        "parameters": {"experience_types": ["skill_points", "adventure_points"],
                       "skill_points_for": ["skills"],
                       "adventure_points_for": ["weapon_skills", "valour", "wisdom"]},
        "related": [P + "skill_points", P + "adventure_points"],
    },
    {
        "id": P + "skill_points", "title": "Баллы навыков", "level": "leaf",
        "section": f"{CH} → ОПЫТ → Баллы навыков", "pages": [56],
        "quotes": [("Способность героев извлекать пользу из своего опыта и совершенствовать свои умения",
                    "так как его рейтинг РАЗУМА равен 6).")],
        "summary": "Игрок получает 3 балла навыков в конце каждой сессии, в которой участвовал. Кроме того, в каждую Фазу братства во время Йоля игрок получает дополнительные баллы навыков, равные рейтингу РАЗУМА его героя.",
        "parameters": {"per_session": 3, "per_yule": "wits_rating"},
        "related": [P + "experience"],
    },
    {
        "id": P + "adventure_points", "title": "Баллы приключений", "level": "leaf",
        "section": f"{CH} → ОПЫТ → Баллы приключений", "pages": [56],
        "quotes": [("Чувство выполненного долга, уверенность в себе, боевое мастерство",
                    "каждый участвовавший в ней игрок получает 3 балла приключений.")],
        "summary": "В конце каждой сессии каждый участвовавший игрок получает 3 балла приключений.",
        "parameters": {"per_session": 3},
        "related": [P + "experience"],
    },
    # ===================== further adventures =====================
    {
        "id": P + "further_adventures", "title": "Дальнейшие приключения", "level": "section",
        "section": f"{CH} → ДАЛЬНЕЙШИЕ ПРИКЛЮЧЕНИЯ", "pages": [56],
        "quotes": [("Есть несколько способов, которыми приключения героя могут окончиться.",
                    "им следует выбрать того, кто займёт их место, чтобы их наследие не кануло в забвение.")],
        "summary": "Приключения героя могут окончиться гибелью в бою, надломом воли под гнётом Тени или добровольным уходом на покой. Прежде чем оставить борьбу, герою следует выбрать наследника, чтобы его наследие не было забыто.",
        "parameters": {"endings": ["death", "shadow", "retirement"], "choose_successor": True},
        "related": [P + "adventuring_path"],
    },
    {
        "id": P + "adventuring_path", "title": "Путь приключений", "level": "leaf",
        "section": f"{CH} → ДАЛЬНЕЙШИЕ ПРИКЛЮЧЕНИЯ → Путь приключений", "pages": [56, 58],
        "quotes": [("Жизнь искателя приключений тяжела для представителей любого народа.",
                    "до 1,5 баллов за час игры или даже больше.")],
        "summary": "Герои достигают вершины мастерства примерно за 10 лет игры (5-й уровень ДОБЛЕСТИ и МУДРОСТИ). Наследник создаётся по обычным правилам с исключениями: 1 любимый навык переходит как семейное наследие, стартовый Образ жизни — от уходящего героя, повышение стартовых способностей оплачивается из запаса предыдущего опыта (навыки до 4-го уровня, Боевые умения до 3-го). Запас наследника растёт начинанием «Взращивание наследника» (до 5 баллов сокровищ и 5 баллов приключений за раз, +1 за балл приключений), наследник готов при 10 баллах, максимум 20; при запасе 15 передаётся одна Семейная реликвия, при 20 — вторая. Подробная скорость развития — 1 балл навыка и 1 балл приключений за час игры (можно до 1,5 и выше).",
        "parameters": {
            "mastery": {"years": 10, "valour_wisdom_level": 5},
            "heir": {"treasure_per_undertaking": 5, "adventure_points_per_undertaking": 5,
                     "pool_per_adventure_point": 1, "ready_at_pool": 10, "max_pool": 20,
                     "legacy_favoured_skills": 1, "starting_sol": "inherits_from_hero",
                     "build_skill_cap": 4, "build_weapon_skill_cap": 3,
                     "heirloom_at_pool": {"15": 1, "20": 2}},
            "session": {"hours": 3, "skill_points_per_hour": 1, "adventure_points_per_hour": 1,
                        "fast_rate_per_hour": 1.5},
        },
        "related": [P + "further_adventures", P + "previous_experience"],
        "notes": "Начинание «Взращивание наследника» — стр. 120, B5 (fellowship_phase); стоимости повышения наследника берут таблицы из previous_experience (стр. 46); Семейные реликвии / Знаменитое оружие / Чудесные артефакты — B3+ (rewards / treasure, стр. 78/158).",
    },
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ids = [c["id"] for c in CARDS]
    assert len(ids) == len(set(ids)), "duplicate card ids"
    written = 0
    for c in CARDS:
        payload = {
            "subsystem": "hero_creation",
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
    print(f"{written} hero_creation cards written; "
          f"{len(list(OUT.glob('*.json')))} total in mechanics/")


if __name__ == "__main__":
    main()
