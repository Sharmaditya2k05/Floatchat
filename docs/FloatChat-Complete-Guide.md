# FloatChat — The Complete Guide

*Everything about the project, in plain language and full detail — enough that someone could rebuild it from scratch.*

FloatChat is a website where anyone can ask a question about the ocean in plain language — English or an Indian language — and get back a correct, short answer, a map of the relevant ocean robots, a chart, and the exact database query that produced the answer. It is built on real ARGO ocean-float data and now includes a **Fisheries Intelligence** layer that combines PFZ advisories, SST composites, and chlorophyll/ocean colour data to help fishermen find productive fishing grounds.

This guide has six parts:

1. **The domain** — what ARGO is, who INCOIS/MoES are, and what the data looks like.
2. **The data pipeline** — how raw ocean files become a clean database.
3. **The brain** — the core: language handling, RAG, the LLM, NL→SQL, validation, execution, grounding.
4. **The application** — the backend API and the frontend.
5. **Build it from scratch** — step-by-step.
6. **Reference** — tech stack, and a glossary.

---

## Part 1 · The domain

### What is ARGO?

**ARGO** is a global ocean-observing programme running since the year 2000. It is a fleet of about **4,000 autonomous robotic floats** drifting through every ocean. Each float is a tube roughly a metre long that repeats a cycle, typically every **10 days**:

1. It sinks to about **2,000 metres** deep and drifts with the current ("parking").
2. It rises slowly to the surface, and **as it rises it measures the water**: temperature, salinity (saltiness), and pressure at many depths.
3. At the surface it transmits its readings home by satellite, then sinks again.

Each rise-and-measure is called a **profile** — a vertical stack of readings (a value at 5 m, 20 m, 100 m, 500 m, and so on) taken in one place at one time. The fleet adds **100,000+ profiles a year**; there are over 3 million in total. ARGO is named after the ship in the Greek myth of Jason (it pairs with the "Jason" satellite altimeters).

Why it matters: the ocean stores most of the planet's heat. ARGO is the single most important source of data on how the upper ocean is changing — it feeds weather and climate forecasts, fisheries, and cyclone prediction.

### Who are INCOIS and MoES?

- **MoES** — the **Ministry of Earth Sciences**, Government of India.
- **INCOIS** — the **Indian National Centre for Ocean Information Services**, an institute under MoES, based in Hyderabad. INCOIS both **deploys ARGO floats** in the Indian Ocean and **consumes** ARGO data to produce ocean forecasts, potential-fishing-zone advisories, cyclone and tsunami warnings.

FloatChat's reference problem is **ANALYTICA 2026, PS26-033**, which originates from MoES/INCOIS: make ARGO data usable by non-specialists.

### The problem we solve

ARGO data is public, but it ships as **NetCDF** files — a scientific binary format with domain-specific conventions. To get a single answer today, a person must understand NetCDF, quality-control flags, "delayed-mode vs real-time" processing, pressure-vs-depth, and write extraction code. In practice only a small number of trained scientists can do this. **FloatChat removes every one of those steps.**

### The dataset in detail

Each ARGO measurement comes with a lot of metadata. The variables that matter:

| Variable | Meaning |
|---|---|
| `PLATFORM_NUMBER` | the float's unique **WMO id** (like a licence plate) |
| `CYCLE_NUMBER` | which dive-rise cycle this profile is |
| `LATITUDE`, `LONGITUDE` | where the float surfaced |
| `JULD` | the time of the profile (a "Julian day" → converted to a normal date) |
| `PRES` | **pressure** in decibars (dbar) — what the float actually measures for depth |
| `TEMP` | temperature in °C |
| `PSAL` | practical salinity in PSU (practical salinity units) |
| `PRES/TEMP/PSAL_ADJUSTED` | delayed-mode, scientifically corrected versions of the above |
| `*_QC` | a per-value **quality-control flag** |
| `DATA_MODE` | `R` real-time, `A` adjusted, `D` delayed-mode |
| `DIRECTION` | `A` ascending / `D` descending |

