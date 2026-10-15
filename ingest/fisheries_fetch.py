"""Fetch REAL, open fisheries data for the Indian coast and load it.

Sources (no account or key needed):
  * NOAA OISST v2.1  — daily 0.25° satellite+in-situ sea-surface temperature and
    anomaly, via NOAA CoastWatch ERDDAP (ncdcOisst21Agg_LonPM180).
  * NOAA VIIRS (SNPP) — daily 4 km chlorophyll-a, via the same ERDDAP
    (nesdisVHNSQchlaDaily).
  * Potential fishing zones are then DERIVED from those two grids around each
    port, the same way INCOIS builds its PFZ advisories (warm SST band + high
    chlorophyll).  They are tagged source = 'derived: NOAA OISST + VIIRS chl-a',
    never presented as INCOIS advisories.

  python -m ingest.fisheries_fetch                 # last 14 days SST, 7 days chl, derive PFZ
  python -m ingest.fisheries_fetch --days 30
  python -m ingest.fisheries_fetch --drop-demo     # also delete rows tagged source='DEMO'
"""
from __future__ import annotations

import argparse
import csv
import io
import logging
import math
from collections import defaultdict
from datetime import date, datetime, timedelta

import httpx
import psycopg

from app import config
from ingest.fisheries import GEOM, PORTS, _species_for, ensure_schema

log = logging.getLogger("ingest.fisheries_fetch")

ERDDAP = "https://coastwatch.pfeg.noaa.gov/erddap/griddap"
SST_DATASET = "ncdcOisst21NrtAgg"   # near-real-time (~2 day lag), 0–360° lon; the final product lags ~2 weeks
CHL_DATASET = "nesdisVHNSQchlaDaily"
SST_SOURCE = "NOAA-OISST"
CHL_SOURCE = "NOAA-VIIRS"
PFZ_SOURCE = "derived: NOAA OISST + VIIRS chl-a"

# Indian coastal box: Arabian Sea to Bay of Bengal
LAT0, LAT1, LON0, LON1 = 5, 24, 66, 92
SST_STRIDE = 2   # 0.25° grid -> 0.5°
CHL_STRIDE = 4   # 0.0375° grid -> 0.15°

PFZ_RADIUS_KM = 150
PFZ_MIN_DIST_KM = 25     # skip the surf zone / river mouths
PFZ_MAX_CHL = 15.0       # above this VIIRS is usually seeing sediment, not plankton
PFZ_MIN_SEP_KM = 20
PFZ_PER_PORT = 3
PFZ_VALID_DAYS = 3


def _get(url: str) -> str:
    with httpx.Client(follow_redirects=True, timeout=300) as c:
        r = c.get(url)
        r.raise_for_status()
        return r.text


def _rows(text: str) -> list[dict]:
    lines = text.splitlines()
    header = lines[0].split(",")
    return [dict(zip(header, row)) for row in csv.reader(io.StringIO("\n".join(lines[2:])))]


def _latest(dataset: str) -> date:
    """The dataset's own last available day — windows are anchored on it, since
    every satellite product lags real time by days or weeks."""
    info = _get(f"{ERDDAP.replace('/griddap', '/info')}/{dataset}/index.csv")
    for row in csv.reader(io.StringIO(info)):
        if len(row) > 4 and row[2] == "time_coverage_end":
            return date.fromisoformat(row[4][:10])
    raise RuntimeError(f"no time_coverage_end for {dataset}")


def fetch_oisst(days: int) -> list[tuple]:
    end = _latest(SST_DATASET)
    start = (end - timedelta(days=days - 1)).isoformat() + "T12:00:00Z"
    sub = f"[({start}):(last)][(0.0)][({LAT0}):{SST_STRIDE}:({LAT1})][({LON0}):{SST_STRIDE}:({LON1})]"
    url = f"{ERDDAP}/{SST_DATASET}.csv?sst{sub},anom{sub}"
    out = []
    for r in _rows(_get(url)):
        if r["sst"] in ("", "NaN"):
            continue
        anom = None if r.get("anom") in (None, "", "NaN") else float(r["anom"])
        out.append((r["time"][:10], float(r["latitude"]), float(r["longitude"]), float(r["sst"]), anom))
    log.info("OISST: %d sea cells, %d days ending %s", len(out), days, end)
    return out


def fetch_viirs(days: int) -> list[tuple]:
    end = _latest(CHL_DATASET)
    start = (end - timedelta(days=days - 1)).isoformat() + "T12:00:00Z"
    # latitude axis is descending on this dataset
    url = (f"{ERDDAP}/{CHL_DATASET}.csv?chlor_a[({start}):(last)][(0.0)]"
           f"[({LAT1}):{CHL_STRIDE}:({LAT0})][({LON0}):{CHL_STRIDE}:({LON1})]")
    out = []
    for r in _rows(_get(url)):
        if r["chlor_a"] in ("", "NaN"):
            continue
        out.append((r["time"][:10], round(float(r["latitude"]), 4), round(float(r["longitude"]), 4),
                    float(r["chlor_a"])))
    log.info("VIIRS chl-a: %d cloud-free cells, %d days ending %s", len(out), days, end)
    return out


def _km(lat1, lon1, lat2, lon2) -> float:
    p = math.pi / 180
    a = (0.5 - math.cos((lat2 - lat1) * p) / 2
         + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2)
    return 12742 * math.asin(math.sqrt(a))


