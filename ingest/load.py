"""Load cleaned DataFrames into Postgres using the admin role.

profiles are inserted with ON CONFLICT DO NOTHING (idempotent re-runs);
measurements are bulk-loaded with COPY keyed by the returned profile_ids.
"""
from __future__ import annotations

import logging

import pandas as pd
import psycopg

log = logging.getLogger("ingest.load")


def reset_tables(admin_url: str) -> None:
    with psycopg.connect(admin_url) as conn:
        conn.execute("TRUNCATE measurements, profiles, floats RESTART IDENTITY CASCADE")
        conn.commit()
    log.info("tables truncated")


def load_chunk(admin_url: str, meas: pd.DataFrame, prof: pd.DataFrame) -> tuple[int, int]:
    """Load one chunk. Returns (profiles_inserted, measurements_inserted)."""
    if prof.empty:
        return 0, 0

    with psycopg.connect(admin_url) as conn:
        with conn.cursor() as cur:
            # 1. floats (bare rows; aggregates refreshed at the end of the run)
            wmo_ids = sorted(prof["wmo_id"].unique().tolist())
            cur.executemany(
                "INSERT INTO floats (wmo_id) VALUES (%s) ON CONFLICT DO NOTHING",
                [(int(w),) for w in wmo_ids],
            )

            # 2. profiles
            inserted = {}
            for row in prof.itertuples(index=False):
                cur.execute(
                    """
                    INSERT INTO profiles
                      (wmo_id, cycle_number, profile_time, latitude, longitude,
                       geom, data_mode, max_depth_m, surface_temp_c, surface_psal, n_levels)
                    VALUES (%s, %s, %s, %s, %s,
                            ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                            %s, %s, %s, %s, %s)
                    ON CONFLICT (wmo_id, cycle_number) DO NOTHING
                    RETURNING profile_id
                    """,
                    (
                        int(row.wmo_id), int(row.cycle_number), row.profile_time,
                        float(row.latitude), float(row.longitude),
                        float(row.longitude), float(row.latitude),
                        row.data_mode,
                        float(row.max_depth_m),
                        None if pd.isna(row.surface_temp_c) else float(row.surface_temp_c),
                        None if pd.isna(row.surface_psal) else float(row.surface_psal),
                        int(row.n_levels),
                    ),
                )
                res = cur.fetchone()
                if res is not None:
                    inserted[(int(row.wmo_id), int(row.cycle_number))] = res[0]

            # 3. measurements for the newly inserted profiles only
            n_meas = 0
            if inserted:
                sub = meas[
                    meas.apply(
                        lambda r: (int(r["wmo_id"]), int(r["cycle_number"])) in inserted, axis=1
                    )
                ]
                with cur.copy(
                    "COPY measurements (profile_id, pressure_db, depth_m, "
                    "temperature_c, salinity_psu, is_adjusted) FROM STDIN"
                ) as copy:
                    for r in sub.itertuples(index=False):
                        copy.write_row(
                            (
                                inserted[(int(r.wmo_id), int(r.cycle_number))],
                                float(r.pressure_db), float(r.depth_m),
                                float(r.temperature_c), float(r.salinity_psu),
                                bool(r.is_adjusted),
                            )
                        )
                        n_meas += 1
        conn.commit()
    return len(inserted), n_meas


def refresh_float_aggregates(admin_url: str) -> None:
    with psycopg.connect(admin_url) as conn:
        conn.execute(
            """
            UPDATE floats f SET
              first_profile_at = s.first_at,
              last_profile_at  = s.last_at,
              n_profiles       = s.n
            FROM (
              SELECT wmo_id, MIN(profile_time) first_at,
                     MAX(profile_time) last_at, COUNT(*) n
              FROM profiles GROUP BY wmo_id
            ) s
            WHERE s.wmo_id = f.wmo_id
            """
        )
        conn.commit()
    log.info("float aggregates refreshed")