**Quality-control (QC) flags** — the critical part. Every single reading has a flag:

`1` good · `2` probably good · `3` bad but correctable · `4` bad · `5` changed · `8` interpolated · `9` missing.

**FloatChat keeps only flags {1, 2}** and drops the rest. This is what makes answers trustworthy — bad and missing readings never enter the database.

**Adjusted values.** Months after a profile is collected, scientists publish carefully corrected ("delayed-mode") versions. When a good corrected value exists, FloatChat stores that instead of the raw one, and records `is_adjusted = true`.

**Pressure vs depth.** Floats measure pressure, not depth. FloatChat converts pressure (dbar) to true depth in metres at ingest using the **TEOS-10** standard (the `gsw` library, `gsw.z_from_p`). So a filter like "above 200 m" is exact.

### Where the data actually comes from

- **ARGO's official servers** — the **GDAC** (Global Data Assembly Centre, at Ifremer/US-GODAE) and the **Ifremer ERDDAP** server. These are the canonical distribution points.
- **`argopy`** — a Python library that fetches ARGO data by region, float, or profile and returns it as tidy `xarray` datasets. FloatChat uses `argopy` in **"expert" mode** (which exposes QC flags and adjusted values) against ERDDAP.
- **INCOIS / data.gov.in** — the same Indian-Ocean floats are catalogued on `kerala.data.gov.in/catalog/indian-ocean-argo-data`. That catalog entry is only a **pointer** (no file attached), so FloatChat loads the identical floats from ARGO's servers via `argopy`.

**Pilot scope:** the Indian Ocean (roughly longitude 20–120°E, latitude 40°S–30°N), for the year **2023**. Loaded once into a local database so demos run with no network. The current database holds **~440 floats, ~12,400 profiles, ~8 million measurements.**

---

## Part 2 · The data pipeline (ingestion)

This runs **once, offline**, to build the database. Four stages: fetch → transform → load, plus schema.

### 2.1 Fetch (`ingest/fetch.py`)

Uses `argopy`'s `DataFetcher(src="erddap", mode="expert").region([lon_min, lon_max, lat_min, lat_max, pres_min, pres_max, date_start, date_end]).to_xarray()`. Because a whole-basin, whole-year request is huge, FloatChat fetches in **monthly time chunks × spatial tiles** (e.g. 25° squares) with retries, so it stays memory-safe and resilient to network hiccups.

### 2.2 Transform (`ingest/transform.py`)

Each `xarray` dataset (shaped as profiles × depth-levels) is flattened into a **tidy table**: one row per (float, cycle, depth-level). Then it is cleaned:

- Keep only rows whose QC flag is in **{1, 2}**.
- **Prefer the adjusted value** when it exists and its QC is good; otherwise use the raw value; mark `is_adjusted`.
- Drop rows missing pressure/temperature/salinity.
- Keep **ascending** profiles (`DIRECTION = 'A'`).
- Convert `JULD` → a real UTC datetime.
- Compute **`depth_m`** from pressure using TEOS-10 (`gsw`).

A **per-profile summary** is also derived (one row per float+cycle): position, time, data mode, max depth, the surface temperature/salinity, and the number of levels. This summary table is what makes maps, counts, and "nearest float" queries fast.

### 2.3 Load (`ingest/load.py`)

Rows are bulk-loaded into PostgreSQL using **`COPY`** (the fast path). Profiles are inserted with `ON CONFLICT DO NOTHING` so re-running is safe (idempotent). PostGIS geometry points are built from lat/lon. Indexes are created on time, float id, and a **GiST spatial index** on the geometry.

### 2.4 The database schema (`db/schema.sql`)

PostgreSQL 16 with the **PostGIS** extension (adds geography types + spatial functions). Four tables:

