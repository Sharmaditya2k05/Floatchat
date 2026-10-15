"""Follow-up question suggestions.

After an answer, propose a few natural next questions. Uses the LLM when
available (aware of what was just asked and returned); otherwise falls back
to a small static set that always works offline.
"""
from __future__ import annotations

import json
import re

STATIC = [
    "How many active floats are in the Bay of Bengal?",
    "Average salinity in the Arabian Sea in 2023 between 0 and 200 m",
    "Nearest 5 floats to 15N, 68E",
    "Show me a temperature–depth profile near the equator",
    "Current fishing zones near Kochi",
    "Is the water warm enough for tuna near Chennai?",
    "Show me chlorophyll hotspots in the Bay of Bengal",
]


def suggestions(question: str, columns: list[str], row_count: int) -> list[str]:
    try:
        from app.llm import chat, reasoning_extra

        raw = chat(
            "You suggest follow-up questions for an ARGO ocean-float data explorer that "
            "also has fisheries data. The app can answer questions about temperature, "
            "salinity, float positions, PFZ fishing zone advisories, SST composites, "
            "chlorophyll/ocean colour, fish species, and fishing conditions in the Indian "
            "Ocean (regions: Arabian Sea, Bay of Bengal, equator; ports: Kochi, Chennai, "
            "Visakhapatnam, Mumbai, Mangalore). Given the user's last question, propose "
            "3 short, specific, distinct follow-up questions they might ask next. "
            'Reply as a JSON array of strings only, e.g. ["...","...","..."].',
            f"Last question: {question}\nColumns returned: {columns}\nRows: {row_count}",
            max_tokens=500,
            extra=reasoning_extra(),
        )
        arr = _parse_array(raw)
        if arr:
            return arr[:3]
    except Exception:
        pass
    return [s for s in STATIC if s.lower() != question.lower().strip()][:3]


def _parse_array(text: str) -> list[str]:
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if not m:
        return []
    try:
        arr = json.loads(m.group(0))
        return [str(x).strip() for x in arr if isinstance(x, (str, int, float)) and str(x).strip()]
    except Exception:
        return []
