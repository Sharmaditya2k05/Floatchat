"""SQL safety gate (spec §8.5). Every generated statement passes through here
before execution. sqlglot parses the SQL; anything that is not exactly one
SELECT over the allow-listed tables is rejected, and a LIMIT is force-appended
for non-aggregate queries.
"""
from __future__ import annotations

import re

import sqlglot
from sqlglot import exp

ALLOWED_TABLES = {
    "floats", "profiles", "measurements", "regions",
    "pfz_advisories", "sst_composites", "chlorophyll",
}

DENYLIST = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|"
    r"call|do|execute|prepare|set|listen|notify|pg_sleep|pg_read_file|pg_ls_dir|lo_import)\b",
    re.IGNORECASE,
)

AGG_FUNCS = (exp.Avg, exp.Min, exp.Max, exp.Sum, exp.Count)


class SQLValidationError(ValueError):
    pass


def _is_aggregate(select: exp.Select) -> bool:
    """A query is 'aggregate-shaped' when it has GROUP BY or every projected
    expression contains an aggregate function — those may skip the LIMIT."""
    if select.args.get("group"):
        return True
    exprs = select.expressions
    if not exprs:
        return False
    return all(any(isinstance(n, AGG_FUNCS) for n in e.walk()) for e in exprs)


def validate_sql(sql: str, max_rows: int = 500) -> str:
    """Validate and normalize one SQL statement. Returns the safe SQL to run.

    Raises SQLValidationError on anything unsafe.
    """
    sql = sql.strip().rstrip(";").strip()
    if not sql:
        raise SQLValidationError("empty SQL")
    if ";" in sql:
        raise SQLValidationError("multiple statements are not allowed")
    if DENYLIST.search(sql):
        raise SQLValidationError("statement contains a disallowed keyword")

    try:
        statements = sqlglot.parse(sql, read="postgres")
    except Exception as e:
        raise SQLValidationError(f"SQL failed to parse: {e}") from e
    if len(statements) != 1 or statements[0] is None:
        raise SQLValidationError("exactly one statement is required")

    tree = statements[0]
    inner = tree
    if isinstance(tree, exp.With):  # CTEs: the real statement is inside
        inner = tree.this
    if not isinstance(inner, exp.Select) and not isinstance(inner, (exp.Union, exp.Intersect, exp.Except)):
        raise SQLValidationError("only SELECT statements are allowed")

    for table in tree.find_all(exp.Table):
        name = table.name.lower()
        cte_names = {c.alias_or_name.lower() for c in tree.find_all(exp.CTE)}
        if name not in ALLOWED_TABLES and name not in cte_names:
            raise SQLValidationError(f"table '{table.name}' is not allowed")

    # Force a LIMIT on non-aggregate row queries
    if isinstance(inner, exp.Select) and not inner.args.get("limit") and not _is_aggregate(inner):
        inner.limit(max_rows, copy=False)
    elif isinstance(inner, exp.Select) and inner.args.get("limit"):
        lim = inner.args["limit"].expression
        try:
            if int(lim.name) > max_rows:
                inner.limit(max_rows, copy=False)
        except (TypeError, ValueError):
            inner.limit(max_rows, copy=False)

    return tree.sql(dialect="postgres")