```sql
floats(wmo_id PK, project_name, data_center,
       first_profile_at, last_profile_at, n_profiles)

profiles(profile_id PK, wmo_id FK, cycle_number, profile_time,
         latitude, longitude, geom GEOGRAPHY(POINT,4326),
         data_mode, max_depth_m, surface_temp_c, surface_psal, n_levels,
         UNIQUE(wmo_id, cycle_number))

measurements(profile_id FK, pressure_db, depth_m,
             temperature_c, salinity_psu, is_adjusted)

regions(name PK, aliases TEXT[], bbox GEOGRAPHY(POLYGON,4326))
```

**Design rationale.** The huge `measurements` table (millions of rows) is only touched when a question needs depth-level values. Everything else — maps, counts, positions, nearest-float — is answered from the small `profiles` summary table, which is fast. The `regions` table lets a question like "Arabian Sea" resolve to a bounding box via `ST_Covers(regions.bbox, profiles.geom)`.

### 2.5 Fisheries tables

Three additional tables support the Fisheries Intelligence layer:

```sql
pfz_advisories(advisory_id PK, issued_date, valid_from, valid_to,
               zone_name, latitude, longitude, geom GEOGRAPHY(POINT,4326),
               sst_c, chlorophyll_mg, wind_speed_kn, fish_species TEXT[],
               confidence, source)

sst_composites(sst_id PK, obs_date, latitude, longitude,
               geom GEOGRAPHY(POINT,4326), sst_c, sst_anomaly_c, source)

chlorophyll(chl_id PK, obs_date, latitude, longitude,
            geom GEOGRAPHY(POINT,4326), chl_a_mg_m3, source)
```

**SST composites** are daily gridded sea-surface temperature (and anomaly) from **NOAA OISST v2.1**, fetched over the Indian coastal box from NOAA CoastWatch's ERDDAP server — open, no account. SST from the ARGO floats already loaded can be added alongside (`source = 'ARGO-derived'`). Warm-water bands are where pelagic fish gather.

**Chlorophyll** is daily 4 km chlorophyll-a from **NOAA VIIRS** (same ERDDAP). Chlorophyll-a concentration is a direct indicator of phytoplankton blooms — more chlorophyll means more food for fish, so productive fishing grounds. INCOIS's ERDDAP also serves ISRO OCM chlorophyll archives (2003–2020) that can be loaded for historical questions.

**PFZ advisories** — INCOIS publishes its Potential Fishing Zone advisories as bulletins and SMS, not as an open dataset. FloatChat therefore *derives* fishing zones from the two satellite grids with the same recipe INCOIS uses (a warm SST band plus high chlorophyll, within 150 km of each port, 3 zones per port, valid 3 days) and tags them `source = 'derived: NOAA OISST + VIIRS chl-a'`. Official INCOIS exports, when available, load into the same table with `source = 'INCOIS-PFZ'`. Each zone carries its validity, likely species for the season, and the SST/chlorophyll at the zone.

Every row in the three tables carries a `source` tag, and the Fisheries tab's "where the data comes from" panel is generated from those tags — it describes exactly what is loaded. On the deployed server a nightly cron job (`deploy/refresh_fisheries.sh`, installed by `deploy/install_cron.sh`) re-runs the fetch inside the API container, so the satellite SST, chlorophyll and derived zones stay current without any manual step. All three tables have spatial (GiST) and date indexes and are queried through the same NL→SQL pipeline as the ARGO tables.

Two database **roles** are created: an **admin** role for ingestion, and a **read-only** role (`GRANT SELECT` only) that the live app uses — so the app can never modify data.

---

## Part 3 · The brain (the core of the system)

This is what happens when a user asks a question. The request flows through the backend's `/chat` endpoint. Here is every step.

