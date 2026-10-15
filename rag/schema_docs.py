"""Generate the documents indexed for schema RAG (spec §8.2).

One doc per table, per column (with NL synonyms), per named region,
plus the few-shot NL→SQL example pairs.
"""
from __future__ import annotations

from rag.examples import EXAMPLES

TABLE_DOCS = [
    {
        "id": "table:floats",
        "kind": "table",
        "text": (
            "Table floats — one row per ARGO float. Columns: wmo_id BIGINT primary key "
            "(the WMO platform number identifying a float), project_name TEXT, data_center TEXT, "
            "first_profile_at TIMESTAMPTZ, last_profile_at TIMESTAMPTZ (when the float last "
            "reported — use for 'active' floats), n_profiles INTEGER."
        ),
    },
    {
        "id": "table:profiles",
        "kind": "table",
        "text": (
            "Table profiles — one row per profile (one float dive/cycle). Columns: profile_id "
            "BIGSERIAL primary key, wmo_id BIGINT references floats, cycle_number INTEGER, "
            "profile_time TIMESTAMPTZ (when the profile was taken), latitude, longitude DOUBLE "
            "PRECISION, geom GEOGRAPHY(POINT,4326) for spatial and nearest queries, data_mode "
            "CHAR(1) R/A/D, max_depth_m, surface_temp_c (sea-surface temperature), surface_psal "
            "(sea-surface salinity), n_levels. Prefer this table for maps, counts, positions, "
            "nearest-float and surface time-series queries — it avoids scanning measurements."
        ),
    },
    {
        "id": "table:measurements",
        "kind": "table",
        "text": (
            "Table measurements — one row per depth level of a profile (the big table). Columns: "
            "profile_id BIGINT references profiles, pressure_db DOUBLE PRECISION (dbar), depth_m "
            "DOUBLE PRECISION (metres, positive down), temperature_c (°C), salinity_psu (PSU), "
            "is_adjusted BOOLEAN (true when delayed-mode adjusted values were used). Join to "
            "profiles for time/position. Only use when depth-level values are needed."
        ),
    },
    {
        "id": "table:regions",
        "kind": "table",
        "text": (
            "Table regions — named seas and ocean regions. Columns: name TEXT primary key "
            "(e.g. 'Arabian Sea', 'Bay of Bengal', 'Equatorial Indian Ocean', 'Southern Indian "
            "Ocean', 'Indian Ocean'), aliases TEXT[], bbox GEOGRAPHY(POLYGON,4326). Filter "
            "spatially with ST_Covers(regions.bbox, profiles.geom)."
        ),
    },
    {
        "id": "table:pfz_advisories",
        "kind": "table",
        "text": (
            "Table pfz_advisories — INCOIS Potential Fishing Zone advisories. Columns: "
            "advisory_id BIGSERIAL primary key, issued_date DATE, valid_from DATE, valid_to DATE, "
            "zone_name TEXT, latitude/longitude DOUBLE PRECISION, geom GEOGRAPHY(POINT,4326), "
            "sst_c DOUBLE PRECISION (sea-surface temperature at the zone), chlorophyll_mg DOUBLE "
            "PRECISION (chlorophyll concentration), wind_speed_kn DOUBLE PRECISION, fish_species TEXT[] "
            "(array of likely species), confidence TEXT, source TEXT. Use for questions about fishing "
            "zones, PFZ advisories, which areas are good for fishing, fish species, and fishing conditions."
        ),
    },
    {
        "id": "table:sst_composites",
        "kind": "table",
        "text": (
            "Table sst_composites — gridded sea-surface temperature composites from INCOIS. Columns: "
            "sst_id BIGSERIAL primary key, obs_date DATE, latitude/longitude DOUBLE PRECISION, "
            "geom GEOGRAPHY(POINT,4326), sst_c DOUBLE PRECISION (SST in Celsius), sst_anomaly_c "
            "DOUBLE PRECISION (anomaly from climatology), source TEXT. Use for SST patterns, "
            "warm/cold water queries related to fishing, and surface temperature maps."
        ),
    },
    {
        "id": "table:chlorophyll",
        "kind": "table",
        "text": (
            "Table chlorophyll — ocean colour / chlorophyll-a concentrations from ISRO OCM/MODIS. "
            "Columns: chl_id BIGSERIAL primary key, obs_date DATE, latitude/longitude DOUBLE PRECISION, "
            "geom GEOGRAPHY(POINT,4326), chl_a_mg_m3 DOUBLE PRECISION (chlorophyll-a in mg/m³), "
            "source TEXT. High chlorophyll indicates phytoplankton blooms and productive fishing grounds. "
            "Use for questions about ocean productivity, chlorophyll levels, plankton blooms, and "
            "identifying fish-rich areas."
        ),
    },
]

