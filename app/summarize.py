"""Turn a result set into one grounded plain-English answer.

Every number in the sentence comes from the result set itself — actual row
values (min/max), counts of returned records, or aggregate columns the query
computed. Nothing is invented (spec §17 grounding). When an LLM is available
it may rephrase, but the output is checked so no new numbers appear.
"""
from __future__ import annotations

import re

# value column -> (spoken name, unit)
VALUE_COLS = {
    "salinity_psu": ("salinity", "PSU"),
    "surface_psal": ("surface salinity", "PSU"),
    "temperature_c": ("temperature", "°C"),
    "surface_temp_c": ("surface temperature", "°C"),
    "pressure_db": ("pressure", "dbar"),
    "sst_c": ("sea-surface temperature", "°C"),
    "sst_anomaly_c": ("SST anomaly", "°C"),
    "chl_a_mg_m3": ("chlorophyll-a", "mg/m³"),
    "chlorophyll_mg": ("chlorophyll", "mg/m³"),
    "wind_speed_kn": ("wind speed", "knots"),
}

# Preferred sea-surface temperature bands (°C). Used only to choose wording —
# the numbers themselves are never printed, so answers stay grounded in the rows.
SPECIES_SST = {
    "tuna": (20, 30), "skipjack": (20, 30), "yellowfin": (20, 30),
    "oil sardine": (22, 28), "sardine": (22, 28), "anchovy": (22, 28),
    "mackerel": (18, 25), "seer fish": (26, 30), "kingfish": (26, 30),
    "pomfret": (24, 30), "hilsa": (24, 30),
}


def _species_note(question: str, sst_vals: list) -> str:
    q = question.lower()
    for name, (lo, hi) in sorted(SPECIES_SST.items(), key=lambda kv: -len(kv[0])):
        if name in q:
            mid = sum(sst_vals) / len(sst_vals)
            verdict = "within the range" if lo <= mid <= hi else ("cooler than" if mid < lo else "warmer than")
            return f" — {verdict} {name} usually prefer"
    return ""


def _fmt(v, decimals: int = 2) -> str:
    if isinstance(v, float):
        return f"{v:,.{decimals}f}".rstrip("0").rstrip(".")
    if isinstance(v, int):
        return f"{v:,}"
    return str(v)


def _col(columns: list[str], name: str) -> int | None:
    return columns.index(name) if name in columns else None


def _values(columns: list[str], rows: list[list], name: str) -> list:
    i = _col(columns, name)
    if i is None:
        return []
    return [r[i] for r in rows if r[i] is not None]


def _n_floats(columns: list[str], rows: list[list]) -> int | None:
    i = _col(columns, "wmo_id")
    if i is None:
        return None
    return len({r[i] for r in rows if r[i] is not None})


def _depth_clause(columns: list[str], rows: list[list]) -> str:
    depths = _values(columns, rows, "depth_m")
    if not depths:
        return ""
    lo, hi = min(depths), max(depths)
    if hi - lo < 1:
        return f" at about {_fmt(hi, 1)} m depth"
    return f" between {_fmt(lo, 1)} and {_fmt(hi, 1)} m depth"