```
question
   ↓  detect language, translate if needed
   ↓  RETRIEVE relevant schema notes (RAG)
   ↓  WRITE one SQL statement (LLM, or rule engine)
   ↓  VALIDATE it (sqlglot: single SELECT, safe tables, LIMIT)
   ↓  RUN it read-only against Postgres (+PostGIS)
   ↓  SHAPE the result → map (GeoJSON) + chart series
   ↓  WRITE one grounded sentence
answer + map + chart + the SQL + the source float ids
```

### 3.1 Language detection & translation (`app/lang.py`)

The question's language is detected (`langdetect`). If it isn't English, it is translated to English before anything else. Two mechanisms:

- **With an LLM:** the model translates, with a strict instruction to **preserve place names, numbers, coordinates, dates and units** (so "Bay of Bengal" survives translation and the region filter still works).
- **Without an LLM (offline):** a small **gazetteer** maps domain words from Hindi/Tamil/Bengali/Telugu into English — e.g. `बंगाल की खाड़ी → Bay of Bengal`, `லவணता → salinity`, `மிதவைகள் → floats`. This is applied *before* translation as a safety net, so region names always survive.

Verified working in **English, Hindi, Tamil, Bengali, and Telugu.**

### 3.2 RAG — Retrieval-Augmented Generation (`rag/`)

**What RAG is, and why.** A language model, left to itself, will happily invent table and column names that don't exist — the classic way text-to-SQL fails. **RAG** fixes this: before asking the model to write SQL, we *retrieve* the exact, relevant pieces of the database's documentation and hand them to the model. The model can then only use real tables and columns, because those are the only ones it was shown.

**What we index (the "knowledge").** A set of short documents (`rag/schema_docs.py`):

- one document per **table** (name, purpose, every column with its type and meaning),
- one document per **column** with **synonyms** (so "salinity" ↔ `salinity_psu`, "depth" ↔ `depth_m`),
- one document per **named region** and its aliases,
- the curated **few-shot NL→SQL example pairs** (`rag/examples.py`) — real question→SQL examples.

**How retrieval works (`rag/retriever.py`).** Each document and the incoming question are turned into a numeric vector; we return the **top ~6 documents** most similar to the question (cosine similarity). Two backends:

- **TF-IDF** (default) — a classic, dependency-free "how important is each word" vectoriser. It needs no model download and runs fully offline. This is what makes FloatChat work without internet.
- **sentence-transformers (MiniLM)** — optional dense embeddings for better semantic matching, if you install it and want higher quality.

The retrieved schema docs + few-shot examples are injected into the prompt. (We keep this layer as a **thin custom module** rather than pulling in **LangChain** — the plumbing here is small, and a custom layer keeps it offline-friendly and easy to reason about. LangChain would be a drop-in alternative if you preferred its abstractions.)

### 3.3 The LLM and NL→SQL (`app/nl2sql.py`, `app/llm.py`)

**How the LLM is used.** We do **not** fine-tune anything. We use a general chat model with a carefully constructed prompt:

- A **system prompt** that says: *"You are an expert PostgreSQL analyst for an ARGO database. Output ONE valid SELECT and nothing else. SELECT only. Use only the tables/columns in the RELEVANT SCHEMA. Prefer the profiles table for maps/counts/nearest. Use ST_Distance/ST_Covers for spatial. Always add LIMIT 500 unless it's an aggregate…"* plus specific rules (e.g. exclude NULLs on superlative queries).
- The **user message** contains the **RELEVANT SCHEMA** (from RAG), the **FEW-SHOT EXAMPLES** (from RAG), and the **user's question**.
- The model returns exactly one SQL statement.

**Providers (`app/llm.py`).** A thin HTTP client supports several, chosen by an environment variable — all interchangeable:

- **Groq** (fast, free) running open models like `openai/gpt-oss-120b` — this is the default in the current deployment.
- **Anthropic** (Claude), **OpenAI**, or a local **Ollama** model for a fully offline LLM.
- **`none`** — no LLM at all; use the rule-based engine below.

For reasoning-style models we pass a low "reasoning effort" so short internal calls stay fast.

