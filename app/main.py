"""FastAPI backend (spec §9): /chat, /query (dev-only), /floats, /health."""
from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import config, execute, viz
from app.lang import detect_language, translate_to_english
from app.nl2sql import generate_sql
from app.suggest import suggestions
from app.summarize import summarize
from app.validate import SQLValidationError, validate_sql

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("app")

app = FastAPI(title="FloatChat API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str
    lang: str | None = None


class QueryRequest(BaseModel):
    sql: str


@app.get("/health")
def health() -> dict:
    try:
        execute.run_query("SELECT COUNT(*) FROM profiles")
        db = "ok"
    except Exception as e:
        db = f"error: {e}"
    return {"status": "ok", "db": db}


@app.post("/chat")
def chat(req: ChatRequest) -> dict:
    question = req.question.strip()
    if not question:
        raise HTTPException(400, "empty question")

    language = req.lang or detect_language(question)
    english_q = translate_to_english(question, language)

    try:
        sql, engine, _docs = generate_sql(english_q)
    except SQLValidationError as e:
        raise HTTPException(422, f"Couldn't build a safe query for that: {e}")

    try:
        result = execute.run_query(sql)
    except Exception as e:
        log.warning("query failed: %s", e)
        raise HTTPException(500, f"Query execution failed: {e}")

    columns, rows = result["columns"], result["rows"]
    kind = viz.infer_kind(columns, rows)
    series = viz.build_series(columns, rows, kind)
    float_ids = viz.extract_float_ids(columns, rows)
    try:
        geojson = viz.build_geojson(columns, rows, float_ids)
    except Exception:
        geojson = {"type": "FeatureCollection", "features": []}
    # If the answer carries no positions (aggregate / time-series), still show
    # the floats that match the question's region/time on the map.
    if not geojson["features"]:
        try:
            geojson = viz.context_geojson(english_q)
        except Exception:
            pass

    answer = summarize(english_q, columns, rows, kind)
    try:
        follow_ups = suggestions(english_q, columns, len(rows))
    except Exception:
        follow_ups = []

    return {
        "question": question,
        "language": language,
        "engine": engine,
        "sql": sql,
        "answer": answer,
        "chart_kind": kind,
        "columns": columns,
        "rows": rows[: config.MAX_ROWS],
        "row_count": len(rows),
        "series": series,
        "geojson": geojson,
        "float_ids": float_ids,
        "suggestions": follow_ups,
    }


@app.post("/query")
def raw_query(req: QueryRequest) -> dict:
    if not config.DEV_MODE:
        raise HTTPException(403, "dev endpoint disabled (set DEV_MODE=true)")
    try:
        sql = validate_sql(req.sql, config.MAX_ROWS)
    except SQLValidationError as e:
        raise HTTPException(422, str(e))
    return execute.run_query(sql)


@app.get("/floats")
def floats(
    bbox: str | None = Query(None, description="lon_min,lat_min,lon_max,lat_max"),
    limit: int = Query(500, le=2000),
) -> dict:
    where = ""
    if bbox:
        try:
            x0, y0, x1, y1 = (float(v) for v in bbox.split(","))
        except ValueError:
            raise HTTPException(400, "bbox must be lon_min,lat_min,lon_max,lat_max")
        where = (
            f"WHERE longitude BETWEEN {x0} AND {x1} AND latitude BETWEEN {y0} AND {y1}"
        )
    res = execute.run_query(
        f"""SELECT DISTINCT ON (wmo_id) wmo_id, profile_time, latitude, longitude
            FROM profiles {where}
            ORDER BY wmo_id, profile_time DESC
            LIMIT {int(limit)}"""
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


# Fixed (non-LLM) preview queries for the Data tab — a few sample rows per table.
_TABLE_PREVIEWS = [
    ("floats", "One row per ARGO float (robot). Identified by its WMO id.",
     "SELECT wmo_id, n_profiles, first_profile_at, last_profile_at FROM floats "
     "ORDER BY n_profiles DESC NULLS LAST LIMIT 8"),
    ("profiles", "One row per profile — a single dive-and-rise cycle, with its position and surface readings.",
     "SELECT profile_id, wmo_id, cycle_number, profile_time, latitude, longitude, "
     "surface_temp_c, surface_psal, n_levels FROM profiles ORDER BY profile_time DESC LIMIT 8"),
    ("measurements", "One row per depth level of a profile — the raw temperature, salinity and depth.",
     "SELECT profile_id, pressure_db, depth_m, temperature_c, salinity_psu, is_adjusted "
     "FROM measurements LIMIT 8"),
    ("regions", "Named seas used to resolve questions like 'Arabian Sea' into a bounding box.",
     "SELECT name, aliases FROM regions ORDER BY name LIMIT 8"),
]


@app.get("/data/overview")
def data_overview() -> dict:
    """What's stored (a small preview per table) + where it came from."""
    counts = execute.run_query(
        "SELECT (SELECT COUNT(*) FROM floats), (SELECT COUNT(*) FROM profiles), "
        "(SELECT reltuples::bigint FROM pg_class WHERE relname='measurements'), "
        "(SELECT COUNT(*) FROM regions), "
        "(SELECT MIN(profile_time) FROM profiles), (SELECT MAX(profile_time) FROM profiles)"
    )["rows"][0]
    n_floats, n_profiles, n_meas, n_regions, t_min, t_max = counts
    count_by = {"floats": n_floats, "profiles": n_profiles, "measurements": n_meas, "regions": n_regions}

    tables = []
    for name, desc, sql in _TABLE_PREVIEWS:
        try:
            res = execute.run_query(sql)
        except Exception:
            res = {"columns": [], "rows": []}
        tables.append({
            "name": name,
            "description": desc,
            "count": count_by.get(name),
            "columns": res["columns"],
            "rows": res["rows"],
        })

    sources = [
        {
            "name": "ARGO — global ocean-observing programme",
            "detail": "The origin of every measurement: ~4,000 autonomous floats that dive to ~2 km and "
                      "rise while recording temperature, salinity and pressure. Running since 2000.",
            "tag": "primary source",
        },
        {
            "name": "argopy → Ifremer ERDDAP / GDAC",
            "detail": "How we pull it: the argopy library fetches the Indian-Ocean subset in expert mode "
                      "(with QC flags and delayed-mode adjusted values) from ARGO's official data servers.",
            "tag": "ingestion",
        },
        {
            "name": "INCOIS · data.gov.in",
            "detail": "The same INCOIS-contributed Indian-Ocean floats are catalogued on data.gov.in "
                      "(kerala.data.gov.in/catalog/indian-ocean-argo-data); that entry is a pointer, so we "
                      "load the identical floats from ARGO's servers.",
            "tag": "catalogue",
        },
    ]

    return {
        "sources": sources,
        "tables": tables,
        "summary": {
            "profiles": n_profiles,
            "measurements": n_meas,
            "floats": n_floats,
            "time_from": t_min,
            "time_to": t_max,
            "region": "Indian Ocean",
        },
    }


# ── Fisheries endpoints ──────────────────────────────────────────────

_SOURCE_INFO = {
    "NOAA-OISST": ("NOAA OISST v2.1 — satellite sea-surface temperature",
                   "Daily 0.25° SST and anomaly blended from satellite and in-situ readings, pulled "
                   "from NOAA CoastWatch ERDDAP. Warm-water bands show where pelagic species gather.",
                   "satellite"),
    "NOAA-VIIRS": ("NOAA VIIRS — chlorophyll-a (ocean colour)",
                   "Daily 4 km chlorophyll-a from the VIIRS sensor via NOAA CoastWatch ERDDAP. High "
                   "chlorophyll marks plankton blooms — food for fish, so productive grounds.",
                   "satellite"),
    "derived: NOAA OISST + VIIRS chl-a": (
        "Potential fishing zones — derived",
        "Computed by FloatChat from the two satellite grids above using the same recipe INCOIS uses "
        "for its PFZ advisories: warm SST band plus high chlorophyll within 150 km of each port. "
        "Not an official INCOIS advisory.",
        "derived"),
    "ARGO-derived": ("ARGO floats — surface temperature",
                     "Sea-surface temperature taken directly from the ARGO float profiles already in "
                     "the database; anomaly is against the same month and 5° cell.",
                     "in-situ"),
    "INCOIS-PFZ": ("INCOIS PFZ advisories", "Official Potential Fishing Zone advisories loaded from INCOIS exports.", "advisory"),
    "INCOIS-SST": ("INCOIS SST composites", "Gridded sea-surface temperature loaded from INCOIS exports.", "satellite"),
    "ISRO-OCM": ("ISRO OCM chlorophyll", "Ocean-colour chlorophyll-a loaded from ISRO/INCOIS exports.", "satellite"),
    "DEMO": ("Demo rows", "Sample values for demonstration only — not real observations.", "demo"),
}


def _describe_source(table: str, source: str, n: int, latest) -> dict:
    name, detail, tag = _SOURCE_INFO.get(source, (source, "Loaded from a custom export.", "custom"))
    what = {"pfz": "advisories", "sst": "SST observations", "chl": "chlorophyll observations"}[table]
    return {"name": name, "detail": f"{detail} {n:,} {what}, latest {latest}.", "tag": tag}

@app.get("/fisheries/overview")
def fisheries_overview() -> dict:
    """Summary data for the Fisheries tab."""
    try:
        counts = execute.run_query(
            "SELECT "
            "(SELECT COUNT(*) FROM pfz_advisories), "
            "(SELECT COUNT(*) FROM sst_composites), "
            "(SELECT COUNT(*) FROM chlorophyll), "
            "(SELECT COUNT(*) FROM pfz_advisories "
            " WHERE valid_from <= CURRENT_DATE AND valid_to >= CURRENT_DATE), "
            "(SELECT MIN(issued_date) FROM pfz_advisories), "
            "(SELECT MAX(issued_date) FROM pfz_advisories)"
        )["rows"][0]
        n_pfz, n_sst, n_chl, n_active, pfz_from, pfz_to = counts
    except Exception:
        n_pfz = n_sst = n_chl = n_active = 0
        pfz_from = pfz_to = None

    # Active PFZ advisories
    try:
        active_pfz = execute.run_query(
            "SELECT zone_name, latitude, longitude, sst_c, chlorophyll_mg, "
            "fish_species, confidence, valid_from, valid_to "
            "FROM pfz_advisories "
            "WHERE valid_from <= CURRENT_DATE AND valid_to >= CURRENT_DATE "
            "ORDER BY issued_date DESC LIMIT 12"
        )
    except Exception:
        active_pfz = {"columns": [], "rows": []}

    # Recent SST composites (sample)
    try:
        recent_sst = execute.run_query(
            "SELECT obs_date, latitude, longitude, sst_c, sst_anomaly_c "
            "FROM sst_composites ORDER BY obs_date DESC LIMIT 8"
        )
    except Exception:
        recent_sst = {"columns": [], "rows": []}

    # Recent chlorophyll (sample)
    try:
        recent_chl = execute.run_query(
            "SELECT obs_date, latitude, longitude, chl_a_mg_m3, source "
            "FROM chlorophyll ORDER BY obs_date DESC LIMIT 8"
        )
    except Exception:
        recent_chl = {"columns": [], "rows": []}

    # Species found in active advisories
    try:
        species = execute.run_query(
            "SELECT DISTINCT unnest(fish_species) AS species "
            "FROM pfz_advisories "
            "WHERE valid_from <= CURRENT_DATE AND valid_to >= CURRENT_DATE "
            "ORDER BY species LIMIT 30"
        )
        species_list = [r[0] for r in species["rows"]]
    except Exception:
        species_list = []

    # Build GeoJSON of active PFZ zones for the map
    pfz_features = []
    for row in active_pfz["rows"]:
        cols = active_pfz["columns"]
        props = {c: v for c, v in zip(cols, row)}
        lat = props.get("latitude")
        lon = props.get("longitude")
        if lat is not None and lon is not None:
            pfz_features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": props,
            })

    # Report what is actually loaded, per source tag, rather than a fixed label.
    try:
        src_rows = execute.run_query(
            "SELECT 'pfz' AS t, source, COUNT(*), MAX(issued_date) FROM pfz_advisories GROUP BY source "
            "UNION ALL SELECT 'sst', source, COUNT(*), MAX(obs_date) FROM sst_composites GROUP BY source "
            "UNION ALL SELECT 'chl', source, COUNT(*), MAX(obs_date) FROM chlorophyll GROUP BY source "
            "ORDER BY 1, 3 DESC"
        )["rows"]
    except Exception:
        src_rows = []
    sources = [_describe_source(t, s, n, latest) for t, s, n, latest in src_rows]

    example_questions = [
        "Current fishing zones near Kochi",
        "Is the water warm enough for tuna near Chennai?",
        "Average chlorophyll in the Arabian Sea this month",
        "Which zones have sardine right now?",
        "SST near Visakhapatnam this week",
        "Show me chlorophyll hotspots in the Bay of Bengal",
    ]

    seasonal_tips = [
        {
            "season": "Oct–Jan (NE Monsoon)",
            "species": ["sardine", "mackerel", "anchovy"],
            "tip": "Post-monsoon upwelling along the southeast coast brings nutrient-rich "
                   "water to the surface. Watch for chlorophyll blooms near Tamil Nadu.",
        },
        {
            "season": "Feb–May (Pre-Monsoon)",
            "species": ["tuna", "seer fish", "pomfret"],
            "tip": "Warm, calm waters along the west coast. Tuna and seer fish move closer "
                   "to shore. Look for SST 27–30°C zones.",
        },
        {
            "season": "Jun–Sep (SW Monsoon)",
            "species": ["mackerel", "oil sardine", "prawn"],
            "tip": "Heavy upwelling off Kerala and Karnataka coasts. Massive plankton blooms "
                   "attract schooling fish. Monitor PFZ advisories closely.",
        },
    ]

    return {
        "sources": sources,
        "summary": {
            "pfz_advisories": n_pfz,
            "sst_observations": n_sst,
            "chlorophyll_observations": n_chl,
            "active_advisories": n_active,
            "data_from": pfz_from,
            "data_to": pfz_to,
        },
        "active_pfz": active_pfz,
        "recent_sst": recent_sst,
        "recent_chl": recent_chl,
        "pfz_geojson": {"type": "FeatureCollection", "features": pfz_features},
        "species": species_list,
        "example_questions": example_questions,
        "seasonal_tips": seasonal_tips,
    }
