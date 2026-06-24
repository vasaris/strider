"""Build rule cards for the «Игра для одного» SOLO OVERLAY — batch B-ИдО.1.

THROWAWAY TOOLING (stage 0). The prose RULES that make solo play differ from the
full КВ game. Batches built in this file:
  B-ИдО.1 — A «В одиночку в диких краях» (2) + B «Введение» (6) +
            C «Ваш искатель приключений» (9) = 17 cards (folios 4–7);
  B-ИдО.2 — «Система» (11): ЦЧ, особый успех, степени риска, Око Мордора
            (рейтинг/рост/сброс/порог/сцены обнаружения), folios 10–11, 15–16;
  B-ИдО.3 — «Сражение» (8): манёвренная позиция, «Продвинуться», действия и
            способности врага, folio 17;
  B-ИдО.4 — «Советы»/«Путешествия»/«Фаза братства»/«Приложение» (13): соло-Совет,
            соло-путешествие и его сцены, духовное восстановление, др. таблицы,
            folios 18–22, 30.
Overlay cards carry `related` edges to the КВ CORE cards they modify
(kv.mechanics.hero_creation/checks/eye/traits/rewards_virtues/combat/journey/...);
these resolve through validate.py's dangling-ref check. B-ИдО.3 introduced the
convention; the B-ИдО.1/.2 setup cards were back-filled in the gate-2a S1 pass.
Numbers stay canonical in the verified solo tables.
The solo ORACLE TABLES (answers/lore/luck/… patron_tasks/…) were extracted in
Session 1 and live in content-packs/kv/tables/solo — this batch does NOT touch them.

CONTRACT (same fidelity posture as build_mechanics_b3.py / build_solo_tables.py):
- source_text is CUT verbatim by (start, end_incl) anchors over the whitespace-
  normalised ИдО page text. The normaliser used here, norm_cell(page(n)), is
  byte-equal to independent_check.norm(raw_page_n) (both strip \\u0002 + the two
  lexical-hyphen exceptions, then collapse whitespace), so gate-1 holds by
  construction. Anchors are never retyped — they are exact substrings of the page.
- NUMBERS ARE NOT DUPLICATED. Session 1 already extracted and VERIFIED every solo
  numeric adjustment into kv.solo.hero_adjustments (15 exp pts, fellowship base 3,
  TN base 18, no important companion, the Странник quality, recommended callings).
  Cards that carry such a rule reference that canonical, gate-2b/gate-3-verified
  table via parameters.params_ref instead of re-declaring the integer. The number
  still appears verbatim inside source_text; it just has a single source of truth.
  => check_param_numbers has no int params to trace on these cards (by design).
- ORACLE BINDINGS are machine-readable: parameters.oracle_refs lists the solo
  table id(s) a rule dispatches; each ref is checked to EXIST at build time
  (against tables/solo), so a typo can never ship a dangling reference — without
  needing a validate.py change.
- subsystem = "solo" (NEW enum value in rule_card.schema.json, added idempotently
  as part of landing). id scheme kv.mechanics.solo.<name>; dir content-packs/kv/
  mechanics (so validate/independent_check/check_determinism pick it up with no new
  registration; the cards are told apart from КВ core by source.book = igra_dlya_odnogo).
- `related` carries edges to the КВ CORE cards a card modifies (gate-2a S1 back-fill
  extended this to the B-ИдО.1/.2 setup cards). Cards modifying no core rule keep
  `related` empty (the four intro cards, glavnye_tablicy/sovmestnaya_igra, advice
  cards such as srazhayas_s_soboy). Cross-refs to OTHER overlay cards live in `notes`
  as resolved pointers; numbers stay canonical via parameters (params_ref/oracle_refs).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))  # so `postprocess` imports when driven by check_determinism
from postprocess import page, norm_cell  # noqa: E402

OUT = HERE.parents[1] / "content-packs" / "kv" / "mechanics"
TABLES_SOLO = HERE.parents[1] / "content-packs" / "kv" / "tables" / "solo"

BOOK = "igra_dlya_odnogo"
EDITION = "на_рассылку_03_04_2026"
HA = "kv.solo.hero_adjustments"  # canonical numeric solo adjustments (Session 1, verified)
EM = "kv.solo.eye_of_mordor"      # canonical Eye-vigilance params (Session 1, verified)
SH = "kv.solo.shadow_recovery"    # canonical solo Shadow-removal scale (Session 1, verified)

# Whitespace-normalised pages used by this batch; equals independent_check.norm(raw_page).
PAGES = {n: norm_cell(page(n)) for n in (4, 5, 6, 7, 10, 11, 15, 16, 17, 18, 19, 22, 30)}


def cut(pg: int, start: str, end_incl: str) -> str:
    """Verbatim span from PAGES[pg], start..end_incl inclusive. Asserts start is unique."""
    s = PAGES[pg]
    i = s.find(start)
    if i < 0:
        raise ValueError(f"p{pg}: start anchor not found: {start[:60]!r}")
    if s.count(start) > 1:
        raise ValueError(f"p{pg}: start anchor not unique ({s.count(start)}x): {start[:60]!r}")
    j = s.find(end_incl, i)
    if j < 0:
        raise ValueError(f"p{pg}: end anchor not found after start: {end_incl[:60]!r}")
    return s[i: j + len(end_incl)]


def _known_solo_ids() -> set[str]:
    return {json.loads(f.read_text(encoding="utf-8"))["id"] for f in TABLES_SOLO.glob("*.json")}


KNOWN = _known_solo_ids()


def _check_refs(parameters: dict) -> None:
    refs: list[str] = []
    if "params_ref" in parameters:
        refs.append(parameters["params_ref"])
    refs += parameters.get("oracle_refs", [])
    for r in refs:
        if r not in KNOWN:
            raise ValueError(f"unknown ref (not a tables/solo id): {r}")


def envelope(name, title, section, pages, spans, summary, parameters,
             related=None, notes=""):
    _check_refs(parameters)
    source_text = [cut(pg, s, e) for (pg, s, e) in spans]
    return {
        "schema_version": "1.0",
        "id": f"kv.mechanics.solo.{name}",
        "type": "rule_card",
        "title": title,
        "source": {"book": BOOK, "edition": EDITION, "section": section, "pages": pages},
        "verified": False,
        "locale": "ru",
        "terminology": "pandora_box",
        "notes": notes,
        "payload": {
            "subsystem": "solo",
            "title": title,
            "source_text": source_text,
            "summary": summary,
            "parameters": parameters,
            "related": related or [],
        },
    }


SEC_A = "в одиночку в диких краях"
SEC_B = "введение"
SEC_C = "ваш искатель приключений"
SEC_D = "система"
SEC_SRAZH = "сражение"
SEC_SOVET = "советы"
SEC_PUT = "путешествия"
SEC_FBRAT = "фаза братства"
SEC_PRIL = "приложение"

# Each entry: name, title, section, pages, [(pg, start, end_incl), ...], summary, parameters, related, notes
CARDS = [
    # ---- A. «В одиночку в диких краях» (folio 4) -----------------------------
    envelope(
        "v_odinochku_v_dikih_krayah", "В одиночку в диких краях", SEC_A, [4],
        [(4, "«Он один из странников", "оружие, смекалка и надежда."),
         (4, "«Игра для одного» предлагает дополнительные", "на помощь придёт эта книга.")],
        "Вводная глава дополнения: эпиграф о Колоброде и завязка в духе странствий "
        "Арагорна; ИдО даёт адаптированные правила, таблицы случайностей и советы для "
        "соло-игры в КВ. Собственной механики карта не несёт.",
        {},
    ),
    envelope(
        "chto_takoe_odinochnaya_igra", "Что такое одиночная ролевая игра?", SEC_A, [4],
        [(4, "В «Игре для одного» хранитель не требуется", "из вашей основной кампании.")],
        "Ориентир по жанру: соло-игра обходится без хранителя; кратко об истории и "
        "преимуществах формата; ИдО применима и при разделённом отряде, и для "
        "второстепенного персонажа основной кампании. Механики нет.",
        {},
    ),
    # ---- B. «Введение» (folio 5) --------------------------------------------
    envelope(
        "kak_ustroena_igra", "Как устроена игра", SEC_B, [5],
        [(5, "«Игра для одного» — это дополнение к НРИ",
          "для одиночных приключений в Средиземье Третьей эпохи.")],
        "ИдО — дополнение к КВ и требует книгу основных правил; на практике отличается "
        "мало, но добавляет особенности и инструменты для ведения повествования без "
        "хранителя.",
        {},
    ),
    envelope(
        "osnovnaya_ideya", "Основная идея", SEC_B, [5],
        [(5, "Играя в одиночку в НРИ «Кольцо Всевластья», вы управляете героем",
          "ролевые игры так увлекательны.")],
        "Соло-игрок одновременно герой и хранитель: действует от лица героя, но сам "
        "выстраивает сцены и определяет последствия, сочетая интуицию с правилами "
        "дополнения, чтобы сохранить неожиданность и вызов.",
        {},
    ),
    envelope(
        "glavnye_tablicy", "Главные таблицы Игры для одного", SEC_B, [5],
        [(5, "Четыре новые таблицы этого дополнения являются ключевыми",
          "собраны в приложении (стр. 23).")],
        "Четыре ключевые соло-таблицы и их назначение: ответов — простые вопросы "
        "да/нет/возможно; преданий — открытые вопросы и новые ситуации; удачи и "
        "неудачи — подсказки событий на руне/знаке Кости испытания. Полный свод — "
        "в приложении (стр. 23).",
        {"oracle_refs": ["kv.solo.answers", "kv.solo.lore",
                         "kv.solo.luck", "kv.solo.misfortune"]},
    ),
    envelope(
        "faza_priklyucheniy_obzor", "Фаза приключений (обзор)", SEC_B, [5],
        [(5, "Как и в обычной игре, игровой процесс разбит на разные фазы",
          "оставаясь на шаг впереди Тени.")],
        "Обзор отличий соло-Фазы приключений: в путешествии не назначаются роли — "
        "герой реагирует и проверяет навыки сам; расширенная таблица сцен путешествия; "
        "новая боевая манёвренная позиция. Развёрнутые правила — стр. 17/19.",
        {"oracle_refs": ["kv.solo.journey_scenes"]},
        notes="Развёрнуто в B-ИдО.3: «манёвренная позиция» (стр. 17) — "
              "kv.mechanics.solo.manevrennaya_poziciya.",
    ),
    envelope(
        "faza_bratstva_obzor", "Фаза братства (обзор)", SEC_B, [5],
        [(5, "Правила Фазы братства в «Игре для одного» мало отличаются",
          "Подробности этой фазы даны на стр. 22.")],
        "Соло-Фаза братства почти не отличается от КВ: герой отдыхает, восстанавливает "
        "силы и занимается личными делами — лечит шрамы, собирает слухи, беседует с "
        "покровителем. Подробности — стр. 22.",
        {},
        notes="Развёрнуто в B-ИдО.3: «духовное восстановление героев-одиночек» "
              "(стр. 22) — kv.mechanics.solo.duhovnoe_vosstanovlenie, "
              "kv.mechanics.solo.faza_bratstva_solo.",
    ),
    envelope(
        "sovmestnaya_igra", "Совместная игра", SEC_B, [5],
        [(5, "Хотя это дополнение создано для одиночной игры",
          "поддерживая совместное повествование.")],
        "Кооп-режим без хранителя для малого отряда: группа совместно описывает мир и "
        "решает спорное либо использует таблицы ответов/преданий; важно уделять "
        "внимание каждому герою и передавать роль «ведущего» по очереди.",
        {"oracle_refs": ["kv.solo.answers", "kv.solo.lore"]},
    ),
    # ---- C. «Ваш искатель приключений» (folios 6–7) -------------------------
    envelope(
        "sozdanie_geroya_obzor", "Создание вашего героя (соло)", SEC_C, [6],
        [(6, "В начале кампании «Игры для одного» игрок создаёт одного героя",
          "но можно выбрать любое.")],
        "Создание соло-героя идёт как в КВ: один герой, доступны все культуры и "
        "призвания; для соло лучше подходят вестник, искатель сокровищ и страж, но "
        "выбрать можно любое; единственное отличие — по Особенностям (см. ниже). "
        "Рекомендованные призвания — в kv.solo.hero_adjustments.",
        {"params_ref": HA},
    ),
    envelope(
        "predydushchiy_opyt", "Предыдущий опыт", SEC_C, [6],
        [(6, "При распределении баллов предыдущего опыта",
          "странствий по Средиземью в одиночку.")],
        "Соло-правка распределения предыдущего опыта (КВ стр. 46): 15 баллов вместо 10, "
        "отражая особенности и опыт одиночных странствий. Число канонизировано в "
        "kv.solo.hero_adjustments (previous_experience_points).",
        {"params_ref": HA},
        related=["kv.mechanics.hero_creation.previous_experience"],
    ),
    envelope(
        "bezopasnoe_mesto", "Безопасное место", SEC_C, [6],
        [(6, "В приключениях без отряда безопасное место играет",
          "путь обратно из диких земель.")],
        "Без отряда безопасное место для героя — не только убежище, но дом: источник "
        "союзников, друзей и семьи и ориентир для возвращения из диких земель. "
        "Числовых параметров не несёт.",
        {},
    ),
    envelope(
        "reyting_bratstva", "Рейтинг братства", SEC_C, [6],
        [(6, "У героя-одиночки рейтинг братства равен 3",
          "это его надежда, неподвластная Тени.")],
        "Соло-правка: базовый рейтинг братства 3 плюс бонусы за Особенности, "
        "Культурные дары и покровителя; символизирует связь героя с сообществами и "
        "землями — его надежду вне власти Тени. Число — в kv.solo.hero_adjustments "
        "(fellowship_rating_base).",
        {"params_ref": HA},
        related=["kv.mechanics.hero_creation.fellowship_rating"],
    ),
    envelope(
        "vazhnyy_tovarishch", "Важный товарищ", SEC_C, [7],
        [(7, "При игре в одиночку ваш герой не состоит в отряде",
          "эта часть создания героя пропускается.")],
        "Соло-правка: герой не состоит в отряде, Важного товарища нет, и этот шаг "
        "создания пропускается. Флаг important_companion=false — в "
        "kv.solo.hero_adjustments.",
        {"params_ref": HA},
        related=["kv.mechanics.hero_creation.important_companion"],
    ),
    envelope(
        "osobennosti_solo", "Особенности (соло)", SEC_C, [7],
        [(7, "Выбирая Особенности, прочитайте их описание",
          "больше подходит характеру его героя.")],
        "Правило выбора Особенностей соло: полезные только отряду в одиночку не "
        "работают (книжные примеры — хоббитская «Трое — это уже толпа»; частично "
        "полезная бардингская «Друг гномов»); по компромиссным решает игрок, опираясь "
        "на характер героя. Исчерпывающего списка «бесполезных» книга не даёт — это "
        "рантайм-суждение по тексту самих Особенностей.",
        {},
        related=["kv.mechanics.rewards_virtues.osobennosti"],
    ),
    envelope(
        "kachestvo_strannik", "Новое отличительное качество: Странник", SEC_C, [7],
        [(7, "Странствия в одиночку по диким землям Средиземья закаляют дух",
          "герой считается вдохновлённым.")],
        "Соло-герои получают дополнительное Отличительное качество Странник: при "
        "проверках навыков в путешествии герой считается вдохновлённым. Структурно — "
        "extra_distinctive_quality в kv.solo.hero_adjustments.",
        {"params_ref": HA},
        related=["kv.mechanics.traits.otlichitelnye_kachestva"],
    ),
    envelope(
        "pokrovitel", "Ваш покровитель", SEC_C, [7],
        [(7, "Возможно, важнейший выбор для героя-одиночки",
          "больше подходят Бильбо или Балин.")],
        "Выбор покровителя — ключевое решение соло-героя: он задаёт цель поручения или "
        "приключения, связывает героя с миром и даёт повод для встреч в Фазе братства; "
        "сверяйте задачу и любимые призвания покровителя с целями кампании.",
        {},
    ),
    envelope(
        "zadaniya_pokrovitelya", "Задания покровителя", SEC_C, [7],
        [(7, "В приведённых далее таблицах для каждого стартового покровителя",
          "неизвестных вам и покровителю.")],
        "Как пользоваться таблицами заданий покровителя: взять задание по интересу, "
        "выбрать случайно (Кость успеха) или выполнять по порядку; уточнять детали "
        "поручения через таблицы ответов и преданий, оставляя место для ещё "
        "неизвестных деталей. Сами таблицы заданий — kv.solo.patron_tasks.*.",
        {"oracle_refs": ["kv.solo.answers", "kv.solo.lore",
                         "kv.solo.patron_tasks.balin", "kv.solo.patron_tasks.bilbo",
                         "kv.solo.patron_tasks.cirdan", "kv.solo.patron_tasks.gandalf",
                         "kv.solo.patron_tasks.gilraen",
                         "kv.solo.patron_tasks.tom_and_goldberry"]},
    ),
    # ---- B-ИдО.2: «Система» (folios 10–11, 15–16) ---------------------------
    # ЦЧ, особый успех, степени риска, Око Мордора (рейтинг/рост/сброс/порог/сцены).
    # Numbers stay canonical in verified hero_adjustments / eye_of_mordor (params_ref).
    envelope(
        "vypolnenie_deystviy", "Выполнение действий", SEC_D, [10],
        [(10, "В одиночной игре вы сами решаете, когда нужны проверки",
          "на стр. 16 книги основных правил).")],
        "Кто назначает проверки соло: игрок сам, когда происходящее рискованно и провал "
        "может повлиять на сюжет; проверки дают равные шансы и на провал, и на триумф "
        "(КВ «Когда требуется проверка», стр. 16).",
        {},
        related=["kv.mechanics.checks.when_required"],
    ),
    envelope(
        "raschet_celevogo_chisla", "Расчёт целевого числа", SEC_D, [10],
        [(10, "Используя альтернативный метод (книга основных правил, стр. 18)",
          "опасностями Средиземья в одиночку.")],
        "Соло-правка ЦЧ (альтернативный метод, КВ стр. 18): целевое число = 18 − рейтинг "
        "характеристики (а не из 20), делая героя более умелым и самодостаточным. Число — "
        "в kv.solo.hero_adjustments (target_number_base).",
        {"params_ref": HA},
    ),
    envelope(
        "rezultaty_na_kosti_ispytaniya", "Результаты на Кости испытания", SEC_D, [10],
        [(10, "Когда ваш герой действует, можно сделать проверки более драматичными",
          "неожиданные преимущества.")],
        "Драматизация по руне/Оку на Кости испытания: руна при успехе — подсказка из "
        "таблицы удачи; знак при провале — подсказка из таблицы неудачи; результаты можно "
        "и пропустить, оценив исход по ситуации.",
        {"oracle_refs": ["kv.solo.luck", "kv.solo.misfortune"]},
        related=["kv.mechanics.checks.feat_die_values"],
    ),
    envelope(
        "osobyy_uspekh_solo", "Особый успех в одиночной игре", SEC_D, [11],
        [(11, "Если при успешной проверке на Костях успеха также выпадает 1 знак",
          "используйте их вместо таблицы выше.")],
        "Знаки на Костях успеха дают более значимый результат (КВ стр. 18) — следствие "
        "навыков героя, а не удачи; эффект выбирается по соло-таблице особых успехов (по "
        "1 за знак), кроме боевого снаряжения и Культурных особенностей, у которых свои "
        "эффекты за знак.",
        {"oracle_refs": ["kv.solo.special_successes"]},
        related=["kv.mechanics.checks.special_successes"],
    ),
    envelope(
        "primenenie_stepeney_riska", "Применение степеней риска", SEC_D, [11],
        [(11, "В «Игре для одного», воображая и разыгрывая рискованные действия",
          "а если «нет» со знаком , то Безрассудная.")],
        "Степени риска соло (КВ стр. 131): по умолчанию обычная (провал можно заменить "
        "успехом с последствием), эскалируется по мере угрозы; при сомнении бросок по "
        "таблице ответов на «Это обычная Степень риска?» — «нет» даёт Опасную, «нет» со "
        "знаком — Безрассудную.",
        {"oracle_refs": ["kv.solo.answers", "kv.solo.risk_degrees"]},
    ),
    envelope(
        "oko_mordora_solo", "Око Мордора (соло)", SEC_D, [15],
        [(15, "Одинокий герой привлекает меньше внимания, чем отряд",
          "постоянную и коварную угрозу.")],
        "Соло-рекомендация: использовать необязательные правила Бдительности Ока (КВ "
        "стр. 169) для отслеживания заметности героя Врагу; в одиночной игре они "
        "подчёркивают постоянную угрозу Тени. Структура — в kv.solo.eye_of_mordor.",
        {"params_ref": EM},
        related=["kv.mechanics.eye.oko_mordora"],
    ),
    envelope(
        "nachalnyy_reyting_bditelnosti", "Начальный рейтинг Бдительности Ока", SEC_D, [15],
        [(15, "Рассчитайте начальный рейтинг Бдительности ока",
          "которые носит герой.")],
        "Начальный рейтинг (КВ стр. 170): база 0 плюс модификаторы за Доблесть 4+, "
        "культуру (гном / эльф или дунэдайн / высший эльф) и каждое Знаменитое оружие или "
        "броню. Значения — в kv.solo.eye_of_mordor (initial_rating).",
        {"params_ref": EM},
        related=["kv.mechanics.eye.bditelnost_oka"],
    ),
    envelope(
        "rost_bditelnosti", "Рост Бдительности Ока", SEC_D, [15],
        [(15, "Следуйте указаниям из книги основных правил",
          "Око следит за вами!")],
        "Триггеры роста (КВ стр. 170–171): знак Ока на броске вне боя (+1), баллы тени вне "
        "боя (+столько же), Дивные артефакты и Чудесные предметы; плюс результат броска по "
        "таблице неудачи добавляет +2 поверх исходного. Структура — в kv.solo.eye_of_mordor "
        "(growth_triggers).",
        {"params_ref": EM, "oracle_refs": ["kv.solo.misfortune"]},
        related=["kv.mechanics.eye.bditelnost_oka"],
    ),
    envelope(
        "sbros_bditelnosti", "Сброс рейтинга Бдительности Ока", SEC_D, [15],
        [(15, "Рейтинг Бдительности Ока не увеличивается во время Фазы братства",
          "сбросьте рейтинг до начального значения.")],
        "Рейтинг не растёт в Фазе братства и сбрасывается к начальному значению в начале "
        "следующей Фазы приключений. Закреплено в kv.solo.eye_of_mordor (fellowship_phase).",
        {"params_ref": EM},
        related=["kv.mechanics.eye.bditelnost_oka"],
    ),
    envelope(
        "porog_presledovaniya", "Порог преследования", SEC_D, [15],
        [(15, "И для героя-одиночки, и для отряда действуют одинаковые правила",
          "чтобы определить Порог преследования.")],
        "Порог преследования у соло-героя и отряда одинаков (КВ стр. 172); определяется по "
        "таблицам регионов и модификаторов преследования. Значения (18/16/14 и "
        "модификаторы) — в kv.solo.eye_of_mordor (pursuit_thresholds / pursuit_modifiers).",
        {"params_ref": EM},
        related=["kv.mechanics.eye.presledovanie"],
    ),
    envelope(
        "sceny_obnaruzheniya", "Сцены обнаружения", SEC_D, [16],
        [(16, "Когда рейтинг Бдительности Ока сравняется с порогом преследования",
          "возвращается к начальному значению.")],
        "Сцена обнаружения запускается, когда рейтинг достигает порога преследования: "
        "бросок по таблице сцен обнаружения (или придуманная угроза); скрытые сцены "
        "записываются на будущее; после завершения рейтинг сбрасывается к начальному.",
        {"params_ref": EM, "oracle_refs": ["kv.solo.detection_scenes"]},
        related=["kv.mechanics.eye.presledovanie"],
    ),
    # ---- B-ИдО.3: «Сражение» (folio 17) ------------------------------------
    # Solo combat overlay; related-edges point at the КВ core combat cards modified.
    envelope(
        "srazhenie", "Сражение", SEC_SRAZH, [17],
        [(17, "В «Игре для одного» вы не сражаетесь плечом к плечу с вашим отрядом",
          "дающая одинокому лучнику шанс в бою."),
         (17, "Приключения в одиночку для НРИ «Кольцо Всевластья» нередко полны опасностей",
          "сразиться в другой раз.")],
        "Соло-бой: герой противостоит врагу один; добавлены инструменты для одиночки, в "
        "т.ч. манёвренная позиция для лучника. Врезка «В меньшинстве»: при безнадёжной "
        "ситуации можно сразу выйти из боя и сразиться в другой раз.",
        {}, related=["kv.mechanics.combat.boy"],
    ),
    envelope(
        "manevrennaya_poziciya", "Манёвренная позиция", SEC_SRAZH, [17],
        [(17, "В «Игре для одного» бои в целом проходят по правилам книги основных правил",
          "ища выгодную позицию для удара.")],
        "Манёвренная позиция: перед ближним боем можно сделать залпы дальним оружием в "
        "зависимости от дистанции; герою с луком/метательным она позволяет драться «на "
        "ходу», обмениваясь дальними атаками и ища выгодную точку.",
        {}, related=["kv.mechanics.combat.boy",
                     "kv.mechanics.combat.shagi_v_raunde_blizhnego_boya"],
    ),
    envelope(
        "manevrennaya_poziciya_dalniy_boy", "Манёвренная позиция (дальний бой)",
        SEC_SRAZH, [17],
        [(17, "Герой сражается на ходу, двигаясь по местности и обстреливая",
          "Боевая задача: Продвинуться.")],
        "Механика манёвренной позиции: герой атакует только дальним оружием; врагам "
        "ближнего боя −1к, дальнего — без штрафа; атакам героя −1к; выход из боя — "
        "проверкой дальней атаки без −1к (при успехе уходит без урона); доступна боевая "
        "задача Продвинуться.",
        {}, related=["kv.mechanics.combat.sovershenie_atak",
                     "kv.mechanics.combat.vyhod_iz_boya"],
    ),
    envelope(
        "prodvinutsya", "Продвинуться — манёвренная позиция", SEC_SRAZH, [17],
        [(17, "На ходу герой может попробовать занять выгодное для атаки место",
          "покинуть бой (см. Манёвренная позиция).")],
        "Боевая задача Продвинуться: основное действие на проверку АТЛЕТИКИ или ПОИСКА; "
        "при успехе +1к к следующей дальней атаке и ещё +1к за каждый выпавший знак; "
        "бонусные кости идут в дальнюю атаку или на выход из боя.",
        {}, related=["kv.mechanics.combat.boevye_zadachi"],
    ),
    envelope(
        "oslozhneniya_preimushchestva_solo", "Осложнения и преимущества", SEC_SRAZH, [17],
        [(17, "Без хранителя игрок-одиночка самостоятельно решает, будут ли у героя",
          "более сложным и интересным.")],
        "Без хранителя игрок сам решает осложнения и преимущества в бою — из обстановки "
        "(вода, дистанция) или по выпавшей руне/знаку Кости испытания.",
        {}, related=["kv.mechanics.combat.oslozhneniya_i_preimuschestva"],
    ),
    envelope(
        "deystviya_protivnikov", "Действия противников", SEC_SRAZH, [17],
        [(17, "В «Игре для одного» игрок-одиночка оказывается в уникальной ситуации",
          "больше шансов нанести урон.")],
        "Игрок ведёт и героя, и врагов: противник берёт оружие, лучше подходящее под "
        "боевую позицию героя; при выборе — то, что даёт наибольшее преимущество или шанс "
        "нанести урон.",
        {}, related=["kv.mechanics.combat.boy", "kv.mechanics.combat.sovershenie_atak"],
    ),
    envelope(
        "osobyy_uron", "Особый урон", SEC_SRAZH, [17],
        [(17, "Тратя знаки на активацию особого урона врага",
          "другие варианты особого урона.")],
        "Особый урон врага по умолчанию — «Сокрушительный удар», если в таблице "
        "характеристик противника не указаны иные варианты.",
        {}, related=["kv.mechanics.combat.sovershenie_atak", "kv.mechanics.combat.raneniya"],
    ),
    envelope(
        "sposobnosti_vraga", "Способности врага", SEC_SRAZH, [17],
        [(17, "Если применение Способности врага даёт ему явное преимущество",
          "для определения поведения врага.")],
        "Враг применяет Способности (тратя Решимость/Ненависть), когда это даёт явное "
        "преимущество; если дорого или рискованно для него — поведение определяется "
        "броском по таблице ответов.",
        {"oracle_refs": ["kv.solo.answers"]}, related=["kv.mechanics.combat.boy"],
    ),
    # ---- B-ИдО.4: «Советы» (folio 18) --------------------------------------
    envelope(
        "sovet_solo", "Советы (соло)", SEC_SOVET, [18],
        [(18, "На Советах ваш герой предстаёт перед важными фигурами",
          "с некоторыми изменениями, указанными ниже.")],
        "Соло-Советы идут по правилам КВ (стр. 104) с изменениями ниже: важные встречи в "
        "официальной обстановке с обсуждением ключевых событий или напряжёнными "
        "переговорами.",
        {}, related=["kv.mechanics.council.sovet"],
    ),
    envelope(
        "opredelenie_soprotivleniya", "Определение сопротивления", SEC_SOVET, [18],
        [(18, "Как и обычно, Совет начинается с определения рейтинга сопротивления",
          "Если нет, выберите второй.")],
        "Рейтинг сопротивления по цели переговоров (3 разумная / 6 смелая / 9 дерзкая — "
        "значения ядра Совета); при сомнении выберите два варианта и разрешите бросок по "
        "таблице ответов с вероятностью «возможно».",
        {"oracle_refs": ["kv.solo.answers"]},
        related=["kv.mechanics.council.zavershenie_soveta"],
    ),
    envelope(
        "razygryvanie_peregovorov", "Разыгрывание переговоров по ролям", SEC_SOVET, [18],
        [(18, "Может быть странно или сложно разыгрывать происходящее по ролям одному",
          "в контексте персонажей и разговора.")],
        "Чтобы Совет не свёлся к серии бросков: представляйте ход обсуждения; на "
        "конкретный да/нет — таблица ответов; на общий вопрос о реакции или теме — "
        "таблица преданий.",
        {"oracle_refs": ["kv.solo.answers", "kv.solo.lore"]},
        related=["kv.mechanics.council.sotsialnoe_vzaimodeystvie"],
    ),
    # ---- B-ИдО.4: «Путешествия» (folios 18–19) -----------------------------
    envelope(
        "puteshestvie_solo", "Путешествия (соло)", SEC_PUT, [18],
        [(18, "В НРИ «Кольцо Всевластья» путешествия — ключевая часть",
          "Отличительное качество Странник (стр. 7).")],
        "Соло-путешествия идут как в КВ (стр. 108) с изменениями ниже; структура "
        "путешествий хорошо подходит одиночке. Герой получает качество Странник.",
        {}, related=["kv.mechanics.journey.puteshestvie",
                     "kv.mechanics.solo.kachestvo_strannik"],
    ),
    envelope(
        "kogda_primenyat_pravila_puteshestviy", "Когда применять правила путешествий",
        SEC_PUT, [18],
        [(18, "Как указано в книге основных правил (стр. 109), правила путешествий применяются",
          "можно определить без бросков.")],
        "Полные правила путешествия — при походе в конкретное место через опасные земли; "
        "при единичной угрозе достаточно проверки СТРАНСТВИЯ; рутинный путь по безопасным "
        "землям или возврат тем же путём — без бросков.",
        {}, related=["kv.mechanics.journey.puteshestvie",
                     "kv.mechanics.journey.poryadok_puteshestviya"],
    ),
    envelope(
        "navstrechu_neizvedannomu", "Навстречу неизведанному", SEC_PUT, [18],
        [(18, "Когда вы играете с хранителем и в отряде, вам обычно мало известно",
          "влиять на решения, принимаемые вашим героем.")],
        "Соло-игрок сочетает знания, нужные для ведения путешествия (карты, таблицы, "
        "сведения о регионах, таблицы ответов/преданий), со знаниями самого героя; для "
        "героя-новичка эти «закулисные» сведения не должны влиять на его решения.",
        {"oracle_refs": ["kv.solo.answers", "kv.solo.lore"]},
        related=["kv.mechanics.journey.karta"],
    ),
    envelope(
        "roli_v_puteshestvii", "Роли в путешествии", SEC_PUT, [18],
        [(18, "В «Игре для одного» нет ролей в путешествии",
          "а не от ролей.")],
        "В соло-путешествии ролей нет: герой сам отвечает за всё, проверки сцен зависят "
        "напрямую от навыков, а не от назначенных ролей.",
        {}, related=["kv.mechanics.journey.puteshestvuyuschiy_otryad"],
    ),
    envelope(
        "srazhayas_s_soboy", "Сражаясь с собой", SEC_SRAZH, [18],
        [(18, "Управление врагами в роли хранителя против собственного героя",
          "вам в этом помогут.")],
        "Совет по вождению боя за себя: цель не «выиграть», а сделать бой впечатляющим и "
        "значимым для сюжета; при сомнении — «принцип крутизны»; таблицы ответов и "
        "преданий помогают.",
        {"oracle_refs": ["kv.solo.answers", "kv.solo.lore"]},
        related=[],
    ),
    envelope(
        "sceny_puteshestviya_solo", "Сцены путешествия в одиночку", SEC_PUT, [19, 22],
        [(19, "Чтобы разыграть сцены путешествия героя-одиночки, пропустите шаг",
          "по таблице деталей сцены (см. далее)."),
         (22, "Если вы не уверены, кто из героев будет целью сцены",
          "чтобы лучше понять характер сцены.")],
        "Соло-сцены путешествия: шаг выбора цели пропускается (цель — всегда герой), тип "
        "сцены — бросок по соло-таблице сцен путешествия; характер броска по местности "
        "(Пограничные — благополучный, Дикие — обычный, Тёмные — злополучный). При "
        "совместной игре цель определяется случайно, а отряд из 3+ героев пользуется "
        "оригинальной таблицей КВ.",
        {"oracle_refs": ["kv.solo.journey_scenes"]},
        related=["kv.mechanics.journey.razygryvanie_stsen_puteshestviya",
                 "kv.mechanics.journey.opisanie_stsen_puteshestviya"],
    ),
    envelope(
        "detali_scen", "Детали сцен", SEC_PUT, [19],
        [(19, "Чтобы вам было легче представить суть сцены, используйте таблицы деталей",
          "указано в каждой таблице деталей сцены.")],
        "Таблицы деталей сцены дополняют таблицу сцен путешествия: выберите подходящую под "
        "тип сцены, бросьте Кость успеха (можно вместе с Костью испытания); уточняйте "
        "через ответы/предания; рельеф меняет проверку (−1к сложный, +1к дорога); итог "
        "учитывает баллы Изнурения из таблицы детали.",
        {"oracle_refs": ["kv.solo.answers", "kv.solo.lore",
                         "kv.solo.scene_details.terrible_misfortune",
                         "kv.solo.scene_details.despair", "kv.solo.scene_details.bad_choice",
                         "kv.solo.scene_details.mishap", "kv.solo.scene_details.short_cut",
                         "kv.solo.scene_details.chance_meeting",
                         "kv.solo.scene_details.inspiring_sight"]},
        related=["kv.mechanics.journey.opisanie_stsen_puteshestviya"],
    ),
    # ---- B-ИдО.4: «Фаза братства» (folio 22) -------------------------------
    envelope(
        "faza_bratstva_solo", "Фаза братства (соло)", SEC_FBRAT, [22],
        [(22, "Фаза братства — это часть игры, управляемая игроками",
          "находясь в безопасности и не торопясь.")],
        "Соло-Фаза братства по структуре КВ (стр. 118–120) не меняется: герой отдыхает в "
        "безопасном месте, тратит опыт за вехи на улучшения и начинания, выбирает "
        "длительность и место, с более долгим Йолем примерно каждую третью фазу.",
        {"oracle_refs": ["kv.solo.milestones"]},
        related=["kv.mechanics.fellowship_phase.struktura_fazy_bratstva",
                 "kv.mechanics.fellowship_phase.yol"],
    ),
    envelope(
        "duhovnoe_vosstanovlenie", "Духовное восстановление героев-одиночек",
        SEC_FBRAT, [22],
        [(22, "Как описано на стр. 119 книги основных правил НРИ «Кольцо Всевластья», обычно хранитель решает",
          "уберите 3 балла Тени.")],
        "В соло-игре игрок сам решает, сколько баллов Тени убрать в Фазе братства, по "
        "значимости поступков против Тени: помеха возвращению — 1, активное "
        "противодействие или урон Врагу — 2, подвиг уровня внимания Тёмного Повелителя — "
        "3. Шкала — в kv.solo.shadow_recovery.",
        {"params_ref": SH},
        related=["kv.mechanics.fellowship_phase.struktura_fazy_bratstva"],
    ),
    # ---- B-ИдО.4: «Приложение» (folio 30) ----------------------------------
    envelope(
        "ispolzovanie_drugih_tablic", "Использование других таблиц", SEC_PRIL, [30],
        [(30, "В книге основных правил НРИ «Кольцо Всевластья» и её дополнениях есть множество таблиц",
          "вдохновиться на создание мест, встреч, заданий и прочего.")],
        "В КВ и дополнениях есть множество таблиц конкретных регионов, полезных для "
        "соло-кампаний; используйте их для вдохновения при создании мест, встреч и "
        "заданий.",
        {},
    ),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    for doc in CARDS:
        name = doc["id"].split(".")[-1]
        (OUT / f"{name}.json").write_text(
            json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        n += 1
    total = len(list(OUT.glob("*.json")))
    print(f"{n} solo-overlay cards written; {total} total in mechanics/")


if __name__ == "__main__":
    main()
