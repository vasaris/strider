"""build_kv_review_map.py — generate docs/HANDOFF_KV_REVIEW.md.

THROWAWAY stage-0 tooling. NOT a content build: this reads the 140 КВ CORE
rule cards (content-packs/kv/mechanics/*.json whose id is NOT kv.mechanics.solo.*)
and emits a deterministic markdown REVIEW MAP for the fresh gate-2a session
(ADR-001: reviewer != author). Mirrors docs/HANDOFF_IDO_REVIEW.md (§0-8).

The map is data-derived, so its counts can never drift from the JSON; re-running
regenerates a byte-stable file. The card numbers themselves are the source of
truth here — edges/spans/sections come from the build_mechanics_b*.py outputs,
not retyped. Glosses per cluster are taken from the cards' own source.section
roots (the book's headings), not invented.

Run:  python3 tools/extraction/build_kv_review_map.py
Out:  docs/HANDOFF_KV_REVIEW.md
"""
from __future__ import annotations

import collections
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
MECH = REPO / "content-packs" / "kv" / "mechanics"
OUT = REPO / "docs" / "HANDOFF_KV_REVIEW.md"

# Canonical cluster order: character build -> play loop -> keeper/adversaries -> reference.
CLUSTER_ORDER = [
    "hero_creation", "standard_of_living", "traits", "valour_wisdom",
    "rewards_virtues", "equipment", "checks", "combat", "journey", "council",
    "fellowship_phase", "endurance_hope", "shadow", "eye", "conditions",
    "treasure", "adversaries", "keeper_tools", "reference",
]


def load_kv_core() -> list[dict]:
    cards = []
    for p in sorted(MECH.glob("*.json")):
        d = json.loads(p.read_text(encoding="utf-8"))
        if d.get("id", "").startswith("kv.mechanics.solo."):
            continue
        cards.append(d)
    return cards


def short_id(card: dict) -> str:
    return card["id"].replace("kv.mechanics.", "")


def cluster_of(card: dict) -> str:
    return card["id"].split(".")[2]


def folio_str(card: dict) -> str:
    pp = card.get("source", {}).get("pages", []) or []
    if not pp:
        return "?"
    if len(pp) == 1:
        return str(pp[0])
    return f"{min(pp)}\u2013{max(pp)}"


def rel_tags(card: dict) -> str:
    """Compact related-target tags grouped by destination cluster, e.g. 'checks x2, traits x1'."""
    rel = card["payload"].get("related", []) or []
    if not rel:
        return "\u2014"
    c = collections.Counter(
        r.split(".")[2] if r.startswith("kv.mechanics.") else "OTHER" for r in rel
    )
    return ", ".join(f"{k}\u00d7{n}" for k, n in sorted(c.items(), key=lambda x: (-x[1], x[0])))


def section_leaf(card: dict, gloss_root: str) -> str:
    """Section path with the cluster's gloss root stripped (location within the chapter).
    A card whose root differs from the cluster gloss shows its FULL path (surfaces anomalies)."""
    sec = card.get("source", {}).get("section", "?")
    parts = sec.split(" \u2192 ")
    if parts and parts[0] == gloss_root and len(parts) > 1:
        return " \u2192 ".join(parts[1:])
    return sec


def gloss_root(cards: list[dict]) -> str:
    roots = collections.Counter(
        c.get("source", {}).get("section", "?").split(" \u2192 ")[0] for c in cards
    )
    return roots.most_common(1)[0][0]


