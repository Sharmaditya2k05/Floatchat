"""NL→SQL: retrieve schema docs → prompt LLM → validate; rule-based fallback.

The LLM path follows spec §8.3. If the generated SQL fails validation the
LLM is retried once with the error message; if the LLM is unavailable or
still failing, the deterministic fallback engine takes over.
"""
from __future__ import annotations

import logging
import re

from app import config
from app.fallback_nl2sql import generate as fallback_generate
from app.llm import LLMUnavailable, chat
from app.validate import SQLValidationError, validate_sql
from rag.retriever import get_retriever

log = logging.getLogger("app.nl2sql")

SYSTEM_PROMPT = """You are an expert PostgreSQL analyst for an ARGO ocean-float database
that also serves fisheries data. Given a user question and the RELEVANT SCHEMA
below, output ONE valid PostgreSQL SELECT statement and nothing else.

Rules:
- SELECT only. No INSERT/UPDATE/DELETE/DDL. No multiple statements.
- Use only the tables/columns in RELEVANT SCHEMA.
- Prefer the `profiles` table for locations, counts, and nearest-float
  queries; only join `measurements` when depth-level values are needed.
- For depth filters, use measurements.depth_m.
- For "nearest" queries use ST_Distance on profiles.geom and ORDER BY it.
- For named seas/regions, join or filter using the `regions` bbox with
  ST_Covers(regions.bbox, profiles.geom).
- Always add LIMIT 500 unless the question implies an aggregate.
- Return timestamps in ISO format.
- For "highest / lowest / deepest / saltiest / warmest" style questions, add a
  WHERE ... IS NOT NULL filter on the column you ORDER BY, so the top row is a
  real value (Postgres sorts NULLs first on DESC otherwise).
- When a question asks "which float/where", also select the identifying columns
  (wmo_id, latitude, longitude) so the answer can name it.
- If the question is ambiguous, choose the most reasonable interpretation.

Fisheries-specific rules:
- For fishing zones / PFZ / advisory questions, use pfz_advisories table.
  Filter current advisories with valid_from <= CURRENT_DATE AND valid_to >= CURRENT_DATE.
- For fish species queries, filter pfz_advisories.fish_species with
  array_to_string(fish_species, ',') ILIKE '%name%' (partial names must match).
- For chlorophyll / ocean colour / plankton bloom queries, use chlorophyll table.
  When ranking hotspots / highest / richest chlorophyll, add
  chl_a_mg_m3 <= 15 — satellite values above that near the coast are river
  sediment, not plankton.
- For SST composites / surface temperature maps, use sst_composites table.
- For "is water warm enough for [fish]", query sst_composites near that location.
  Tuna prefers 20-30°C, sardine 22-28°C, mackerel 18-25°C.
- For spatial fisheries queries near a port, use known coordinates:
  Kochi (76.27E, 9.93N), Chennai (80.29E, 13.08N), Visakhapatnam (83.30E, 17.69N),
  Mumbai (72.88E, 19.08N), Mangalore (74.84E, 12.87N), Tuticorin (78.15E, 8.76N).
"""

_retriever = None


def _get_retriever():
    global _retriever
    if _retriever is None:
        _retriever = get_retriever()
    return _retriever


def _strip_fences(text: str) -> str:
    m = re.search(r"```(?:sql)?\s*(.+?)```", text, re.DOTALL)
    if m:
        text = m.group(1)
    return text.strip()


def generate_sql(question: str) -> tuple[str, str, list[dict]]:
    """Return (validated_sql, engine, retrieved_docs).

    engine is 'llm' or 'fallback'.
    """
    docs = _get_retriever().search(question, k=config.RAG_TOP_K)
    schema_docs = "\n\n".join(d["text"] for d in docs if d["kind"] != "example")
    example_docs = "\n\n".join(d["text"] for d in docs if d["kind"] == "example")

    user_prompt = (
        f"RELEVANT SCHEMA:\n{schema_docs}\n\n"
        f"FEW-SHOT EXAMPLES:\n{example_docs}\n\n"
        f"USER QUESTION: {question}\nSQL:"
    )

    try:
        raw = chat(SYSTEM_PROMPT, user_prompt)
        try:
            return validate_sql(_strip_fences(raw), config.MAX_ROWS), "llm", docs
        except SQLValidationError as e:
            log.warning("LLM SQL rejected (%s) — retrying once", e)
            raw = chat(
                SYSTEM_PROMPT,
                user_prompt + f"\n\nYour previous SQL was rejected: {e}\n"
                              f"Previous SQL:\n{raw}\nWrite a corrected SELECT:",
            )
            return validate_sql(_strip_fences(raw), config.MAX_ROWS), "llm", docs
    except LLMUnavailable:
        log.info("LLM unavailable — using rule-based fallback engine")
    except SQLValidationError as e:
        log.warning("LLM SQL rejected twice (%s) — using fallback engine", e)
    except Exception as e:
        log.warning("LLM error (%s) — using fallback engine", e)

    sql = fallback_generate(question)
    return validate_sql(sql, config.MAX_ROWS), "fallback", docs
