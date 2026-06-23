"""Build rule cards for B9 (КВ глава «Противники», folios 142-157; subsystem adversaries).

VISION-ASSISTED extraction (same as B8): the bestiary is stat-block/table-dense and
the text layer column-scrambles tables/sidebars, so structure and stat blocks are
established from rendered PAGE IMAGES; source_text is CUT verbatim from kv_core.txt
(gate-1 / ADR-002 fidelity); parameters verified against the scans (folds gate-2b in).

NOTE — B9 introduces a NEW subsystem value "adversaries" in rule_card.schema.json
(added after "treasure"). This is the only enum change across all batches.

THIS BATCH = the 2 foundation cards (folios 142-144):
  protivniki (intro) / format_opisaniya (enemy stat-block format + all combat mechanics).
The enemy-type stat-block cards (volki / nedobrye_lyudi / nezhit / orki / trolli,
folios 146-157) come with the next render batch and EXTEND this build script.

KEY enemy rule (folio 144): the Feat die is INVERTED for enemies — the Eye is the
highest result and an automatic success, the Gandalf rune is the lowest and equals 0
(mirror of heroes). The die glyphs drop from the text layer; the values are read off
the page scan. Enemy stat-block NUMBERS (Might/Endurance/Hatred) live in the per-enemy
cards, not here — this card holds the RULES (prose).

JOINS — NO CHURN: attack/Pierce/Brawl/round -> combat (B4); Endurance/weary ->
endurance_hope.vynoslivost (B2.1); Misdeed (Проступок, стр.138) ->
shadow.istochniki_teni (B6); special damage spends success-signs ->
checks.feat_die_values.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parents[1] / "content-packs" / "kv" / "mechanics"
LAYER = (HERE / "source_kv" / "kv_core.txt").read_text(encoding="utf-8")
NORM = re.sub(r"\s+", " ", LAYER.replace("\u0002", "")).strip()

AD = "kv.mechanics.adversaries."
FEAT = "kv.mechanics.checks.feat_die_values"
END = "kv.mechanics.endurance_hope.vynoslivost"
SHADOW_SRC = "kv.mechanics.shadow.istochniki_teni"


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
        "id": AD + "protivniki", "title": "Противники",
        "subsystem": "adversaries", "section": "Противники → (вступление)", "pages": [142],
        "quotes": [("противники Арнорцев почти не осталось",
                    "противостоящих действиям героев игроков по недоумию.")],
        "summary": "Вступление к подглаве о врагах. Слуги Врага — не всегда орки, тролли или призраки; "
                   "среди противников много тех, кого трудно, а иногда невозможно отличить от друзей, и "
                   "даже верные союзники могут превратиться в беспощадных противников из-за простого "
                   "недоразумения, вероломства или предательства. Подглава представляет разнообразных "
                   "врагов — от хитрых и злобных существ, населяющих Средиземье, до заблуждающихся "
                   "персонажей, противостоящих героям игроков по недоумию.",
        "parameters": {"is_intro": True,
                       "enemies_range_from": ["monstrous_creatures", "misguided_persons"],
                       "even_allies_may_turn": "via misunderstanding, treachery, or betrayal"},
        "related": [AD + "format_opisaniya"],
        "notes": "Vision-assisted (ф.142).",
    },
    {
        "id": AD + "format_opisaniya", "title": "Формат описания врагов",
        "subsystem": "adversaries", "section": "Противники → формат описания врагов", "pages": [143, 144],
        "quotes": [("формат описания врагов Чтобы облегчить задачу хранителя",
                    "есть подсказки, что можно сделать.")],
        "summary": "Владелец формата описания врага и боевой механики противников; информация о враге "
                   "дана упрощённо. УРОВЕНЬ ХАРАКТЕРИСТИКИ — единый рейтинг вместо трёх характеристик "
                   "героя, в бою служит модификатором (особый урон, способности). МОЩЬ И ВЫНОСЛИВОСТЬ: "
                   "Выносливость — сопротивляемость усталости и урону (враг выбывает при 0); Мощь — "
                   "сколько ранений нужно для уничтожения и сколько атак за раунд (атак = Мощь, можно по "
                   "разным целям); враги не могут выбрать отброс назад. НЕНАВИСТЬ ИЛИ РЕШИМОСТЬ играют "
                   "роль Надежды: трата даёт 1к в бою или питает способности; без баллов враг считается "
                   "уставшим; за раунд тратится не больше Мощи. Ненависть — у приспешников и слуг Врага "
                   "и чудовищ (всегда враждебны); Решимость — у не заклятых врагов, которые могут "
                   "сдаться; убийство врага с Решимостью хранитель всегда рассматривает как возможный "
                   "Проступок. ПОСЛЕ СРАЖЕНИЯ выбывшие при 0 могут выжить, если помочь. РЕЗУЛЬТАТ НА "
                   "КОСТИ ИСПЫТАНИЯ ПРОТИВНИКОВ: для врагов значения инвертированы — знак Ока становится "
                   "наивысшим результатом и даёт автоуспех, руна Гэндальфа — наименьшим, равным 0; "
                   "большинство врагов наносят Пронзающий удар при выпадении 10 или Ока. ПАРИРОВАНИЕ — "
                   "числовой модификатор к ЦЧ СИЛЫ атакующего героя. БРОНЯ — для проверки ЗАЩИТЫ врага "
                   "при Пронзающем ударе. БОЕВЫЕ УМЕНИЯ — главное и дополнительное (рейтинг, урон/травма, "
                   "варианты особого урона). ОСОБЫЙ УРОН: за 1 знак успеха активируется эффект (несколько "
                   "знаков — несколько эффектов), все враги всегда могут выбрать Сокрушительный удар; "
                   "СОКРУШЕНИЕ ЩИТА (цель теряет бонус щита; усиленные Наградой или волшебные щиты "
                   "разбить нельзя), СОКРУШИТЕЛЬНЫЙ УДАР (доп. урон Выносливости = уровню характеристики "
                   "атакующего), УКОЛ (+2 к результату Кости испытания этой атаки), ЗАХВАТ (цель "
                   "сражается только на передовой позиции в Драке; освобождается успешной атакой, "
                   "потратив 1 знак успеха). СПОСОБНОСТИ ВРАГА — уникальные таланты, указанные в "
                   "статблоке каждого врага; применимы даже за последний балл Ненависти/Решимости. "
                   "ОТЛИЧИТЕЛЬНЫЕ КАЧЕСТВА — одно-два по правилам создания препятствующих ПХ.",
        "parameters": {
            "attribute_level": "single rating replacing the hero's 3 attributes; a combat modifier",
            "might_and_endurance": {
                "endurance": "resistance to fatigue/damage; enemy out of combat at 0",
                "might": "wounds needed to destroy it AND attacks per round",
                "attacks_per_round": "equal to Might (may split across targets)",
                "no_knockback_choice": True,
            },
            "hatred_or_resolve": {
                "role": "like the hero's Hope",
                "spend_for_die": "lower it to gain one die on a combat check",
                "spend_for_abilities": True,
                "without_points": "counts as weary",
                "max_spend_per_round": "Might rating",
                "hatred": "Sauron's servants and monstrous creatures; always hostile",
                "resolve": "non-monsters opposing by circumstance; may surrender",
                "killing_resolve_enemy": "always a possible Misdeed (keeper weighs circumstances)",
            },
            "after_battle": "enemies out at 0 Endurance may survive if helped",
            "enemy_feat_die_inverted": {
                "eye": "highest possible result and an automatic success",
                "gandalf_rune": "lowest possible result, equals 0",
                "note": "INVERTED from heroes; most enemies Pierce at 10 or the Eye",
            },
            "parry": "numeric modifier added to the attacking hero's STRENGTH TN",
            "armour": "used for the enemy's PROTECTION check when Pierced",
            "combat_proficiencies": "a main and an additional proficiency; each gives rating, damage/wound, special-damage options",
            "special_damage": {
                "cost": "one success-sign per effect (several signs -> several effects)",
                "always_available": "Heavy Blow (Сокрушительный удар)",
                "effects": {
                    "shatter_shield": "target loses the shield's parry bonus (Reward/magic shields cannot be shattered)",
                    "heavy_blow": "extra Endurance damage equal to the attacker's attribute level",
                    "pierce": "+2 to the Feat-die result of this attack check",
                    "grab": "target may only fight from the front (in a Brawl); frees itself with a successful attack check spending one success-sign",
                },
            },
            "enemy_abilities": "unique talents listed in each enemy's stat block; usable even spending the last Hatred/Resolve",
            "distinctive_qualities": "keeper may add one or two per the obstructive-NPC rules (стр.135)",
        },
        "related": [AD + "protivniki", FEAT, END, SHADOW_SRC],
        "notes": "Владелец формата описания врага и боевой механики противников (ф.143-144). "
                 "Vision-assisted: статблок-механика, Особый урон и инверсия Кости испытания сверены по "
                 "скану. Глифы Кости теряются в текст-слое — по картинке: знак Ока = автоуспех/высший, "
                 "руна Гэндальфа = 0 (зеркально героям → checks.feat_die_values). Числа Мощи/Выносливости/"
                 "Ненависти — в статблоках врагов (карты volki/nedobrye_lyudi/... B9). Атака/Пронзающий/"
                 "Драка/раунд → combat (B4); Выносливость/уставший → endurance_hope.vynoslivost (B2.1); "
                 "Проступок (стр.138) → shadow.istochniki_teni (B6).",
    },
    {
        "id": AD + "volki", "title": "Волки Диких земель",
        "subsystem": "adversaries", "section": "Противники → ВОЛКИ ДИКИХ ЗЕМЕЛЬ", "pages": [146, 147],
        "quotes": [("волки диких земель Во времена приключений Бильбо",
                    "все герои в поле зрения пса получают 2 балла Тени (Страх). Те, за кого проверка "
                    "Тени провалена, запуганы и не могут тратить баллы Надежды до конца боя.")],
        "summary": "Владелец статблоков волков Диких земель. У всех волков Диких земель есть способность "
                   "Гигантский прыжок (за 1 балл Ненависти атакуют героя на любой позиции, даже "
                   "стрелковой). Варги — особо жестокая порода серых волков; на них ездят орки. "
                   "Статблоки: Дикий волк (Ур.3, Выносл 12, Мощь 1, Ненависть 3, Парир —, Броня 1; Клыки "
                   "3 (3/14, Укол); Боязнь огня, Змеиная быстрота); Волчий вожак (Ур.4, Выносл 16, Мощь "
                   "1, Ненависть 4, Парир —, Броня 1; Клыки 3 (4/14, Укол), Когти 2 (4/14, Захват); "
                   "Боязнь огня, Змеиная быстрота, Победный вой); Пёс Саурона — слуга Тёмного Повелителя "
                   "в облике варга (Ур.5, Выносл 20, Мощь 2, Ненависть 5, Парир +1, Броня 2; Клыки 3 "
                   "(5/14, Укол), Когти 3 (5/14, Захват); Невероятная стойкость, Смертельная рана, Удар "
                   "страха).",
        "parameters": {
            "general_abilities": ["Гигантский прыжок"],
            "abilities_glossary": {
                "Гигантский прыжок": "for 1 Hatred, may attack a hero in any combat position, even ranged",
                "Боязнь огня": "loses 1 Hatred at the start of each round it is in melee with a foe holding a torch or burning item",
                "Змеиная быстрота": "if targeted by an attack, may spend 1 Hatred to make that attack check ill-fated",
                "Победный вой": "for 1 Hatred, restores 1 Hatred to every other warg in the fight",
                "Невероятная стойкость": "immune to unarmed attacks; damage that would drop its Endurance to 0 instead Pierces; if it survives, it restores half its maximum Endurance",
                "Смертельная рана": "a target it wounds rolls an ill-fated Feat die to determine wound severity",
                "Удар страха": "for 1 Hatred, all heroes in sight gain 2 Shadow (Fear); those who fail the Shadow check are frightened and cannot spend Hope until the fight ends",
            },
            "enemies": {
                "dikiy_volk": {"name_ru": "Дикий волк", "distinctive": ["Мрачность", "Остроглазость"],
                    "level": 3, "endurance": 12, "might": 1, "hatred": 3, "parry": None, "armour": 1,
                    "weapons": [{"name": "Клыки", "rating": 3, "damage": 3, "wound": 14, "special": ["Укол"]}],
                    "abilities": ["Боязнь огня", "Змеиная быстрота"]},
                "volchiy_vozhak": {"name_ru": "Волчий вожак", "distinctive": ["Быстрота", "Злобность"],
                    "level": 4, "endurance": 16, "might": 1, "hatred": 4, "parry": None, "armour": 1,
                    "weapons": [{"name": "Клыки", "rating": 3, "damage": 4, "wound": 14, "special": ["Укол"]},
                                {"name": "Когти", "rating": 2, "damage": 4, "wound": 14, "special": ["Захват"]}],
                    "abilities": ["Боязнь огня", "Змеиная быстрота", "Победный вой"]},
                "pyos_saurona": {"name_ru": "Пёс Саурона", "distinctive": ["Смелость", "Свирепость"],
                    "level": 5, "endurance": 20, "might": 2, "hatred": 5, "parry": 1, "armour": 2,
                    "weapons": [{"name": "Клыки", "rating": 3, "damage": 5, "wound": 14, "special": ["Укол"]},
                                {"name": "Когти", "rating": 3, "damage": 5, "wound": 14, "special": ["Захват"]}],
                    "abilities": ["Невероятная стойкость", "Смертельная рана", "Удар страха"]},
            },
        },
        "related": [AD + "format_opisaniya", SHADOW_SRC, FEAT],
        "notes": "Владелец статблоков волков Диких земель (ф.146-147). Vision-assisted: статблоки "
                 "(уровень/выносл/мощь/ненависть/парир/броня/оружие) и способности сверены по скану; "
                 "числа есть в текст-слое и трассируются. Способности — в abilities_glossary "
                 "(описания прозой). Страх → shadow.istochniki_teni (B6); Пронзающий/раунд/позиция/Драка "
                 "→ combat (B4); общая механика врага → adversaries.format_opisaniya.",
    },
    {
        "id": AD + "nedobrye_lyudi", "title": "Недобрые люди",
        "subsystem": "adversaries", "section": "Противники → НЕДОБРЫЕ ЛЮДИ", "pages": [148, 149],
        "quotes": [("недобрые люди Это жестокие личности",
                    "Если является целью атаки, за 1 балл Решимости может сделать бросок при проверке "
                    "этой атаки злополучным.")],
        "summary": "Владелец статблоков недобрых людей — бандитов, мародёров и работорговцев Одиноких "
                   "земель; они не служат Саурону и противостоят героям по обстоятельствам (у них "
                   "Решимость, а не Ненависть). Враждебные южане: Южанин-налётчик (Ур.4, Выносл 16, Мощь "
                   "1, Решим 4, Парир +1, Броня 2; Топор 3 (5/18), Короткое копьё 2 (3/14, Укол); "
                   "Свирепость); Предводитель южан (Ур.5, Выносл 20, Мощь 1, Решим 5, Парир +2, Броня 3; "
                   "Копьё 3 (4/14, Укол), Секира 3 (6/18, Сокрушение щита); Свирепость). Бандиты: "
                   "Разбойник (Ур.2, Выносл 8, Мощь 1, Решим 2, Парир —, Броня 1; Жезл 2 (3/12), Лук 2 "
                   "(3/14, Укол); Трус); Главарь бандитов (Ур.3, Выносл 12, Мощь 1, Решим 3, Парир +1, "
                   "Броня 2; Короткий меч 3 (3/16), Лук 2 (3/14, Укол); Победный клич); Дорожный "
                   "грабитель (Ур.4, Выносл 16, Мощь 1, Решим 4, Парир —, Броня 2; Копьё 3 (4/14, Укол), "
                   "Лук 2 (3/14, Укол); Змеиная быстрота).",
        "parameters": {
            "intro": "bandits, marauders and slavers of the Lone-lands; not Sauron's servants; oppose by circumstance (Resolve, not Hatred)",
            "abilities_glossary": {
                "Свирепость": "for 1 Resolve, gains one die and makes the attack check favoured",
                "Трус": "if «Запугать врага» is successfully used on it, it loses 1 more Resolve",
                "Победный клич": "for 1 Resolve, restores 1 Resolve to every other bandit in the fight",
                "Змеиная быстрота": "if targeted by an attack, may spend 1 Resolve to make that attack check ill-fated",
            },
            "enemies": {
                "yuzhanin_naletchik": {"name_ru": "Южанин-налётчик", "distinctive": ["Практичность", "Чёрствость"],
                    "level": 4, "endurance": 16, "might": 1, "resolve": 4, "parry": 1, "armour": 2,
                    "weapons": [{"name": "Топор", "rating": 3, "damage": 5, "wound": 18, "special": []},
                                {"name": "Короткое копьё", "rating": 2, "damage": 3, "wound": 14, "special": ["Укол"]}],
                    "abilities": ["Свирепость"]},
                "predvoditel_yuzhan": {"name_ru": "Предводитель южан", "distinctive": ["Жестокость", "Стойкость"],
                    "level": 5, "endurance": 20, "might": 1, "resolve": 5, "parry": 2, "armour": 3,
                    "weapons": [{"name": "Копьё", "rating": 3, "damage": 4, "wound": 14, "special": ["Укол"]},
                                {"name": "Секира", "rating": 3, "damage": 6, "wound": 18, "special": ["Сокрушение щита"]}],
                    "abilities": ["Свирепость"]},
                "razboynik": {"name_ru": "Разбойник", "distinctive": ["Подозрительность", "Прыткость"],
                    "level": 2, "endurance": 8, "might": 1, "resolve": 2, "parry": None, "armour": 1,
                    "weapons": [{"name": "Жезл", "rating": 2, "damage": 3, "wound": 12, "special": []},
                                {"name": "Лук", "rating": 2, "damage": 3, "wound": 14, "special": ["Укол"]}],
                    "abilities": ["Трус"]},
                "glavar_banditov": {"name_ru": "Главарь бандитов", "distinctive": ["Безжалостность", "Замкнутость"],
                    "level": 3, "endurance": 12, "might": 1, "resolve": 3, "parry": 1, "armour": 2,
                    "weapons": [{"name": "Короткий меч", "rating": 3, "damage": 3, "wound": 16, "special": []},
                                {"name": "Лук", "rating": 2, "damage": 3, "wound": 14, "special": ["Укол"]}],
                    "abilities": ["Победный клич"]},
                "dorozhnyy_grabitel": {"name_ru": "Дорожный грабитель", "distinctive": ["Быстрота", "Мстительность"],
                    "level": 4, "endurance": 16, "might": 1, "resolve": 4, "parry": None, "armour": 2,
                    "weapons": [{"name": "Копьё", "rating": 3, "damage": 4, "wound": 14, "special": ["Укол"]},
                                {"name": "Лук", "rating": 2, "damage": 3, "wound": 14, "special": ["Укол"]}],
                    "abilities": ["Змеиная быстрота"]},
            },
        },
        "related": [AD + "format_opisaniya", FEAT],
        "notes": "Владелец статблоков недобрых людей (ф.148-149). Vision-assisted: статблоки и "
                 "способности сверены по скану; числа в текст-слое трассируются. У всех — Решимость "
                 "(не Ненависть): убийство — возможный Проступок (см. format_opisaniya). «Запугать "
                 "врага»/Пронзающий → combat (B4); механика врага → adversaries.format_opisaniya.",
    },
    {
        "id": AD + "nezhit", "title": "Нежить",
        "subsystem": "adversaries", "section": "Противники → НЕЖИТЬ", "pages": [150, 151],
        "quotes": [("нежить Множество ужасов обитает",
                    "Укус 3 (3/14, Укол), Когти 2 (3/14, Захват) СПОСОБНОСТИ ВРАГА: Боязнь огня. В начале "
                    "каждого раунда, когда находится в ближнем бою с врагом, держащим факел или иной "
                    "горящий предмет, теряет 1 балл Ненависти. Ненависть к солнечному свету. Теряет 1 "
                    "балл Ненависти в начале каждого раунда, в котором находится под прямыми солнечными "
                    "лучами.")],
        "summary": "Владелец статблоков нежити. Вся нежить обладает общими способностями: Бездушие "
                   "(«Запугать врага» не действует без волшебного успеха), Бессмертность (за 1 балл "
                   "Ненависти отменяет ранение или полностью восстанавливает Выносливость при уроне до "
                   "0; не действует против волшебного оружия, гибельного для нежити), Ужасное создание (в "
                   "начале первого раунда герои в поле зрения получают 3 балла Тени (Страх)). Статблоки: "
                   "Могильное умертвие (Ур.6, Выносл 24, Мощь 1, Ненависть 6, Парир —, Броня 3; Древний "
                   "меч 3 (5/16, Укол), Ледяное касание 2 (6/12, Захват); Ненависть к солнечному свету, "
                   "Обитатель тьмы, Ужасные заклинания); Свирепый призрак (Ур.4, Выносл 16, Мощь 1, "
                   "Ненависть 4, Парир +1, Броня 2; Выщербленный клинок 3 (4/16), Безжалостное копьё 2 "
                   "(4/14, Укол); Боязнь огня, Обитатель тьмы); Болотная тварь (Ур.3, Выносл 12, Мощь 1, "
                   "Ненависть 3, Парир —, Броня 1; Укус 3 (3/14, Укол), Когти 2 (3/14, Захват); Боязнь "
                   "огня, Ненависть к солнечному свету).",
        "parameters": {
            "general_abilities": ["Бездушие", "Бессмертность", "Ужасное создание"],
            "abilities_glossary": {
                "Бездушие": "«Запугать врага» does not affect it unless the performer gets a magic success",
                "Бессмертность": "for 1 Hatred may cancel a wound; if damage would drop its Endurance to 0, for 1 Hatred it may fully restore its Endurance; does not work against magic weapons deadly to undead",
                "Ужасное создание": "at the start of the first round, heroes in sight gain 3 Shadow (Fear); those who fail the Shadow check cannot spend Hope until the fight ends",
                "Ненависть к солнечному свету": "loses 1 Hatred at the start of each round it is in direct sunlight",
                "Обитатель тьмы": "while it is in darkness, all its attack checks are favoured",
                "Ужасные заклинания": "for 1 Hatred, one hero gains 3 Shadow (Sorcery); if the target is ill-fated or fails the Shadow check, it falls unconscious (revived by a successful ВЫСТУПЛЕНИЕ check, else after 1 hour)",
                "Боязнь огня": "loses 1 Hatred at the start of each round it is in melee with a foe holding a torch or burning item",
            },
            "enemies": {
                "mogilnoe_umertvie": {"name_ru": "Могильное умертвие", "distinctive": ["Остроумие", "Мстительность"],
                    "level": 6, "endurance": 24, "might": 1, "hatred": 6, "parry": None, "armour": 3,
                    "weapons": [{"name": "Древний меч", "rating": 3, "damage": 5, "wound": 16, "special": ["Укол"]},
                                {"name": "Ледяное касание", "rating": 2, "damage": 6, "wound": 12, "special": ["Захват"]}],
                    "abilities": ["Ненависть к солнечному свету", "Обитатель тьмы", "Ужасные заклинания"]},
                "svirepyy_prizrak": {"name_ru": "Свирепый призрак", "distinctive": ["Быстрота", "Подозрительность"],
                    "level": 4, "endurance": 16, "might": 1, "hatred": 4, "parry": 1, "armour": 2,
                    "weapons": [{"name": "Выщербленный клинок", "rating": 3, "damage": 4, "wound": 16, "special": []},
                                {"name": "Безжалостное копьё", "rating": 2, "damage": 4, "wound": 14, "special": ["Укол"]}],
                    "abilities": ["Боязнь огня", "Обитатель тьмы"]},
                "bolotnaya_tvar": {"name_ru": "Болотная тварь", "distinctive": ["Свирепость", "Незаметность"],
                    "level": 3, "endurance": 12, "might": 1, "hatred": 3, "parry": None, "armour": 1,
                    "weapons": [{"name": "Укус", "rating": 3, "damage": 3, "wound": 14, "special": ["Укол"]},
                                {"name": "Когти", "rating": 2, "damage": 3, "wound": 14, "special": ["Захват"]}],
                    "abilities": ["Боязнь огня", "Ненависть к солнечному свету"]},
            },
        },
        "related": [AD + "format_opisaniya", SHADOW_SRC, FEAT],
        "notes": "Владелец статблоков нежити (ф.150-151). Vision-assisted: статблоки и способности "
                 "сверены по скану; числа в текст-слое трассируются. Общие способности (Бездушие/"
                 "Бессмертность/Ужасное создание) и пер-враг — в abilities_glossary. Страх/Колдовство → "
                 "shadow.istochniki_teni (B6); «Запугать врага»/Пронзающий/гибельное оружие → combat (B4) "
                 "и treasure.volshebnye_nagrady; яд (стр.134) → combat; механика врага → "
                 "adversaries.format_opisaniya.",
    },
    {
        "id": AD + "orki", "title": "Орки",
        "subsystem": "adversaries", "section": "Противники → ОРКИ", "pages": [152, 154],
        "quotes": [("орки Орки — злобная разумная раса",
                    "Если кто-то успешно применил к орку-солдату боевую задачу «Запугать врага», "
                    "орк-солдат теряет ещё и 1 балл Ненависти.")],
        "summary": "Владелец статблоков орков. Некоторым оркам хранитель может добавить общую способность "
                   "Вражда (с кем-то) (все броски атак против объекта вражды благополучные), и у всех "
                   "орков есть Ненависть к солнечному свету (теряет 1 балл Ненависти в начале раунда под "
                   "прямыми лучами). Великие орки: Великий орк-главарь (Ур.7, Выносл 48, Мощь 2, "
                   "Ненависть 7, Парир +3, Броня 4; Тяжёлый ятаган 3 (5/18, Сокрушение щита), Копьё с "
                   "широким наконечником 3 (5/16, Укол); Змеиная быстрота, Победный клич, Ужасающая сила); "
                   "Великий орк-телохранитель (Ур.6, Выносл 24, Мощь 2, Ненависть 6, Парир +2, Броня 3; "
                   "Орочий топор 3 (5/18, Сокрушение щита), Копьё с широким наконечником 3 (5/16, Укол); "
                   "Невероятная стойкость). Орки Севера: Гоблин-лучник (Ур.2, Выносл 8, Мощь 1, Ненависть "
                   "2, Парир —, Броня 1; Составной лук 3 (3/14, Укол), Зазубренный нож 2 (2/14); Орочий "
                   "яд, Трус); Орк-вождь (Ур.5, Выносл 20, Мощь 1, Ненависть 5, Парир +3, Броня 3; Ятаган "
                   "3 (3/16), Копьё 3 (3/14, Укол); Гигантский прыжок, Змеиная быстрота, Победный клич); "
                   "Орк-страж (Ур.4, Выносл 16, Мощь 1, Ненависть 4, Парир +2, Броня 3; Ятаган 3 (3/16), "
                   "Копьё 3 (3/14, Укол); без особых способностей); Орк-солдат (Ур.3, Выносл 12, Мощь 1, "
                   "Ненависть 3, Парир +1, Броня 2; Ятаган 3 (3/16), Копьё 2 (3/14, Укол); Трус).",
        "parameters": {
            "general_abilities": ["Вражда", "Ненависть к солнечному свету"],
            "abilities_glossary": {
                "Вражда": "all attack checks against the enmity's object are favoured (keeper names the people, e.g. dwarves or hobbits)",
                "Ненависть к солнечному свету": "loses 1 Hatred at the start of each round it is in direct sunlight",
                "Змеиная быстрота": "if targeted by an attack, may spend 1 Hatred to make that attack check ill-fated",
                "Победный клич": "for 1 Hatred, restores 1 Hatred to every other orc in the fight",
                "Ужасающая сила": "on a Piercing blow in melee, may spend 1 Hatred to make the target's PROTECTION check ill-fated",
                "Невероятная стойкость": "immune to unarmed attacks; damage that would drop its Endurance to 0 instead Pierces; if it survives, it restores half its maximum Endurance",
                "Орочий яд": "if its attack wounds, the target is also poisoned (стр.134 on poison)",
                "Трус": "if «Запугать врага» is successfully used on it, it loses 1 more Hatred",
                "Гигантский прыжок": "for 1 Hatred, may attack a hero in any combat position, even ranged",
            },
            "enemies": {
                "velikiy_ork_glavar": {"name_ru": "Великий орк-главарь", "distinctive": ["Остроумие", "Смелость"],
                    "level": 7, "endurance": 48, "might": 2, "hatred": 7, "parry": 3, "armour": 4,
                    "weapons": [{"name": "Тяжёлый ятаган", "rating": 3, "damage": 5, "wound": 18, "special": ["Сокрушение щита"]},
                                {"name": "Копьё с широким наконечником", "rating": 3, "damage": 5, "wound": 16, "special": ["Укол"]}],
                    "abilities": ["Змеиная быстрота", "Победный клич", "Ужасающая сила"]},
                "velikiy_ork_telohranitel": {"name_ru": "Великий орк-телохранитель", "distinctive": ["Свирепость", "Подозрительность"],
                    "level": 6, "endurance": 24, "might": 2, "hatred": 6, "parry": 2, "armour": 3,
                    "weapons": [{"name": "Орочий топор", "rating": 3, "damage": 5, "wound": 18, "special": ["Сокрушение щита"]},
                                {"name": "Копьё с широким наконечником", "rating": 3, "damage": 5, "wound": 16, "special": ["Укол"]}],
                    "abilities": ["Невероятная стойкость"]},
                "goblin_luchnik": {"name_ru": "Гоблин-лучник", "distinctive": ["Остроглазость", "Остроумие"],
                    "level": 2, "endurance": 8, "might": 1, "hatred": 2, "parry": None, "armour": 1,
                    "weapons": [{"name": "Составной лук", "rating": 3, "damage": 3, "wound": 14, "special": ["Укол"]},
                                {"name": "Зазубренный нож", "rating": 2, "damage": 2, "wound": 14, "special": []}],
                    "abilities": ["Орочий яд", "Трус"]},
                "ork_vozhd": {"name_ru": "Орк-вождь", "distinctive": ["Жестокость", "Чёрствость"],
                    "level": 5, "endurance": 20, "might": 1, "hatred": 5, "parry": 3, "armour": 3,
                    "weapons": [{"name": "Ятаган", "rating": 3, "damage": 3, "wound": 16, "special": []},
                                {"name": "Копьё", "rating": 3, "damage": 3, "wound": 14, "special": ["Укол"]}],
                    "abilities": ["Гигантский прыжок", "Змеиная быстрота", "Победный клич"]},
                "ork_strazh": {"name_ru": "Орк-страж", "distinctive": ["Внимательность", "Могучесть"],
                    "level": 4, "endurance": 16, "might": 1, "hatred": 4, "parry": 2, "armour": 3,
                    "weapons": [{"name": "Ятаган", "rating": 3, "damage": 3, "wound": 16, "special": []},
                                {"name": "Копьё", "rating": 3, "damage": 3, "wound": 14, "special": ["Укол"]}],
                    "abilities": []},
                "ork_soldat": {"name_ru": "Орк-солдат", "distinctive": ["Мятежность", "Мстительность"],
                    "level": 3, "endurance": 12, "might": 1, "hatred": 3, "parry": 1, "armour": 2,
                    "weapons": [{"name": "Ятаган", "rating": 3, "damage": 3, "wound": 16, "special": []},
                                {"name": "Копьё", "rating": 2, "damage": 3, "wound": 14, "special": ["Укол"]}],
                    "abilities": ["Трус"]},
            },
        },
        "related": [AD + "format_opisaniya", FEAT],
        "notes": "Владелец статблоков орков (ф.152-154). Vision-assisted: 6 статблоков и способности "
                 "сверены по скану; числа в текст-слое трассируются. Орк-страж — без особых способностей. "
                 "Вражда/Пронзающий/«Запугать врага»/яд (стр.134) → combat (B4) и shadow; механика врага "
                 "→ adversaries.format_opisaniya.",
    },
    {
        "id": AD + "trolli", "title": "Тролли",
        "subsystem": "adversaries", "section": "Противники → ТРОЛЛИ", "pages": [155, 157],
        "quotes": [("тролли Великий Враг вывел троллей",
                    "восстанавливает по 1 баллу Ненависти всем другим троллям в бою. Ужасающая сила. "
                    "Нанеся Пронзающий удар при атаке в ближнем бою, может потратить 1 балл Ненависти, "
                    "чтобы сделать бросок при проверке ЗАЩИТЫ цели злополучным.")],
        "summary": "Владелец статблоков троллей. У всех троллей общие способности: Невероятная стойкость "
                   "(невосприимчив к безоружным атакам; урон до 0 наносит Пронзающий удар, после чего "
                   "тролль восстанавливает половину максимальной Выносливости) и Недалёкость (герой на "
                   "передовой проверяет ЗАГАДКИ основным действием раунда: при успехе тролль теряет 1 "
                   "балл Ненависти и ещё по 1 за каждый знак успеха). Пещерные тролли: Великий пещерный "
                   "тролль (Ур.10, Выносл 80, Мощь 2, Ненависть 10, Парир —, Броня 3; Сокрушение 3 (6/12, "
                   "Захват), Укус 2 (6/14, Укол); Толстая шкура, Удар страха); Пещерный тролль-скрытень "
                   "(Ур.6, Выносл 50, Мощь 2, Ненависть 6, Парир —, Броня 3; Дубина 3 (6/16, Сокрушение "
                   "щита), Укус 2 (6/14, Укол); Боязнь огня, Обитатель тьмы, Толстая шкура). Каменные "
                   "тролли: Каменный тролль-грабитель (Ур.8, Выносл 60, Мощь 2, Ненависть 8, Парир —, "
                   "Броня 3; Дубина 3 (6/16, Сокрушение щита), Сокрушение 2 (6/12, Захват); Вражда "
                   "(гномы), Ужасающая сила); Каменный тролль-главарь (Ур.9, Выносл 70, Мощь 2, Ненависть "
                   "9, Парир —, Броня 3; Дубина 3 (6/16, Сокрушение щита), Сокрушение 2 (6/12, Захват); "
                   "Вражда (гномы), Победный клич, Ужасающая сила).",
        "parameters": {
            "general_abilities": ["Невероятная стойкость", "Недалёкость"],
            "abilities_glossary": {
                "Невероятная стойкость": "immune to unarmed attacks; damage that would drop its Endurance to 0 instead Pierces; if it survives, it restores half its maximum Endurance",
                "Недалёкость": "a hero in the front may take a special combat task: roll ЗАГАДКИ as the round's main action; on a success the troll loses 1 Hatred, plus 1 more per success-sign rolled",
                "Толстая шкура": "for 1 Hatred, may gain +2 dice on its PROTECTION check",
                "Удар страха": "for 1 Hatred, all heroes in sight gain 2 Shadow (Fear); those who fail the Shadow check are frightened and cannot spend Hope until the fight ends",
                "Боязнь огня": "loses 1 Hatred at the start of each round it is in melee with a foe holding a torch or burning item",
                "Обитатель тьмы": "while it is in darkness, all its attack checks are favoured",
                "Вражда": "in a fight against dwarves all its checks are favoured (keeper names the people)",
                "Победный клич": "for 1 Hatred, restores 1 Hatred to every other troll in the fight",
                "Ужасающая сила": "on a Piercing blow in melee, may spend 1 Hatred to make the target's PROTECTION check ill-fated",
            },
            "enemies": {
                "velikiy_peshchernyy_troll": {"name_ru": "Великий пещерный тролль", "distinctive": ["Звероподобность", "Злобность"],
                    "level": 10, "endurance": 80, "might": 2, "hatred": 10, "parry": None, "armour": 3,
                    "weapons": [{"name": "Сокрушение", "rating": 3, "damage": 6, "wound": 12, "special": ["Захват"]},
                                {"name": "Укус", "rating": 2, "damage": 6, "wound": 14, "special": ["Укол"]}],
                    "abilities": ["Толстая шкура", "Удар страха"]},
                "peshchernyy_troll_skryten": {"name_ru": "Пещерный тролль-скрытень", "distinctive": ["Незаметность", "Подозрительность"],
                    "level": 6, "endurance": 50, "might": 2, "hatred": 6, "parry": None, "armour": 3,
                    "weapons": [{"name": "Дубина", "rating": 3, "damage": 6, "wound": 16, "special": ["Сокрушение щита"]},
                                {"name": "Укус", "rating": 2, "damage": 6, "wound": 14, "special": ["Укол"]}],
                    "abilities": ["Боязнь огня", "Обитатель тьмы", "Толстая шкура"]},
                "kamennyy_troll_grabitel": {"name_ru": "Каменный тролль-грабитель", "distinctive": ["Голод", "Раздражительность"],
                    "level": 8, "endurance": 60, "might": 2, "hatred": 8, "parry": None, "armour": 3,
                    "weapons": [{"name": "Дубина", "rating": 3, "damage": 6, "wound": 16, "special": ["Сокрушение щита"]},
                                {"name": "Сокрушение", "rating": 2, "damage": 6, "wound": 12, "special": ["Захват"]}],
                    "abilities": ["Вражда", "Ужасающая сила"]},
                "kamennyy_troll_glavar": {"name_ru": "Каменный тролль-главарь", "distinctive": ["Жестокость", "Подозрительность"],
                    "level": 9, "endurance": 70, "might": 2, "hatred": 9, "parry": None, "armour": 3,
                    "weapons": [{"name": "Дубина", "rating": 3, "damage": 6, "wound": 16, "special": ["Сокрушение щита"]},
                                {"name": "Сокрушение", "rating": 2, "damage": 6, "wound": 12, "special": ["Захват"]}],
                    "abilities": ["Вражда", "Победный клич", "Ужасающая сила"]},
            },
        },
        "related": [AD + "format_opisaniya", SHADOW_SRC, FEAT],
        "notes": "Владелец статблоков троллей (ф.155-157). Vision-assisted: 4 статблока и способности "
                 "сверены по скану; числа в текст-слое трассируются. Общие (Невероятная стойкость/"
                 "Недалёкость) и пер-враг — в abilities_glossary. Страх → shadow.istochniki_teni (B6); "
                 "Недалёкость использует ЗАГАДКИ → checks; Пронзающий/раунд → combat (B4); механика врага "
                 "→ adversaries.format_opisaniya.",
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
    print(f"{n} B9 cards written; {len(list(OUT.glob('*.json')))} total in mechanics/")


if __name__ == "__main__":
    main()
