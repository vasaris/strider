"""Build content-packs/kv/lifepaths/*.json from «Жизненные пути героев».

THROWAWAY TOOLING (stage 0, session 2). Backgrounds are parsed from the text
layer; the events table uses curated row anchors (became-labels and
quote-start prefixes transcribed from pages 10–11) because the effect/quote
boundary is typographic (italics), invisible in the text layer. Vision gate
verifies the splits against scans.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from postprocess import page, norm_cell

BOOK = "zhizn_puti_geroev"
OUT = Path(__file__).parents[2] / "content-packs" / "kv" / "lifepaths"
EDITION = "на_рассылку_03_04_2026"

CULTURES = [
    ("bardings", "Бардинги", 4),
    ("dwarves_of_durins_folk", "Гномы народа Дурина", 5),
    ("elves_of_lindon", "Эльфы Линдона", 6),
    ("hobbits_of_the_shire", "Хоббиты Шира", 7),
    ("men_of_bree", "Люди Бри", 8),
    ("rangers_of_the_north", "Следопыты Севера", 9),
]


def envelope(id_: str, type_: str, title: str, pages: list[int], payload: dict,
             notes: str = "") -> dict:
    return {
        "schema_version": "1.0",
        "id": id_,
        "type": type_,
        "title": title,
        "source": {"book": BOOK, "edition": EDITION, "pages": pages},
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
    print(f"  wrote {p}")


# ---------------------------------------------------------------- cultures
def build_cultures():
    payload = {
        "die": "success",
        "rows": [
            {"face": i + 1, "culture_id": cid, "name": name}
            for i, (cid, name, _) in enumerate(CULTURES)
        ],
    }
    emit("cultures", envelope(
        "kv.lifepaths.cultures", "lifepath_cultures", "Таблица культур героев",
        [3], payload,
        notes="Порядок 1–6 как в книге; culture_id — стабильные слаги движка.",
    ))


# ------------------------------------------------------------- backgrounds
ROW_RE = re.compile(r"^([1-6])\s+([А-ЯЁ][А-ЯЁ \u2014,«»\-]+?)\s*$")
ATTR_RE = re.compile(r"СИЛА\s+(\d+),\s*СЕРДЦЕ\s+(\d+),\s*РАЗУМ\s+(\d+)")
SKILL_RE = re.compile(r"ЛЮБИМЫЙ НАВЫК:\s*(.+)")
QUAL_RE = re.compile(r"ОТЛИЧИТЕЛЬНЫЕ КАЧЕСТВА:\s*(.+)")


def parse_backgrounds(text: str) -> list[dict]:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    rows: list[dict] = []
    cur: dict | None = None
    prose: list[str] = []
    bullets: list[str] = []

    def flush():
        nonlocal cur, prose, bullets
        if cur is None:
            return
        blob = " ".join(bullets)
        am, sm, qm = ATTR_RE.search(blob), SKILL_RE.search(blob), QUAL_RE.search(blob)
        if not (am and sm and qm):
            raise ValueError(f"row {cur['face']} «{cur['title']}»: bullets incomplete: {blob!r}")
        skill = sm.group(1)
        skill = re.split(r"\s*♦\s*|ОТЛИЧИТЕЛЬНЫЕ", skill)[0].strip()
        quals = [q.strip() for q in qm.group(1).split(",")]
        if len(quals) != 2:
            raise ValueError(f"row {cur['face']}: qualities != 2: {quals}")
        cur.update({
            "story": norm_cell(" ".join(prose)),
            "attributes": {"strength": int(am.group(1)), "heart": int(am.group(2)),
                            "wits": int(am.group(3))},
            "favoured_skill": skill,
            "distinctive_features": quals,
        })
        rows.append(cur)
        cur, prose, bullets = None, [], []

    for line in lines:
        m = ROW_RE.match(line)
        expected = (cur["face"] + 1) if cur else 1
        if m and int(m.group(1)) == expected:
            flush()
            cur = {"face": int(m.group(1)), "title": norm_cell(m.group(2))}
        elif cur is not None:
            if line.startswith("♦") or bullets:
                bullets.append(line.lstrip("♦ ").strip())
            else:
                prose.append(line)
    flush()
    if len(rows) != 6:
        raise ValueError(f"{len(rows)} backgrounds parsed, want 6")
    return rows


def build_backgrounds():
    for cid, name, pg in CULTURES:
        rows = parse_backgrounds(page(pg, BOOK))
        emit(f"backgrounds.{cid}", envelope(
            f"kv.lifepaths.backgrounds.{cid}", "lifepath_backgrounds",
            f"Предыстории: {name}", [pg],
            {"die": "success", "culture": {"id": cid, "name": name}, "rows": rows},
            notes="Навыки и качества — русскими строками дословно; слаги появятся с реестром навыков КВ (сессия mechanics).",
        ))


# ------------------------------------------------------------------ events
# Curated row anchors: became-labels and quote-start prefixes, transcribed
# from pp. 10–11. The effect/quote boundary is italics in print — invisible
# in the text layer — so the split is config, verified by the vision gate.
EVENTS = [
    ("eye", "…преследуемым Тенью", "...он решил поплыть",
     [{"op": "shadow_scar", "value": 1},
      {"op": "previous_experience_delta", "value": 10}], None),
    (1, "…беднее", "...нам пришлось зарабатывать",
     [{"op": "standard_of_living_delta", "value": -1},
      {"op": "previous_experience_delta", "value": 5}], None),
    (2, "…не слишком умным", "«Ведь нужно же,",
     [{"op": "tn_delta", "attribute": "wits", "value": 1},
      {"op": "tn_delta", "attribute": "choice", "value": -1, "choice": True}], None),
    (3, "…угрюмым", "Им командовал Бард,",
     [{"op": "tn_delta", "attribute": "heart", "value": 1},
      {"op": "tn_delta", "attribute": "choice", "value": -1, "choice": True}], None),
    (4, "…неуклюжим", "Они всё ещё стояли",
     [{"op": "tn_delta", "attribute": "strength", "value": 1},
      {"op": "tn_delta", "attribute": "choice", "value": -1, "choice": True}], None),
    (5, "…затворником", "Однажды ночью я видел",
     [{"op": "fellowship_rating_delta", "value": -1},
      {"op": "favoured_skill_add", "count": 1, "choice": True}], None),
    (6, "…весельчаком", "Четверо хоббитов,",
     [{"op": "fellowship_rating_delta", "value": 1},
      {"op": "favoured_skill_remove", "count": 1, "choice": True}], None),
    (7, "…слабым", "Стройнее березки",
     [{"op": "endurance_delta", "value": -2},
      {"op": "parry_delta", "value": 1}], None),
    (8, "…простодушным", "Пока простецы живут",
     [{"op": "hope_delta", "value": 2},
      {"op": "favoured_skill_remove", "count": 2, "choice": True}], None),
    (9, "…сильным", "Гимли поднялся,",
     [{"op": "endurance_delta", "value": 2},
      {"op": "parry_delta", "value": -1}], None),
    (10, "…счастливчиком", "...кроме того, кажется,",
     [{"op": "standard_of_living_delta", "value": 1},
      {"op": "previous_experience_delta", "value": -5}], None),
    ("gandalf_rune", "…протеже Серого волшебника", "О своих делах",
     [{"op": "eye_awareness_delta", "value": 2},
      {"op": "treat_feat_roll", "from": 1, "as": 11}],
     "НЕОДНОЗНАЧНОСТЬ для этапа 1: «считайте выпавшую 1 за 11» — по канону КВ 11 на d12 = Око; "
     "благословение, превращающее 1 в Око, подозрительно. Интерпретацию решать по правилам при "
     "реализации движка, не по памяти. treat_feat_roll хранит букву текста."),
]


def parse_events() -> list[dict]:
    text = page(10, BOOK) + "\n" + page(11, BOOK)
    text = norm_cell(text)
    body = text[text.find("…преследуемым"):]  # всё до первой became-метки отрезано
    rows: list[dict] = []
    for i, (face, became, qstart, effects, note) in enumerate(EVENTS):
        b = body.find(became)
        if b < 0:
            raise ValueError(f"became not found: {became!r}")
        nxt = len(body)
        if i + 1 < len(EVENTS):
            # следующий якорь: номер строки + became (или просто became для рун)
            nb, nbecame = EVENTS[i + 1][0], EVENTS[i + 1][1]
            probe = body.find(nbecame, b + len(became))
            if probe < 0:
                raise ValueError(f"next became not found after {became!r}")
            # включаем возможный числовой маркер перед меткой
            num_m = re.search(rf"\s{nb}\s*$", body[:probe]) if isinstance(nb, int) else None
            nxt = num_m.start() if num_m else probe
        cell = body[b + len(became):nxt].strip()
        q = cell.find(qstart)
        if q < 0:
            raise ValueError(f"quote start not found for {became!r}: {qstart!r}")
        effect_text = norm_cell(cell[:q])
        quote = norm_cell(cell[q:])
        # хвост заголовка стр. 11 («КОСТЬ ИСПЫТ. ПОВЗРОСЛЕВ, ГЕРОЙ СТАЛ… ЭФФЕКТ») чистим
        for junk in ("КОСТЬ ИСПЫТ. ПОВЗРОСЛЕВ, ГЕРОЙ СТАЛ… ЭФФЕКТ",
                     "ЖИЗНЕННЫЕ ПУТИ ГЕРОЕВ 11", "11 ЖИЗНЕННЫЕ ПУТИ ГЕРОЕВ"):
            quote = quote.replace(junk, "").strip()
            effect_text = effect_text.replace(junk, "").strip()
        row = {"face": face, "became": became, "effect_text": effect_text,
               "quote": quote, "effects": effects}
        if note:
            row["engine_note"] = note
        rows.append(row)
    return rows


def build_events():
    rows = parse_events()
    emit("events", envelope(
        "kv.lifepaths.events", "lifepath_events", "Таблица основных событий",
        [10, 11],
        {"die": "feat", "rows": rows},
        notes="Око — первая строка, руна — последняя (позиционная конвенция, на vision-сверку). "
              "Граница эффект/цитата — курсив в наборе, в слое не видна: разрез по курируемым "
              "якорям цитат, проверяется vision-гейтом. Цитаты-флейвор — часть строки таблицы в книге.",
    ))


def main():
    build_cultures()
    build_backgrounds()
    build_events()
    print(f"\n{len(list(OUT.glob('*.json')))} lifepath JSON files")


if __name__ == "__main__":
    main()
