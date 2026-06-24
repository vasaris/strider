"""Gate-2b (ADR-002) vision spotcheck for the training-cost ladder, folio 119.

Card: fellowship_phase.struktura_fazy_bratstva -> parameters.training_cost

Resolves the F4 open-item: the СТОИМОСТЬ ОБУЧЕНИЯ table has three columns that the
PDF text layer scrambles, because column 1 ("УРОВЕНЬ НОВОГО БОЕВОГО УМЕНИЯ ИЛИ
НАВЫКА") is rendered as pictographic pips (1..6) that the text layer drops entirely.
The level<->cost binding was therefore resolved from the rendered page image
(folio 119 = PDF page 120; offset PDF = folio + 1), per ADR-002.

EXPECTED was transcribed independently from the rendered page image, NOT copied
from the card:

    C1 skill/weapon-skill level | C2 valour/wisdom level | C3 cost
              1 (one pip)       |          --             |   4
              2                 |           2             |   8
              3                 |           3             |  12
              4                 |           4             |  20
              5                 |           5             |  26
              6                 |           6             |  30

Negative control: the numeric tokens the text layer DID carry for this table are
exactly the C2+C3 columns interleaved after the leading row's lone cost, i.e.
[row1.cost] + flatten[(row.vw_level, row.cost) for row in rows[1:]]. We parse that
stream straight out of the card's own source_text and require it to equal both the
EXPECTED reconstruction and the card reconstruction. This ties the resolved table to
the verbatim gate-1 cut (catching any C2/C3 drift) while documenting C1 as a
scan-only pip column.

Run:  python3 verify_gate2b_training_cost.py
NB: does NOT set verified:true (only mark_verified.py does, after gate 2a + 3).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

MECH = Path(__file__).parent.parents[1] / "content-packs" / "kv" / "mechanics"
CARD = "fellowship_phase.struktura_fazy_bratstva"

# Independently transcribed from the folio-119 image: (skill_level, vw_level, cost)
EXPECTED = [
    (1, None, 4),
    (2, 2, 8),
    (3, 3, 12),
    (4, 4, 20),
    (5, 5, 26),
    (6, 6, 30),
]


def stream_from_rows(rows):
    """Text-layer ordering: first row contributes only its cost (C2 is a dash),
    every later row contributes (vw_level, cost)."""
    out = [rows[0][2]]
    for _sk, vw, cost in rows[1:]:
        out.extend([vw, cost])
    return out


def main() -> int:
    issues = 0
    nums = 0

    doc = json.loads((MECH / f"{CARD}.json").read_text(encoding="utf-8"))
    payload = doc["payload"]

    def find_training_cost(obj):
        if isinstance(obj, dict):
            if "training_cost" in obj:
                return obj["training_cost"]
            for v in obj.values():
                hit = find_training_cost(v)
                if hit is not None:
                    return hit
        return None

    tc = find_training_cost(payload["parameters"]) or {}

    if "status" in tc:
        print(f"FAIL: training_cost still carries status={tc.get('status')!r} (not resolved)")
        return 1

    rows = tc.get("rows")
    if not isinstance(rows, list) or len(rows) != len(EXPECTED):
        print(f"FAIL: training_cost.rows missing or wrong length: {rows!r}")
        return 1

    card_rows = []
    for r in rows:
        card_rows.append((
            r.get("new_skill_or_weapon_skill_level"),
            r.get("new_valour_or_wisdom_level"),
            r.get("cost"),
        ))

    # 1) card rows == EXPECTED (transcribed from image), cell by cell
    for idx, (got, exp) in enumerate(zip(card_rows, EXPECTED), 1):
        for col, g, e in zip(("skill_level", "vw_level", "cost"), got, exp):
            nums += 1
            if g != e:
                print(f"[row {idx}] {col}: card={g!r} scan={e!r}")
                issues += 1

    # 2) C1 pip column is a contiguous 1..6 (pip-derived, scan-only)
    if [r[0] for r in card_rows] != [1, 2, 3, 4, 5, 6]:
        print(f"FAIL: skill/weapon-skill level column not 1..6: {[r[0] for r in card_rows]}")
        issues += 1

    # 3) Negative control: text-layer numeric stream for the table region must
    #    equal the reconstruction from BOTH expected and card rows.
    src = payload["source_text"]
    if isinstance(src, list):
        src = " ".join(src)
    a = src.find("СТОИМОСТЬ ОБУЧЕНИЯ")
    b = src.find("\u2666", a)  # first diamond bullet after the table
    if b == -1:
        b = len(src)
    seg = src[a:b]
    text_stream = [int(t) for t in re.findall(r"\d+", seg)]

    exp_stream = stream_from_rows(EXPECTED)
    card_stream = stream_from_rows(card_rows)
    if text_stream != exp_stream:
        print(f"NEG-CTRL FAIL: source_text stream {text_stream} != expected {exp_stream}")
        issues += 1
    if text_stream != card_stream:
        print(f"NEG-CTRL FAIL: source_text stream {text_stream} != card {card_stream}")
        issues += 1

    print(f"training_cost gate-2b: {nums} numbers checked, "
          f"neg-control stream={text_stream}")
    print("RESULT:", "PASS (0 mismatches)" if issues == 0 else f"FAIL ({issues})")
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
