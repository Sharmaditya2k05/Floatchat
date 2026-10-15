"""SQL safety tests (spec §17): every non-SELECT / stacked / disallowed-table
statement must be rejected."""
import pytest

from app.validate import SQLValidationError, validate_sql

MALICIOUS = [
    "DROP TABLE profiles",
    "DELETE FROM measurements",
    "INSERT INTO floats (wmo_id) VALUES (1)",
    "UPDATE profiles SET latitude = 0",
    "TRUNCATE measurements",
    "CREATE TABLE evil (x int)",
    "ALTER TABLE profiles ADD COLUMN evil int",
    "GRANT ALL ON profiles TO public",
    "SELECT * FROM profiles; DROP TABLE profiles",
    "SELECT * FROM pg_shadow",
    "SELECT * FROM users",
    "SELECT pg_sleep(100)",
    "COPY profiles TO '/tmp/x'",
    "",
    "this is not sql at all (",
]


@pytest.mark.parametrize("sql", MALICIOUS)
def test_rejects_malicious(sql):
    with pytest.raises(SQLValidationError):
        validate_sql(sql)


def test_accepts_simple_select():
    out = validate_sql("SELECT wmo_id FROM profiles")
    assert out.lower().startswith("select")


def test_appends_limit_to_row_queries():
    out = validate_sql("SELECT wmo_id FROM profiles", max_rows=500)
    assert "LIMIT 500" in out.upper()


def test_caps_oversized_limit():
    out = validate_sql("SELECT wmo_id FROM profiles LIMIT 999999", max_rows=500)
    assert "999999" not in out
    assert "500" in out


def test_aggregate_needs_no_limit():
    out = validate_sql("SELECT AVG(salinity_psu) FROM measurements")
    assert "LIMIT" not in out.upper()


def test_group_by_allowed_without_limit():
    out = validate_sql(
        "SELECT date_trunc('month', profile_time) AS m, AVG(surface_temp_c) "
        "FROM profiles GROUP BY 1"
    )
    assert out.lower().startswith("select")


def test_allows_postgis_functions():
    out = validate_sql(
        "SELECT wmo_id, ST_Distance(geom, ST_SetSRID(ST_MakePoint(68,15),4326)::geography) "
        "FROM profiles ORDER BY 2 LIMIT 5"
    )
    assert "st_distance" in out.lower()


def test_rejects_unknown_table_in_join():
    with pytest.raises(SQLValidationError):
        validate_sql("SELECT * FROM profiles p JOIN secrets s ON s.id = p.profile_id")
