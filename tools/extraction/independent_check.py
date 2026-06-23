"""REVIEW ONLY: independent content-vs-source check.
Does NOT import build parsers. Normalizes raw pages independently and
verifies every text cell from the JSONs occurs in the declared source pages.
Catches parser-induced corruption: wrong splits, dropped/joined words.
"""
import json, re, sys
from pathlib import Path

SRC_BY_BOOK = {"igra_dlya_odnogo": Path("tools/extraction/source_pages"),
               "zhizn_puti_geroev": Path("tools/extraction/source_pages_zhp")}
KV_LAYER = Path("tools/extraction/source_kv/kv_core.txt")
TBLS = [Path("content-packs/kv/tables/solo"), Path("content-packs/kv/lifepaths"),
        Path("content-packs/kv/mechanics")]

# Artifact-decoding convention shared with postprocess.LEXICAL_HYPHENS
# (grounded in the vision gate, not in the build parsers): U+0002 is a soft
# hyphen everywhere except the two lexical compounds below.
LEX = {"Противник\u0002хищник": "Противник-хищник",
       "Животное\u0002проводник": "Животное-проводник"}

def norm(s):
    s = s.replace("\r","")
    for a, b in LEX.items():
        s = s.replace(a, b)
    s = s.replace("\u0002","")
    return re.sub(r"\s+"," ",s).strip()

pages = {book: {int(p.stem): norm(p.read_text(encoding="utf-8")) for p in d.glob("[0-9]*.txt")}
         for book, d in SRC_BY_BOOK.items()}
KV_NORM = norm(KV_LAYER.read_text(encoding="utf-8"))

def in_pages(text, pp, book):
    if book == "kv_core":
        # слой плоский: страницы — атрибуция по рубрикатору, ищем по всему слою
        return norm(text) in KV_NORM
    blob = " ".join(pages[book][p] for p in pp)
    return norm(text) in blob

fails = []
checked = 0
for f in [x for t in TBLS for x in sorted(t.glob("*.json"))]:
    d = json.loads(f.read_text(encoding="utf-8"))
    pp = d["source"]["pages"]
    book = d["source"]["book"]
    pl = d["payload"]
    cells = []
    t = d["type"]
    if t == "feat_die_event_table":
        cells = [r["text"] for r in pl["rows"]]
    elif t == "lore_table":
        for s in pl["sections"]:
            for r in s["rows"]:
                cells.append(f'{r["action"]} {r["aspect"]} {r["focus"]}')
    elif t == "scene_detail_table":
        cells = [f'{r["scene"]} {r["prompt"]}' for r in pl["rows"]]
        cells.append(pl["check_consequence_text"])
    elif t == "patron_tasks_table":
        cells = [r["text"] for r in pl["rows"]]
    elif t == "lookup_table" and pl["kind"] == "special_successes":
        cells = [r["description"] for r in pl["rows"]]
    elif t == "lookup_table" and pl["kind"] == "milestones":
        cells = [r["milestone"] for r in pl["rows"]]
    elif t == "lookup_table" and pl["kind"] == "risk_degrees":
        cells = [r["examples"] for r in pl["rows"]]
    elif t == "lookup_table" and pl["kind"] == "shadow_recovery":
        cells = [r["text"] for r in pl["rows"]]
    elif t == "lifepath_cultures":
        cells = [r["name"] for r in pl["rows"]]
    elif t == "lifepath_backgrounds":
        for r in pl["rows"]:
            a = r["attributes"]
            cells += [r["title"], r["story"], r["favoured_skill"],
                      f'СИЛА {a["strength"]}, СЕРДЦЕ {a["heart"]}, РАЗУМ {a["wits"]}',
                      *r["distinctive_features"]]
    elif t == "lifepath_events":
        for r in pl["rows"]:
            cells += [r["became"], r["effect_text"], r["quote"]]
    elif t == "rule_card":
        cells = list(pl["source_text"])
    elif t == "adversary":
        cells = [pl["description"]] + [a["text"] for a in pl["fell_abilities"]]
    # journey & rule_parameters: curated transcription from scans; text layer
    # differs in line-wrap — checked by eye instead, reported separately.
    for c in cells:
        checked += 1
        if not in_pages(c, pp, book):
            fails.append(f"{f.name}: NOT IN SOURCE pages {pp}: {c[:90]!r}")
print(f"cells checked: {checked}; failures: {len(fails)}")
for x in fails: print(" -", x)
sys.exit(1 if fails else 0)
