"""Orchestrate the offline ingestion pipeline: fetch → transform → load.

Usage (from repo root, venv active):
    python -m ingest.build_db                       # uses .env dates/bbox
    python -m ingest.build_db --start 2023-01-01 --end 2023-03-31
    python -m ingest.build_db --reset               # truncate first
"""
from __future__ import annotations

import argparse
import logging
import os
import sys

from dotenv import load_dotenv

from ingest.fetch import bbox_tiles, fetch_region, month_chunks
from ingest.load import load_chunk, refresh_float_aggregates, reset_tables
from ingest.transform import ds_to_measurements, measurements_to_profiles

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("ingest")


def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default=os.getenv("ARGO_DATE_START", "2019-01-01"))
    ap.add_argument("--end", default=os.getenv("ARGO_DATE_END", "2023-12-31"))
    ap.add_argument("--bbox", default=os.getenv("ARGO_REGION_BBOX", "20,120,-40,30"),
                    help="lon_min,lon_max,lat_min,lat_max")
    ap.add_argument("--pres-max", type=float, default=float(os.getenv("ARGO_PRES_MAX", "2000")))
    ap.add_argument("--src", default="erddap")
    ap.add_argument("--reset", action="store_true")
    args = ap.parse_args()

    admin_url = os.getenv("DATABASE_URL_ADMIN")
    if not admin_url:
        log.error("DATABASE_URL_ADMIN is not set (see .env.example)")
        return 1

    bbox = tuple(float(x) for x in args.bbox.split(","))
    if args.reset:
        reset_tables(admin_url)

    total_prof = total_meas = 0
    for t0, t1 in month_chunks(args.start, args.end):
        for tile in bbox_tiles(bbox):
            log.info("=== chunk %s → %s tile %s ===", t0, t1, tile)
            try:
                ds = fetch_region(tile, t0, t1, pres_max=args.pres_max, src=args.src)
            except RuntimeError as e:
                log.error("skipping tile after retries: %s", e)
                continue
            if ds is None:
                continue
            meas = ds_to_measurements(ds)
            log.info("kept %d clean measurements", len(meas))
            if meas.empty:
                continue
            prof = measurements_to_profiles(meas)
            n_p, n_m = load_chunk(admin_url, meas, prof)
            total_prof += n_p
            total_meas += n_m
            log.info("loaded %d profiles / %d measurements (running total %d / %d)",
                     n_p, n_m, total_prof, total_meas)

    refresh_float_aggregates(admin_url)
    log.info("DONE: %d profiles, %d measurements", total_prof, total_meas)
    return 0


if __name__ == "__main__":
    sys.exit(main())
