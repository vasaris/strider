"""Parsers for the four regular table families of «Игра для одного».

Rune handling: rune glyphs are image glyphs in the book and are LOST in the
text layer. Their position is reconstructed by the layout convention verified
visually against page scans (pp. 13, 16, 19, 23):
  - feat-die row tables: Eye row FIRST (unnumbered), then 1..10, Gandalf rune
    row LAST (unnumbered);
  - lore tables: Eye SECTION first, Gandalf rune section second, then 1..10.
Canonical numeric mapping (core rulebook, «выполнение проверок»):
  Eye of Sauron = 11, Gandalf rune = 12 on a plain d12.
"""
from __future__ import annotations

import re

from postprocess import norm_cell

ROW_NUM = re.compile(r"^(10|[1-9])\s+(.*)$")

SKILLS = {
    "ОХОТА": "hunting",
    "ИССЛЕДОВАНИЕ": "exploration",
    "БДИТЕЛЬНОСТЬ": "awareness",
}


def _segment(text: str, start_marker: str, end_markers: list[str]) -> str:
    i = text.find(start_marker)
    if i < 0:
        raise ValueError(f"marker not found: {start_marker!r}")
    j = len(text)
    for m in end_markers:
        k = text.find(m, i + len(start_marker))
        if 0 <= k < j:
            j = k
    return text[i:j]


def parse_feat_event(segment: str) -> list[dict]:
    """12-row feat-die table. Returns [{'face': ..., 'text': ...}]."""
    lines = [l.strip() for l in segment.split("\n") if l.strip()]
    buckets: list[tuple[object, list[str]]] = []
    seen_num = 0
    for line in lines:
        m = ROW_NUM.match(line)
        nxt = int(m.group(1)) if m else None
        if m and nxt == seen_num + 1 and seen_num < 10:
            seen_num = nxt
            buckets.append((seen_num, [m.group(2)]))
        elif not buckets:
            buckets.append(("eye", [line]))
        elif seen_num == 10 and _ends_sentence(buckets[-1][1]):
            # first complete-sentence boundary after row 10 -> rune row
            buckets.append(("gandalf_rune", [line]))
            seen_num = 11  # stop splitting further; append continuations
        else:
            buckets[-1][1].append(line)
    rows = [{"face": f, "text": norm_cell(" ".join(parts))} for f, parts in buckets]
    faces = [r["face"] for r in rows]
    expected = ["eye", *range(1, 11), "gandalf_rune"]
    if faces != expected:
        raise ValueError(f"face sequence mismatch: {faces}")
    return rows


def _ends_sentence(parts: list[str]) -> bool:
    return " ".join(parts).rstrip().endswith((".", "!", "?", "»"))


def parse_lore_sections(text: str) -> list[dict]:
    """Lore table: 12 sections × 6 rows × (action, aspect, focus)."""
    chunks = re.split(r"КОСТЬ ИСПЫТАНИЯ:\s*", text)[1:]
    sections: list[dict] = []
    for chunk in chunks:
        header_line, _, body = chunk.partition("\n")
        face: object
        hv = header_line.strip()
        if hv.isdigit():
            face = int(hv)
        else:
            # rune glyph lost in the text layer -> assigned by verified
            # layout convention: first blank header = Eye, second = rune
            face = "eye" if not any(s["face"] == "eye" for s in sections) else "gandalf_rune"
        rows = []
        for line in body.split("\n"):
            line = line.strip()
            m = re.match(r"^([1-6])\s+(\S+)\s+(\S+)\s+(\S+)\s*$", line)
            if m and int(m.group(1)) == len(rows) + 1:
                rows.append(
                    {"action": m.group(2), "aspect": m.group(3), "focus": m.group(4)}
                )
            if len(rows) == 6:
                break
        if len(rows) != 6:
            raise ValueError(f"section {face}: {len(rows)} rows parsed, want 6")
        sections.append({"face": face, "rows": rows})
    return sections


def parse_detail_table(text: str, title: str) -> dict:
    """One «ДЕТАЛИ СЦЕНЫ: X» block: 6 success-die rows + footer."""
    seg = _segment(
        text,
        f"ДЕТАЛИ СЦЕНЫ: {title}",
        ["ДЕТАЛИ СЦЕНЫ:", "ЗНАЧИМЫЕ ВСТРЕЧИ", "РЕГИОНЫ И ПОРОГ"],
    )
    seg = seg[len("ДЕТАЛИ СЦЕНЫ: ") + len(title):]
    footer_m = re.search(
        r"ПОСЛЕДСТВИЯ ПРОВЕРКИ НАВЫК(?:А|ОВ)\.\s*(.*?)\s*ПОЛУЧАЕМЫЕ БАЛЛЫ ИЗНУРЕНИЯ:\s*([0-9]+|—)",
        seg,
        re.S,
    )
    if not footer_m:
        raise ValueError(f"{title}: footer not found")
    consequence_text = norm_cell(footer_m.group(1))
    fat = footer_m.group(2)
    fatigue = None if fat == "—" else int(fat)
    body = seg[: footer_m.start()]

    lines = [l.strip() for l in body.split("\n") if l.strip()]
    raw_rows: list[list[str]] = []
    for line in lines:
        m = re.match(r"^([1-6])\s+(.*)$", line)
        if m and int(m.group(1)) == len(raw_rows) + 1:
            raw_rows.append([m.group(2)])
        elif raw_rows:
            raw_rows[-1].append(line)
    if len(raw_rows) != 6:
        raise ValueError(f"{title}: {len(raw_rows)} rows, want 6")

    rows = []
    for i, parts in enumerate(raw_rows, 1):
        cell = norm_cell(" ".join(parts))
        rows.append({"face": i, **_split_scene_result(cell, title)})
    return {"rows": rows, "consequence_text": consequence_text, "fatigue_gain": fatigue}


def _split_scene_result(cell: str, ctx: str) -> dict:
    """Split a detail-table cell into scene / result on the first marker:
    an ALL-CAPS skill name or the literal «Значимая встреча»."""
    m = re.search(r"(ОХОТА|ИССЛЕДОВАНИЕ|БДИТЕЛЬНОСТЬ|Значимая встреча)", cell)
    if not m:
        raise ValueError(f"{ctx}: no result marker in cell: {cell!r}")
    scene = cell[: m.start()].strip()
    result = cell[m.start():].strip()
    skill = SKILLS.get(m.group(1))  # None for «Значимая встреча»
    out = {"scene": scene, "prompt": result, "skill": skill}
    if result == "Значимая встреча":
        out["significant_encounter"] = True
    return out


def parse_patron_rows(text: str, header: str) -> list[dict]:
    """6 task rows for one patron."""
    seg = _segment(
        text, header, ["ЗАДАНИЯ ПОКРОВИТЕЛЯ:", "Вехи и опыт", "ИСПОЛЬЗОВАНИЕ ДРУГИХ"]
    )
    seg = seg[len(header):]
    seg = re.sub(r"КОСТЬ\s+УСПЕХА\s+ЗАДАНИЕ", "", seg)
    lines = [l.strip() for l in seg.split("\n") if l.strip()]
    raw: list[list[str]] = []
    for line in lines:
        m = re.match(r"^([1-6])\s+(.*)$", line)
        if m and int(m.group(1)) == len(raw) + 1:
            raw.append([m.group(2)])
        elif raw:
            raw[-1].append(line)
        # leading junk before row 1 is dropped
    if len(raw) != 6:
        raise ValueError(f"{header}: {len(raw)} rows, want 6")
    return [
        {"face": i, "text": norm_cell(" ".join(parts))} for i, parts in enumerate(raw, 1)
    ]
