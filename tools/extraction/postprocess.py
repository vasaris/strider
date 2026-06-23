"""Post-processing for the pre-extracted text layer of «Игра для одного».

THROWAWAY TOOLING (stage 0 content pipeline). Not imported by the engine.

Known artifacts in the source text layer:
- U+0002 marks a lost soft hyphen at a line-wrap point inside a word
  («универ\u0002сальных» -> «универсальных»). Removing it joins the word.
- \r\n line endings.
- Decorative letter-spacing inside SMALL-CAPS headers («В СЕ ТАБЛИЦЫ»,
  «О СОБЫЙ») — affects headers only; we never store those strings, but the
  normaliser collapses double spaces anyway.
"""
from __future__ import annotations

import re
from pathlib import Path

SOURCE_DIRS = {
    "igra_dlya_odnogo": Path(__file__).parent / "source_pages",
    "zhizn_puti_geroev": Path(__file__).parent / "source_pages_zhp",
}
SOURCE_DIR = SOURCE_DIRS["igra_dlya_odnogo"]


# U+0002 encodes BOTH soft (line-wrap) and lexical hyphens; they are
# byte-identical in the layer. Full-book sweep of all 368 distinct joins
# (vision-sweep gate 2 finding, 2026-06-11) found exactly two lexical
# compounds, restored explicitly below. Any new page source requires
# re-running the sweep before trusting clean().
LEXICAL_HYPHENS = {
    "Противник\u0002хищник": "Противник-хищник",
    "Животное\u0002проводник": "Животное-проводник",
}


def clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    for raw, fixed in LEXICAL_HYPHENS.items():
        text = text.replace(raw, fixed)
    text = text.replace("\u0002", "")  # rejoin soft-hyphen-wrapped words
    return text


def page(n: int, book: str = "igra_dlya_odnogo") -> str:
    """Cleaned text of book page n."""
    return clean((SOURCE_DIRS[book] / f"{n}.txt").read_text(encoding="utf-8"))


def norm_cell(s: str) -> str:
    """Normalise a table cell: collapse whitespace/newlines to single spaces."""
    return re.sub(r"\s+", " ", s).strip()