def main() -> None:
    cards = load_kv_core()
    assert len(cards) == 140, f"expected 140 КВ core cards, got {len(cards)}"

    by_cluster: dict[str, list[dict]] = collections.defaultdict(list)
    for c in cards:
        by_cluster[cluster_of(c)].append(c)
    found = set(by_cluster)
    missing = found - set(CLUSTER_ORDER)
    assert not missing, f"new/renamed cluster not in CLUSTER_ORDER: {missing}"
    for cl in CLUSTER_ORDER:
        assert cl in by_cluster, f"CLUSTER_ORDER lists empty cluster: {cl}"

    total_related = sum(len(c["payload"].get("related", []) or []) for c in cards)
    empties = sorted(short_id(c) for c in cards if not c["payload"].get("related"))
    spans1 = sum(1 for c in cards if len(c["payload"].get("source_text", [])) == 1)
    spans2 = sum(1 for c in cards if len(c["payload"].get("source_text", [])) == 2)
    hubs = sorted(cards, key=lambda c: -len(c["payload"].get("related", []) or []))[:6]

    # section-casing anomaly detector (the recon find): same root, different case, within a cluster
    casing_notes = []
    for cl in CLUSTER_ORDER:
        roots = collections.Counter(
            c.get("source", {}).get("section", "?").split(" \u2192 ")[0]
            for c in by_cluster[cl]
        )
        low = collections.defaultdict(list)
        for r in roots:
            low[r.lower()].append(r)
        for lk, variants in low.items():
            if len(variants) > 1:
                casing_notes.append((cl, variants))

    L: list[str] = []
    w = L.append

    # ---- header + §0 -------------------------------------------------------
    w("# HANDOFF \u2014 Stage-0 exit review: \u041a\u0412 core (140 cards) gate-2a map\n")
    w("> \u0410\u0432\u0442\u043e\u0440\u0441\u043a\u0438\u0439 \u0437\u0430\u0434\u0435\u043b \u0434\u043b\u044f **\u0444\u0440\u0435\u0448 gate-2a** \u0441\u0435\u0441\u0441\u0438\u0438. \u042d\u0442\u043e \u041a\u0410\u0420\u0422\u0410, \u043d\u0435 \u0432\u0435\u0440\u0434\u0438\u043a\u0442: "
      "\u0441\u0443\u0434\u0438\u0442\u044c \u043f\u043e \u041a\u041d\u0418\u0413\u0415 (\u041a\u0412-PDF / kv_core.txt), \u043d\u0435 \u043f\u043e \u043a\u0430\u0440\u0442\u0435.\n")

    w("## 0. ADR-001 boundary (\u0447\u0438\u0442\u0430\u0442\u044c \u043f\u0435\u0440\u0432\u044b\u043c)\n")
    w("\u042d\u0442\u043e\u0442 \u043f\u0440\u043e\u0445\u043e\u0434 \u0432\u0435\u0434\u0451\u0442 **\u0440\u0435\u0432\u044c\u044e\u0435\u0440 \u2260 \u0430\u0432\u0442\u043e\u0440 \u044d\u043a\u0441\u0442\u0440\u0430\u043a\u0446\u0438\u0438**, "
      "\u0432 \u0441\u0432\u0435\u0436\u0435\u0439 \u0441\u0435\u0441\u0441\u0438\u0438. \u041a\u0430\u0440\u0442\u0430 \u043d\u0438\u0436\u0435 \u2014 \u043e\u0440\u0438\u0435\u043d\u0442\u0438\u0440 (\u0444\u043e\u043b\u0438\u043e, \u0440\u0451\u0431\u0440\u0430, "
      "\u0441\u043f\u0430\u043d\u044b), \u043d\u043e \u0432\u0441\u0435 \u0441\u0443\u0436\u0434\u0435\u043d\u0438\u044f SUPPORTED/PARTIAL/UNSUPPORTED \u0432\u044b\u043d\u043e\u0441\u044f\u0442\u0441\u044f "
      "\u043f\u043e \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0443 (\u043a\u043d\u0438\u0433\u0430), \u043d\u0435 \u043f\u043e \u0444\u043e\u0440\u043c\u0443\u043b\u0438\u0440\u043e\u0432\u043a\u0430\u043c \u044d\u0442\u043e\u0433\u043e \u0444\u0430\u0439\u043b\u0430. "
      "\u0424\u043e\u0440\u043c\u0430\u0442 \u0432\u0435\u0440\u0434\u0438\u043a\u0442\u0430 \u2014 \u043a\u0430\u043a `docs/GATE2A_IDO_FINDINGS.md`.\n")

    # ---- §1 ----------------------------------------------------------------
    w("## 1. \u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435\n")
    w(f"- **140 \u041a\u0412-\u044f\u0434\u0440\u043e \u043a\u0430\u0440\u0442** (`book=kv_core`), \u0432\u0441\u0435 `verified:false` \u2014 \u044d\u0442\u043e \u0432\u0441\u044f \u043e\u0441\u0442\u0430\u0432\u0448\u0430\u044f\u0441\u044f "
      "\u043c\u0430\u0441\u0441\u0430 Stage 0.\n")
    w("- 49 \u0418\u0434\u041e + 33 \u0442\u0430\u0431\u043b\u0438\u0446\u044b \u0443\u0436\u0435 `verified:true` \u2014 \u043d\u0435 \u0432 \u0441\u043a\u043e\u0443\u043f\u0435.\n")
    w("- 5 \u0430\u0432\u0442\u043e-\u0433\u0435\u0439\u0442\u043e\u0432 \u0437\u0435\u043b\u0451\u043d\u044b\u0435 (`validate`/`independent_check`/`check_determinism`/"
      "`check_param_numbers`/`confirm_s1_edges`).\n")
    w(f"- \u0420\u0451\u0431\u0435\u0440 `related` (\u041a\u0412\u2192\u041a\u0412, \u0432\u043d\u0443\u0442\u0440\u0438 \u044f\u0434\u0440\u0430): **{total_related}** \u00b7 "
      f"\u043a\u0430\u0440\u0442 \u0441 \u043f\u0443\u0441\u0442\u044b\u043c `related`: **{len(empties)}** \u00b7 `oracle_refs`/`params_ref`: **0/0** "
      f"(solo-\u043c\u0435\u0445\u0430\u043d\u0438\u043a\u0430, \u0432 \u044f\u0434\u0440\u0435 \u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 by design) \u00b7 "
      f"`source_text`: {spans1} \u043a\u0430\u0440\u0442\u00d71 \u0441\u043f\u0430\u043d, {spans2} \u043a\u0430\u0440\u0442\u00d72 \u0441\u043f\u0430\u043d\u0430.\n")

    # ---- §2 ----------------------------------------------------------------
    w("## 2. \u0413\u0410\u0420\u0410\u041d\u0422\u0418\u0420\u041e\u0412\u0410\u041d\u041e \u0433\u0435\u0439\u0442\u0430\u043c\u0438 \u2014 \u041d\u0415 \u043f\u0435\u0440\u0435\u043f\u0440\u043e\u0432\u0435\u0440\u044f\u0442\u044c\n")
    w("- **\u0422\u0435\u043a\u0441\u0442-\u0444\u0438\u0434\u0435\u043b\u0438\u0442\u0438 \u044f\u0447\u0435\u0435\u043a**: `independent_check.py` 676/0 \u2014 \u043a\u0430\u0436\u0434\u044b\u0439 `source_text` "
      "\u0434\u043e\u0441\u043b\u043e\u0432\u043d\u043e \u0440\u0435\u0436\u0435\u0442\u0441\u044f \u0438\u0437 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0430. \u041d\u0435 \u0441\u0432\u0435\u0440\u044f\u0442\u044c \u0431\u0443\u043a\u0432\u044b \u0440\u0443\u043a\u0430\u043c\u0438.\n")
    w("- **\u0421\u0445\u0435\u043c\u0430/\u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430**: `validate.py` 222/0. **\u0414\u0435\u0442\u0435\u0440\u043c\u0438\u043d\u0438\u0437\u043c**: byte-identical.\n")
    w("- **\u0412\u0438\u0441\u044f\u0447\u0438\u0445 `related`** \u043d\u0435\u0442 (validate \u043b\u043e\u0432\u0438\u0442 dangling). \u041d\u043e \u0413\u0415\u0419\u0422\u042b \u041d\u0415 \u041b\u041e\u0412\u042f\u0422 "
      "*\u041d\u0415\u0412\u0415\u0420\u041d\u041e\u0415* \u0438\u043b\u0438 *\u041d\u0415\u0414\u041e\u0421\u0422\u0410\u042e\u0429\u0415\u0415* \u0440\u0435\u0431\u0440\u043e \u2014 \u044d\u0442\u043e \u0440\u0430\u0431\u043e\u0442\u0430 \u0440\u0435\u0432\u044c\u044e\u0435\u0440\u0430 (\u00a73).\n")
    w("- **gate-2b \u041a\u0412 \u0417\u0410\u041a\u0420\u042b\u0422** (`content-packs/kv/gate2b_evidence/MANIFEST.md`, "
      "\u00ab0 \u0440\u0430\u0441\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0439, 2026-06-23\u00bb): \u0432\u0441\u0435 \u0447\u0438\u0441\u043b\u0430 (\u043d\u0430\u0432\u044b\u043a\u0438, \u0441\u0442\u0430\u0442\u0431\u043b\u043e\u043a\u0438 6 \u043a\u0443\u043b\u044c\u0442\u0443\u0440, "
      "\u043a\u0443\u043b\u044c\u0442\u0443\u0440\u043d\u044b\u0435 \u043e\u0441\u043e\u0431\u0435\u043d\u043d\u043e\u0441\u0442\u0438, \u0441\u0442\u0430\u0440\u0442\u043e\u0432\u043e\u0435 \u0441\u043d\u0430\u0440\u044f\u0436\u0435\u043d\u0438\u0435, \u0441\u043a\u0430\u043b\u044f\u0440\u044b) \u0441\u0432\u0435\u0440\u0435\u043d\u044b \u043f\u043e \u0441\u043a\u0430\u043d\u0430\u043c. "
      "**\u0427\u0438\u0441\u043b\u0430 \u043d\u0435 \u043f\u0435\u0440\u0435\u043f\u0440\u043e\u0433\u043e\u043d\u044f\u0442\u044c.**\n")

    # ---- §3 ----------------------------------------------------------------
    w("## 3. \u041d\u0415 \u043f\u043e\u043a\u0440\u044b\u0442\u043e \u0433\u0435\u0439\u0442\u0430\u043c\u0438 \u2014 \u0420\u0410\u0411\u041e\u0422\u0410 gate-2a\n")
    w("\u041f\u043e \u043a\u0430\u0436\u0434\u043e\u0439 \u043a\u0430\u0440\u0442\u0435 \u0438\u0437 \u00a76, \u0441\u0443\u0434\u044f \u043f\u043e \u043a\u043d\u0438\u0433\u0435:\n")
    w("1. **`summary` \u0441\u043b\u0435\u0434\u0443\u0435\u0442 \u0438\u0437 `source_text` \u0431\u0435\u0437 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u0439** \u2014 \u043d\u0438\u043a\u0430\u043a\u0438\u0445 \u0447\u0438\u0441\u0435\u043b/\u043f\u0440\u0430\u0432\u0438\u043b, "
      "\u043a\u043e\u0442\u043e\u0440\u044b\u0445 \u043d\u0435\u0442 \u0432 \u0432\u044b\u0440\u0435\u0437\u0430\u043d\u043d\u043e\u043c \u0442\u0435\u043a\u0441\u0442\u0435; \u043f\u0435\u0440\u0435\u0441\u043a\u0430\u0437, \u043d\u0435 \u0438\u043d\u0442\u0435\u0440\u043f\u0440\u0435\u0442\u0430\u0446\u0438\u044f.\n")
    w("2. **`subsystem`/`section` \u0432\u0435\u0440\u043d\u044b** \u2014 \u043a\u0430\u0440\u0442\u0430 \u0441\u0442\u043e\u0438\u0442 \u0432 \u0442\u043e\u0439 \u043f\u043e\u0434\u0441\u0438\u0441\u0442\u0435\u043c\u0435 \u0438 \u0440\u0430\u0437\u0434\u0435\u043b\u0435 \u043a\u043d\u0438\u0433\u0438, "
      "\u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0437\u0430\u044f\u0432\u043b\u0435\u043d\u044b.\n")
    w("3. **\u041a\u0430\u0436\u0434\u043e\u0435 `related` \u0431\u044c\u0451\u0442 \u0432 *\u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u043e\u0435* \u044f\u0434\u0440\u043e-\u043f\u0440\u0430\u0432\u0438\u043b\u043e.** "
      f"\u0418\u0445 {total_related} \u2014 \u0441\u043f\u043b\u043e\u0448\u043d\u0430\u044f \u0440\u0443\u0447\u043d\u0430\u044f \u0441\u0432\u0435\u0440\u043a\u0430 \u043d\u0435\u0440\u0435\u0430\u043b\u044c\u043d\u0430; "
      "\u043f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442: \u0445\u0430\u0431\u044b (\u00a77), \u043a\u043b\u0430\u0441\u0442\u0435\u0440\u044b \u0441 \u043f\u043b\u043e\u0442\u043d\u044b\u043c\u0438 \u0440\u0451\u0431\u0440\u0430\u043c\u0438, \u0441\u043f\u043e\u0442-\u0447\u0435\u043a. "
      "\u0422\u043e\u0447\u043d\u044b\u0435 id \u0446\u0435\u043b\u0435\u0439 \u2014 \u041f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 A.\n")
    w(f"4. **\u041f\u043e\u0434-\u043b\u0438\u043d\u043a\u0438\u043d\u0433-\u0430\u0443\u0434\u0438\u0442** \u043d\u0430 {len(empties)} \u043f\u0443\u0441\u0442\u044b\u0445 `related`: "
      f"{', '.join('`'+e+'`' for e in empties)} \u2014 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u043e \u043b\u0438 \u043f\u0443\u0441\u0442\u044b, \u0438\u043b\u0438 \u0440\u0435\u0431\u0440\u043e \u043f\u0440\u043e\u043f\u0443\u0449\u0435\u043d\u043e.\n")
    w("\n*(`oracle_refs`-\u0431\u0438\u043d\u0434\u0438\u043d\u0433\u0438 \u0438 `params_ref` \u2014 solo-\u043e\u0441\u043e\u0431\u0435\u043d\u043d\u043e\u0441\u0442\u044c; \u0432 \u041a\u0412-\u044f\u0434\u0440\u0435 \u0438\u0445 \u043d\u0435\u0442, "
      "\u043f\u0440\u043e\u0432\u0435\u0440\u044f\u0442\u044c \u043d\u0435\u0447\u0435\u0433\u043e. \u0427\u0438\u0441\u043b\u0430 \u0443\u0436\u0435 \u0437\u0430\u043a\u0440\u044b\u0442\u044b gate-2b \u2014 \u0441\u043c. \u00a72/\u00a75.)*\n")

    # ---- §4 ----------------------------------------------------------------
    w("## 4. \u041c\u0435\u0445\u0430\u043d\u0438\u0437\u043c \u0432\u044b\u0445\u043e\u0434\u0430 Stage 0\n")
    w("\u042d\u0442\u043e\u0442 gate-2a \u2192 \u0430\u0432\u0442\u043e\u0440 \u043f\u0440\u0438\u043c\u0435\u043d\u044f\u0435\u0442 2a-\u043f\u0440\u0430\u0432\u043a\u0438 (\u0442\u043e\u043b\u044c\u043a\u043e \u0432 `build_mechanics_b*.py`) \u2192 \u0440\u0435\u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f "
      "\u2192 **gate-3 lynn-review** (\u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439, \u0444\u0440\u0435\u0448) \u2192 \u0418\u0432\u0430\u043d \u043f\u0440\u043e\u0441\u0442\u0430\u0432\u043b\u044f\u0435\u0442 140. "
      "\u041a\u0430\u0436\u0434\u0430\u044f \u0441\u0435\u0441\u0441\u0438\u044f \u2014 \u0441\u0432\u043e\u044f, \u043f\u043e ADR-001.\n")

    # ---- §5 ----------------------------------------------------------------
    w("## 5. gate-2b \u041a\u0412: \u0441\u0442\u0430\u0442\u0443\u0441 \u0417\u0410\u041a\u0420\u042b\u0422 \u2014 vision-worklist'\u0430 \u043d\u0435\u0442\n")
    w("\u0412 \u043e\u0442\u043b\u0438\u0447\u0438\u0435 \u043e\u0442 \u0418\u0434\u041e, \u0443 \u041a\u0412 \u043f\u043e\u0433\u043b\u0430\u0437\u043d\u0430\u044f \u0441\u0432\u0435\u0440\u043a\u0430 \u0447\u0438\u0441\u0435\u043b **\u0443\u0436\u0435 \u0441\u0434\u0435\u043b\u0430\u043d\u0430** "
      "(`gate2b_evidence/MANIFEST.md`, \u0432\u043e\u0441\u043f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0438\u043c\u044b\u0435 \u0432\u0435\u0440\u0438\u0444\u0438\u043a\u0430\u0442\u043e\u0440\u044b "
      "`verify_gate2b_cultures.py` / `_cultural_features.py` / `_starting_gear.py`). "
      "\u041f\u0435\u0440\u0435\u043f\u0440\u043e\u0433\u043e\u043d \u041d\u0415 \u043d\u0443\u0436\u0435\u043d.\n")
    w("\u0415\u0441\u043b\u0438 \u043d\u0430\u0445\u043e\u0434\u043a\u0430 gate-3 \u043f\u043e\u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0442\u043e\u0447\u0435\u0447\u043d\u043e\u0439 \u0440\u0435-\u0441\u0432\u0435\u0440\u043a\u0438 \u0441\u043a\u0430\u043d\u0430 \u2014 \u043d\u0443\u0436\u0435\u043d "
      "**\u043d\u0430\u0441\u0442\u043e\u044f\u0449\u0438\u0439 \u041a\u0412-PDF** \u0418\u0432\u0430\u043d\u0430 (`%PDF-1.7`, 242 \u0441\u0442\u0440.). "
      "**\u0421\u041c\u0415\u0429\u0415\u041d\u0418\u0415: PDF-\u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430 = \u043a\u043d\u0438\u0436\u043d\u044b\u0439 \u0444\u043e\u043b\u0438\u043e + 1.** "
      "(\u041a\u043e\u043f\u0438\u044f \u0432 knowledge \u043f\u0440\u043e\u0435\u043a\u0442\u0430 \u2014 \u0433\u043e\u043b\u044b\u0439 \u0442\u0435\u043a\u0441\u0442 \u0431\u0435\u0437 \u0441\u043a\u0430\u043d\u043e\u0432; \u0434\u043b\u044f \u0432\u0438\u0436\u043d-\u0441\u0432\u0435\u0440\u043a\u0438 \u043d\u0435\u043f\u0440\u0438\u0433\u043e\u0434\u043d\u0430.)\n")

    # ---- §6 ----------------------------------------------------------------
    w("## 6. \u041a\u0430\u0440\u0442\u0430 140 \u041a\u0412-\u043a\u0430\u0440\u0442 (\u043f\u043e \u043a\u043b\u0430\u0441\u0442\u0435\u0440\u0430\u043c)\n")
    w("\u041a\u043e\u043b\u043e\u043d\u043a\u0438: `name` \u00b7 `folio` (\u043a\u043d\u0438\u0436\u043d\u044b\u0439 \u0444\u043e\u043b\u0438\u043e; PDF=+1) \u00b7 `section` (\u043f\u0443\u0442\u044c \u0432\u043d\u0443\u0442\u0440\u0438 \u0433\u043b\u0430\u0432\u044b) \u00b7 "
      "`sp` (\u0441\u043f\u0430\u043d\u043e\u0432) \u00b7 `rel` (\u0447\u0438\u0441\u043b\u043e \u0440\u0451\u0431\u0435\u0440) \u00b7 `related\u2192` (\u043a\u043b\u0430\u0441\u0442\u0435\u0440\u044b-\u0446\u0435\u043b\u0438) \u00b7 `flag` (\u043f\u043e\u0434 \u0440\u0435\u0432\u044c\u044e\u0435\u0440\u0430).\n")

    for cl in CLUSTER_ORDER:
        clist = sorted(by_cluster[cl], key=lambda c: (folio_str(c), short_id(c)))
        gr = gloss_root(clist)
        c_spans = sum(len(c["payload"].get("source_text", [])) for c in clist)
        c_rel = sum(len(c["payload"].get("related", []) or []) for c in clist)
        c_empty = sum(1 for c in clist if not c["payload"].get("related"))
        w(f"\n### {cl} \u2014 \u00ab{gr}\u00bb ({len(clist)} \u043a\u0430\u0440\u0442; \u0440\u0451\u0431\u0435\u0440 {c_rel}; \u043f\u0443\u0441\u0442\u044b\u0445 {c_empty})\n")
        w("| name | folio | section | sp | rel | related\u2192 | flag |")
        w("|---|---|---|---|---|---|---|")
        for c in clist:
            name = short_id(c).split(".", 1)[1] if "." in short_id(c) else short_id(c)
            sec = section_leaf(c, gr).replace("|", "\\|")
            w(f"| `{name}` | {folio_str(c)} | {sec} | "
              f"{len(c['payload'].get('source_text', []))} | "
              f"{len(c['payload'].get('related', []) or [])} | {rel_tags(c)} |  |")
        w(f"| **\u2211 {cl}** | | | {c_spans} | {c_rel} | | |")

    # ---- §7 ----------------------------------------------------------------
    w("\n## 7. \u041e\u0442\u043a\u0440\u044b\u0442\u044b\u0435 judgment-call'\u044b (\u0441\u043f\u043e\u0442-\u0447\u0435\u043a \u0440\u0435\u0432\u044c\u044e\u0435\u0440\u0430, \u041d\u0415 \u0438\u0441\u0442\u0438\u043d\u0430)\n")
    w(f"1. **\u0413\u0440\u0430\u043d\u0443\u043b\u044f\u0440\u043d\u043e\u0441\u0442\u044c `hero_creation` ({len(by_cluster['hero_creation'])} \u043a\u0430\u0440\u0442)** \u2014 \u043a\u0440\u0443\u043f\u043d\u0435\u0439\u0448\u0438\u0439 \u043a\u043b\u0430\u0441\u0442\u0435\u0440. "
      "\u041e\u043f\u0440\u0430\u0432\u0434\u0430\u043d \u043b\u0438 \u0441\u043f\u043b\u0438\u0442 (\u043e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0435 \u043a\u0430\u0440\u0442\u044b \u043d\u0430 \u043f\u0440\u0438\u0437\u0432\u0430\u043d\u0438\u044f/\u043a\u0443\u043b\u044c\u0442\u0443\u0440\u044b/\u043e\u043f\u044b\u0442), \u043d\u0435\u0442 \u043b\u0438 \u043f\u0435\u0440\u0435-\u0434\u0440\u043e\u0431\u043b\u0435\u043d\u0438\u044f \u0438\u043b\u0438 \u0434\u0443\u0431\u043b\u0435\u0439.\n")
    w(f"2. **{len(empties)} \u043f\u0443\u0441\u0442\u044b\u0445 `related`**: {', '.join('`'+e+'`' for e in empties)} \u2014 \u043f\u043e\u0434-\u043b\u0438\u043d\u043a\u0438\u043d\u0433-\u0430\u0443\u0434\u0438\u0442 "
      "(\u044d\u0442\u0438 \u043a\u0430\u0440\u0442\u044b \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u043e \u043d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043c\u043e\u0434\u0438\u0444\u0438\u0446\u0438\u0440\u0443\u044e\u0442?).\n")
    hub_str = ", ".join(f"`{short_id(c)}`\u00d7{len(c['payload']['related'])}" for c in hubs)
    w(f"3. **\u0420\u0451\u0431\u0440\u0430-\u0445\u0430\u0431\u044b**: {hub_str} \u2014 \u043d\u0430\u0438\u0431\u043e\u043b\u0435\u0435 \u0432\u0435\u0440\u043e\u044f\u0442\u043d\u044b\u0435 \u043d\u043e\u0441\u0438\u0442\u0435\u043b\u0438 \u043d\u0435\u0432\u0435\u0440\u043d\u043e\u0433\u043e/\u043d\u0435\u0434\u043e\u0441\u0442\u0430\u044e\u0449\u0435\u0433\u043e \u0440\u0435\u0431\u0440\u0430.\n")
    w("4. **`adversaries` \u0436\u0438\u0432\u0451\u0442 7 \u043a\u0430\u0440\u0442\u0430\u043c\u0438 \u0432 `mechanics/`**, \u043d\u0435 \u0432 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e\u043c `adversaries/` "
      "(arch \u00a73.2). \u041e\u0441\u0442\u0430\u0432\u0438\u0442\u044c/\u0432\u044b\u043d\u0435\u0441\u0442\u0438 \u2014 \u043c\u0435\u043b\u043a\u0438\u0439 \u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u043d\u044b\u0439 \u0432\u043e\u043f\u0440\u043e\u0441, \u043d\u0435 \u0431\u043b\u043e\u043a\u0435\u0440.\n")
    if casing_notes:
        parts = "; ".join(f"`{cl}`: {variants}" for cl, variants in casing_notes)
        w(f"5. **\u041d\u0438\u0442 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430 `section`** (\u043d\u0430\u0445\u043e\u0434\u043a\u0430 \u0440\u0430\u0437\u0432\u0435\u0434\u043a\u0438): {parts}. "
          "\u041e\u0434\u0438\u043d \u043a\u043e\u0440\u0435\u043d\u044c \u0441\u0435\u043a\u0446\u0438\u0438 \u0437\u0430\u043f\u0438\u0441\u0430\u043d \u0432 \u0440\u0430\u0437\u043d\u043e\u043c \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0435 \u2014 \u043b\u0438\u043a\u0432\u0438\u0434\u043d\u043e \u0432 build-\u0441\u043a\u0440\u0438\u043f\u0442\u0435, "
          "\u043d\u0435 \u043a\u043e\u043d\u0442\u0435\u043d\u0442-\u043e\u0448\u0438\u0431\u043a\u0430; \u0440\u0435\u0448\u0438\u0442\u044c, \u043d\u0443\u0436\u043d\u0430 \u043b\u0438 \u043d\u043e\u0440\u043c\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f.\n")

    # ---- Appendix A --------------------------------------------------------
    w("\n## \u041f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 A \u2014 \u043f\u043e\u043b\u043d\u044b\u0435 `related` id \u043f\u043e \u043a\u0430\u0440\u0442\u0430\u043c\n")
    w("\u0414\u043b\u044f \u0442\u043e\u0447\u043d\u043e\u0433\u043e \u0430\u0443\u0434\u0438\u0442\u0430 \u00a73.3: \u0446\u0435\u043b\u0438 \u0440\u0451\u0431\u0435\u0440 (id \u0431\u0435\u0437 \u043f\u0440\u0435\u0444\u0438\u043a\u0441\u0430 `kv.mechanics.`). "
      "\u041f\u0443\u0441\u0442\u044b\u0435 \u043e\u043f\u0443\u0449\u0435\u043d\u044b.\n")
    for cl in CLUSTER_ORDER:
        clist = sorted(by_cluster[cl], key=lambda c: short_id(c))
        rows = [c for c in clist if c["payload"].get("related")]
        if not rows:
            continue
        w(f"\n**{cl}**\n")
        for c in rows:
            name = short_id(c).split(".", 1)[1] if "." in short_id(c) else short_id(c)
            tgts = ", ".join(sorted(r.replace("kv.mechanics.", "") for r in c["payload"]["related"]))
            w(f"- `{name}` \u2192 {tgts}")

    # ---- §8 ----------------------------------------------------------------
    w("\n## 8. \u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438 \u0438 \u0442\u0443\u043b\u0438\u043d\u0433 (\u041a\u0412-\u0441\u043f\u0435\u0446\u0438\u0444\u0438\u043a\u0430)\n")
    w("- **\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a \u0438\u0441\u0442\u0438\u043d\u044b \u0440\u0451\u0431\u0435\u0440/\u0441\u043f\u0430\u043d\u043e\u0432/\u0441\u0432\u043e\u0434\u043e\u043a** \u2014 `build_mechanics_b21.py \u2026 b9.py` "
      "(+ `build_mechanics_pilot.py`); JSON \u0432\u044b\u0432\u043e\u0434\u0438\u0442\u0441\u044f, \u0440\u0435\u0431\u0438\u043b\u0434 byte-identical. \u041f\u0440\u0430\u0432\u043a\u0438 \u2014 \u0442\u043e\u043b\u044c\u043a\u043e \u0432 \u0441\u043a\u0440\u0438\u043f\u0442\u044b.\n")
    w("- **gate-1 \u0440\u0435\u0437-\u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a \u041a\u0412** \u2014 `tools/extraction/source_kv/kv_core.txt` "
      "(\u0434\u0435\u0433\u0440\u0430\u0434\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0439 \u0442\u0435\u043a\u0441\u0442-\u043e\u0433\u0440\u044b\u0437\u043e\u043a; \u043f\u0435\u0440\u0435\u0440\u0435\u0437\u0430\u0442\u044c \u0441 \u043d\u0430\u0441\u0442\u043e\u044f\u0449\u0435\u0433\u043e PDF \u041e\u0422\u041a\u041b\u041e\u041d\u0415\u041d\u041e \u2014 "
      "\u0434\u0440\u0443\u0433\u0430\u044f \u043b\u0438\u043d\u0435\u0430\u0440\u0438\u0437\u0430\u0446\u0438\u044f \u043b\u043e\u043c\u0430\u0435\u0442 gate-1 \u043d\u0430 ~60% \u044f\u0447\u0435\u0435\u043a).\n")
    w("- **gate-2b vision-\u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a** \u2014 \u043d\u0430\u0441\u0442\u043e\u044f\u0449\u0438\u0439 \u041a\u0412-PDF \u0418\u0432\u0430\u043d\u0430 (offset PDF=\u0444\u043e\u043b\u0438\u043e+1); "
      "\u0440\u0430\u0441\u0442\u0440: `pdftoppm -jpeg -r 135 -f <PDF#> -l <PDF#> <pdf> out`. \u0413\u0435\u0439\u0442 \u0443\u0436\u0435 \u0437\u0430\u043a\u0440\u044b\u0442 (\u00a75).\n")
    w("- **\u0413\u0435\u0439\u0442\u044b**: `validate.py`, `independent_check.py`, `check_determinism.py`, "
      "`check_param_numbers.py`, `confirm_s1_edges.py`. **Verify-only**: `mark_verified.py`.\n")
    w("- **\u041f\u0440\u0435\u0446\u0435\u0434\u0435\u043d\u0442\u044b (\u043a\u0430\u043a \u043a\u0430\u0440\u0442\u0430, \u041d\u0415 \u0438\u0441\u0442\u0438\u043d\u0430)**: `docs/HANDOFF_IDO_REVIEW.md`, "
      "`docs/GATE2A_IDO_FINDINGS.md`, `docs/HANDOFF_IDO_GATE3_LYNN.md`, `ADR-001`, `ADR-002`.\n")

    w(f"\n---\n**\u0418\u0422\u041e\u0413\u0418: 140 \u043a\u0430\u0440\u0442 \u00b7 19 \u043a\u043b\u0430\u0441\u0442\u0435\u0440\u043e\u0432 \u00b7 {total_related} related\u2192\u044f\u0434\u0440\u043e \u00b7 "
      f"{len(empties)} \u043f\u0443\u0441\u0442\u044b\u0445-related \u00b7 0 oracle/params (by design).**\n")
    w("\n*\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u043e `tools/extraction/build_kv_review_map.py` \u0438\u0437 140 JSON \u2014 \u0447\u0438\u0441\u043b\u0430 \u043d\u0435 \u043c\u043e\u0433\u0443\u0442 "
      "\u0440\u0430\u0437\u043e\u0439\u0442\u0438\u0441\u044c \u0441 \u043a\u0430\u0440\u0442\u0430\u043c\u0438; \u0440\u0435\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044f \u043f\u0440\u0438 \u0438\u0445 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0438.*\n")

    OUT.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(REPO)} ({len(L)} lines, {total_related} edges, "
          f"{len(empties)} empty-related)")


if __name__ == "__main__":
    main()