**The rule-based fallback engine (`app/fallback_nl2sql.py`).** If no LLM is configured, or the LLM fails, a deterministic engine parses the question with regular expressions and templates and handles the five core query families (below) on its own. This means **the demo works with no internet and never breaks** — the model improves quality, it isn't a hard dependency. Both paths produce SQL that goes through the same safety gate.

**The query families** the system handles:

1. **Aggregate** — avg/min/max over a region + depth + time window.
2. **Nearest-N** — the closest floats to a lat/lon (PostGIS distance).
3. **Single-float profile** — a depth profile for one float/cycle.
4. **Time-series** — a metric grouped by month/season.
5. **Discovery/count** — how many floats/profiles match a filter.
6. **Fisheries — PFZ** — current fishing-zone advisories near a port, optionally filtered by species ("Current fishing zones near Kochi", "Which zones have sardine right now?").
7. **Fisheries — SST** — sea-surface temperature near a location for a species' preferred range ("Is the water warm enough for tuna near Chennai?").
8. **Fisheries — chlorophyll** — chlorophyll-a levels or averages by region/date, and hotspots near a port ("Average chlorophyll in the Arabian Sea this month").

The rule engine recognises fisheries vocabulary (fish species names, "PFZ", "advisory", "chlorophyll", "plankton", "fishing zone"…) and a gazetteer of Indian ports (Kochi, Chennai, Visakhapatnam, Mumbai, Mangalore, Tuticorin, Paradip, Goa, Karwar, Ratnagiri) so a question like "near Kochi" resolves to coordinates without an LLM.

### 3.4 Validation — the safety gate (`app/validate.py`)

An LLM writing SQL against a real database is only safe if every statement is fenced in. Before anything runs, the SQL passes through **`sqlglot`** (a real SQL parser):

1. **Parse** it — reject if it doesn't parse.
2. Reject if it is **not exactly one `SELECT`** (no stacked statements, no DDL/DML).
3. Reject any **denylisted keyword** (`INSERT UPDATE DELETE DROP ALTER CREATE TRUNCATE GRANT COPY …`).
4. Reject any **table not in the allow-list** (`floats, profiles, measurements, regions, pfz_advisories, sst_composites, chlorophyll`).
5. **Force a `LIMIT`** on non-aggregate queries (and cap oversized ones).

If validation fails, the LLM is **retried once** with the error message; if it still fails, the friendly rule engine takes over.

### 3.5 Execution — read-only (`app/execute.py`)

The validated SQL runs through **`psycopg` (v3)** using the **read-only database role**, inside a transaction forced to `default_transaction_read_only = on`, with a **5-second `statement_timeout`**. So the query can look but never touch, and a runaway query is killed. Results come back as columns + rows.

### 3.6 Grounding — no invented numbers (`app/summarize.py`)

This is the trust guarantee. The one-sentence answer is generated **only from the returned rows**. When an LLM writes the sentence, we compute the set of numbers actually present in the result (plus the numbers the user typed) and **reject the sentence if it contains any number that isn't in that set**. If it fails the check, we fall back to a safe template. So FloatChat literally cannot state a number that didn't come from a real query.

### 3.7 Visualisation builder (`app/viz.py`)

From the returned columns/rows it builds:

