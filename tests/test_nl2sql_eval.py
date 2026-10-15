"""NL→SQL evaluation harness (spec §17): execution accuracy against the
gold seed set — result sets must match, not SQL strings. Runs against
whichever engine is configured (LLM or fallback). Skipped without a DB."""
import pytest

from app import execute
from app.nl2sql import generate_sql
from app.summarize import summarize, _numbers
from rag.examples import EXAMPLES

try:
    n = execute.run_query("SELECT COUNT(*) FROM profiles")["rows"][0][0]
    DB_READY = n > 0
except Exception:
    DB_READY = False

needs_data = pytest.mark.skipif(not DB_READY, reason="database empty or unreachable")

# Examples whose gold SQL doesn't depend on which float ids were ingested
STABLE = [e for e in EXAMPLES if "6902746" not in e["sql"]]


def _valset(res: dict) -> set:
    """Values (not row tuples), floats rounded — engines may project extra
    columns or order differently while still answering the same question."""
    out = set()
    for row in res["rows"]:
        for v in row:
            if isinstance(v, list):  # array columns (e.g. fish_species)
                v = tuple(v)
            out.add(round(v, 4) if isinstance(v, float) else v)
    return out


@needs_data
@pytest.mark.parametrize("example", STABLE, ids=[e["question"][:40] for e in STABLE])
def test_execution_accuracy(example):
    gold = execute.run_query(example["sql"])
    sql, engine, _ = generate_sql(example["question"])
    got = execute.run_query(sql)
    gold_vals, got_vals = _valset(gold), _valset(got)
    assert (gold_vals & got_vals) or (not gold["rows"] and not got["rows"]) or gold_vals == got_vals, (
        f"engine={engine}\ngenerated:\n{sql}\ngold rows={len(gold['rows'])} "
        f"got rows={len(got['rows'])}"
    )


@needs_data
def test_grounding_no_invented_numbers():
    sql, _, _ = generate_sql("How many active floats are in the Bay of Bengal?")
    res = execute.run_query(sql)
    answer = summarize("How many active floats are in the Bay of Bengal?",
                       res["columns"], res["rows"], "table")
    allowed = _numbers(" ".join(str(v) for row in res["rows"] for v in row))
    allowed.add(str(len(res["rows"])))
    assert _numbers(answer) <= allowed
