"""Load the fisheries layer: PFZ advisories, SST composites, chlorophyll-a.

INCOIS publishes PFZ advisories as maps/SMS/PDF bulletins and SST / ocean-colour
products through its portals, not as one public REST API — so this loader takes
three CSV files exported from those products, plus two helpers that make the
Fisheries tab usable before a real feed is wired in:

  python -m ingest.fisheries --csv-dir data/fisheries    # real exports
  python -m ingest.fisheries --sst-from-argo             # SST from the ARGO profiles already loaded
  python -m ingest.fisheries --demo                      # clearly-labelled sample rows (source = 'DEMO')
  python -m ingest.fisheries --reset ...                 # truncate the three tables first

CSV columns
  pfz_advisories.csv : issued_date, valid_from, valid_to, zone_name, latitude, longitude,
                       sst_c, chlorophyll_mg, wind_speed_kn, fish_species (';'-separated),
                       confidence, source
  sst_composites.csv : obs_date, latitude, longitude, sst_c, sst_anomaly_c, source
  chlorophyll.csv    : obs_date, latitude, longitude, chl_a_mg_m3, source
"""
from __future__ import annotations

import argparse
import logging
import math
import random
from datetime import date, timedelta
from pathlib import Path

import psycopg

from app import config

log = logging.getLogger("ingest.fisheries")

SCHEMA_SQL = Path(__file__).resolve().parent.parent / "db" / "schema.sql"

# (name, lon, lat, offshore direction in degrees lon/lat per 10 km)
PORTS = [
    ("Kochi", 76.27, 9.93, (-0.09, 0.0)),
    ("Mangalore", 74.84, 12.87, (-0.09, 0.0)),
    ("Goa", 73.80, 15.40, (-0.09, 0.0)),
    ("Ratnagiri", 73.30, 16.98, (-0.09, 0.0)),
    ("Mumbai", 72.88, 19.08, (-0.09, 0.0)),
    ("Tuticorin", 78.15, 8.76, (0.06, -0.06)),
    ("Chennai", 80.29, 13.08, (0.09, 0.0)),
    ("Visakhapatnam", 83.30, 17.69, (0.09, 0.0)),
    ("Paradip", 86.61, 20.26, (0.09, 0.0)),
]

SEASON_SPECIES = {
    (10, 11, 12, 1): ["sardine", "mackerel", "anchovy"],
    (2, 3, 4, 5): ["tuna", "seer fish", "pomfret"],
    (6, 7, 8, 9): ["mackerel", "oil sardine", "prawn"],
}

GEOM = "ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography"


def _admin_url() -> str:
    url = config.DATABASE_URL_ADMIN
    if not url:
        raise SystemExit("DATABASE_URL_ADMIN is not set (see .env.example)")
    return url


def ensure_schema(conn: psycopg.Connection) -> None:
    conn.execute(SCHEMA_SQL.read_text(encoding="utf-8"))
    conn.commit()


def reset(conn: psycopg.Connection) -> None:
    conn.execute("TRUNCATE pfz_advisories, sst_composites, chlorophyll RESTART IDENTITY")
    conn.commit()
    log.info("fisheries tables truncated")


def _species_for(d: date) -> list[str]:
    for months, species in SEASON_SPECIES.items():
        if d.month in months:
            return species
    return ["tuna"]


def load_csv_dir(conn: psycopg.Connection, folder: Path) -> None:
    import pandas as pd

    pfz = folder / "pfz_advisories.csv"
    if pfz.exists():
        df = pd.read_csv(pfz)
        rows = [
            (r.issued_date, r.valid_from, r.valid_to, r.zone_name, r.latitude, r.longitude,
             r.longitude, r.latitude, r.sst_c, r.chlorophyll_mg, r.wind_speed_kn,
             [s.strip() for s in str(r.fish_species).split(";") if s.strip()],
             r.confidence, getattr(r, "source", "INCOIS-PFZ"))
            for r in df.itertuples(index=False)
        ]
        conn.cursor().executemany(
            f"INSERT INTO pfz_advisories (issued_date, valid_from, valid_to, zone_name, latitude, "
            f"longitude, geom, sst_c, chlorophyll_mg, wind_speed_kn, fish_species, confidence, source) "
            f"VALUES (%s,%s,%s,%s,%s,%s,{GEOM},%s,%s,%s,%s,%s,%s)", rows)
        log.info("pfz_advisories: %d rows from %s", len(rows), pfz)

    sst = folder / "sst_composites.csv"
    if sst.exists():
        df = pd.read_csv(sst)
        rows = [(r.obs_date, r.latitude, r.longitude, r.longitude, r.latitude, r.sst_c,
                 getattr(r, "sst_anomaly_c", None), getattr(r, "source", "INCOIS-SST"))
                for r in df.itertuples(index=False)]
        conn.cursor().executemany(
            f"INSERT INTO sst_composites (obs_date, latitude, longitude, geom, sst_c, sst_anomaly_c, source) "
            f"VALUES (%s,%s,%s,{GEOM},%s,%s,%s)", rows)
        log.info("sst_composites: %d rows from %s", len(rows), sst)

    chl = folder / "chlorophyll.csv"
    if chl.exists():
        df = pd.read_csv(chl)
        rows = [(r.obs_date, r.latitude, r.longitude, r.longitude, r.latitude, r.chl_a_mg_m3,
                 getattr(r, "source", "ISRO-OCM")) for r in df.itertuples(index=False)]
        conn.cursor().executemany(
            f"INSERT INTO chlorophyll (obs_date, latitude, longitude, geom, chl_a_mg_m3, source) "
            f"VALUES (%s,%s,%s,{GEOM},%s,%s)", rows)
        log.info("chlorophyll: %d rows from %s", len(rows), chl)
    conn.commit()