COLUMN_DOCS = [
    {"id": "col:salinity", "kind": "column",
     "text": "Salinity / PSAL / salt content maps to measurements.salinity_psu (PSU); "
             "sea-surface salinity maps to profiles.surface_psal."},
    {"id": "col:temperature", "kind": "column",
     "text": "Temperature / TEMP maps to measurements.temperature_c (°C); sea-surface "
             "temperature / SST maps to profiles.surface_temp_c."},
    {"id": "col:depth", "kind": "column",
     "text": "Depth in metres maps to measurements.depth_m; pressure in dbar maps to "
             "measurements.pressure_db. For depth filters like 'between 0 and 200 m' or "
             "'above 200 m' use measurements.depth_m."},
    {"id": "col:time", "kind": "column",
     "text": "Dates, months, years, 'in 2022', 'March 2023' map to profiles.profile_time "
             "(TIMESTAMPTZ). Group monthly with date_trunc('month', profile_time)."},
    {"id": "col:float-id", "kind": "column",
     "text": "Float id / WMO id / platform number maps to profiles.wmo_id and floats.wmo_id. "
             "A specific profile of a float is identified by (wmo_id, cycle_number); the latest "
             "cycle is MAX(cycle_number)."},
    {"id": "col:position", "kind": "column",
     "text": "Positions / locations / 'where are the floats' map to profiles.latitude, "
             "profiles.longitude and profiles.geom. Nearest-N: ORDER BY profiles.geom <-> "
             "ST_SetSRID(ST_MakePoint(lon, lat),4326)::geography, distance via ST_Distance."},
    {"id": "col:chlorophyll", "kind": "column",
     "text": "Chlorophyll / chlorophyll-a / chl-a / ocean colour / plankton maps to "
             "chlorophyll.chl_a_mg_m3 (mg/m³). High values (>0.5 mg/m³) indicate productive "
             "fishing grounds, but values above 15 near the coast are sediment, not plankton — "
             "filter chl_a_mg_m3 <= 15 when ranking hotspots. Also available as "
             "pfz_advisories.chlorophyll_mg."},
    {"id": "col:pfz", "kind": "column",
     "text": "Fishing zones / PFZ / potential fishing zone / advisory maps to pfz_advisories. "
             "Use pfz_advisories.fish_species for species, pfz_advisories.confidence for "
             "advisory confidence, pfz_advisories.valid_from/valid_to for validity period."},
    {"id": "col:sst-composite", "kind": "column",
     "text": "SST composite / surface temperature map / SST anomaly maps to "
             "sst_composites.sst_c and sst_composites.sst_anomaly_c. Use for broad SST patterns "
             "and fishing temperature preferences."},
    {"id": "col:fish-species", "kind": "column",
     "text": "Fish species / tuna / sardine / mackerel / pomfret / hilsa / seer fish / "
             "kingfish / skipjack maps to pfz_advisories.fish_species (TEXT array). "
             "Filter with array_to_string(pz.fish_species, ',') ILIKE '%name%' so partial "
             "names match (e.g. 'sardine' finds 'oil sardine')."},
]

REGION_DOCS = [
    {"id": "region:arabian-sea", "kind": "region",
     "text": "Region 'Arabian Sea' (aliases: arabian, arab sea, अरब सागर) — northwest Indian "
             "Ocean, roughly lon 45–78E lat 0–27N. Use regions.name = 'Arabian Sea'."},
    {"id": "region:bay-of-bengal", "kind": "region",
     "text": "Region 'Bay of Bengal' (aliases: BoB, bengal, बंगाल की खाड़ी, வங்காள விரிகுடா) — "
             "northeast Indian Ocean, roughly lon 78–100E lat 0–24N. Use regions.name = "
             "'Bay of Bengal'."},
    {"id": "region:equatorial", "kind": "region",
     "text": "Region 'Equatorial Indian Ocean' (aliases: equator, near the equator) — lat "
             "-10 to 10. For strict 'near the equator' use profiles.latitude BETWEEN -2 AND 2."},
    {"id": "region:southern", "kind": "region",
     "text": "Region 'Southern Indian Ocean' — lon 20–120E lat -40 to -10."},
    {"id": "region:indian-ocean", "kind": "region",
     "text": "Region 'Indian Ocean' (alias: हिंद महासागर) — the whole pilot domain, lon 20–120E "
             "lat -40 to 30."},
]


def all_docs() -> list[dict]:
    docs = TABLE_DOCS + COLUMN_DOCS + REGION_DOCS
    for i, ex in enumerate(EXAMPLES):
        docs.append(
            {
                "id": f"example:{i}",
                "kind": "example",
                "text": f"-- Q: {ex['question']}\n{ex['sql']}",
            }
        )
    return docs
