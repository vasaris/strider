"""Build rule cards for B7 (КВ глава «Око Мордора», pages 169-173; subsystem eye).

THROWAWAY STAGE-0 TOOLING. Same contract as build_mechanics_b4..b6: every
source_text quote is CUT from the КВ core text layer by a (start, end_incl)
anchor pair over whitespace-normalized text — never retyped (gate 1 / ADR-002).
summary/parameters are engine annotations; numbers trace to the cut source_text
(check_param_numbers); table columns are flagged ⚠ for human gate 2b.

3 cards 1:1 with the rubricator of «Око Мордора» (ch.9):
  ОКО МОРДОРА / Бдительность Ока / Преследование.

OWNS (subsystem eye): eye-awareness (starting composition table + valour>=4 and
famous-gear bonuses; growth: eyes-gaze / magic / shadow; reset); the Hunt
(threshold-by-terrain + modifiers; discovery scenes + 10 example outcomes).

⚠ SOURCE-FIDELITY FLAG (gate 2a #1, ВЗОР ОКА, folio 170): the text says eye-
awareness rises "когда ... выпадает знак" (a *sign*), NOT "Око" (the Eye). By
the book's own glossary "знак" == знак успеха (success sign ✶); "знак Ока" never
occurs, the Eye is always "Око". The die is unspecified and the effect is
consequential, so the referent (success-sign ✶ vs Eye; which die) is encoded
LITERALLY from the source and flagged for human resolution — NOT silently
substituted with "Eye" from outside knowledge.

JOIN CONTRACT — NO CHURN: shadow growth -> shadow.bally_teni (B6); VALOUR ->
valour_wisdom.doblest; sign -> checks.feat_die_values; discovery-scene examples
cross-ref council (B5), shadow (B6), weariness (B2.1). Forward refs (notes
only): famous weapons/armour -> treasure (B8); enemy Hatred/Resolve, enmity,
enemy abilities -> adversaries (B9).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parents[1] / "content-packs" / "kv" / "mechanics"
LAYER = (HERE / "source_kv" / "kv_core.txt").read_text(encoding="utf-8")
NORM = re.sub(r"\s+", " ", LAYER.replace("\u0002", "")).strip()

EY = "kv.mechanics.eye."
VAL = "kv.mechanics.valour_wisdom.doblest"
SHADOW = "kv.mechanics.shadow.bally_teni"
FEAT = "kv.mechanics.checks.feat_die_values"


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
        "id": EY + "oko_mordora", "title": "Око Мордора",
        "subsystem": "eye", "section": "Око Мордора → ОКО МОРДОРА", "pages": [169],
        "quotes": [("око мордора «Численность должна быть малой, ведь ваша надежда",
                    "Враг обращает враждебные силы мира против группы героев игроков.")],
        "summary": "Вступление к главе: с Закатом Третьей эпохи воля Тёмного Повелителя подталкивает "
                   "злые силы к дурным деяниям, шпионы Врага действуют повсюду. Привлечёт ли отряд "
                   "внимание Ока — определяется Бдительностью Ока (рейтинг интереса Врага, меняется от "
                   "поступков и перемещений героев и отслеживается всю кампанию); при достижении "
                   "рейтингом определённого предела начинается Преследование, символизирующее то, как "
                   "Враг обращает враждебные силы мира против отряда.",
        "parameters": {"is_intro": True,
                       "concepts": {"eye_awareness": "rating_of_enemy_interest_in_the_company",
                                    "hunt": "triggered_when_awareness_reaches_threshold"}},
        "related": [EY + "bditelnost_oka", EY + "presledovanie"],
        "notes": "",
    },
    {
        "id": EY + "bditelnost_oka", "title": "Бдительность Ока",
        "subsystem": "eye", "section": "Око Мордора → Бдительность Ока", "pages": [169, 172],
        "quotes": [("бдительность ока В целом уровень Бдительности Ока определяется",
                    "Бдительность Ока вновь устанавливается на начальный рейтинг.")],
        "summary": "Владелец Бдительности Ока. Это необязательные правила (вводить позже, когда отряд "
                   "опытен; для отслеживания удобны ~20 жетонов). Начальный рейтинг определяется в "
                   "начале каждой Фазы приключений по составу отряда (таблица: только хоббиты и люди 0; "
                   "хотя бы один гном 1; хотя бы один дунэдайн или эльф 2; хотя бы один высший эльф 3 — "
                   "берётся только самый высокий подходящий вариант), плюс 1 за каждого героя с "
                   "ДОБЛЕСТЬЮ ≥ 4 и плюс 1 за каждое Знаменитое оружие или броню. Рост: ВЗОР ОКА "
                   "(увеличение на 1 при выпадении знака вне боя, независимо от результата; в особо "
                   "напряжённой ситуации — на 2 и более, в безопасном месте — может не расти); "
                   "ПРИМЕНЕНИЕ ВОЛШЕБСТВА (малый эффект +1, мощное заклинание +2, могущественное +3); "
                   "УСИЛЕНИЕ ТЕНИ (+N за каждый балл Тени, полученный героем вне боя). Сброс: в Фазе "
                   "братства учёт приостанавливается, в начале новой Фазы приключений рейтинг "
                   "возвращается к начальному.",
        "parameters": {
            "optional_rule": True,
            "tokens_typical": 20,
            "starting_rating": {
                "determined": "at_start_of_each_adventuring_phase",
                "composition_table": {
                    "only_hobbits_and_men": 0, "one_or_more_dwarf": 1,
                    "one_or_more_dunadan_or_elf": 2, "one_or_more_high_elf": 3,
                    "rule": "use_only_highest_applicable",
                },
                "plus_one_per_hero_with_valour_ge_4": True,
                "plus_one_per_famous_weapon_or_armour": True,
            },
            "growth": {
                "eyes_gaze": {
                    "trigger": "eye_on_feat_die out_of_combat",
                    "amount": 1, "tense_situation": "two_or_more", "safe_place": 0,
                },
                "use_of_magic": {"minor_effect": 1, "powerful_spell": 2, "mighty_spell": 3},
                "shadow_growth": "plus_one_per_shadow_point_gained_out_of_combat",
            },
            "reset": {"paused_during": "fellowship_phase",
                      "back_to_starting_at": "start_of_next_adventuring_phase"},
        },
        "related": [EY + "oko_mordora", EY + "presledovanie", VAL, SHADOW, FEAT],
        "notes": "Владелец Бдительности Ока. Референт «знака» в триггере ВЗОР ОКА = Око (Кость "
                 "испытания), установлен по книге без скана: самоопределение «Знак … равен 0» = Око; "
                 "«выпадает знак» в книге = Око (5/5, 0 контрпримеров); «независимо от результата "
                 "проверки» = result-independent (поведение Ока); заголовок ВЗОР ОКА/ОКО МОРДОРА + "
                 "канон TOR2e. Закодировано как eye_on_feat_die (зеркало conditions.miserable). "
                 "Знаменитое оружие/броня → treasure (B8, форвард-реф).",
    },
    {
        "id": EY + "presledovanie", "title": "Преследование",
        "subsystem": "eye", "section": "Око Мордора → Преследование", "pages": [172, 173],
        "quotes": [("преследование В зависимости от поступков героев игроков",
                    "Пришли уничтожать. Один из типов врагов, с которым отряду предстоит сражаться "
                    "в ближайшем бою, получает: СПОСОБНОСТЬ ВРАГА. Смертельная рана. Раненая цель "
                    "совершает злополучный бросок Кости испытания, чтобы определить тяжесть своего "
                    "ранения.")],
        "summary": "Владелец Преследования. Порог преследования зависит от местности (таблица: "
                   "Пограничные земли 18, Дикие земли 16, Тёмные земли 14) и изменяется модификаторами "
                   "(+4 под благословением Волшебника или сильного ПХ; +2 за ложные имена, редкие тропы "
                   "или скрытность; −2 за громкую славу в этих местах; −4 если Враг активно ищет отряд "
                   "или знает о его задании). Пока Бдительность Ока меньше Порога — отряд незамечен; при "
                   "Бдительности ≥ Порога отряд обнаружен, и хранитель вводит сцену обнаружения — "
                   "опасное происшествие, логично вытекающее из сессии и создающее впечатление "
                   "незримых сил. После сцены отряд снова скрыт, Бдительность сбрасывается к "
                   "начальному рейтингу, и счёт продолжается до конца Фазы приключений. Приведены 10 "
                   "примеров эффектов сцены обнаружения, которые хранитель подстраивает под ситуацию.",
        "parameters": {
            "hunt_threshold": {
                "by_terrain": {"border_lands": 18, "wild_lands": 16, "dark_lands": 14},
                "modifiers": {"blessed_by_wizard_or_strong_npc": 4, "false_names_or_stealth": 2,
                              "great_fame_here": -2, "enemy_actively_hunting": -4},
            },
            "compare": {"below_threshold": "unnoticed", "at_or_above_threshold": "discovered"},
            "discovery_scene": {
                "is": "dangerous_event",
                "must": ["follow_logically_from_session", "feel_like_unseen_forces"],
                "after": {"hidden_again": True, "eye_awareness_reset_to_starting": True},
                "repeats_until": "end_of_adventuring_phase",
                "examples": {
                    "out_of_the_frying_pan": {"n": 1, "effect": "all_checks_-1d for one journey leg or next scene"},
                    "bearer_of_ill_news": {"n": 2, "effect": "council harder: reasonable->bold, bold->audacious"},
                    "tempt_me_not": {"n": 3, "effect": "hero gains 3 shadow (greed), per shadow path"},
                    "deceit_and_threats": {"n": 4, "effect": "an ally becomes an enemy"},
                    "weariness_of_heart": {"n": 5, "effect": "all heroes become weary"},
                    "will_lending_strength": {"n": 6, "effect": "captive escapes or pursuers catch up"},
                    "led_by_sinister_will": {"n": 7, "effect": "an avoidable threat becomes real"},
                    "unbridled_hatred": {"n": 8, "effect": "one enemy type gains enmity vs a present culture"},
                    "deadly_struggle": {"n": 9, "effect": "enemy starts with extra Hatred/Resolve = success-die roll"},
                    "come_to_destroy": {"n": 10, "effect": "one enemy type gains the Deadly-wound ability"},
                },
            },
        },
        "related": [EY + "bditelnost_oka", "kv.mechanics.council.zavershenie_soveta",
                    SHADOW, "kv.mechanics.endurance_hope.vynoslivost"],
        "notes": "Владелец Преследования. Таблицы местности (18/16/14) и модификаторов (±4/±2) "
                 "читаются — подтверждающий 2b. Местность здесь Eye-специфичная (Пограничные/Дикие/"
                 "Тёмные земли), отдельно от сложного рельефа путешествия (journey.poryadok). Сцена "
                 "обнаружения — нарративная импровизация; примеры ссылаются на Совет (B5), Тень (B6), "
                 "усталость (B2.1). Ненависть/Решимость, Вражда, Способности врага — Противники (B9, "
                 "форвард-реф).",
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
    print(f"{n} B7 cards written; {len(list(OUT.glob('*.json')))} total in mechanics/")


if __name__ == "__main__":
    main()
