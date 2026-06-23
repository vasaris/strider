"""check_param_numbers.py — number-provenance gate for rule_card parameters.

Discipline: "numbers come only from source_text". This asserts that every
integer appearing anywhere in a rule_card's `parameters` also occurs in that
card's own `source_text` — as a digit (10, 1к, +2, -1) OR as a Russian number
word (два/трёх/шести...). Catches transcription typos automatically (e.g. a
parry mod written +2 where the book says +3) without anyone reading scans.

It does NOT prove semantic correctness (right number, right field) — that
remains gate 2a/2b, human-in-the-loop by design. This is an additive guard.

Usage: python3 check_param_numbers.py [subsystem_prefix]   (default: combat)
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

MECH = Path(__file__).resolve().parents[2] / "content-packs" / "kv" / "mechanics"
PREFIX = sys.argv[1] if len(sys.argv) > 1 else "combat."

# word forms (incl. common inflections) for 0..12 — the full range B-cards use
NUMWORDS = {
    0: ["ноль"],
    1: ["один", "одна", "одно", "одного", "одну", "первого", "первый", "первое", "одиночк"],
    2: ["два", "две", "двух", "вдвое", "удваив", "пополам", "наполовину", "второго", "второе"],
    3: ["три", "трёх", "трех", "третье", "третьего"],
    4: ["четыре", "четырёх", "четырех"],
    5: ["пять", "пяти"],
    6: ["шесть", "шести", "шестью"],
    7: ["семь", "семи"],
    8: ["восемь", "восьми"],
    9: ["девять", "девяти"],
    10: ["десять", "десяти"],
    11: ["одиннадцать"],
    12: ["двенадцать"],
}


def ints(o):
    if isinstance(o, bool):
        return
    if isinstance(o, int):
        yield o
    elif isinstance(o, float) and o == int(o):
        yield int(o)
    elif isinstance(o, dict):
        for v in o.values():
            yield from ints(v)
    elif isinstance(o, list):
        for v in o:
            yield from ints(v)


def present(n: int, text: str) -> bool:
    # Provenance is about the MAGNITUDE; sign (+bonus/-penalty) and 0 ("no
    # modifier") are engine encoding, not data transcribed from the book.
    n = abs(n)
    if n == 0:
        return True
    if re.search(rf"(?<!\d){n}(?!\d)", text):      # digit not embedded in a longer number
        return True
    low = text.lower()
    return any(w in low for w in NUMWORDS.get(n, []))


def main() -> int:
    misses = []
    cards = 0
    for p in sorted(MECH.glob("*.json")):
        d = json.loads(p.read_text(encoding="utf-8"))
        name = d["id"].split("kv.mechanics.")[1]
        if not name.startswith(PREFIX):
            continue
        cards += 1
        src = " ".join(d["payload"]["source_text"])
        for n in sorted(set(ints(d["payload"]["parameters"]))):
            if not present(n, src):
                misses.append(f"{name}: parameter number {n} NOT found in source_text")
    if misses:
        print(f"FAIL: {len(misses)} number(s) without source provenance across {cards} '{PREFIX}*' cards")
        for m in misses:
            print(" -", m)
        return 1
    print(f"OK: every parameter number traces to source_text across {cards} '{PREFIX}*' cards")
    return 0


if __name__ == "__main__":
    sys.exit(main())
