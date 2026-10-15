"""Fetch ARGO data for the Indian-Ocean pilot subset via argopy.

Uses the Ifremer ERDDAP source in "expert" mode so QC flags, adjusted
variables, DATA_MODE and DIRECTION are all available (see spec §4.1).
Fetches in monthly chunks to stay memory-safe and retry-friendly.
"""
from __future__ import annotations

import datetime as dt
import logging
import time
from typing import Iterator

log = logging.getLogger("ingest.fetch")


def month_chunks(start: str, end: str) -> Iterator[tuple[str, str]]:
    """Yield (start, end) ISO date pairs, one per calendar month."""
    cur = dt.date.fromisoformat(start)
    stop = dt.date.fromisoformat(end)
    while cur < stop:
        if cur.month == 12:
            nxt = dt.date(cur.year + 1, 1, 1)
        else:
            nxt = dt.date(cur.year, cur.month + 1, 1)
        yield cur.isoformat(), min(nxt, stop).isoformat()
        cur = nxt


def bbox_tiles(
    bbox: tuple[float, float, float, float], max_deg: float = 25.0
) -> Iterator[tuple[float, float, float, float]]:
    """Split a large bounding box into tiles ERDDAP can serve without timing out."""
    lon_min, lon_max, lat_min, lat_max = bbox
    lon = lon_min
    while lon < lon_max:
        lon_hi = min(lon + max_deg, lon_max)
        lat = lat_min
        while lat < lat_max:
            lat_hi = min(lat + max_deg, lat_max)
            yield (lon, lon_hi, lat, lat_hi)
            lat = lat_hi
        lon = lon_hi


def fetch_region(
    bbox: tuple[float, float, float, float],
    date_start: str,
    date_end: str,
    pres_min: float = 0,
    pres_max: float = 2000,
    src: str = "erddap",
    retries: int = 3,
):
    """Fetch one region/time chunk as an xarray.Dataset (expert mode).

    bbox = (lon_min, lon_max, lat_min, lat_max). Returns None when the
    chunk contains no data.
    """
    import argopy
    from argopy import DataFetcher

    argopy.set_options(api_timeout=600)
    lon_min, lon_max, lat_min, lat_max = bbox
    box = [lon_min, lon_max, lat_min, lat_max, pres_min, pres_max, date_start, date_end]
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            ds = DataFetcher(src=src, mode="expert").region(box).to_xarray()
            return ds
        except FileNotFoundError:
            log.info("no data for %s → %s", date_start, date_end)
            return None
        except Exception as e:  # network hiccups, ERDDAP 5xx, etc.
            last_err = e
            wait = 5 * attempt
            log.warning("fetch failed (%s/%s): %s — retrying in %ss", attempt, retries, e, wait)
            time.sleep(wait)
    raise RuntimeError(f"fetch failed after {retries} attempts: {last_err}")
