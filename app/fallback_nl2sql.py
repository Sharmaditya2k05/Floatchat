"""Deterministic rule-based NL→SQL engine.

Handles the five query-intent families from spec §3 without any LLM:
aggregate, nearest-N, single-float profile, time-series, discovery/count.
Used when no LLM provider is configured, and as the canned fallback when
the LLM path fails (spec §16 M5, §19).
"""
from __future__ import annotations

import calendar
import re

REGIONS = {
    "arabian sea": "Arabian Sea",
    "arabian": "Arabian Sea",
    "arab sea": "Arabian Sea",
    "bay of bengal": "Bay of Bengal",
    "bengal": "Bay of Bengal",
    "bob": "Bay of Bengal",
    "southern indian ocean": "Southern Indian Ocean",
    "south indian ocean": "Southern Indian Ocean",
    "indian ocean": "Indian Ocean",
}

PORTS = {
    "kochi": (76.27, 9.93),
    "cochin": (76.27, 9.93),
    "chennai": (80.29, 13.08),
    "madras": (80.29, 13.08),
    "visakhapatnam": (83.30, 17.69),
    "vizag": (83.30, 17.69),
    "mumbai": (72.88, 19.08),
    "bombay": (72.88, 19.08),
    "mangalore": (74.84, 12.87),
    "tuticorin": (78.15, 8.76),
    "thoothukudi": (78.15, 8.76),
    "paradip": (86.61, 20.26),
    "goa": (73.80, 15.40),
    "karwar": (74.13, 14.80),
    "ratnagiri": (73.30, 16.98),
}

FISH_SPECIES = [
    "tuna", "skipjack", "yellowfin", "sardine", "oil sardine",
    "mackerel", "seer fish", "kingfish", "pomfret", "hilsa",
    "anchovy", "ribbon fish", "squid", "cuttlefish", "prawn",
    "shrimp", "lobster", "crab",
]

MONTHS = {m.lower(): i for i, m in enumerate(calendar.month_name) if m}
MONTHS.update({m.lower(): i for i, m in enumerate(calendar.month_abbr) if m})


class CannotParse(Exception):
    pass


def _find_region(q: str) -> str | None:
    for key in sorted(REGIONS, key=len, reverse=True):
        if re.search(rf"\b{re.escape(key)}\b", q):
            return REGIONS[key]
    return None


def _near_equator(q: str) -> bool:
    return "equator" in q


def _find_float_id(q: str) -> int | None:
    m = re.search(r"\b(\d{7})\b", q)
    return int(m.group(1)) if m else None


def _find_time_window(q: str) -> tuple[str, str] | None:
    """Return (start, end_exclusive) ISO dates, or None."""
    m = re.search(
        r"\b(january|february|march|april|may|june|july|august|september|october|"
        r"november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\w*\s+(20\d\d)\b",
        q,
    )
    if m:
        month = MONTHS[m.group(1)[:3]]
        year = int(m.group(2))
        nm, ny = (1, year + 1) if month == 12 else (month + 1, year)
        return f"{year:04d}-{month:02d}-01", f"{ny:04d}-{nm:02d}-01"
    m = re.search(r"\b(20\d\d)\b", q)
    if m:
        y = int(m.group(1))
        return f"{y}-01-01", f"{y + 1}-01-01"
    return None


def _find_depth_range(q: str) -> tuple[float, float] | None:
    m = re.search(r"between\s+(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)?\s+and\s+(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)?", q)
    if m:
        return float(m.group(1)), float(m.group(2))
    m = re.search(r"(?:above|top|upper|first|shallower than)\s+(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)\b", q)
    if m:
        return 0.0, float(m.group(1))
    m = re.search(r"(?:below|deeper than)\s+(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)\b", q)
    if m:
        return float(m.group(1)), 100000.0
    return None


def _find_latlon(q: str) -> tuple[float, float] | None:
    """Parse '15N, 68E' / '15°N 68°E' / '15 n 68 e' style coordinates."""
    m = re.search(
        r"(\d+(?:\.\d+)?)\s*°?\s*([ns])\b[,\s]*(\d+(?:\.\d+)?)\s*°?\s*([ew])\b",
        q,
    )
    if m:
        lat = float(m.group(1)) * (1 if m.group(2) == "n" else -1)
        lon = float(m.group(3)) * (1 if m.group(4) == "e" else -1)
        return lat, lon
    return None


def _variable(q: str) -> tuple[str, str, str]:
    """Return (measurements_col, surface_col, label)."""
    if "salin" in q or "psal" in q or "salt" in q:
        return "salinity_psu", "surface_psal", "salinity"
    return "temperature_c", "surface_temp_c", "temperature"


def _spatial_clauses(q: str) -> tuple[str, str]:
    """Return (join_sql, where_sql) implementing region / equator filters."""
    if _near_equator(q):
        return "", "p.latitude BETWEEN -2 AND 2"
    region = _find_region(q)
    if region:
        return (
            f"JOIN regions r ON r.name = '{region}'",
            "ST_Covers(r.bbox, p.geom)",
        )
    return "", ""


