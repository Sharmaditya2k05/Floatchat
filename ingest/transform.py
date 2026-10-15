"""Flatten + clean ARGO xarray datasets into tidy DataFrames.

Rules (spec §4.3–4.4, §6):
- Keep measurements whose QC flag is in {1, 2}. Drop 3, 4, 9 (and others).
- Prefer *_ADJUSTED values when present and their QC is good; mark is_adjusted.
- Drop rows missing PRES/TEMP/PSAL after selection.
- Keep ascending profiles (DIRECTION == 'A') when DIRECTION is present.
- Convert pressure (dbar) to depth (m) with TEOS-10 gsw.z_from_p when
  available, else approximate depth ≈ pressure.
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

log = logging.getLogger("ingest.transform")

GOOD_QC = {1, 2}


def _qc_to_int(series: pd.Series) -> pd.Series:
    """QC flags arrive as bytes (b'1'), str ('1'), or floats. Normalize to int, -1 for unknown."""

    def conv(v):
        if isinstance(v, bytes):
            v = v.decode(errors="ignore")
        if isinstance(v, str):
            v = v.strip()
            return int(v) if v.isdigit() else -1
        try:
            if v is None or (isinstance(v, float) and np.isnan(v)):
                return -1
            return int(v)
        except (TypeError, ValueError):
            return -1

    return series.map(conv)


def _to_str(series: pd.Series) -> pd.Series:
    return series.map(lambda v: v.decode(errors="ignore") if isinstance(v, bytes) else str(v)).str.strip()


def _select_value(df: pd.DataFrame, var: str) -> tuple[pd.Series, pd.Series]:
    """Pick VAR_ADJUSTED when present+good, else VAR when good, else NaN.

    Returns (value, used_adjusted) series.
    """
    raw = pd.to_numeric(df.get(var), errors="coerce")
    raw_qc = _qc_to_int(df[f"{var}_QC"]) if f"{var}_QC" in df else pd.Series(1, index=df.index)
    raw_ok = raw.notna() & raw_qc.isin(GOOD_QC)

    adj_col, adj_qc_col = f"{var}_ADJUSTED", f"{var}_ADJUSTED_QC"
    if adj_col in df:
        adj = pd.to_numeric(df[adj_col], errors="coerce")
        adj_qc = _qc_to_int(df[adj_qc_col]) if adj_qc_col in df else pd.Series(1, index=df.index)
        adj_ok = adj.notna() & adj_qc.isin(GOOD_QC)
    else:
        adj = pd.Series(np.nan, index=df.index)
        adj_ok = pd.Series(False, index=df.index)

    value = adj.where(adj_ok, raw.where(raw_ok))
    return value, adj_ok


def _depth_from_pressure(pres: pd.Series, lat: pd.Series) -> pd.Series:
    try:
        import gsw

        # z_from_p returns height (negative below the surface)
        return pd.Series(-gsw.z_from_p(pres.to_numpy(), lat.to_numpy()), index=pres.index)
    except Exception:
        log.warning("gsw unavailable — approximating depth_m = pressure_db")
        return pres.copy()


def ds_to_measurements(ds) -> pd.DataFrame:
    """Flatten an argopy expert-mode Dataset into one tidy row per measurement.

    Output columns: wmo_id, cycle_number, profile_time, latitude, longitude,
    data_mode, pressure_db, depth_m, temperature_c, salinity_psu, is_adjusted.
    """
    df = ds.to_dataframe().reset_index()
    if df.empty:
        return pd.DataFrame()

    time_col = "TIME" if "TIME" in df else "JULD"

    out = pd.DataFrame(
        {
            "wmo_id": pd.to_numeric(_to_str(df["PLATFORM_NUMBER"]), errors="coerce"),
            "cycle_number": pd.to_numeric(df["CYCLE_NUMBER"], errors="coerce"),
            "profile_time": pd.to_datetime(df[time_col], utc=True, errors="coerce"),
            "latitude": pd.to_numeric(df["LATITUDE"], errors="coerce"),
            "longitude": pd.to_numeric(df["LONGITUDE"], errors="coerce"),
        }
    )
    out["data_mode"] = _to_str(df["DATA_MODE"]) if "DATA_MODE" in df else "R"

    if "DIRECTION" in df:
        direction = _to_str(df["DIRECTION"])
        keep_dir = direction.isin(["A", ""])  # keep ascending; some sources omit it
    else:
        keep_dir = pd.Series(True, index=df.index)

    pres, pres_adj = _select_value(df, "PRES")
    temp, temp_adj = _select_value(df, "TEMP")
    psal, psal_adj = _select_value(df, "PSAL")

    out["pressure_db"] = pres
    out["temperature_c"] = temp
    out["salinity_psu"] = psal
    out["is_adjusted"] = (pres_adj | temp_adj | psal_adj).fillna(False)

    mask = (
        keep_dir
        & out["wmo_id"].notna()
        & out["cycle_number"].notna()
        & out["profile_time"].notna()
        & out["latitude"].notna()
        & out["longitude"].notna()
        & out["pressure_db"].notna()
        & out["temperature_c"].notna()
        & out["salinity_psu"].notna()
    )
    out = out.loc[mask].copy()
    if out.empty:
        return out

    out["depth_m"] = _depth_from_pressure(out["pressure_db"], out["latitude"])
    out["wmo_id"] = out["wmo_id"].astype("int64")
    out["cycle_number"] = out["cycle_number"].astype("int64")
    return out.reset_index(drop=True)


def measurements_to_profiles(meas: pd.DataFrame) -> pd.DataFrame:
    """Derive the per-profile summary table (one row per float+cycle)."""
    if meas.empty:
        return pd.DataFrame()

    def summarize(g: pd.DataFrame) -> pd.Series:
        top = g.loc[g["depth_m"].idxmin()]
        surface_ok = top["depth_m"] <= 15  # only call it "surface" if shallow enough
        return pd.Series(
            {
                "profile_time": g["profile_time"].iloc[0],
                "latitude": g["latitude"].iloc[0],
                "longitude": g["longitude"].iloc[0],
                "data_mode": g["data_mode"].iloc[0][:1] or "R",
                "max_depth_m": g["depth_m"].max(),
                "surface_temp_c": top["temperature_c"] if surface_ok else None,
                "surface_psal": top["salinity_psu"] if surface_ok else None,
                "n_levels": len(g),
            }
        )

    prof = (
        meas.groupby(["wmo_id", "cycle_number"], sort=True)
        .apply(summarize, include_groups=False)
        .reset_index()
    )
    return prof