def _template_summary(question: str, columns: list[str], rows: list[list], kind: str) -> str:
    n = len(rows)
    if n == 0:
        return ("No matching records were found in the pilot dataset — "
                "try widening the region, dates, or depth range.")

    # --- Single aggregate row (AVG / COUNT / MIN / MAX) ---
    if n == 1 and len(columns) <= 3 and all(
        isinstance(v, (int, float)) or v is None for v in rows[0]
    ):
        return _aggregate_sentence(columns, rows[0])

    # --- Fisheries: PFZ advisories ---
    if "zone_name" in columns or "fish_species" in columns:
        zi, si = _col(columns, "zone_name"), _col(columns, "fish_species")
        first = rows[0]
        zone = first[zi] if zi is not None else None
        species = first[si] if si is not None else None
        sst = _values(columns, rows, "sst_c")
        s = f"Found {n} active fishing-zone advisor{'y' if n == 1 else 'ies'}"
        if zone:
            from app.fallback_nl2sql import _find_port
            s += f" — {'nearest is' if _find_port(question.lower()) else 'for example'} {zone}"
        if species:
            s += f" (likely {', '.join(str(x) for x in list(species)[:3])})"
        if sst:
            lo, hi = _fmt(min(sst), 1), _fmt(max(sst), 1)
            s += f"; SST {lo} °C" if lo == hi else f"; SST {lo} to {hi} °C"
        return s + "."

    # --- Nearest-N (has a distance column) ---
    dist = _values(columns, rows, "distance_km") or _values(columns, rows, "km")
    if dist:
        nf = _n_floats(columns, rows) or n
        wmo_i = _col(columns, "wmo_id")
        closest_wmo = rows[0][wmo_i] if wmo_i is not None else None
        near = f"float {closest_wmo} at {_fmt(min(dist), 1)} km" if closest_wmo else f"{_fmt(min(dist), 1)} km"
        return (f"The {nf} nearest floats range from {_fmt(min(dist), 1)} to "
                f"{_fmt(max(dist), 1)} km away — closest is {near}.")

    # --- A measurement value is present: report its real range ---
    for col, (label, unit) in VALUE_COLS.items():
        vals = _values(columns, rows, col)
        if len(vals) >= 2:
            nf = _n_floats(columns, rows)
            floats_clause = f" from {nf} float{'s' if nf != 1 else ''}" if nf else ""
            what = "measurements" if ("wmo_id" in columns or "depth_m" in columns) else "observations"
            note = _species_note(question, vals) if col in ("sst_c", "surface_temp_c") else ""
            return (f"Across {n:,} {what}{floats_clause}, {label} ranged "
                    f"{_fmt(min(vals))} to {_fmt(max(vals))} {unit}"
                    f"{_depth_clause(columns, rows)}{note}.")

    # --- Time series ---
    if kind == "timeseries":
        val_col = next((c for c in columns if c not in ("month", "profile_time")
                        and _values(columns, rows, c)), None)
        if val_col:
            vals = _values(columns, rows, val_col)
            return (f"Over {n} months the value ranged {_fmt(min(vals))} to "
                    f"{_fmt(max(vals))} — see the chart for the trend.")
        return f"Time series with {n} points — see the chart for the trend."

    # --- Map / positions ---
    if kind == "map" or {"latitude", "longitude"} <= set(columns):
        nf = _n_floats(columns, rows)
        if nf:
            return f"Found {n:,} matching profiles from {nf} float{'s' if nf != 1 else ''} — plotted on the map."
        return f"Found {n:,} matching positions — plotted on the map."

    return f"The query returned {n:,} rows — see the table."


def _aggregate_sentence(columns: list[str], row: list) -> str:
    """One-row aggregate → a spoken sentence, e.g. 'The average salinity was
    36.11 PSU across 24,559 measurements.'"""
    parts = {c: v for c, v in zip(columns, row) if v is not None}
    if not parts:
        return "The query returned no usable values."

    # count-style
    for c in ("n_floats", "n_profiles", "count"):
        if c in parts:
            what = "floats" if "float" in c else ("profiles" if "profile" in c else "records")
            return f"There are {_fmt(int(parts[c]))} {what} matching your query."

    # metric + optional count
    metric_col = next((c for c in parts if c not in ("n_measurements", "n", "count")), None)
    if metric_col is None:
        c, v = next(iter(parts.items()))
        return f"{c.replace('_', ' ').capitalize()}: {_fmt(v)}."

    label, unit = _metric_label(metric_col)
    sentence = f"The {label} was {_fmt(parts[metric_col])}{(' ' + unit) if unit else ''}"
    for c in ("n_measurements", "n_obs", "n", "count"):
        if c in parts:
            sentence += f" across {_fmt(int(parts[c]))} {'observations' if c == 'n_obs' else 'measurements'}"
            break
    return sentence + "."