def _find_port(q: str) -> tuple[float, float] | None:
    for name, coords in sorted(PORTS.items(), key=lambda x: len(x[0]), reverse=True):
        if name in q:
            return coords
    return None


def _find_fish(q: str) -> str | None:
    for fish in sorted(FISH_SPECIES, key=len, reverse=True):
        if fish in q:
            return fish
    return None


def _recent_window(q: str, col: str) -> str:
    """Date filter for the fisheries tables: relative phrases first, then explicit dates."""
    if re.search(r"\b(today|right now|currently)\b", q):
        return f"{col} >= CURRENT_DATE - INTERVAL '1 day'"
    if re.search(r"\b(this|past|last) week\b", q):
        return f"{col} >= CURRENT_DATE - INTERVAL '7 days'"
    if re.search(r"\b(this|past|last) month\b|\bnow\b", q):
        return f"{col} >= CURRENT_DATE - INTERVAL '30 days'"
    win = _find_time_window(q)
    if win:
        return f"{col} >= '{win[0]}' AND {col} < '{win[1]}'"
    return ""


def _is_fisheries_query(q: str) -> bool:
    fisheries_terms = [
        "fish", "fishing", "pfz", "advisory", "tuna", "sardine", "mackerel",
        "pomfret", "hilsa", "seer", "kingfish", "catch", "chlorophyll",
        "plankton", "bloom", "ocean colour", "ocean color", "phytoplankton",
        "warm enough for", "cold enough", "skipjack", "anchovy", "prawn",
        "shrimp", "lobster", "squid", "cuttlefish", "ribbon fish",
        "fisherman", "fishermen", "fishing zone", "fishing ground",
    ]
    return any(t in q for t in fisheries_terms)


