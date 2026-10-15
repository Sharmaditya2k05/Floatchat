"""Read-only SQL execution against Postgres (spec §8.5 step 6).

Connects with the read-only role, forces the transaction read-only at the
session level as defense-in-depth, and applies a statement timeout.
"""
from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Any

import psycopg

from app import config


def _jsonable(v: Any) -> Any:
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (dt.datetime, dt.date)):
        return v.isoformat()
    return v


def run_query(sql: str, url: str | None = None) -> dict:
    """Execute one validated SELECT. Returns {"columns": [...], "rows": [[...], ...]}."""
    conn_url = url or config.DATABASE_URL
    options = (
        f"-c default_transaction_read_only=on "
        f"-c statement_timeout={config.SQL_STATEMENT_TIMEOUT_MS}"
    )
    with psycopg.connect(conn_url, options=options, connect_timeout=5) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            columns = [d.name for d in cur.description] if cur.description else []
            rows = [[_jsonable(v) for v in row] for row in cur.fetchall()]
    return {"columns": columns, "rows": rows}
