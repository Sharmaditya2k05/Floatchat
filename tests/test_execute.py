"""Read-only execution tests. Skipped automatically when the database
is not reachable (e.g. in CI without docker)."""
import pytest

from app import execute

try:
    execute.run_query("SELECT 1")
    DB_UP = True
except Exception:
    DB_UP = False

needs_db = pytest.mark.skipif(not DB_UP, reason="database not reachable")


@needs_db
def test_select_works():
    res = execute.run_query("SELECT COUNT(*) FROM profiles")
    assert res["columns"] == ["count"]
    assert isinstance(res["rows"][0][0], int)


@needs_db
def test_writes_blocked_by_readonly_role():
    with pytest.raises(Exception):
        execute.run_query("INSERT INTO floats (wmo_id) VALUES (999)")


@needs_db
def test_regions_seeded():
    res = execute.run_query("SELECT name FROM regions ORDER BY name")
    names = [r[0] for r in res["rows"]]
    assert "Arabian Sea" in names
    assert "Bay of Bengal" in names
