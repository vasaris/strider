"""check_determinism.py — content-only, NON-DESTRUCTIVE determinism gate.

Why this exists (and why a bare `re-run builders; git status` is wrong):
the committed JSON of a layer = builder CONTENT  +  an additive verification
STAMP (`verified` + `verification`) written on top by mark_verified.py. The
stamp is idempotent (mark_verified skips already-verified files), so re-running
a builder legitimately drops it. A naive in-tree rebuild therefore (a) reverts
provenance on every stamped file and (b) reports a false diff.

This gate builds every layer into a THROWAWAY temp tree (the working tree is
never written) and asserts CONTENT is byte-identical to the committed files,
ignoring the stamp. Correct for BOTH unstamped (mechanics) and stamped
(solo/lifepaths) layers, with no special-casing.

Exit 0 iff every committed JSON's content round-trips byte-for-byte.
"""
from __future__ import annotations

import contextlib
import importlib
import io
import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
KV = REPO / "content-packs" / "kv"

# (builder module, committed dir relative to content-packs/kv).
# Builders sharing a dir (the 4 mechanics scripts) accumulate into it.
LAYERS = [
    ("build_mechanics_pilot", "mechanics"),
    ("build_mechanics_b21",   "mechanics"),
    ("build_mechanics_b22",   "mechanics"),
    ("build_mechanics_b3",    "mechanics"),
    ("build_mechanics_b4",    "mechanics"),
    ("build_mechanics_b5",    "mechanics"),
    ("build_mechanics_b6",    "mechanics"),
    ("build_mechanics_b7",    "mechanics"),
    ("build_mechanics_b8",    "mechanics"),
    ("build_mechanics_b9",    "mechanics"),
    ("build_solo_overlay",    "mechanics"),
    ("build_solo_tables",     "tables/solo"),
    ("build_lifepath_tables", "lifepaths"),
]
STAMP_KEYS = ("verified", "verification")


def content(doc: dict) -> str:
    """Canonical JSON of everything EXCEPT the verification stamp."""
    return json.dumps({k: v for k, v in doc.items() if k not in STAMP_KEYS},
                      ensure_ascii=False, indent=2, sort_keys=True)


def main() -> int:
    sys.path.insert(0, str(HERE))
    tmp = Path(tempfile.mkdtemp(prefix="brod_det_"))
    built = {}  # rel -> temp out dir (mirrors real depth so sibling writes stay in temp)
    for mod_name, rel in LAYERS:
        out = tmp / "content-packs" / "kv" / rel
        out.mkdir(parents=True, exist_ok=True)
        mod = importlib.import_module(mod_name)
        mod.OUT = out  # redirect writes; input paths (LAYER/source_pages) untouched
        with contextlib.redirect_stdout(io.StringIO()):
            mod.main()
        built[rel] = out

    problems, checked = [], 0
    for rel in sorted({r for _, r in LAYERS}):
        committed, temp_out = KV / rel, built[rel]
        cfiles = {p.name for p in committed.glob("*.json")}
        tfiles = {p.name for p in temp_out.glob("*.json")}
        for m in sorted(cfiles - tfiles):
            problems.append(f"{rel}/{m}: committed but builders did NOT produce it")
        for e in sorted(tfiles - cfiles):
            problems.append(f"{rel}/{e}: builders produced it but it is NOT committed")
        for name in sorted(cfiles & tfiles):
            cdoc = json.loads((committed / name).read_text(encoding="utf-8"))
            tdoc = json.loads((temp_out / name).read_text(encoding="utf-8"))
            checked += 1
            if content(cdoc) != content(tdoc):
                problems.append(f"{rel}/{name}: CONTENT differs (non-deterministic)")
        print(f"  {rel}: {len(cfiles & tfiles)} files content-checked")

    if problems:
        print(f"FAIL: {len(problems)} determinism problem(s); content cells checked: {checked}")
        for p in problems:
            print(" -", p)
        return 1
    print(f"OK: content byte-identical across {checked} files "
          f"(stamp ignored; working tree untouched)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
