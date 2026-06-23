"""Segment КВ pages 14–123 into rule-card skeletons (stage 0, session 3a).

Skeletons carry verbatim source_text (whitespace-normalized slice of the
layer) and live in tools/extraction/staging_3a/ — NOT in content-packs/ —
until curated (summary + parameters) batch by batch. Header search tolerates
the layer's letter-spacing artifacts and case differences.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).parent
STAGING = HERE / "staging_3a"
LAYER = (HERE / "source_kv" / "kv_core.txt").read_text(encoding="utf-8")
TOC = json.loads(Path("/tmp/toc_3a.json").read_text(encoding="utf-8"))

# известные расхождения заголовков TOC и тела
ALIASES = {"Значение Костей испытания": "значения костей испытания"}

BODY_START = LAYER.find("СОДЕРЖАНИЕ") + 4300
NORM = re.sub(r"\s+", " ", LAYER.replace("\u0002", "")).strip()
# позиция тела в нормализованном тексте: ищем первый заголовок главы после TOC
_first = "Чтобы получить такую силу"
BODY_NORM_START = NORM.find(_first)

CHAPTERS = {"выполнение действий", "искатели приключений", "отличия",
            "доблесть и мудрость", "фаза приключений", "фаза братства"}

# правая граница 3a: глава «Хранитель» (стр. 124)
END_3A_M = re.compile(r"х\s*р\s*а\s*н\s*и\s*т\s*е\s*л\s*ь", re.IGNORECASE)

SUBSYSTEM_BY_SECTION = {
    "СОСТОЯНИЯ": "conditions",
    "ВЫНОСЛИВОСТЬ И НАДЕЖДА": "endurance_hope",
    "ОБРАЗ ЖИЗНИ": "standard_of_living",
    "БОЕВОЕ СНАРЯЖЕНИЕ": "equipment",
    "СТАРТОВОЕ СНАРЯЖЕНИЕ": "hero_creation",
    "НАГРАДЫ": "rewards_virtues",
    "ОСОБЕННОСТИ": "rewards_virtues",
    "КУЛЬТУРНЫЕ ОСОБЕННОСТИ": "rewards_virtues",
    "БОЙ": "combat",
    "СОВЕТ": "council",
    "ПУТЕШЕСТВИЕ": "journey",
}
SUBSYSTEM_BY_CHAPTER = {
    "выполнение действий": "checks",
    "искатели приключений": "hero_creation",
    "отличия": "traits",
    "доблесть и мудрость": "valour_wisdom",
    "фаза приключений": "keeper_tools",  # перекрывается секциями выше
    "фаза братства": "fellowship_phase",
}

TRANSLIT = dict(zip(
    "абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
    ["a","b","v","g","d","e","e","zh","z","i","y","k","l","m","n","o","p","r",
     "s","t","u","f","h","ts","ch","sh","sch","","y","","e","yu","ya"]))


def slug(title: str) -> str:
    s = "".join(TRANSLIT.get(c, c) for c in title.lower())
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s[:48]


def loose_pattern(title: str) -> re.Pattern:
    """Заголовок с допуском: разрядка внутри слов, регистр, переносы."""
    parts = []
    for ch in title:
        if ch == " ":
            parts.append(r"\s+")
        else:
            parts.append(re.escape(ch) + r"\s*")
    return re.compile("".join(parts), re.IGNORECASE)


def main() -> None:
    global END_3A
    # ищем границу с конца зоны: последний заголовок главы Хранитель в верхней половине хвоста
    tail = NORM[BODY_NORM_START:]
    mfb = loose_pattern("фаза братства").search(NORM, BODY_NORM_START)
    m = loose_pattern("глава 8").search(NORM, mfb.end() if mfb else BODY_NORM_START)
    if not m:
        m = loose_pattern("инструменты хранителя").search(NORM, BODY_NORM_START)
    END_3A = m.start() if m else len(NORM)
    STAGING.mkdir(exist_ok=True)
    import shutil
    for old in STAGING.glob("*.json"):
        old.unlink()
    hits = []
    missed = []
    # все вхождения каждого заголовка в зоне 3a
    occs = []
    for e in TOC:
        probe = ALIASES.get(e["title"], e["title"])
        pat = loose_pattern(probe)
        found = [(m.start(), m.end()) for m in pat.finditer(NORM, BODY_NORM_START)
                 if m.start() < END_3A]
        occs.append(found)

    # анти-колонтитул: вхождение T внутри фразы родительского заголовка
    def guarded(i, occ_list):
        title = TOC[i]["title"].lower()
        parents = set()
        for j in range(i - 1, -1, -1):
            tj = TOC[j]["title"].lower()
            if title in tj and title != tj:
                parents.add(tj)
            if TOC[j]["title"] in CHAPTERS:
                break
        out = []
        for st, en in occ_list:
            tail = NORM[en:en + 110]
            if any(p.split(title, 1)[1].strip()[:12] and
                   tail.lower().lstrip().startswith(p.split(title, 1)[1].strip()[:12])
                   for p in parents if title in p):
                continue
            # перечисление/колонтитул: рядом заголовок следующей записи
            near_next = False
            for j in (i + 1, i + 2):
                if j < len(TOC):
                    if loose_pattern(TOC[j]["title"]).search(tail):
                        near_next = True
                        break
            if near_next:
                continue
            out.append((st, en))
        return out

    # DP с конца: вхождение entry i допустимо, если существует допустимое
    # вхождение entry i+1 на расстоянии >= min_gap(i) от его конца.
    # min_gap: 0 для секционных шапок (контента может не быть), 60 для leaf.
    guarded_occs = [guarded(i, occs[i]) for i in range(len(TOC))]
    def min_gap(i):
        return 0 if TOC[i]["title"].upper() == TOC[i]["title"] or TOC[i]["title"] in CHAPTERS else 60

    feasible = [set() for _ in TOC]
    n = len(TOC)
    for i in range(n - 1, -1, -1):
        nxt_idx = next((j for j in range(i + 1, n) if guarded_occs[j]), None)
        for k, (st, en) in enumerate(guarded_occs[i]):
            if nxt_idx is None:
                feasible[i].add(k)
            else:
                if any((st2 >= en + min_gap(i)) and (k2 in feasible[nxt_idx])
                       for k2, (st2, _) in enumerate(guarded_occs[nxt_idx])):
                    feasible[i].add(k)

    cursor = BODY_NORM_START
    for i, e in enumerate(TOC):
        cand = [(k, o) for k, o in enumerate(guarded_occs[i])
                if o[0] >= cursor and k in feasible[i]]
        if not cand:
            cand = [(k, o) for k, o in enumerate(guarded_occs[i]) if o[0] >= cursor]
        if not cand:
            missed.append(e["title"])
            hits.append(None)
            continue
        pick = cand[0][1]
        hits.append(pick)
        cursor = pick[1] + min_gap(i)

    chapter = section = None
    written = 0
    for i, e in enumerate(TOC):
        title = e["title"]
        if title in CHAPTERS:
            chapter = title
            section = None
            continue
        is_caps = title.upper() == title
        if is_caps:
            section = title
        if hits[i] is None:
            continue
        start = hits[i][1]
        nxt = next((h[0] for h in hits[i + 1:] if h), END_3A)
        seg = NORM[start:nxt].strip()
        nxt_page = next((x["page"] for x in TOC[i + 1:]), e["page"])
        pages = sorted({e["page"], max(e["page"], nxt_page if nxt_page >= e["page"] else e["page"])})
        subsystem = (SUBSYSTEM_BY_SECTION.get(section)
                     or SUBSYSTEM_BY_CHAPTER.get(chapter, "keeper_tools"))
        sec_path = " → ".join(x for x in [chapter, None if is_caps else section, title] if x)
        doc = {
            "status": "skeleton",
            "id": f"kv.mechanics.{subsystem}.{slug(title)}",
            "title": title.capitalize() if is_caps else title,
            "level": "section" if is_caps else "leaf",
            "section": sec_path,
            "pages": pages,
            "subsystem": subsystem,
            "source_text": [seg],
            "summary": "",
            "parameters": {},
            "related": [],
        }
        if len(seg) < 60 and is_caps:
            continue  # структурная шапка без собственного контента
        if len(seg) < 60:
            print(f"  WARN короткий leaf-сегмент: {title} ({len(seg)})")
        out = STAGING / f"{subsystem}.{slug(title)}.json"
        out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        written += 1

    print(f"скелетов записано: {written}; заголовков не найдено: {len(missed)}")
    for t in missed:
        print("  MISS:", t)
    lens = sorted((len(json.loads(p.read_text())["source_text"][0]), p.name)
                  for p in STAGING.glob("*.json"))
    print("самые короткие сегменты (подозрение на промах):")
    for n, name in lens[:6]:
        print(f"  {n:>6}  {name}")
    print("самые длинные:")
    for n, name in lens[-4:]:
        print(f"  {n:>6}  {name}")


if __name__ == "__main__":
    main()