- a **GeoJSON** FeatureCollection of float positions for the map (and, for aggregate answers that carry no positions, a "context map" of the floats matching the question's region/time),
- a **chart series** — depth-vs-value ("profile"), time-vs-value ("timeseries"), or none,
- a **chart-kind** inference (profile / timeseries / map / table),
- the list of **source WMO float ids**.

### 3.8 Follow-up suggestions (`app/suggest.py`)

After an answer, the LLM proposes three natural next questions (with a static fallback offline). These render as clickable chips.

---

## Part 4 · The application

### 4.1 Backend — FastAPI (`app/main.py`)

Endpoints:

- `POST /chat` — the whole pipeline above; returns `{ question, language, engine, sql, answer, chart_kind, columns, rows, row_count, series, geojson, float_ids, suggestions }`.
- `GET /floats` — GeoJSON of float positions (optionally within a bbox).
- `GET /data/overview` — the Data tab: per-table counts + a few sample rows + the data sources (fixed read-only queries).
- `GET /fisheries/overview` — the Fisheries tab: counts of PFZ/SST/chlorophyll records, active advisories (as rows and as GeoJSON for the map), recent SST and chlorophyll samples, the species present in active advisories, example questions, and a seasonal fishing guide.
- `GET /health` — status + DB connectivity.
- `POST /query` — a dev-only raw-SQL endpoint, disabled unless `DEV_MODE=true`.

### 4.2 Frontend — React + Vite + Tailwind

- **Landing hero** — a cinematic full-viewport entry (background video, headline, an "ask" composer with example chips); typing a question or clicking a chip **crossfades** into the app and runs the query.
- **Explore** — the chat on the left (with grounded answers, "view results", follow-up chips, save/star), and a results panel on the right with **Map / Chart / Table** tabs plus a **Query (SQL)** panel that always shows the exact SQL. The map is a satellite basemap (Leaflet + Esri tiles) with float markers; charts are Plotly (depth profiles have depth inverted; time-series by month).
- **How it works** — an illustrated, plain-language explainer over a deep-sea background.
- **Data** — a live preview of every table + where the data came from.
- **Fisheries** — a dedicated tab for fishermen and fisheries officers: headline counts (advisories, active now, SST and chlorophyll observations), one-click fisheries questions in simple language, the species currently in active PFZ advisories (clickable), a seasonal guide by monsoon period, the three fisheries data sources, live tables of active advisories and recent SST/chlorophyll, and an "offline" note explaining that the rule engine answers from the last synced data when connectivity drops at sea.
- **Query / Saved** — session query history and bookmarked questions.
- A working **dark/light theme** toggle, and **multilingual** input.

---

## Part 5 · Build it from scratch

Prerequisites: Python 3.11+, Node 18+, Docker.

1. **Database.** `docker compose up -d db` — starts PostgreSQL 16 + PostGIS and auto-applies `db/schema.sql`, `db/seed_regions.sql`, and `db/roles.sql`.
2. **Backend deps.** `python -m venv .venv` then `pip install -r requirements.txt` (`fastapi, uvicorn, psycopg, sqlglot, argopy, xarray, netCDF4, gsw, pandas, langdetect, httpx …`).
3. **Ingest the data (once).** `python -m ingest.build_db --start 2023-01-01 --end 2024-01-01`. This fetches, cleans, and loads the Indian-Ocean subset. (First run needs network; afterwards the database volume persists.)
   - **Fisheries layer.** `python -m ingest.fisheries_fetch` pulls the last two weeks of NOAA OISST SST and a week of VIIRS chlorophyll for the Indian coast and derives the fishing zones (needs network, no account; `--days 30` for more). Then `python -m ingest.fisheries --sst-from-argo` adds SST from the ARGO profiles. `ingest.fisheries --csv-dir <folder>` loads INCOIS PFZ / SST and ISRO chlorophyll exports (CSV columns are documented at the top of `ingest/fisheries.py`); `--demo` adds clearly-labelled sample rows (`source = 'DEMO'`) for offline demos. Both scripts apply `db/schema.sql`, so an existing database picks up the three tables.
4. **Build the RAG index.** `python -m rag.index` (re-run after any change to the schema docs or examples — it now indexes the fisheries tables and examples too).
5. **Configure the LLM (optional).** In `.env`, set `LLM_PROVIDER` (`groq`/`anthropic`/`openai`/`ollama`/`none`), the model, and the API key. With `none`, the rule engine runs everything offline.
6. **Run the API.** `uvicorn app.main:app --port 8000`.
7. **Run the frontend.** `cd frontend && npm install && npm run dev`, open `http://localhost:5173`.

To ship a self-contained demo, bake the pre-loaded database volume (or a `pg_dump`) into the image and run the LLM locally with Ollama, so nothing needs the network.

**Deploying to a server.** `docker-compose.prod.yml` runs the full stack on one machine — PostGIS, the API image, and a Caddy container that serves the built frontend and proxies `/api` (HTTPS is automatic once `SITE_ADDRESS` is a domain). `deploy/dump_db.sh` / `deploy/restore_db.sh` move the database up as a `pg_dump`. The complete walkthrough for an Oracle Cloud Always Free ARM VM is in [Deploy-Oracle-Cloud.md](Deploy-Oracle-Cloud.md).

---

## Part 6 · Reference

### Tech stack and why

| Layer | Choice | Why |
|---|---|---|
| Data access | argopy · xarray · pandas · netCDF4 | native ARGO tooling |
| Depth conversion | gsw (TEOS-10) | correct pressure → depth |
| Database | PostgreSQL 16 + PostGIS | spatial SQL the model targets |
| DB driver | psycopg v3 | read-only execution + COPY |
| Retrieval (RAG) | TF-IDF (opt. MiniLM) | schema grounding, offline-capable |
| LLM | Groq / Anthropic / OpenAI / Ollama + rule fallback | quality online, works offline |
| SQL safety | sqlglot | parse + validate |
| Backend | FastAPI + Uvicorn | async API |
| Frontend | React · Vite · Tailwind · Leaflet · Plotly | chat UI + map + charts |
| Container | Docker Compose | reproducible demo |

### Glossary

- **ARGO** — the global fleet of ~4,000 ocean-measuring robotic floats, running since 2000.
- **Float** — one such robot; drifts, dives to ~2 km, rises while measuring, transmits, repeats.
- **Profile** — one dive-to-surface trip: readings at many depths, one place and time.
- **Cycle** — one full dive-and-rise, ~10 days.
- **WMO id** — the unique number identifying each float.
- **Salinity (PSU)** — how salty the water is. **Temperature (°C)** — how warm it is.
- **Pressure (dbar) → depth (m)** — floats measure pressure; we convert it to true depth.
- **QC flag** — a 1–9 quality tag on every reading; we keep only 1 and 2.
- **Adjusted / delayed-mode value** — a later, corrected reading; preferred when good.
- **NetCDF** — the scientific binary file format ARGO ships in.
- **INCOIS / MoES** — India's ocean-information agency and its parent ministry.
- **PostGIS** — the spatial add-on to PostgreSQL (locations, distances, "nearest").
- **NL→SQL** — turning a natural-language question into a database query.
- **RAG (Retrieval-Augmented Generation)** — retrieve the relevant schema first, then let the model generate using it, so it can't invent tables/columns.
- **Embedding / TF-IDF** — ways to turn text into vectors so similar text can be found.
- **Few-shot examples** — worked question→SQL pairs shown to the model to steer it.
- **sqlglot** — the SQL parser that validates the generated query is a safe single SELECT.
- **Grounding** — the guarantee that every number in an answer came from a real query result.
- **argopy** — the Python library that downloads ARGO data from the official servers.
- **TEOS-10 / gsw** — the seawater standard and library used to convert pressure to depth.
- **PFZ (Potential Fishing Zone)** — an INCOIS advisory pointing fishermen to areas where satellite SST, ocean colour and wind suggest fish are likely to aggregate.
- **SST composite** — a gridded sea-surface temperature map assembled from satellite passes over a day or week.
- **Chlorophyll-a (chl-a, mg/m³)** — the pigment in phytoplankton; measured from satellite "ocean colour". High values mark productive water and likely fishing grounds.
- **OCM** — ISRO's Ocean Colour Monitor sensor (Oceansat), one source of chlorophyll data; **MODIS** is NASA's equivalent.

---

*FloatChat — democratising ocean data. ANALYTICA 2026 · PS26-033 · MoES / INCOIS.*
