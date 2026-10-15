"""QC correctness (spec §17): ingestion drops QC 3/4/9 rows and prefers
adjusted values when their QC is good."""
import numpy as np
import pandas as pd
import xarray as xr

from ingest.transform import ds_to_measurements, measurements_to_profiles


def make_ds(**overrides):
    n = 6
    base = {
        "PLATFORM_NUMBER": ("N_POINTS", np.array([b"6902746"] * n)),
        "CYCLE_NUMBER": ("N_POINTS", np.array([1.0] * n)),
        "TIME": ("N_POINTS", pd.to_datetime(["2023-03-01T00:00:00"] * n)),
        "LATITUDE": ("N_POINTS", np.array([10.0] * n)),
        "LONGITUDE": ("N_POINTS", np.array([70.0] * n)),
        "DIRECTION": ("N_POINTS", np.array([b"A"] * n)),
        "DATA_MODE": ("N_POINTS", np.array([b"D"] * n)),
        "PRES": ("N_POINTS", np.array([5.0, 50.0, 100.0, 200.0, 500.0, 1000.0])),
        "PRES_QC": ("N_POINTS", np.array([b"1"] * n)),
        "TEMP": ("N_POINTS", np.array([28.0, 26.0, 24.0, 20.0, 12.0, 8.0])),
        "TEMP_QC": ("N_POINTS", np.array([b"1", b"1", b"4", b"1", b"1", b"9"])),
        "PSAL": ("N_POINTS", np.array([35.0, 35.1, 35.2, 35.3, 35.0, 34.8])),
        "PSAL_QC": ("N_POINTS", np.array([b"1"] * n)),
    }
    base.update(overrides)
    return xr.Dataset({k: v for k, v in base.items()})


def test_drops_bad_qc_rows():
    df = ds_to_measurements(make_ds())
    # TEMP_QC 4 and 9 rows must be gone
    assert len(df) == 4
    assert 24.0 not in df["temperature_c"].values
    assert 8.0 not in df["temperature_c"].values


def test_prefers_adjusted_when_good():
    n = 6
    ds = make_ds(
        TEMP_ADJUSTED=("N_POINTS", np.array([27.5, 25.5, 23.5, 19.5, 11.5, 7.5])),
        TEMP_ADJUSTED_QC=("N_POINTS", np.array([b"1"] * n)),
    )
    df = ds_to_measurements(ds)
    # adjusted values used everywhere their QC is good (raw QC 4/9 rows now pass via adjusted)
    assert 27.5 in df["temperature_c"].values
    assert 28.0 not in df["temperature_c"].values
    assert df["is_adjusted"].all()


def test_ignores_adjusted_when_bad():
    n = 6
    ds = make_ds(
        TEMP_ADJUSTED=("N_POINTS", np.array([99.0] * n)),
        TEMP_ADJUSTED_QC=("N_POINTS", np.array([b"4"] * n)),
    )
    df = ds_to_measurements(ds)
    assert 99.0 not in df["temperature_c"].values
    assert 28.0 in df["temperature_c"].values


def test_drops_descending_profiles():
    n = 6
    ds = make_ds(DIRECTION=("N_POINTS", np.array([b"D"] * n)))
    assert ds_to_measurements(ds).empty


def test_profile_summary():
    prof = measurements_to_profiles(ds_to_measurements(make_ds()))
    assert len(prof) == 1
    row = prof.iloc[0]
    assert row["wmo_id"] == 6902746
    assert row["n_levels"] == 4
    assert row["surface_temp_c"] == 28.0  # value at the shallowest level (5 dbar)
    assert row["max_depth_m"] > 400
