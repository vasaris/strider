"""Build content-packs/kv/tables/solo/*.json from «Игра для одного».

THROWAWAY TOOLING (stage 0). Regular table families are parsed from the
text layer (parsers.py); singleton tables and structured effect annotations
are curated configs transcribed from the book and verified against page
scans. Every output starts as verified:false; Ivan flips it manually.

Body-vs-appendix duplicates are both parsed and diffed; diffs go to
DUPLICATE_DIFFS.md. The BODY version is canonical pending verification.
"""
from __future__ import annotations

import json
from pathlib import Path

from postprocess import page, norm_cell
from parsers import (
    parse_feat_event,
    parse_lore_sections,
    parse_detail_table,
    parse_patron_rows,
)

OUT = Path(__file__).parents[2] / "content-packs" / "kv" / "tables" / "solo"
DIFFS: list[str] = []

EDITION = "на_рассылку_03_04_2026"


def envelope(id_: str, type_: str, title: str, pages: list[int], payload: dict,
             notes: str = "") -> dict:
    return {
        "schema_version": "1.0",
        "id": id_,
        "type": type_,
        "title": title,
        "source": {"book": "igra_dlya_odnogo", "edition": EDITION, "pages": pages},
        "verified": False,
        "locale": "ru",
        "terminology": "pandora_box",
        "notes": notes,
        "payload": payload,
    }


