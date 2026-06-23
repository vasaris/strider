"""Build rule cards for B2.1 block (subsystems `checks` remainder + `conditions`).

THROWAWAY TOOLING (stage 0, session 3a, batch 2.1). Same contract as
build_mechanics_pilot.py: quotes are CUT from the КВ core text layer by
(start, end_incl) anchor pairs over whitespace-normalized text — never
retyped — so gate 1 (text-fidelity, ADR-002) holds by construction.
`end_incl` is searched AFTER the start offset, so only the start anchor must be
globally distinctive. summary/parameters are engine annotations, verified
semantically by gate 2a; numeric parameters are checked against pages by 2b.

This block covers the `checks` skeletons NOT already curated in the pilot
(8 duplicates dropped), the 6-way split of the composite `modifikatory_broska`
skeleton, and the 4 `conditions` cards. The `hero_creation` core is B2.1 part 2.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parents[1] / "content-packs" / "kv" / "mechanics"
LAYER = (HERE / "source_kv" / "kv_core.txt").read_text(encoding="utf-8")
NORM = re.sub(r"\s+", " ", LAYER.replace("\u0002", "")).strip()

SEC_DO = "Выполнение действий"
SEC_CHK = f"{SEC_DO} → Выполнение проверок"
SEC_MOD = f"{SEC_DO} → Модификаторы броска"
SEC_ST = f"{SEC_DO} → Состояния"


def cut(start: str, end_incl: str) -> str:
    i = NORM.find(start)
    if i < 0:
        raise ValueError(f"start anchor not found: {start[:60]!r}")
    if NORM.count(start) > 1:
        # distinctive starts only; surface accidental ambiguity loudly
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


CARDS = [
    # ---- checks: remaining non-pilot cards ----
    {
        "id": "kv.mechanics.checks.dice_set",
        "title": "Игральные кости", "section": f"{SEC_DO} → Игральные кости",
        "pages": [16], "subsystem": "checks",
        "quotes": [("В НРИ «Кольцо Всевластья» используется особый набор игральных костей",
                    "может принести на игру свой собственный набор.")],
        "summary": "Набор КВ: 6 шестигранников (Кости успеха) и 2 двенадцатигранника с особыми знаками (Кости испытания); специальные наборы продаются отдельно.",
        "parameters": {"success_dice": {"die": "d6", "count": 6},
                        "feat_dice": {"die": "d12", "count": 2}},
        "related": ["kv.mechanics.checks.feat_die_values",
                    "kv.mechanics.checks.success_die_values"],
    },
    {
        "id": "kv.mechanics.checks.scene_structure",
        "title": "Краткое описание сцен", "section": f"{SEC_DO} → Краткое описание сцен",
        "pages": [16, 17], "subsystem": "checks",
        "quotes": [("Сцены в НРИ «Кольцо Всевластья» устроены так", "знак успеха.")],
        "summary": "Структура сцены: (1) хранитель описывает требующую решения ситуацию; (2) игроки предлагают решение и описывают действия героев; (3) хранитель либо соглашается, либо требует проверку. При обычных костях: на d12 «11» — Око Саурона, «12» — руна Гэндальфа; на d6 «6» — знак успеха.",
        "parameters": {"scene_steps": 3,
                        "plain_dice_mapping": {"d12_11": "eye", "d12_12": "gandalf_rune",
                                                "d6_6": "success_icon"}},
        "related": ["kv.mechanics.checks.feat_die_values", "kv.mechanics.checks.dice_set"],
    },
    {
        "id": "kv.mechanics.checks.when_required",
        "title": "Когда требуется проверка", "section": f"{SEC_CHK} → Когда требуется проверка",
        "pages": [16], "subsystem": "checks",
        "quotes": [("Если кратко: хранителю следует просить игрока выполнить проверку",
                    "соответствует намерениям самих ПХ (глава 9), проверка не требуется.")],
        "summary": "Проверка нужна, только если действие может провалиться и попадает под один из трёх случаев: ОПАСНОСТЬ (риск при провале), ЗНАНИЕ (искомое сокрыто или тайно), МАНИПУЛЯЦИЯ (влияние на несговорчивых ПХ). Иначе действие автоматически успешно.",
        "parameters": {"triggers": ["danger", "knowledge", "manipulation"],
                        "no_check": "auto_success"},
        "related": ["kv.mechanics.checks.procedure"],
    },
    {
        "id": "kv.mechanics.reference.procedure_steps",
        "title": "Порядок совершения проверки", "section": f"{SEC_CHK} → Порядок совершения проверки",
        "pages": [23, 24], "subsystem": "reference",
        "quotes": [("Если стало ясно, что без проверки не обойтись, надо последовательно выполнить следующие шаги.",
                    "может быть использовано для достижения особого успеха.")],
        "summary": "Пошаговый чеклист проверки: (1) решить цель действия; (2) выбрать способность — сложность по ЦЧ её характеристики; (3) взять 1 Кость испытания (2 при благополучном/злополучном) и Кости успеха по рейтингу, +1к за балл Надежды (2к при вдохновении); (4) бросить — руна даёт автоуспех, у несчастного героя Око даёт автопровал; (5) сложить значения (у усталого героя 1–3 на Костях успеха не засчитываются), сумма ≥ ЦЧ — успех; (6) знаки успеха задают степень и особые успехи.",
        "parameters": {"steps": 6},
        "related": ["kv.mechanics.checks.procedure", "kv.mechanics.checks.target_numbers",
                    "kv.mechanics.checks.degree_of_success"],
        "notes": "Сводный чеклист главы 2; повторяет правила атомарных карточек checks.* в виде последовательности.",
    },
    {
        "id": "kv.mechanics.reference.character_sheet",
        "title": "Бланк героя", "section": f"{SEC_DO} → Бланк героя",
        "pages": [22, 23], "subsystem": "reference",
        "quotes": [("Физические, духовные и умственные характеристики героев",
                    "можно скачать на сайте trideviatoe.ru.")],
        "summary": "Черты и числовые значения героя сведены в бланк героя — заполняемое и обновляемое по мере развития описание. Пустой бланк — на стр. 239 книги; цифровая PDF-версия доступна на trideviatoe.ru.",
        "parameters": {"blank_page": 239},
        "related": ["kv.mechanics.reference.game_terms"],
    },
    {
        "id": "kv.mechanics.reference.game_terms",
        "title": "Игровые термины", "section": f"{SEC_DO} → Игровые термины",
        "pages": [24, 26], "subsystem": "reference",
        "quotes": [("Как видно на примере бланка героя, приведённого на этом развороте",
                    "Ношение героем любого щита повышает его рейтинг Парирования.")],
        "summary": "Сводный глоссарий бланка героя (~40 терминов: рейтинги характеристик, группы навыков, Выносливость, Надежда, Тень, ЦЧ, состояния, награды и др.); канонические определения раскрыты в профильных карточках. Текстовый слой содержит вкрапления подписей полей бланка между колонками (OCR-артефакт верстки, в т.ч. разрыв определения «Награды») — при вычитке игнорировать.",
        "parameters": {"kind": "reference_glossary"},
        "related": ["kv.mechanics.checks.target_numbers", "kv.mechanics.conditions.overview"],
        "notes": "Навигационная сводка; OCR-шум слоя (подписи бланка) сохранён дословно по ADR-002 (принятый риск дефектов слоя в прозе).",
    },
    # ---- checks: 6-way split of composite `modifikatory_broska` ----
    {
        "id": "kv.mechanics.checks.bonus_dice_hope",
        "title": "Бонус к Костям успеха (Надежда, вдохновение)", "section": f"{SEC_MOD} → Бонус к Костям успеха",
        "pages": [20], "subsystem": "checks",
        "quotes": [("БОНУС К КОСТЯМ УСПЕХА Герой игрока может выполнять действие в благоприятных обстоятельствах",
                    "подробнее о Надежде сказано на стр. 71).")],
        "summary": "Бонусные Кости успеха («получите 1к») даются в основном за Надежду или Культурные особенности. Трата 1 балла Надежды = +1к (за раз нельзя потратить несколько баллов ради нескольких костей). Вдохновлённый герой получает вдвое: 1 балл Надежды = 2к. Вдохновение даёт Отличительное качество или ряд Культурных особенностей.",
        "parameters": {"hope_spend": {"cost": 1, "gain": "1d_success", "max_per_roll": 1},
                        "inspired": {"cost": 1, "gain": "2d_success"}},
        "related": ["kv.mechanics.checks.assistance", "kv.mechanics.checks.penalty_dice"],
    },
    {
        "id": "kv.mechanics.checks.assistance",
        "title": "Помощь", "section": f"{SEC_MOD} → Помощь",
        "pages": [20, 21], "subsystem": "checks",
        "quotes": [("ПОМОЩЬ. Герой может попробовать помочь другому члену отряда при проверке навыка.",
                    "чтобы действующий герой получил 1к."),
                   ("Герой игрока может помочь другому, только если позволяют обстоятельства",
                    "хоббит получает 1к к своему броску.")],
        "summary": "Помощь: помогающий тратит 1 балл Надежды, действующий герой получает +1к. Условия: позволяют обстоятельства; у помогающего есть подходящий (на усмотрение хранителя) навык рейтинга выше 0; помочь тратой Надежды может только один герой.",
        "parameters": {"cost": 1, "gain": "1d_success", "helper_skill_min": 1, "max_helpers": 1},
        "related": ["kv.mechanics.checks.bonus_dice_hope"],
    },
    {
        "id": "kv.mechanics.checks.favoured_edge_cases",
        "title": "Благополучный и злополучный: пограничные случаи", "section": f"{SEC_MOD} → Благополучный и злополучный бросок",
        "pages": [20, 21], "subsystem": "checks",
        "quotes": [("БЛАГОПОЛУЧНЫЙ И ЗЛОПОЛУЧНЫЙ БРОСОК. Когда из-за противоречащих друг другу причин",
                    "лишь по одной (и наоборот)."),
                   ("ЗЛОПОЛУЧНЫЕ ГЕРОИ ИГРОКОВ. Иногда способность противника или другое особое правило",
                    "становятся злополучными.")],
        "summary": "Если бросок одновременно благополучен и злополучен (по противоречащим причинам) — делается обычный бросок с одной Костью испытания, даже при перевесе причин в одну сторону. Если особое правило делает злополучным самого героя (а не бросок) — злополучны все его броски; пример: рейтинг Тени равен максимуму Надежды.",
        "parameters": {"both_at_once": "normal_roll_one_feat_die",
                        "ill_favoured_hero": "all_rolls_ill_favoured",
                        "example_trigger": "shadow == hope_max"},
        "related": ["kv.mechanics.checks.favoured_ill_favoured", "kv.mechanics.conditions.miserable"],
        "notes": "Пример «Тень=максимуму Надежды» — это порог «подавлен страхами» (стр. 137): такой герой ОДНОВРЕМЕННО несчастен (Око=автопровал, порог по текущей Надежде, см. conditions.miserable) и злополучен (все броски, 2 Кости испытания худшая). Выход из этого состояния — приступ безумия (стр. 139). Полная карточка порога придёт с shadow (глава «Тень»), НЕ с endurance_hope.",
    },
    {
        "id": "kv.mechanics.checks.penalty_dice",
        "title": "Штраф к Костям успеха", "section": f"{SEC_MOD} → Штраф к Костям успеха",
        "pages": [21], "subsystem": "checks",
        "quotes": [("ШТРАФ К КОСТЯМ УСПЕХА Конечно, игрокам хочется, чтобы удача всегда была на стороне их героев",
                    "какого-то осложнения (глава 6).")],
        "summary": "Штраф («уберите 1к») — бросить на 1 Кость успеха меньше, вплоть до нуля Костей успеха. Обычно отражает ситуативную помеху: невыгодную позицию в бою или иное осложнение.",
        "parameters": {"penalty": "remove_success_dice", "min_success_dice": 0},
        "related": ["kv.mechanics.checks.bonus_penalty_stacking"],
    },
    {
        "id": "kv.mechanics.checks.magical_success",
        "title": "Волшебный успех", "section": f"{SEC_MOD} → Волшебный успех",
        "pages": [21], "subsystem": "checks",
        "quotes": [("ВОЛШЕБНЫЙ УСПЕХ Зачарованные артефакты, такие как волшебные кольца и плащи",
                    "бежать по свежевыпавшему снегу, как по плотному песку."),
                   ("НЕ ТАКАЯ УЖ НЕЗАМЕТНАЯ МАГИЯ Впечатляющий и необычный результат волшебного успеха",
                    "(см. также правила Ока Мордора, стр. 169).")],
        "summary": "При волшебном таланте или артефакте перед проверкой навыка можно потратить 1 балл Надежды на волшебный успех: герой справляется автоматически независимо от ЦЧ; бросаются лишь Кости успеха для определения возможной более высокой степени, сумма чисел не учитывается. Эффект должен быть явно сверхъестественным и может насторожить свидетелей, связывающих волшебство с тёмным колдовством.",
        "parameters": {"cost": 1, "effect": "auto_success_ignore_tn",
                        "roll": "success_dice_for_degree_only", "sum_counts": False},
        "related": ["kv.mechanics.checks.bonus_dice_hope", "kv.mechanics.checks.degree_of_success"],
    },
    {
        "id": "kv.mechanics.checks.bonus_penalty_stacking",
        "title": "Бонусы и штрафы (суммирование)", "section": f"{SEC_MOD} → Бонусы и штрафы",
        "pages": [21], "subsystem": "checks",
        "quotes": [("БОНУСЫ И ШТРАФЫ Бонусы и штрафы суммируются.",
                    "в общей сложности игрок получает 2к к броску.")],
        "summary": "Бонусы и штрафы Костей успеха суммируются: при проверке сначала прибавляются все бонусные кости, затем вычитаются все штрафные. Пример: +1к (помощь) и +2к (вдохновение), убрать 1к (штраф) = +2к к броску.",
        "parameters": {"order": ["add_all_bonuses", "subtract_all_penalties"]},
        "related": ["kv.mechanics.checks.bonus_dice_hope", "kv.mechanics.checks.penalty_dice"],
    },
    # ---- conditions ----
    {
        "id": "kv.mechanics.conditions.overview",
        "title": "Состояния", "section": SEC_ST,
        "pages": [22], "subsystem": "conditions",
        "quotes": [("На проверки влияют три особых состояния, в которых могут быть герои игроков.",
                    "Состояния отмечаются галочкой в соответствующем поле на бланке героя.")],
        "summary": "Три особых состояния влияют на проверки: усталость, ранение и несчастье; каждое отмечается галочкой в соответствующем поле бланка героя.",
        "parameters": {"states": ["weary", "wounded", "miserable"]},
        "related": ["kv.mechanics.conditions.weariness", "kv.mechanics.conditions.wounded",
                    "kv.mechanics.conditions.miserable"],
    },
    {
        "id": "kv.mechanics.conditions.weariness",
        "title": "Усталость", "section": f"{SEC_ST} → Усталость",
        "pages": [22], "subsystem": "conditions",
        "quotes": [("Стойкость героя в игре выражается его рейтингом Выносливости.",
                    "можно узнать на стр. 49 и стр. 69 соответственно.")],
        "summary": "Герой становится усталым, когда его рейтинг Выносливости становится меньше или равен рейтингу Нагрузки. У усталого героя контурные значения (1, 2 или 3) на Костях успеха считаются за 0.",
        "parameters": {"trigger": "endurance <= load",
                        "effect": {"success_die_values_voided": [1, 2, 3]}},
        "related": ["kv.mechanics.conditions.overview"],
    },
    {
        "id": "kv.mechanics.conditions.wounded",
        "title": "Ранение", "section": f"{SEC_ST} → Ранение",
        "pages": [22], "subsystem": "conditions",
        "quotes": [("Серьёзные травмы могут закончиться для героя игрока ранением.",
                    "восстанавливают потерянные баллы Выносливости дольше («Отдых», стр. 71).")],
        "summary": "Ранение — последствие серьёзной Травмы (чаще всего получаемой в бою), более тяжёлое и долгое, чем обычная потеря Выносливости. Раненый герой, продолжая действовать, рискует быть выведенным из строя прямо в бою и дольше восстанавливает Выносливость.",
        "parameters": {"cause": "wound_from_injury", "risk": "taken_out_of_action"},
        "related": ["kv.mechanics.conditions.overview"],
    },
    {
        "id": "kv.mechanics.conditions.miserable",
        "title": "Несчастье", "section": f"{SEC_ST} → Несчастье",
        "pages": [22], "subsystem": "conditions",
        "quotes": [("Гнетущая тяжесть Заката Третьей эпохи, ощущаемая героями игроков",
                    "действие проваливается независимо от общего результата броска.")],
        "summary": "Герой становится несчастным, когда его рейтинг Тени становится равен текущему рейтингу Надежды или превышает его. Если у несчастного героя на Кости испытания выпадает Око — действие проваливается независимо от общей суммы броска.",
        "parameters": {"trigger": "shadow >= hope_current",
                        "effect": "eye_on_feat_die = auto_failure"},
        "related": ["kv.mechanics.conditions.overview", "kv.mechanics.checks.feat_die_values"],
        "notes": "Порог по ТЕКУЩЕЙ Надежде; эффект — только Око=автопровал (НЕ злополучность). Более тяжёлый порог Тень=максимуму Надежды («подавлен страхами», стр. 137) дополнительно делает героя злополучным — см. kv.mechanics.checks.favoured_edge_cases; полная карточка ЭТОГО порога придёт с shadow (глава «Тень», стр. 137/139). Снятие несчастья (Надежда снова > Тени) — endurance_hope.nadezhda (стр. 71, закрыто B3).",
    },
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
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
        print(f"  wrote {p.name} ({len(payload['source_text'])} quote(s))")
    print(f"\n{len(CARDS)} cards written; {len(list(OUT.glob('*.json')))} total in mechanics/")


if __name__ == "__main__":
    main()
