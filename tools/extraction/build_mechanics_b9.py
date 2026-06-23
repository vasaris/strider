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
