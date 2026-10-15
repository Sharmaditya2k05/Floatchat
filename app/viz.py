"""Turn result rows into chart-ready structures (spec §9–10).

- infer_kind: profile (depth vs value) / timeseries / map / table
- build_series: {x, y, x_label, y_label, kind}
- build_geojson: FeatureCollection of float positions. When the result rows
  carry no coordinates but reference floats, positions are fetched with a
  fixed, safe helper query so the map always has something to show.
"""
from __future__ import annotations

from app import execute

TIME_COLS = {"month", "profile_time", "day", "date", "week", "year"}
DEPTH_COLS = {"depth_m", "pressure_db"}


def _numeric_cols(columns: list[str], rows: list[list]) -> list[str]:
    out = []
    for i, c in enumerate(columns):
        for r in rows:
            if r[i] is not None:
                if isinstance(r[i], (int, float)) and not isinstance(r[i], bool):
                    out.append(c)
                break
    return out


def infer_kind(columns: list[str], rows: list[list]) -> str:
    cols = set(columns)
    numeric = set(_numeric_cols(columns, rows))
    if cols & DEPTH_COLS and len(numeric - DEPTH_COLS - {"wmo_id", "cycle_number"}) >= 1 and len(rows) > 1:
        return "profile"
    if cols & TIME_COLS and len(rows) > 1 and (numeric - {"wmo_id", "cycle_number"}):
        # timeseries needs a value column beside the time
        value_cols = [c for c in columns if c in numeric and c not in ("wmo_id", "cycle_number", "latitude", "longitude")]
        if value_cols and not ({"latitude", "longitude"} <= cols):
            return "timeseries"
    if {"latitude", "longitude"} <= cols:
        return "map"
    return "table"


def build_series(columns: list[str], rows: list[list], kind: str) -> dict | None:
    if not rows:
        return None
    if kind == "profile":
        x_col = next((c for c in columns if c not in DEPTH_COLS and c in _numeric_cols(columns, rows)
                      and c not in ("wmo_id", "cycle_number")), None)
        y_col = next((c for c in columns if c in DEPTH_COLS), None)
        if not x_col or not y_col:
            return None
        xi, yi = columns.index(x_col), columns.index(y_col)
        pairs = sorted(((r[yi], r[xi]) for r in rows if r[xi] is not None and r[yi] is not None))
        return {
            "x": [p[1] for p in pairs],
            "y": [p[0] for p in pairs],
            "x_label": x_col,
            "y_label": y_col,
            "kind": "profile",
        }
    if kind == "timeseries":
        t_col = next((c for c in columns if c in TIME_COLS), None)
        v_col = next((c for c in columns if c not in TIME_COLS and c in _numeric_cols(columns, rows)
                      and c not in ("wmo_id", "cycle_number", "latitude", "longitude")), None)
        if not t_col or not v_col:
            return None
        ti, vi = columns.index(t_col), columns.index(v_col)
        pairs = sorted(((r[ti], r[vi]) for r in rows if r[ti] is not None and r[vi] is not None))
        return {
            "x": [p[0] for p in pairs],
            "y": [p[1] for p in pairs],
            "x_label": t_col,
            "y_label": v_col,
            "kind": "timeseries",
        }
    return None


def extract_float_ids(columns: list[str], rows: list[list]) -> list[int]:
    if "wmo_id" not in columns:
        return []
    i = columns.index("wmo_id")
    seen: dict[int, None] = {}
    for r in rows:
        if r[i] is not None:
            seen[int(r[i])] = None
    return list(seen)[:100]


def build_geojson(columns: list[str], rows: list[list], float_ids: list[int]) -> dict:
    features = []
    cols = set(columns)
    if {"latitude", "longitude"} <= cols:
        la, lo = columns.index("latitude"), columns.index("longitude")
        wi = columns.index("wmo_id") if "wmo_id" in columns else None
        ti = columns.index("profile_time") if "profile_time" in columns else None
        extra = [(c, i) for i, c in enumerate(columns)
                 if c not in ("latitude", "longitude", "wmo_id", "profile_time")]
        for r in rows[:1000]:
            if r[la] is None or r[lo] is None:
                continue
            props = {}
            if wi is not None:
                props["wmo_id"] = r[wi]
            if ti is not None:
                props["profile_time"] = r[ti]
            for c, i in extra:  # zone / SST / chlorophyll / species etc. for the popup
                if r[i] is not None:
                    props[c] = r[i]
            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [r[lo], r[la]]},
                    "properties": props,
                }
            )
    elif float_ids:
        # Fixed helper query (not LLM-generated): latest position per float.
        placeholders = ",".join(str(int(f)) for f in float_ids)
        res = execute.run_query(
            f"""SELECT DISTINCT ON (wmo_id) wmo_id, profile_time, latitude, longitude
                FROM profiles WHERE wmo_id IN ({placeholders})
                ORDER BY wmo_id, profile_time DESC"""
        )
        for wmo, t, lat, lon in res["rows"]:
            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    "properties": {"wmo_id": wmo, "profile_time": t},
                }
            )
    return {"type": "FeatureCollection", "features": features}


def context_geojson(question: str) -> dict:
    """Positions of the floats matching the question's region/time — used so the
    map still shows relevant floats for aggregate/time-series answers that
    return no positions of their own. Built from a fixed, safe query (region
    names come from a closed set, not from the LLM)."""
    from app.fallback_nl2sql import (
        REGIONS, _find_region, _find_time_window, _near_equator,
    )

    q = question.lower()
    join, clauses = "", []
    if _near_equator(q):
        clauses.append("p.latitude BETWEEN -2 AND 2")
    else:
        region = _find_region(q)
        if region and region in REGIONS.values():
            join = f"JOIN regions r ON r.name = '{region}'"
            clauses.append("ST_Covers(r.bbox, p.geom)")
    tw = _find_time_window(q)
    if tw:
        clauses.append(f"p.profile_time >= '{tw[0]}' AND p.profile_time < '{tw[1]}'")
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""

    res = execute.run_query(
        f"""SELECT DISTINCT ON (p.wmo_id) p.wmo_id, p.profile_time, p.latitude, p.longitude
            FROM profiles p {join} {where}
            ORDER BY p.wmo_id, p.profile_time DESC LIMIT 300"""
    )
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {"wmo_id": wmo, "profile_time": t},
        }
        for wmo, t, lat, lon in res["rows"]
    ]
    return {"type": "FeatureCollection", "features": features}
