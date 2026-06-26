"""build_manifest.py — derive content-packs/kv/manifest.json from the pack on disk.

The manifest is the engine's LOAD INTERFACE for the pack (arch §3): system,
version, dependencies, verified-status. It is a DERIVED artifact — never hand
edited. Everything here is a pure function of the committed content, so a rebuild
is byte-identical (no timestamps, sort_keys); check_determinism.py asserts that,
which is what makes the recorded counts trustworthy.

Build:   python3 tools/extraction/build_manifest.py
Verify:  python3 tools/extraction/build_manifest.py --check   # exit 1 on drift

Internal integrity (fails loudly): every content file's source.book resolves to a
declared source; locale/terminology are uniform across the pack; every file type
has a sibling schema. These are build-time guards, not engine concerns.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "content-packs"
KV = ROOT / "kv"
SCHEMAS = ROOT / "schemas"
MANIFEST = KV / "manifest.json"

# Pack-level constants (book facts + release identity; not derivable from cells).
PACK_ID = "kv"
LORE_DIR = KV / "lore"


def _pack_version() -> str:
    """Mechanical version (deterministic, no hand-edit). RULE: 0.1.0 is the base
    (Stage-0 exit); a MINOR bump when a new VERIFIED content class is present in the
    pack. 0.2.0 = the release that adds the lore content class (LT1). While lore/ holds
    no verified content (drafts live in content-packs/kv-pending/), the build stays
    0.1.0 byte-identical; the moment verified lore chunks land in kv/lore/, a rebuild
    stamps 0.2.0. The load interface is not broken by the addition -> minor bump.
    tone.stoplist.json / tone.md are sidecars (not content[]), so they do not affect
    this."""
    has_lore = LORE_DIR.exists() and any(LORE_DIR.glob("*.json"))
    return "0.2.0" if has_lore else "0.1.0"
SYSTEM = {
    "id": "tor2e",
    "title": "Кольцо Всевластья",
    "locale": "ru",
    "terminology": "pandora_box",
}
# source.book id -> human title + page count of the digitized book.
SOURCES = {
    "kv_core": {"title": "Кольцо Всевластья (книга правил)", "pages": 242},
    "igra_dlya_odnogo": {"title": "Игра для одного", "pages": 32},
    "zhizn_puti_geroev": {"title": "Жизненные пути героев", "pages": 12},
}
# pack-root-relative dir -> on-disk path. Order is fixed for deterministic output.
CONTENT_DIRS = [
    ("mechanics/", KV / "mechanics"),
    ("tables/solo/", KV / "tables" / "solo"),
    ("lifepaths/", KV / "lifepaths"),
    ("lore/", LORE_DIR),
]


def build() -> dict:
    problems: list[str] = []
    content: list[dict] = []
    by_dir: dict[str, dict] = {}
    all_types: set[str] = set()
    total = verified = 0

    for rel, path in CONTENT_DIRS:
        files = sorted(path.glob("*.json"))
        if not files:
            continue  # absent/empty content dir (e.g. lore/ before LT1 verification) -> no entry
        d_total = d_verified = 0
        d_types: set[str] = set()
        for p in files:
            doc = json.loads(p.read_text(encoding="utf-8"))
            t = doc.get("type")
            d_types.add(t)
            all_types.add(t)
            d_total += 1
            if doc.get("verified") is True:
                d_verified += 1
            # provenance + uniformity guards
            book = (doc.get("source") or {}).get("book")
            if book not in SOURCES:
                problems.append(f"{rel}{p.name}: source.book {book!r} not in declared sources")
            if doc.get("locale") != SYSTEM["locale"]:
                problems.append(f"{rel}{p.name}: locale {doc.get('locale')!r} != {SYSTEM['locale']!r}")
            if doc.get("terminology") != SYSTEM["terminology"]:
                problems.append(f"{rel}{p.name}: terminology {doc.get('terminology')!r} != {SYSTEM['terminology']!r}")
        content.append({"dir": rel, "count": d_total, "types": sorted(d_types)})
        by_dir[rel] = {"total": d_total, "verified": d_verified}
        total += d_total
        verified += d_verified

    # type -> shared schema (schemas/ is a sibling of the pack, hence ../).
    schemas = {}
    for t in sorted(all_types):
        sp = SCHEMAS / f"{t}.schema.json"
        if not sp.exists():
            problems.append(f"type {t!r}: no schema file {sp.name}")
        schemas[t] = f"../schemas/{t}.schema.json"

    if problems:
        for p in problems:
            print(" -", p, file=sys.stderr)
        raise SystemExit(f"build_manifest: {len(problems)} integrity problem(s)")

    return {
        "schema_version": "1.0",
        "pack_id": PACK_ID,
        "pack_version": _pack_version(),
        "system": SYSTEM,
        "sources": SOURCES,
        "schemas": schemas,
        "content": content,
        "dependencies": {"packs": []},
        "verified": {
            "total": total,
            "verified": verified,
            "all_verified": verified == total,
            "by_dir": by_dir,
        },
    }


def serialize(manifest: dict) -> str:
    return json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main() -> int:
    check = "--check" in sys.argv[1:]
    text = serialize(build())
    if check:
        if not MANIFEST.exists():
            print("FAIL: manifest.json missing (run without --check to build)")
            return 1
        current = MANIFEST.read_text(encoding="utf-8")
        if current != text:
            print("FAIL: manifest.json is stale vs builder (re-run build_manifest.py)")
            return 1
        man = json.loads(text)
        v = man["verified"]
        print(f"OK: manifest.json byte-identical to builder; "
              f"verified {v['verified']}/{v['total']}, all_verified={v['all_verified']}")
        return 0
    MANIFEST.write_text(text, encoding="utf-8")
    man = json.loads(text)
    v = man["verified"]
    print(f"wrote {MANIFEST.relative_to(ROOT.parent)}: "
          f"{v['total']} files across {len(man['content'])} dirs; "
          f"verified {v['verified']}/{v['total']}, all_verified={v['all_verified']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