def sst_from_argo(conn: psycopg.Connection) -> int:
    """Real SST from the ARGO surface readings already in `profiles`.
    Anomaly = reading minus the mean of the same month in the same 5° cell."""
    cur = conn.execute(
        """
        INSERT INTO sst_composites (obs_date, latitude, longitude, geom, sst_c, sst_anomaly_c, source)
        SELECT p.profile_time::date, p.latitude, p.longitude, p.geom, p.surface_temp_c,
               p.surface_temp_c - AVG(p.surface_temp_c) OVER (
                   PARTITION BY date_trunc('month', p.profile_time),
                                floor(p.latitude / 5), floor(p.longitude / 5)),
               'ARGO-derived'
        FROM profiles p
        WHERE p.surface_temp_c IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM sst_composites s WHERE s.source = 'ARGO-derived')
        """
    )
    conn.commit()
    log.info("sst_composites: %d rows derived from ARGO profiles", cur.rowcount)
    return cur.rowcount


def demo(conn: psycopg.Connection, seed: int = 7, days: int = 10) -> None:
    """Sample rows around Indian ports for the last `days` days, so the tab and
    the fisheries queries work end-to-end before a real INCOIS feed is connected.
    Every row is tagged source = 'DEMO'."""
    rng = random.Random(seed)
    today = date.today()
    cur = conn.cursor()

    pfz_rows, sst_rows, chl_rows = [], [], []
    for name, lon, lat, (dlon, dlat) in PORTS:
        # PFZ: three zones 20–80 km offshore, re-issued every 3 days, valid 3 days
        for k in range(0, days, 3):
            issued = today - timedelta(days=k)
            for z in range(3):
                dist = 2 + z * 3 + rng.random() * 2  # in 10-km units
                zlon = lon + dlon * dist + rng.uniform(-0.15, 0.15)
                zlat = lat + dlat * dist + rng.uniform(-0.25, 0.25)
                sst = round(29.2 - abs(zlat - 10) * 0.12 + rng.uniform(-0.6, 0.6), 2)
                chl = round(max(0.15, rng.lognormvariate(-0.4, 0.5)), 3)
                species = _species_for(issued)
                pfz_rows.append((
                    issued, issued, issued + timedelta(days=3), f"{name} PFZ-{z + 1}",
                    round(zlat, 4), round(zlon, 4), round(zlon, 4), round(zlat, 4),
                    sst, chl, round(rng.uniform(5, 18), 1),
                    rng.sample(species, k=min(2, len(species))),
                    "high" if chl > 0.6 else "medium", "DEMO",
                ))
        # SST + chlorophyll on a 0.5° grid, ±1.5° around the port, one value per day
        for d in range(days):
            obs = today - timedelta(days=d)
            for i in range(-3, 4):
                for j in range(-3, 4):
                    glat, glon = lat + i * 0.5, lon + j * 0.5
                    offshore = (glon - lon) * (1 if dlon > 0 else -1) if dlon else (glat - lat) * (-1)
                    if offshore < -0.25:  # roughly on land — skip
                        continue
                    sst = 29.0 - abs(glat - 10) * 0.12 - d * 0.03 + rng.uniform(-0.4, 0.4)
                    sst_rows.append((obs, round(glat, 3), round(glon, 3), round(glon, 3), round(glat, 3),
                                     round(sst, 2), round(rng.uniform(-0.8, 0.8), 2), "DEMO"))
                    coastal = math.exp(-max(offshore, 0) * 1.4)
                    chl = max(0.05, 0.25 + 1.8 * coastal * rng.lognormvariate(0, 0.35))
                    chl_rows.append((obs, round(glat, 3), round(glon, 3), round(glon, 3), round(glat, 3),
                                     round(chl, 3), "DEMO"))

    cur.executemany(
        f"INSERT INTO pfz_advisories (issued_date, valid_from, valid_to, zone_name, latitude, longitude, "
        f"geom, sst_c, chlorophyll_mg, wind_speed_kn, fish_species, confidence, source) "
        f"VALUES (%s,%s,%s,%s,%s,%s,{GEOM},%s,%s,%s,%s,%s,%s)", pfz_rows)
    cur.executemany(
        f"INSERT INTO sst_composites (obs_date, latitude, longitude, geom, sst_c, sst_anomaly_c, source) "
        f"VALUES (%s,%s,%s,{GEOM},%s,%s,%s)", sst_rows)
    cur.executemany(
        f"INSERT INTO chlorophyll (obs_date, latitude, longitude, geom, chl_a_mg_m3, source) "
        f"VALUES (%s,%s,%s,{GEOM},%s,%s)", chl_rows)
    conn.commit()
    log.info("demo rows: %d PFZ, %d SST, %d chlorophyll (source='DEMO')",
             len(pfz_rows), len(sst_rows), len(chl_rows))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv-dir", type=Path, help="folder with pfz_advisories.csv / sst_composites.csv / chlorophyll.csv")
    ap.add_argument("--sst-from-argo", action="store_true", help="derive SST composites from loaded ARGO profiles")
    ap.add_argument("--demo", action="store_true", help="insert labelled sample rows around Indian ports")
    ap.add_argument("--reset", action="store_true", help="truncate the three fisheries tables first")
    args = ap.parse_args()
    if not (args.csv_dir or args.sst_from_argo or args.demo or args.reset):
        ap.error("nothing to do — pass --csv-dir, --sst-from-argo and/or --demo")

    with psycopg.connect(_admin_url()) as conn:
        ensure_schema(conn)
        if args.reset:
            reset(conn)
        if args.csv_dir:
            load_csv_dir(conn, args.csv_dir)
        if args.sst_from_argo:
            sst_from_argo(conn)
        if args.demo:
            demo(conn)


if __name__ == "__main__":
    main()
