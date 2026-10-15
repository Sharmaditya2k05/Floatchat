CREATE EXTENSION IF NOT EXISTS postgis;

-- One row per float
CREATE TABLE IF NOT EXISTS floats (
    wmo_id           BIGINT PRIMARY KEY,          -- PLATFORM_NUMBER
    project_name     TEXT,
    data_center      TEXT,
    first_profile_at TIMESTAMPTZ,
    last_profile_at  TIMESTAMPTZ,
    n_profiles       INTEGER
);

-- One row per profile (float + cycle) — fast for maps, counts, nearest-N
CREATE TABLE IF NOT EXISTS profiles (
    profile_id     BIGSERIAL PRIMARY KEY,
    wmo_id         BIGINT REFERENCES floats(wmo_id),
    cycle_number   INTEGER NOT NULL,
    profile_time   TIMESTAMPTZ NOT NULL,
    latitude       DOUBLE PRECISION NOT NULL,
    longitude      DOUBLE PRECISION NOT NULL,
    geom           GEOGRAPHY(POINT, 4326),        -- for spatial/nearest queries
    data_mode      CHAR(1),                       -- R / A / D
    max_depth_m    DOUBLE PRECISION,
    surface_temp_c DOUBLE PRECISION,
    surface_psal   DOUBLE PRECISION,
    n_levels       INTEGER,
    UNIQUE (wmo_id, cycle_number)
);

-- One row per measurement level (the big table)
CREATE TABLE IF NOT EXISTS measurements (
    profile_id    BIGINT REFERENCES profiles(profile_id),
    pressure_db   DOUBLE PRECISION,   -- PRES(_ADJUSTED)
    depth_m       DOUBLE PRECISION,
    temperature_c DOUBLE PRECISION,   -- TEMP(_ADJUSTED)
    salinity_psu  DOUBLE PRECISION,   -- PSAL(_ADJUSTED)
    is_adjusted   BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_meas_profile ON measurements(profile_id);
CREATE INDEX IF NOT EXISTS idx_prof_time    ON profiles(profile_time);
CREATE INDEX IF NOT EXISTS idx_prof_geom    ON profiles USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_prof_wmo     ON profiles(wmo_id);

-- Named regions so "Arabian Sea", "Bay of Bengal" work in SQL directly
CREATE TABLE IF NOT EXISTS regions (
    name    TEXT PRIMARY KEY,
    aliases TEXT[],
    bbox    GEOGRAPHY(POLYGON, 4326)
);

-- ── Fisheries layer ──────────────────────────────────────────────────

-- Potential Fishing Zone advisories (INCOIS PFZ)
CREATE TABLE IF NOT EXISTS pfz_advisories (
    advisory_id    BIGSERIAL PRIMARY KEY,
    issued_date    DATE NOT NULL,
    valid_from     DATE NOT NULL,
    valid_to       DATE NOT NULL,
    zone_name      TEXT,
    latitude       DOUBLE PRECISION NOT NULL,
    longitude      DOUBLE PRECISION NOT NULL,
    geom           GEOGRAPHY(POINT, 4326),
    sst_c          DOUBLE PRECISION,
    chlorophyll_mg DOUBLE PRECISION,
    wind_speed_kn  DOUBLE PRECISION,
    fish_species   TEXT[],
    confidence     TEXT,
    source         TEXT DEFAULT 'INCOIS-PFZ'
);

CREATE INDEX IF NOT EXISTS idx_pfz_date   ON pfz_advisories(issued_date);
CREATE INDEX IF NOT EXISTS idx_pfz_valid  ON pfz_advisories(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_pfz_geom   ON pfz_advisories USING GIST(geom);

-- SST composites (daily/weekly gridded sea-surface temperature)
CREATE TABLE IF NOT EXISTS sst_composites (
    sst_id         BIGSERIAL PRIMARY KEY,
    obs_date       DATE NOT NULL,
    latitude       DOUBLE PRECISION NOT NULL,
    longitude      DOUBLE PRECISION NOT NULL,
    geom           GEOGRAPHY(POINT, 4326),
    sst_c          DOUBLE PRECISION NOT NULL,
    sst_anomaly_c  DOUBLE PRECISION,
    source         TEXT DEFAULT 'INCOIS-SST'
);

CREATE INDEX IF NOT EXISTS idx_sst_date ON sst_composites(obs_date);
CREATE INDEX IF NOT EXISTS idx_sst_geom ON sst_composites USING GIST(geom);

-- Chlorophyll-a / ocean colour (ISRO OCM / MODIS)
CREATE TABLE IF NOT EXISTS chlorophyll (
    chl_id         BIGSERIAL PRIMARY KEY,
    obs_date       DATE NOT NULL,
    latitude       DOUBLE PRECISION NOT NULL,
    longitude      DOUBLE PRECISION NOT NULL,
    geom           GEOGRAPHY(POINT, 4326),
    chl_a_mg_m3    DOUBLE PRECISION NOT NULL,
    source         TEXT DEFAULT 'ISRO-OCM'
);

CREATE INDEX IF NOT EXISTS idx_chl_date ON chlorophyll(obs_date);
CREATE INDEX IF NOT EXISTS idx_chl_geom ON chlorophyll USING GIST(geom);
