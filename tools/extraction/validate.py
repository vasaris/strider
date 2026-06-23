"""Validate content-packs/kv/tables/solo/*.json.

Two layers:
1. JSON Schema (draft 2020-12) per table type.
2. Structural invariants the schema language can't express:
   - feat-die tables cover faces eye + 1..10 + gandalf_rune exactly, in order;
   - journey table ranges/faces cover 1..10 with no gaps/overlaps,
     eye first and gandalf_rune last;
   - lore sections ordered eye, gandalf_rune, 1..10; cells non-empty, 1-word
     columns flagged if multi-word (book uses single words);
   - detail rows: skill is null iff significant_encounter;
   - journey detail_table references resolve to existing files with matching
     scene_type;
   - exactly one default likelihood in the answers table;
   - verified:true допустим только с валидным verification-блоком ADR-001;
     свежесобранные файлы остаются false до mark_verified.py.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = Path(__file__).parents[2] / "content-packs"
SCHEMAS = ROOT / "schemas"
TABLE_DIRS = [ROOT / "kv" / "tables" / "solo", ROOT / "kv" / "lifepaths",
              ROOT / "kv" / "mechanics"]

FEAT_ORDER = ["eye", *range(1, 11), "gandalf_rune"]


def load_registry() -> Registry:
    registry = Registry()
    for p in SCHEMAS.glob("*.schema.json"):
        res = Resource.from_contents(json.loads(p.read_text(encoding="utf-8")))
        registry = registry.with_resource(uri=p.name, resource=res)
        registry = registry.with_resource(
            uri=f"https://brodyazhnik.local/schemas/{p.name}", resource=res
        )
    return registry


def main() -> int:
    registry = load_registry()
    validators = {}
    for p in SCHEMAS.glob("*.schema.json"):
        name = p.name.replace(".schema.json", "")
        if name == "common":
            continue
        validators[name] = Draft202012Validator(
            json.loads(p.read_text(encoding="utf-8")), registry=registry
        )

    errors: list[str] = []
    docs: dict[str, dict] = {}
    table_files = [f for d in TABLE_DIRS for f in sorted(d.glob("*.json"))]
    for p in table_files:
        doc = json.loads(p.read_text(encoding="utf-8"))
        docs[doc["id"]] = doc
        v = validators.get(doc["type"])
        if v is None:
            errors.append(f"{p.name}: unknown type {doc['type']}")
            continue
        for e in v.iter_errors(doc):
            errors.append(f"{p.name}: {'/'.join(map(str, e.absolute_path))}: {e.message}")
        if doc["verified"] is True:
            v = doc.get("verification", {})
            if not (v.get("method") == "auto-v1" and v.get("adr") == "ADR-001"
                    and isinstance(v.get("gates"), dict)
                    and {"text_fidelity", "vision_sweep", "lynn_review"} <= set(v["gates"])):
                errors.append(f"{p.name}: verified:true without well-formed verification block (ADR-001)")
        elif doc["verified"] is not False:
            errors.append(f"{p.name}: verified must be boolean")

    def check(cond: bool, msg: str):
        if not cond:
            errors.append(msg)

    for id_, doc in docs.items():
        pl = doc["payload"]
        t = doc["type"]
        if t == "feat_die_event_table":
            faces = [r["face"] for r in pl["rows"]]
            check(faces == FEAT_ORDER, f"{id_}: face order {faces}")
        if t == "lore_table":
            faces = [s["face"] for s in pl["sections"]]
            check(faces == ["eye", "gandalf_rune", *range(1, 11)],
                  f"{id_}: section order {faces}")
            for s in pl["sections"]:
                for i, r in enumerate(s["rows"], 1):
                    for col in ("action", "aspect", "focus"):
                        check(" " not in r[col],
                              f"{id_}: section {s['face']} row {i} {col} is multi-word: {r[col]!r}")
        if t == "journey_scenes_table":
            rows = pl["rows"]
            check(rows[0].get("face") == "eye", f"{id_}: first row must be eye")
            check(rows[-1].get("face") == "gandalf_rune", f"{id_}: last row must be gandalf_rune")
            covered = []
            for r in rows[1:-1]:
                if "face" in r:
                    covered.append(r["face"])
                else:
                    rg = r["range"]
                    check(rg["min"] <= rg["max"], f"{id_}: bad range {rg}")
                    covered.extend(range(rg["min"], rg["max"] + 1))
            check(sorted(covered) == list(range(1, 11)),
                  f"{id_}: numeric coverage {sorted(covered)}")
            for r in rows:
                ref = r["detail_table"]
                check(ref in docs, f"{id_}: dangling detail_table {ref}")
                if ref in docs:
                    check(docs[ref]["payload"]["scene_type"] == r["scene_type"],
                          f"{id_}: scene_type mismatch for {ref}")
        if t == "scene_detail_table":
            for r in pl["rows"]:
                sig = r.get("significant_encounter", False)
                if sig:
                    check(r.get("skill") is None,
                          f"{id_}: row {r['face']} significant_encounter with skill set")
                else:
                    check(r.get("skill") in ("hunting", "exploration", "awareness"),
                          f"{id_}: row {r['face']} non-encounter row without skill")
        if t == "rule_card":
            for ref in pl["related"]:
                if ref.startswith("kv.mechanics."):
                    check(ref in docs, f"{id_}: dangling related {ref}")
        if t == "lifepath_cultures":
            faces = [r["face"] for r in pl["rows"]]
            check(faces == list(range(1, 7)), f"{id_}: culture faces {faces}")
            ids = [r["culture_id"] for r in pl["rows"]]
            check(len(set(ids)) == 6, f"{id_}: duplicate culture ids")
        if t == "lifepath_backgrounds":
            faces = [r["face"] for r in pl["rows"]]
            check(faces == list(range(1, 7)), f"{id_}: background faces {faces}")
        if t == "lifepath_events":
            faces = [r["face"] for r in pl["rows"]]
            check(faces == FEAT_ORDER, f"{id_}: event face order {faces}")
        if t == "oracle_yes_no":
            defaults = [l for l in pl["likelihoods"] if l.get("default")]
            check(len(defaults) == 1 and defaults[0]["key"] == "even",
                  f"{id_}: default likelihood must be exactly 'even'")
            thresholds = [l["yes_if_at_least"] for l in pl["likelihoods"]]
            check(thresholds == sorted(thresholds),
                  f"{id_}: thresholds must be non-decreasing: {thresholds}")

    cultures = docs.get("kv.lifepaths.cultures")
    if cultures:
        listed = {r["culture_id"] for r in cultures["payload"]["rows"]}
        havefile = {d["payload"]["culture"]["id"] for d in docs.values()
                    if d["type"] == "lifepath_backgrounds"}
        check(listed == havefile,
              f"culture cross-ref mismatch: listed {sorted(listed)} vs files {sorted(havefile)}")

    expected_count = 173  # +3: B9 nezhit + orki + trolli (150-157)
    check(len(docs) == expected_count, f"file count {len(docs)} != {expected_count}")

    if errors:
        print(f"FAIL: {len(errors)} problem(s)")
        for e in errors:
            print(" -", e)
        return 1
    print(f"OK: {len(docs)} files pass schema + structural validation")
    return 0


if __name__ == "__main__":
    sys.exit(main())
