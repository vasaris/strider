"""mark_verified.py — flips verified:true per ADR-001 (auto-verify v1).

Usage:
  python3 mark_verified.py --dir <content dir> --gate2 "<evidence>" --gate3 "<evidence>"

Refuses to run unless gate 1 passes RIGHT NOW (validate + independent_check
re-executed in-process). Gates 2 and 3 are human-supplied evidence strings
stamped into each file's verification block. Idempotent: already-verified
files are skipped, so per-session runs never restamp older packs.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent


def run_gate(script: str) -> None:
    r = subprocess.run([sys.executable, str(HERE / script)], capture_output=True, text=True)
    if r.returncode != 0:
        print(f"GATE FAILED: {script}\n{r.stdout}{r.stderr}")
        sys.exit(1)
    print(f"gate ok: {script}: {r.stdout.strip().splitlines()[-1]}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True, help="content dir with *.json to flip")
    ap.add_argument("--gate2", required=True, help="vision-sweep evidence")
    ap.add_argument("--gate3", required=True, help="lynn-review evidence")
    args = ap.parse_args()
    tables = Path(args.dir)
    if not tables.is_dir():
        sys.exit(f"not a dir: {tables}")

    run_gate("validate.py")
    run_gate("independent_check.py")

    stamp = {
        "method": "auto-v1",
        "adr": "ADR-001",
        "date": date.today().isoformat(),
        "gates": {
            "text_fidelity": "independent_check.py: зелёный на момент простановки (см. лог)",
            "vision_sweep": args.gate2,
            "lynn_review": args.gate3,
        },
    }
    flipped = skipped = 0
    for p in sorted(tables.glob("*.json")):
        doc = json.loads(p.read_text(encoding="utf-8"))
        if doc.get("verified") is True:
            skipped += 1
            continue
        doc["verified"] = True
        doc["verification"] = stamp
        p.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        flipped += 1
    print(f"verified flipped: {flipped}, already verified: {skipped}")


if __name__ == "__main__":
    main()