def emit(name: str, doc: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"{name}.json"
    p.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  wrote {p.relative_to(OUT.parents[3])}")


def diff_rows(label: str, body_rows, appendix_rows, key="text") -> str:
    notes = []
    for b, a in zip(body_rows, appendix_rows):
        bt, at = b.get(key, ""), a.get(key, "")
        if bt != at:
            notes.append(f"face {b.get('face')}: тело «{bt}» / приложение «{at}»")
            DIFFS.append(f"- **{label}**, face {b.get('face')}:\n  - тело: {bt}\n  - приложение: {at}")
    return "; ".join(notes)


# ---------------------------------------------------------------- answers
def build_answers():
    payload = {
        "die": "feat",
        "likelihoods": [
            {"key": "certain", "label": "Определённо", "yes_if_at_least": 1},
            {"key": "likely", "label": "Возможно", "yes_if_at_least": 4},
            {"key": "even", "label": "Пополам", "yes_if_at_least": 6, "default": True},
            {"key": "doubtful", "label": "Сомнительно", "yes_if_at_least": 8},
            {"key": "unthinkable", "label": "Немыслимо", "yes_if_at_least": 10},
        ],
        "special_faces": {
            "gandalf_rune": {
                "answer": "yes", "extreme": True,
                "text": "Всегда «да» с экстремальным итогом или поворотом.",
            },
            "eye": {
                "answer": "no", "extreme": True,
                "text": "Всегда «нет» с экстремальным итогом или поворотом.",
            },
        },
    }
    emit("answers", envelope(
        "kv.solo.answers", "oracle_yes_no", "Таблица ответов", [12, 23], payload,
        notes="Пороги и строки рун сверены со сканами стр. 12 и 23; расхождений между телом и приложением нет.",
    ))


# ------------------------------------------------------------------- lore
def build_lore():
    body = parse_lore_sections(page(13) + "\n" + page(14))
    appendix = parse_lore_sections(page(24) + "\n" + page(25))
    notes = []
    for bs, as_ in zip(body, appendix):
        for i, (br, ar) in enumerate(zip(bs["rows"], as_["rows"]), 1):
            if br != ar:
                msg = f"секция {bs['face']}, строка {i}: тело {br} / приложение {ar}"
                notes.append(msg)
                DIFFS.append(f"- **Таблица преданий**: {msg}")
    payload = {
        "section_die": "feat",
        "row_die": "success",
        "columns": ["action", "aspect", "focus"],
        "sections": body,
    }
    emit("lore", envelope(
        "kv.solo.lore", "lore_table", "Таблица преданий", [13, 14, 24, 25], payload,
        notes="Секции Ока и руны восстановлены по позиционной конвенции (Око — первая, руна — вторая), сверено со сканом стр. 13. "
              + ("Диффы с приложением: " + "; ".join(notes) if notes else "Приложение (стр. 24–25) идентично."),
    ))


# ------------------------------------------------- luck / misfortune / detection
FEAT_EVENT_EFFECTS = {
    "kv.solo.luck": {"eye": [{"op": "eye_awareness_delta", "value": -1}]},
    "kv.solo.misfortune": {"eye": [{"op": "eye_awareness_delta", "value": 2}]},
    "kv.solo.detection_scenes": {},
}


def build_feat_event(id_: str, name: str, title: str, body_seg: str,
                     app_seg: str, pages: list[int], extra_notes: str = ""):
    body_rows = parse_feat_event(body_seg)
    app_rows = parse_feat_event(app_seg)
    diff_note = diff_rows(title, body_rows, app_rows)
    for row in body_rows:
        eff = FEAT_EVENT_EFFECTS.get(id_, {}).get(row["face"])
        if eff:
            row["effects"] = eff
    payload = {"die": "feat", "rows": body_rows}
    notes = ("Строки Ока (первая) и руны (последняя) восстановлены по позиционной конвенции, сверено со сканами. "
             + (f"Диффы с приложением: {diff_note}." if diff_note else "Приложение идентично.")
             + (" " + extra_notes if extra_notes else ""))
    emit(name, envelope(id_, "feat_die_event_table", title, pages, payload, notes))


def seg_between(text: str, start: str, *ends: str) -> str:
    i = text.find(start)
    assert i >= 0, start
    i += len(start)
    j = len(text)
    for e in ends:
        k = text.find(e, i)
        if 0 <= k < j:
            j = k
    return text[i:j]


def build_feat_events():
    p10, p23, p16, p28 = page(10), page(23), page(16), page(28)
    luck_b = seg_between(p10, "ТАБЛИЦА УДАЧИ", "ТАБЛИЦА НЕУДАЧИ")
    luck_a = seg_between(p23, "ТАБЛИЦА УДАЧИ", "ТАБЛИЦА НЕУДАЧИ", "ТАБЛИЦА ОТВЕТОВ")
    mis_b = seg_between(p10, "ТАБЛИЦА НЕУДАЧИ")
    mis_a = seg_between(p23, "ТАБЛИЦА НЕУДАЧИ", "ТАБЛИЦА ОТВЕТОВ")
    det_b = seg_between(p16, "ТАБЛИЦА СЦЕН ОБНАРУЖЕНИЯ")
    det_a = seg_between(p28, "ТАБЛИЦА СЦЕН ОБНАРУЖЕНИЯ", "ЗАДАНИЯ ПОКРОВИТЕЛЯ")
    for seg in (luck_b, luck_a, mis_b, mis_a, det_b, det_a):
        pass
    build_feat_event(
        "kv.solo.luck", "luck", "Таблица удачи", _strip_header(luck_b), _strip_header(luck_a), [10, 23],
        extra_notes="Эффект строки Ока («уменьшается на 1») структурирован как eye_awareness_delta −1.",
    )
    build_feat_event(
        "kv.solo.misfortune", "misfortune", "Таблица неудачи", _strip_header(mis_b), _strip_header(mis_a), [10, 23],
        extra_notes="Эффект строки Ока («возрос на 2») структурирован как eye_awareness_delta +2; "
                    "по стр. 15 это вдобавок к +1 за исходное Око, вызвавшее бросок.",
    )
    build_feat_event(
        "kv.solo.detection_scenes", "detection_scenes", "Таблица сцен обнаружения",
        _strip_header(det_b), _strip_header(det_a), [16, 28],
    )


def _strip_header(seg: str) -> str:
    return seg.replace("КОСТЬ \nИСПЫТАНИЯ РЕЗУЛЬТАТ", "").replace(
        "КОСТЬ \nИСПЫТАНИЯ СЦЕНА", "").replace("КОСТЬ\nИСПЫТАНИЯ РЕЗУЛЬТАТ", "").replace(
        "КОСТЬ\nИСПЫТАНИЯ СЦЕНА", "")


# --------------------------------------------------------- journey scenes
SCENE_TYPES = {
    "УЖАСНАЯ НЕУДАЧА": "terrible_misfortune",
    "ОТЧАЯНИЕ": "despair",
    "ПЛОХОЙ ВЫБОР": "bad_choice",
    "НЕПРИЯТНОСТЬ": "mishap",
    "КОРОТКИЙ ПУТЬ": "short_cut",
    "СЛУЧАЙНАЯ ВСТРЕЧА": "chance_meeting",
    "ВДОХНОВЛЯЮЩИЙ ВИД": "inspiring_sight",
}


def build_journey():
    rows = [
        {
            "face": "eye", "scene_type": "terrible_misfortune", "scene": "Ужасная неудача",
            "consequence_text": "При провале проверки герой ранен.",
            "consequence": {"trigger": "on_failure", "effects": [{"op": "wound"}]},
            "fatigue_gain": 3,
            "detail_table": "kv.solo.scene_details.terrible_misfortune",
        },
        {
            "face": 1, "scene_type": "despair", "scene": "Отчаяние",
            "consequence_text": "При провале проверки герой получает 2 балла Тени (Страх).",
            "consequence": {"trigger": "on_failure",
                            "effects": [{"op": "shadow_points", "value": 2, "kind": "fear"}]},
            "fatigue_gain": 2,
            "detail_table": "kv.solo.scene_details.despair",
        },
        {
            "range": {"min": 2, "max": 3}, "scene_type": "bad_choice", "scene": "Плохой выбор",
            "consequence_text": "При провале проверки герой получает 1 балл Тени (Страх).",
            "consequence": {"trigger": "on_failure",
                            "effects": [{"op": "shadow_points", "value": 1, "kind": "fear"}]},
            "fatigue_gain": 2,
            "detail_table": "kv.solo.scene_details.bad_choice",
        },
        {
            "range": {"min": 4, "max": 7}, "scene_type": "mishap", "scene": "Неприятность",
            "consequence_text": "При провале проверки добавьте 1 день к длительности путешествия. "
                                "Герой получает 1 дополнительный балл Изнурения.",
            "consequence": {"trigger": "on_failure",
                            "effects": [{"op": "journey_days_delta", "value": 1},
                                        {"op": "fatigue_points", "value": 1}]},
            "fatigue_gain": 2,
            "detail_table": "kv.solo.scene_details.mishap",
        },
        {
            "range": {"min": 8, "max": 9}, "scene_type": "short_cut", "scene": "Короткий путь",
            "consequence_text": "При успехе проверки длительность путешествия уменьшается на день.",
            "consequence": {"trigger": "on_success",
                            "effects": [{"op": "journey_days_delta", "value": -1}]},
            "fatigue_gain": 1,
            "detail_table": "kv.solo.scene_details.short_cut",
        },
        {
            "face": 10, "scene_type": "chance_meeting", "scene": "Случайная встреча",
            "consequence_text": "При успехе проверки баллы Изнурения не начисляются, "
                                "а игрок придумывает встречу, благоприятную для героя.",
            "consequence": {"trigger": "on_success", "effects": [{"op": "fatigue_waived"}]},
            "fatigue_gain": 1,
            "detail_table": "kv.solo.scene_details.chance_meeting",
        },
        {
            "face": "gandalf_rune", "scene_type": "inspiring_sight", "scene": "Вдохновляющий вид",
            "consequence_text": "При успехе проверки герой получает 1 балл Надежды.",
            "consequence": {"trigger": "on_success",
                            "effects": [{"op": "hope_points", "value": 1}]},
            "fatigue_gain": None,
            "detail_table": "kv.solo.scene_details.inspiring_sight",
        },
    ]
    payload = {
        "die": "feat",
        "regional_roll_bias": {
            "border_lands": "favoured",
            "wild_lands": "plain",
            "dark_lands": "ill_favoured",
        },
        "skills_pool": ["exploration", "awareness", "hunting"],
        "rows": rows,
    }
    emit("journey_scenes", envelope(
        "kv.solo.journey_scenes", "journey_scenes_table",
        "Таблица сцен путешествий в одиночку", [19, 26], payload,
        notes="Транскрибировано со скана стр. 19 (приложение стр. 26 идентично, сверено визуально). "
              "Благополучный/злополучный бросок по местности — стр. 19. "
              "Изнурение «—» у руны закодировано как null.",
    ))


# ----------------------------------------------------------- scene details
DETAIL_SOURCES = {
    "terrible_misfortune": ("УЖАСНАЯ НЕУДАЧА", 19, 26),
    "despair": ("ОТЧАЯНИЕ", 20, 26),
    "mishap": ("НЕПРИЯТНОСТЬ", 20, 27),
    "bad_choice": ("ПЛОХОЙ ВЫБОР", 20, 27),
    "short_cut": ("КОРОТКИЙ ПУТЬ", 20, 27),
    "chance_meeting": ("СЛУЧАЙНАЯ ВСТРЕЧА", 21, 27),
    "inspiring_sight": ("ВДОХНОВЛЯЮЩИЙ ВИД", 21, 28),
}

DETAIL_CONSEQUENCES = {
    "terrible_misfortune": {"trigger": "on_failure", "effects": [{"op": "wound"}]},
    "despair": {"trigger": "on_failure",
                "effects": [{"op": "shadow_points", "value": 2, "kind": "fear"}]},
    "mishap": {"trigger": "on_failure",
               "effects": [{"op": "journey_days_delta", "value": 1},
                           {"op": "fatigue_points", "value": 1}]},
    "bad_choice": {"trigger": "on_failure",
                   "effects": [{"op": "shadow_points", "value": 1, "kind": "fear"}]},
    "short_cut": {"trigger": "on_success",
                  "effects": [{"op": "journey_days_delta", "value": -1}]},
    "chance_meeting": {"trigger": "on_success", "effects": [{"op": "fatigue_waived"}]},
    "inspiring_sight": {"trigger": "on_success",
                        "effects": [{"op": "hope_points", "value": 1}]},
}


def build_details():
    for slug, (title, body_p, app_p) in DETAIL_SOURCES.items():
        body = parse_detail_table(page(body_p), title)
        appendix = parse_detail_table(page(app_p), title)
        notes = []
        for br, ar in zip(body["rows"], appendix["rows"]):
            for k in ("scene", "prompt"):
                if br[k] != ar[k]:
                    msg = f"face {br['face']} ({k}): тело «{br[k]}» / приложение «{ar[k]}»"
                    notes.append(msg)
                    DIFFS.append(f"- **Детали сцены: {title}**: {msg}")
        if body["consequence_text"] != appendix["consequence_text"]:
            msg = (f"подвал: тело «{body['consequence_text']}» / "
                   f"приложение «{appendix['consequence_text']}»")
            notes.append(msg)
            DIFFS.append(f"- **Детали сцены: {title}**: {msg}")
        payload = {
            "die": "success",
            "scene_type": slug,
            "rows": body["rows"],
            "check_consequence_text": body["consequence_text"],
            "check_consequence": DETAIL_CONSEQUENCES[slug],
            "fatigue_gain": body["fatigue_gain"],
        }
        emit(f"scene_details.{slug}", envelope(
            f"kv.solo.scene_details.{slug}", "scene_detail_table",
            f"Детали сцены: {title.capitalize()}", [body_p, app_p], payload,
            notes=("Диффы с приложением: " + "; ".join(notes)) if notes else
                  "Приложение идентично телу книги.",
        ))


# ----------------------------------------------------------------- patrons
PATRONS = [
    ("balin", "ЗАДАНИЯ ПОКРОВИТЕЛЯ: БАЛИН, СЫН ФУНДИНА", "Балин, сын Фундина", 7, 28),
    ("bilbo", "ЗАДАНИЯ ПОКРОВИТЕЛЯ: БИЛЬБО ТОРБИНС", "Бильбо Торбинс", 8, 29),
    ("cirdan", "ЗАДАНИЯ ПОКРОВИТЕЛЯ: КИРДАН КОРАБЕЛ", "Кирдан Корабел", 8, 29),
    ("gandalf", "ЗАДАНИЯ ПОКРОВИТЕЛЯ: ГЭНДАЛЬФ СЕРЫЙ", "Гэндальф Серый", 8, 29),
    ("gilraen", "ЗАДАНИЯ ПОКРОВИТЕЛЯ: ", "Гильраэн, дочь Дирхаэля", 9, 29),
    ("tom_and_goldberry", "ЗАДАНИЯ ПОКРОВИТЕЛЯ: ТОМ", "Том Бомбадил и леди Златеника", 9, 30),
]

PATRON_HEADERS = {
    "gilraen": "ЗАДАНИЯ ПОКРОВИТЕЛЯ: \nГИЛЬРАЭН, ДОЧЬ ДИРХАЭЛЯ",
    "tom_and_goldberry": "ЗАДАНИЯ ПОКРОВИТЕЛЯ: \nТОМ БОМБАДИЛ И ЛЕДИ ЗЛАТЕНИКА",
}
PATRON_HEADERS_APPENDIX = {
    "gilraen": "ЗАДАНИЯ ПОКРОВИТЕЛЯ: \nГИЛЬРАЭН, ДОЧЬ ДИРХАЭЛЯ",
    "tom_and_goldberry": "ЗАДАНИЯ ПОКРОВИТЕЛЯ: ТОМ \nБОМБАДИЛ И ЛЕДИ ЗЛАТЕНИКА",
    "balin": "ЗАДАНИЯ ПОКРОВИТЕЛЯ: \nБАЛИН, СЫН ФУНДИНА",
}


def build_patrons():
    for slug, header, name, body_p, app_p in PATRONS:
        bh = PATRON_HEADERS.get(slug, header)
        ah = PATRON_HEADERS_APPENDIX.get(slug, header)
        body = parse_patron_rows(page(body_p), bh)
        appendix = parse_patron_rows(page(app_p), ah)
        note = diff_rows(f"Задания покровителя: {name}", body, appendix)
        payload = {
            "die": "success",
            "patron": {"id": slug, "name": name},
            "rows": body,
        }
        emit(f"patron_tasks.{slug}", envelope(
            f"kv.solo.patron_tasks.{slug}", "patron_tasks_table",
            f"Задания покровителя: {name}", [body_p, app_p], payload,
            notes=(f"Диффы с приложением: {note}." if note else "Приложение идентично."),
        ))


# ----------------------------------------------------------------- lookups
def build_lookups():
    milestones = [
        ("Принять задание покровителя", 1, 0),
        ("Добиться важной личной цели", 1, 1),
        ("Завершить задание покровителя", 1, 1),
        ("Завершить важное путешествие", 0, 2),
        ("Значимая встреча в путешествии", 0, 1),
        ("Обнаружить важное место или находку", 1, 0),
        ("Преодолеть хитрое препятствие", 0, 1),
        ("Участвовать в Совете", 0, 1),
        ("Пережить опасное сражение", 1, 0),
        ("Пережить сцену обнаружения", 1, 0),
    ]
    emit("milestones", envelope(
        "kv.solo.milestones", "lookup_table", "Вехи и опыт", [9, 23],
        {
            "kind": "milestones",
            "rows": [
                {
                    "milestone": m,
                    "adventure_points": ap,
                    "skill_points": sp,
                    "reward_text": _reward_text(ap, sp),
                }
                for m, ap, sp in milestones
            ],
            "constraint": "Если в сцене или испытании достигнуто более одной вехи, выбирается только одна.",
        },
        notes="Заголовок колонки: в теле книги «НАГРАДА» (стр. 9), в приложении «ОПЫТ» (стр. 23); содержимое строк идентично.",
    ))

    emit("risk_degrees", envelope(
        "kv.solo.risk_degrees", "lookup_table", "Степени риска", [11, 26],
        {
            "kind": "risk_degrees",
            "rows": [
                {"key": "normal", "degree": "Обычная",
                 "failure_result": "Простой провал ИЛИ успех с осложнением",
                 "examples": "Ускользнуть от порубежника в Шире, развлечь толпу нетрезвых посетителей таверны, взобраться на высокое дерево."},
                {"key": "dangerous", "degree": "Опасная",
                 "failure_result": "Провал с осложнением",
                 "examples": "Стащить грибы с фермы, охраняемой свирепыми псами, взобраться на вершину обветшалых руин башни или переплыть бурную реку."},
                {"key": "reckless", "degree": "Безрассудная",
                 "failure_result": "Катастрофа!",
                 "examples": "Обчистить карманы голодного тролля, сыграть в загадки с драконом или поспорить с рассерженным волшебником."},
            ],
            "default": "normal",
            "oracle_rule": "Если не знаете, какую выбрать для испытания, обратитесь к таблице ответов (стр. 12). Спросите «Это обычная Степень риска?» используя вероятность «возможно». Если ответ «нет», то степень риска Опасная, а если «нет» со знаком [Око], то Безрассудная.",
        },
        notes="Источник — стр. 11; приложение (стр. 26) идентично, сверено со сканом. Конвенция: [Око]/[руна] = инлайн-глиф книги, утраченный в наборе.",
    ))

    emit("special_successes", envelope(
        "kv.solo.special_successes", "lookup_table",
        "Особые успехи при проверках навыков", [11],
        {
            "kind": "special_successes",
            "spend_rule_text": "Выберите 1 эффект для каждого выпавшего знака [успеха].",
            "engine_note": "1 эффект за 1 потраченный знак успеха.",
            "rows": [
                {"key": "learn_something", "label": "Узнать что-то",
                 "description": "Герой получает дополнительную информацию, не обязательно связанную с текущей задачей. Например, помогая больному с помощью проверки ИСЦЕЛЕНИЯ, он обнаруживает следы яда. Или, пробираясь в руины с помощью проверки СКРЫТНОСТИ, он замечает часового."},
                {"key": "be_silent", "label": "Быть бесшумным",
                 "description": "Герой достигает своей цели бесшумно или не привлекая к себе внимания иным образом."},
                {"key": "be_swift", "label": "Быть быстрым",
                 "description": "Герой выполняет задачу быстрее (примерно за половину ожидаемого времени)."},
                {"key": "widen_influence", "label": "Расширить влияние",
                 "description": "Герой может повлиять на большее количество объектов, чем изначально подразумевало действие. Как правило, за каждый потраченный знак успеха можно повлиять на один дополнительный объект или группу объектов. Например, при проверке ПРОНИЦАТЕЛЬНОСТИ герой замечает второго персонажа, ведущего себя подозрительно в трактире; при проверке ВООДУШЕВЛЕНИЯ для влияния на полдесятка присутствующих герой повлиял на целый десяток."},
                {"key": "gain_advantage", "label": "Получить преимущество",
                 "description": "Успех героя укрепляет позицию или уверенность в схожем деле; игрок получает 1к к следующей проверке навыка."},
                {"key": "cancel_failure", "label": "Отменить провал",
                 "description": "В игре с другими игроками, если в проверке навыка участвует несколько героев, можно помочь тому, проверка за которого была провалена (тогда провал при броске за него считается успехом)."},
            ],
            "precedence": "Если результат для знака [успеха] уже описан другими правилами или способностями героя, используйте их вместо таблицы выше.",
        },
        notes="Альтернатива таблице особых успехов книги основных правил (стр. 19 КВ). В приложении ИдО не повторяется. «Отменить провал» применим только в совместной игре. Конвенция: [успеха] = инлайн-глиф знака успеха, утраченный в наборе.",
    ))

    emit("shadow_recovery", envelope(
        "kv.solo.shadow_recovery", "lookup_table",
        "Духовное восстановление героев-одиночек", [22],
        {
            "kind": "shadow_recovery",
            "rows": [
                {"shadow_removed": 1,
                 "text": "Если действия вашего героя хотя бы немного помешали возвращению Тени, уберите 1 балл Тени."},
                {"shadow_removed": 2,
                 "text": "Если герой своими поступками активно препятствовал Врагу или нанёс ему вред, уберите 2 балла Тени."},
                {"shadow_removed": 3,
                 "text": "Если герой совершил подвиги, которые могли привлечь внимание самого Тёмного Повелителя или хотя бы одного из его главных слуг, уберите 3 балла Тени."},
            ],
            "phase": "fellowship",
        },
        notes="Врезка стр. 22, текст дословный; решение о ярусе принимает игрок (в движке — выбор игрока, не бросок).",
    ))


def _reward_text(ap: int, sp: int) -> str:
    parts = []
    if ap:
        parts.append(f"{ap} балл{'а' if ap > 1 else ''} приключений")
    if sp:
        parts.append(f"{sp} балл{'а' if sp > 1 else ''} навыков")
    return " и ".join(parts)


# ---------------------------------------------------------- rule parameters
def build_params():
    emit("eye_of_mordor", envelope(
        "kv.solo.eye_of_mordor", "rule_parameters", "Око Мордора", [15, 16, 28],
        {
            "initial_rating": {
                "base": 0,
                "modifiers": [
                    {"condition": "valour_gte_4", "value": 1,
                     "text": "+1, если рейтинг ДОБЛЕСТИ героя равен 4 или выше."},
                    {"condition": "culture_dwarf", "value": 1, "text": "+1, если герой — гном."},
                    {"condition": "culture_elf_or_dunedain", "value": 2,
                     "text": "+2, если герой — эльф или дунэдайн."},
                    {"condition": "culture_high_elf", "value": 3,
                     "text": "+3, если герой — высший эльф."},
                    {"condition": "per_famous_weapon_or_armour", "value": 1,
                     "text": "+1 за каждое Знаменитое оружие и броню, которые носит герой."},
                ],
            },
            "growth_triggers": [
                {"trigger": "eye_on_feat_die_out_of_combat", "value": 1,
                 "text": "Каждый раз, когда при броске кости вне боя выпадает знак [Око], независимо от результата проверки, увеличьте рейтинг Бдительности Ока на 1 балл.",
                 "engine_note": "По канону КВ знак Ока существует только на Кости испытания — триггер слушает её."},
                {"trigger": "shadow_points_gained_out_of_combat", "value": "per_point",
                 "text": "Каждый раз, когда ваш герой получает 1 или несколько баллов тени вне боя, увеличьте рейтинг Бдительности Ока на это число."},
                {"trigger": "magical_success_via_wondrous_item", "value": "per_core_rules",
                 "text": "Применение Дивных артефактов или Чудесных предметов для получения волшебного успеха может увеличить рейтинг Бдительности Ока, как указано в книге основных правил (стр. 171)."},
                {"trigger": "eye_result_on_misfortune_table", "value": 2,
                 "text": "Кроме того, результат [Око] при броске по таблице неудачи (стр. 10) увеличивает рейтинг Бдительности Ока на 2 вдобавок к увеличению за начальный результат [Око], вызвавший бросок по таблице. Око следит за вами."},
            ],
            "pursuit_thresholds": {"border_lands": 18, "wild_lands": 16, "dark_lands": 14},
            "pursuit_modifiers": [
                {"value": 4, "text": "Герой защищён благословением волшебника или другого сильного персонажа."},
                {"value": 2, "text": "Герой путешествует под ложным именем, выбирает редко используемые тропы или действует скрытно и незаметно."},
                {"value": -2, "text": "Герой стал очень известен в этих местах благодаря выдающемуся поступку."},
                {"value": -4, "text": "Враг ведёт активные поиски героя либо узнал о его задании или намерениях."},
            ],
            "on_threshold_reached": "detection_scene",
            "after_detection_scene": "reset_to_initial",
            "fellowship_phase": "Рейтинг Бдительности Ока не увеличивается во время Фазы братства. В начале следующей Фазы приключений сбросьте рейтинг до начального значения.",
        },
        notes="Стр. 15–16; тексты триггеров дословные, конвенция [Око] = инлайн-глиф; интерпретации движка — в engine_note. Модификаторы преследования сверены по стр. 15 (тело) и 28 (приложение): формулировки слегка расходятся («иного/другого сильного персонажа», «или ему стало известно/либо узнал»), числа идентичны. В payload — версия тела книги.",
    ))

    emit("hero_adjustments", envelope(
        "kv.solo.hero_adjustments", "rule_parameters",
        "Соло-правки создания героя и проверок", [6, 7, 10],
        {
            "previous_experience_points": 15,
            "fellowship_rating_base": 3,
            "target_number_base": 18,
            "target_number_formula": "18 − рейтинг характеристики (альтернативный метод КВ, стр. 18)",
            "important_companion": False,
            "extra_distinctive_quality": {
                "id": "wanderer", "name": "Странник",
                "text": "При проверках навыков в путешествии герой считается вдохновлённым.",
            },
            "recommended_callings": ["вестник", "искатель сокровищ", "страж"],
        },
        notes="Стр. 6 (15 баллов опыта, братство 3, безопасное место), стр. 7 (без Важного товарища, Странник), стр. 10 (ЦЧ = 18 − рейтинг).",
    ))


def main():
    build_answers()
    build_lore()
    build_feat_events()
    build_journey()
    build_details()
    build_patrons()
    build_lookups()
    build_params()
    diffs_path = OUT.parents[2] / "DUPLICATE_DIFFS.md"
    diffs_path.write_text(
        "# Расхождения тело книги ↔ приложение («Игра для одного»)\n\n"
        "Канонической принята версия тела книги; решение за Иваном при верификации.\n\n"
        + ("\n".join(DIFFS) + "\n" if DIFFS else "Расхождений не найдено.\n"),
        encoding="utf-8",
    )
    print(f"  wrote {diffs_path}")
    print(f"\n{len(list(OUT.glob('*.json')))} JSON files; {len(DIFFS)} duplicate diffs recorded")


if __name__ == "__main__":
    main()
