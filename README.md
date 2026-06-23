# Бродяжник — content pipeline (Stage 0)

> ⚠️ **PRIVATE repo.** JSON cards carry verbatim ВК (Кольцо Всевластья / TOR 2e)
> excerpts in `source_text`. Non-commercial, personal use. Never make public, fork,
> or share. Raw source books are git-ignored — keep them locally.

Deterministic extraction of the КВ core rulebook into JSON `rule_card`s. Mechanics
live in verified JSON consumed by the engine, never in an LLM.

## Build & gates (these are also the `/goal` finish lines)
```bash
python3 tools/extraction/build_mechanics_b21.py
python3 tools/extraction/build_mechanics_b22.py
python3 tools/extraction/build_mechanics_b3.py
python3 tools/extraction/validate.py          # -> OK: 126 files ...
python3 tools/extraction/independent_check.py # -> cells checked: 575; failures: 0
git status --porcelain                         # empty == byte-identical rebuild
```

## Where things are
- State / next steps: `tools/extraction/HANDOFF_3A.md`
- Rules of engagement: `docs/ADR-001`, `docs/ADR-002` (gates), `docs/GOAL_CONDITIONS.md`
- Cut source (git-tracked, copyrighted): `tools/extraction/source_kv/kv_core.txt`
- Gate-2b vision source (LOCAL, not in git): the real 242pp КВ PDF — see
  `content-packs/kv/gate2b_evidence/MANIFEST.md` for sha256 + page offset (+1).

## Discipline
Scripts are the source of truth; JSON is derived. Fixes go in build scripts, never
hand-edited JSON. `verified:true` only via `mark_verified.py` after gates 2a/2b/3.