def derive_pfz(sst: list[tuple], chl: list[tuple]) -> list[tuple]:
    """Score coastal cells on chlorophyll (food) within a warm-water SST band and
    pick the best few near each port — the INCOIS PFZ recipe, on open data."""
    # latest SST per 0.5° cell, mean chl per 0.15° cell
    latest_sst: dict[tuple, tuple] = {}
    for d, la, lo, t, _ in sst:
        k = (round(la, 3), round(lo, 3))
        if k not in latest_sst or d > latest_sst[k][0]:
            latest_sst[k] = (d, t)
    chl_acc: dict[tuple, list] = defaultdict(list)
    for _, la, lo, c in chl:
        chl_acc[(la, lo)].append(c)
    chl_mean = {k: sum(v) / len(v) for k, v in chl_acc.items()}

    def sst_at(la, lo):
        best, bd = None, 1e9
        for (sla, slo), (_, t) in latest_sst.items():
            d = abs(sla - la) + abs(slo - lo)
            if d < bd:
                best, bd = t, d
        return best if bd < 0.6 else None

    today = date.today()
    species = _species_for(today)
    zones = []
    for name, plon, plat, _ in PORTS:
        cands = []
        for (la, lo), c in chl_mean.items():
            dist = _km(plat, plon, la, lo)
            if not PFZ_MIN_DIST_KM <= dist <= PFZ_RADIUS_KM or c > PFZ_MAX_CHL:
                continue
            t = sst_at(la, lo)
            if t is None or not 24 <= t <= 31:
                continue
            warm = 1 - abs(t - 28.5) / 4.5          # 1 at 28.5 °C, 0 at the band edges
            score = math.log1p(c) * (0.5 + warm)
            cands.append((score, la, lo, c, t, dist))
        cands.sort(reverse=True)
        picked: list[tuple] = []
        for s, la, lo, c, t, dist in cands:
            if all(_km(la, lo, p[1], p[2]) >= PFZ_MIN_SEP_KM for p in picked):
                picked.append((s, la, lo, c, t, dist))
            if len(picked) == PFZ_PER_PORT:
                break
        for i, (s, la, lo, c, t, dist) in enumerate(picked, 1):
            zones.append((
                today, today, today + timedelta(days=PFZ_VALID_DAYS), f"{name} PFZ-{i}",
                la, lo, lo, la, round(t, 2), round(c, 3), None,
                species[:2] if i % 2 else species[-2:],
                "high" if c >= 1.0 else "medium", PFZ_SOURCE,
            ))
    log.info("derived %d fishing zones around %d ports", len(zones), len(PORTS))
    return zones


def load(conn: psycopg.Connection, sst, chl, pfz, drop_demo: bool) -> None:
    cur = conn.cursor()
    if drop_demo:
        for t in ("pfz_advisories", "sst_composites", "chlorophyll"):
            cur.execute(f"DELETE FROM {t} WHERE source = 'DEMO'")
        log.info("DEMO rows removed")
    # replace this source's rows for the fetched window so re-runs are idempotent
    if sst:
        cur.execute("DELETE FROM sst_composites WHERE source = %s AND obs_date >= %s", (SST_SOURCE, min(r[0] for r in sst)))
        cur.executemany(
            f"INSERT INTO sst_composites (obs_date, latitude, longitude, geom, sst_c, sst_anomaly_c, source) "
            f"VALUES (%s,%s,%s,{GEOM},%s,%s,%s)",
            [(d, la, lo, lo, la, t, a, SST_SOURCE) for d, la, lo, t, a in sst])
    if chl:
        cur.execute("DELETE FROM chlorophyll WHERE source = %s AND obs_date >= %s", (CHL_SOURCE, min(r[0] for r in chl)))
        cur.executemany(
            f"INSERT INTO chlorophyll (obs_date, latitude, longitude, geom, chl_a_mg_m3, source) "
            f"VALUES (%s,%s,%s,{GEOM},%s,%s)",
            [(d, la, lo, lo, la, c, CHL_SOURCE) for d, la, lo, c in chl])
    if pfz:
        cur.execute("DELETE FROM pfz_advisories WHERE source = %s AND issued_date = CURRENT_DATE", (PFZ_SOURCE,))
        cur.executemany(
            f"INSERT INTO pfz_advisories (issued_date, valid_from, valid_to, zone_name, latitude, longitude, "
            f"geom, sst_c, chlorophyll_mg, wind_speed_kn, fish_species, confidence, source) "
            f"VALUES (%s,%s,%s,%s,%s,%s,{GEOM},%s,%s,%s,%s,%s,%s)", pfz)
    conn.commit()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", type=int, default=14, help="days of SST to fetch (chlorophyll uses half)")
    ap.add_argument("--drop-demo", action="store_true", help="delete rows tagged source='DEMO' first")
    args = ap.parse_args()

    sst = fetch_oisst(args.days)
    chl = fetch_viirs(max(3, args.days // 2))
    pfz = derive_pfz(sst, chl)
    url = config.DATABASE_URL_ADMIN or ap.error("DATABASE_URL_ADMIN is not set")
    with psycopg.connect(url) as conn:
        ensure_schema(conn)
        load(conn, sst, chl, pfz, args.drop_demo)
    log.info("done — loaded %d SST, %d chlorophyll, %d PFZ rows (fetched %s)",
             len(sst), len(chl), len(pfz), datetime.now().strftime("%Y-%m-%d %H:%M"))


if __name__ == "__main__":
    main()
