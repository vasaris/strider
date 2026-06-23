"""Build rule cards for the «Игра для одного» SOLO OVERLAY — batch B-ИдО.1.

THROWAWAY TOOLING (stage 0). Scope of B-ИдО.1: the prose RULES that make solo
play differ from the full КВ game, sections A+B+C (folios 4–7):
  A «В одиночку в диких краях» (intro) — 2 cards,
  B «Введение» — 6 cards,
  C «Ваш искатель приключений» — 9 cards.
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
- Forward references to not-yet-built overlay cards (B-ИдО.2/.3) go in `notes`,
  never in `related` (keeps validate's dangling check clean). `related` is empty
  for this batch — these intro/setup cards cross-reference only core-book pages
  (handled in prose) and the param/oracle tables (handled in parameters).
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

# Whitespace-normalised pages used by this batch; equals independent_check.norm(raw_page).
PAGES = {n: norm_cell(page(n)) for n in (4, 5, 6, 7)}


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
        notes="Forward-ref: «манёвренная позиция» (стр. 17) — карта блока B-ИдО.3, "
              "ещё не создана; её ключ появится там.",
    ),
    envelope(
        "faza_bratstva_obzor", "Фаза братства (обзор)", SEC_B, [5],
        [(5, "Правила Фазы братства в «Игре для одного» мало отличаются",
          "Подробности этой фазы даны на стр. 22.")],
        "Соло-Фаза братства почти не отличается от КВ: герой отдыхает, восстанавливает "
        "силы и занимается личными делами — лечит шрамы, собирает слухи, беседует с "
        "покровителем. Подробности — стр. 22.",
        {},
        notes="Forward-ref: «духовное восстановление героев-одиночек» (стр. 22) — "
              "карта блока B-ИдО.3, ещё не создана.",
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
    ),
    envelope(
        "vazhnyy_tovarishch", "Важный товарищ", SEC_C, [7],
        [(7, "При игре в одиночку ваш герой не состоит в отряде",
          "эта часть создания героя пропускается.")],
        "Соло-правка: герой не состоит в отряде, Важного товарища нет, и этот шаг "
        "создания пропускается. Флаг important_companion=false — в "
        "kv.solo.hero_adjustments.",
        {"params_ref": HA},
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
    ),
    envelope(
        "kachestvo_strannik", "Новое отличительное качество: Странник", SEC_C, [7],
        [(7, "Странствия в одиночку по диким землям Средиземья закаляют дух",
          "герой считается вдохновлённым.")],
        "Соло-герои получают дополнительное Отличительное качество Странник: при "
        "проверках навыков в путешествии герой считается вдохновлённым. Структурно — "
        "extra_distinctive_quality в kv.solo.hero_adjustments.",
        {"params_ref": HA},
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