def generate(question: str) -> str:
    """Turn a (normalized-English) question into one PostgreSQL SELECT."""
    q = question.lower().strip()
    meas_col, surf_col, label = _variable(q)
    join_sql, where_geo = _spatial_clauses(q)
    time_win = _find_time_window(q)
    depth = _find_depth_range(q)
    float_id = _find_float_id(q)
    latlon = _find_latlon(q)

    time_sql = (
        f"p.profile_time >= '{time_win[0]}' AND p.profile_time < '{time_win[1]}'"
        if time_win
        else ""
    )

    def where(*clauses: str) -> str:
        parts = [c for c in clauses if c]
        return ("WHERE " + "\n  AND ".join(parts)) if parts else ""

    # --- Fisheries: PFZ advisories / SST composites / chlorophyll ---
    port = _find_port(q)
    wants_sst = ("sst" in q or "surface temp" in q or "warm enough" in q or "cold enough" in q)
    if _is_fisheries_query(q) or (port and wants_sst):
        if not port and latlon:
            port = (latlon[1], latlon[0])
        fish = _find_fish(q)

        def near(alias: str) -> str:
            if not port:
                return ""
            return f"{alias}.geom <-> ST_SetSRID(ST_MakePoint({port[0]}, {port[1]}), 4326)::geography"

        # Sea-surface temperature near a port / "warm enough for tuna"
        if wants_sst or ("temperature" in q and fish):
            win = _recent_window(q, "s.obs_date") or "s.obs_date >= CURRENT_DATE - INTERVAL '7 days'"
            return f"""SELECT s.obs_date, s.latitude, s.longitude, s.sst_c, s.sst_anomaly_c
FROM sst_composites s
WHERE {win}
ORDER BY {near("s") or "s.obs_date DESC"}
LIMIT 20"""

        # Chlorophyll / ocean colour / plankton
        if "chlorophyll" in q or "plankton" in q or "bloom" in q or "ocean col" in q:
            region = _find_region(q)
            chl_join = f"JOIN regions r ON r.name = '{region}'" if region else ""
            chl_where = ["ST_Covers(r.bbox, c.geom)"] if region else []
            win = _recent_window(q, "c.obs_date")
            if win:
                chl_where.append(win)
            if "average" in q or "avg" in q or "mean" in q:
                return f"""SELECT AVG(c.chl_a_mg_m3) AS avg_chlorophyll, COUNT(*) AS n_obs
FROM chlorophyll c
{chl_join}
{where(*chl_where)}"""
            if "hotspot" in q or "highest" in q or "richest" in q or "bloom" in q:
                # very high coastal values are usually river sediment, not plankton
                chl_where.append("c.chl_a_mg_m3 <= 15")
                order = "c.chl_a_mg_m3 DESC"
            else:
                order = near("c") or "c.obs_date DESC"
            return f"""SELECT c.obs_date, c.latitude, c.longitude, c.chl_a_mg_m3
FROM chlorophyll c
{chl_join}
{where(*chl_where)}
ORDER BY {order}
LIMIT 50"""

        # PFZ / fishing-zone advisories (default fisheries intent)
        pz_where = ["pz.valid_from <= CURRENT_DATE AND pz.valid_to >= CURRENT_DATE"]
        if fish:  # substring so "sardine" also matches "oil sardine"
            pz_where.append(f"array_to_string(pz.fish_species, ',') ILIKE '%{fish}%'")
        return f"""SELECT pz.zone_name, pz.latitude, pz.longitude, pz.sst_c,
       pz.chlorophyll_mg, pz.fish_species, pz.confidence, pz.valid_from, pz.valid_to
FROM pfz_advisories pz
{where(*pz_where)}
ORDER BY {near("pz") or "pz.issued_date DESC"}
LIMIT 20"""

    # --- Nearest-N ---
    if ("nearest" in q or "closest" in q or "near me" in q) and latlon:
        lat, lon = latlon
        n = 5
        m = re.search(r"\b(\d{1,2})\b(?!\d)", q.split("nearest")[-1])
        if m and int(m.group(1)) > 0:
            n = min(int(m.group(1)), 50)
        return f"""SELECT s.wmo_id, s.profile_time, s.latitude, s.longitude, s.distance_km
FROM (
  SELECT DISTINCT ON (p.wmo_id) p.wmo_id, p.profile_time, p.latitude, p.longitude,
         ST_Distance(p.geom, ST_SetSRID(ST_MakePoint({lon}, {lat}), 4326)::geography) / 1000 AS distance_km
  FROM profiles p
  ORDER BY p.wmo_id, p.profile_time DESC
) s
ORDER BY s.distance_km
LIMIT {n}"""

    # --- Trajectory of one float ---
    if float_id and ("trajector" in q or "path" in q or "track" in q or "route" in q):
        return f"""SELECT p.cycle_number, p.profile_time, p.latitude, p.longitude
FROM profiles p
WHERE p.wmo_id = {float_id}
ORDER BY p.cycle_number
LIMIT 500"""

    # --- Single-float depth profile ---
    if float_id:
        cycle_m = re.search(r"cycle\s+(\d+)", q)
        if cycle_m:
            cycle_sql = f"p.cycle_number = {int(cycle_m.group(1))}"
        else:
            cycle_sql = (
                f"p.cycle_number = (SELECT MAX(cycle_number) FROM profiles WHERE wmo_id = {float_id})"
            )
        return f"""SELECT m.depth_m, m.{meas_col}
FROM measurements m
JOIN profiles p ON p.profile_id = m.profile_id
WHERE p.wmo_id = {float_id}
  AND {cycle_sql}
ORDER BY m.depth_m
LIMIT 500"""

    # --- Discovery / count ---
    if "how many" in q or q.startswith("count") or "number of" in q:
        target = "COUNT(DISTINCT p.wmo_id) AS n_floats" if "float" in q else "COUNT(*) AS n_profiles"
        return f"""SELECT {target}
FROM profiles p
{join_sql}
{where(where_geo, time_sql)}"""

    # --- Time-series (monthly) ---
    if "month" in q or "monthly" in q or "over time" in q or "trend" in q or "changed" in q:
        return f"""SELECT date_trunc('month', p.profile_time) AS month,
       AVG(p.{surf_col}) AS mean_{label}
FROM profiles p
{join_sql}
{where(where_geo, time_sql, f"p.{surf_col} IS NOT NULL")}
GROUP BY 1
ORDER BY 1"""

    # --- Aggregate over region/depth/time ---
    agg = None
    for word, fn in (("average", "AVG"), ("mean", "AVG"), ("avg", "AVG"),
                     ("minimum", "MIN"), ("min ", "MIN"), ("coldest", "MIN"),
                     ("maximum", "MAX"), ("max ", "MAX"), ("warmest", "MAX"), ("hottest", "MAX")):
        if word in q:
            agg = fn
            break
    if agg:
        d0, d1 = depth if depth else (0.0, 2000.0)
        return f"""SELECT {agg}(m.{meas_col}) AS {agg.lower()}_{label}, COUNT(*) AS n_measurements
FROM measurements m
JOIN profiles p ON p.profile_id = m.profile_id
{join_sql}
{where(where_geo, time_sql, f"m.depth_m BETWEEN {d0} AND {d1}")}"""

    # --- Generic "show me X" → sampled rows with positions ---
    if "salin" in q or "temp" in q or "show" in q or "data" in q:
        d0, d1 = depth if depth else (0.0, 30.0)
        return f"""SELECT p.wmo_id, p.profile_time, p.latitude, p.longitude,
       m.depth_m, m.{meas_col}
FROM measurements m
JOIN profiles p ON p.profile_id = m.profile_id
{join_sql}
{where(where_geo, time_sql, f"m.depth_m BETWEEN {d0} AND {d1}")}
ORDER BY p.profile_time
LIMIT 500"""

    # --- Default: map of recent float positions ---
    return f"""SELECT p.wmo_id, p.profile_time, p.latitude, p.longitude
FROM profiles p
{join_sql}
{where(where_geo, time_sql)}
ORDER BY p.profile_time DESC
LIMIT 500"""