def _metric_label(col: str) -> tuple[str, str]:
    c = col.lower()
    agg = "average" if c.startswith("avg") or "mean" in c else \
          "minimum" if c.startswith("min") else \
          "maximum" if c.startswith("max") else ""
    unit = "PSU" if "sal" in c or "psal" in c else "°C" if "temp" in c or "sst" in c else \
           "dbar" if "pres" in c else "m" if "depth" in c else "mg/m³" if "chl" in c else ""
    metric = "salinity" if "sal" in c or "psal" in c else \
             "temperature" if "temp" in c else "sea-surface temperature" if "sst" in c else \
             "chlorophyll-a" if "chl" in c else \
             "depth" if "depth" in c else col.replace("_", " ")
    return (f"{agg} {metric}".strip(), unit)


def summarize(question: str, columns: list[str], rows: list[list], kind: str) -> str:
    """One grounded sentence. The rule-based template is the always-safe base;
    when an LLM is available it phrases the answer directly from the result
    rows (better for superlatives, comparisons, multi-row shapes) — accepted
    only if every number it uses actually appears in the data."""
    base = _template_summary(question, columns, rows, kind)
    if not rows:
        return base

    # The answer may use any number from the data, plus numbers the user already
    # put in the question (years, coordinates, depths — fine to echo back).
    allowed = _allowed_numbers(columns, rows) | _numbers(question)
    base_has_number = bool(_numbers(base))
    try:
        from app.llm import chat, reasoning_extra

        table = _compact_table(columns, rows)
        candidate = chat(
            "You answer questions about ARGO ocean-float data. Given the user's question "
            "and the exact rows a database returned, write ONE short, natural sentence that "
            "answers it. Use ONLY numbers that appear in the rows or the question — never "
            "invent or compute new ones. Rounding is fine. If positions are present you may "
            "mention them. Output only the finished sentence, nothing else.",
            f"Question: {question}\n\nRows returned:\n{table}\n\n"
            f"(A safe fallback answer is: {base})",
            max_tokens=500,
            extra=reasoning_extra(),
        ).strip()
        looks_complete = candidate.endswith((".", "!", "?"))
        has_number = bool(_numbers(candidate))
        if (
            candidate
            and looks_complete
            and (has_number or not base_has_number)
            and _numbers(candidate) <= allowed
        ):
            return candidate
    except Exception:
        pass
    return base


def _compact_table(columns: list[str], rows: list[list], limit: int = 30) -> str:
    head = " | ".join(columns)
    body = "\n".join(
        " | ".join("" if v is None else (f"{v:.4g}" if isinstance(v, float) else str(v)) for v in r)
        for r in rows[:limit]
    )
    more = f"\n… (+{len(rows) - limit} more rows)" if len(rows) > limit else ""
    return f"{head}\n{body}{more}"


def _allowed_numbers(columns: list[str], rows: list[list]) -> set[str]:
    """Numbers the answer is allowed to use: every numeric cell in the result
    (in a few rounded forms to tolerate the model rounding), plus the row count."""
    allowed: set[str] = {str(len(rows))}
    for row in rows:
        for v in row:
            if isinstance(v, bool) or v is None:
                continue
            if isinstance(v, (int, float)):
                allowed.add(str(int(v)) if float(v).is_integer() else "")
                for d in (0, 1, 2, 3, 4):
                    allowed.add(f"{v:.{d}f}".rstrip("0").rstrip("."))
                    allowed.add(f"{v:.{d}f}")
            else:
                allowed |= _numbers(str(v))  # e.g. dates embedded in text
    allowed.discard("")
    return allowed


def _numbers(text: str) -> set[str]:
    return {m.replace(",", "") for m in re.findall(r"\d[\d,]*(?:\.\d+)?", text)}
