"""Curated NL→SQL seed pairs (spec §8.4). Used as few-shot prompt material
and as the gold set for the evaluation harness (tests/test_nl2sql_eval.py)."""

EXAMPLES = [
    {
        "question": "Average salinity in the Arabian Sea in 2022 between 0 and 200 m",
        "sql": """SELECT AVG(m.salinity_psu) AS avg_salinity
FROM measurements m
JOIN profiles p ON p.profile_id = m.profile_id
JOIN regions r ON r.name = 'Arabian Sea'
WHERE ST_Covers(r.bbox, p.geom)
  AND p.profile_time >= '2022-01-01' AND p.profile_time < '2023-01-01'
  AND m.depth_m BETWEEN 0 AND 200""",
    },
    {
        "question": "Nearest 5 floats to 15N, 68E",
        "sql": """SELECT p.wmo_id, p.profile_time, p.latitude, p.longitude,
       ST_Distance(p.geom, ST_SetSRID(ST_MakePoint(68, 15), 4326)::geography) / 1000 AS km
FROM profiles p
ORDER BY p.geom <-> ST_SetSRID(ST_MakePoint(68, 15), 4326)::geography
LIMIT 5""",
    },
    {
        "question": "Temperature-depth profile for float 6902746, latest cycle",
        "sql": """SELECT m.depth_m, m.temperature_c
FROM measurements m
JOIN profiles p ON p.profile_id = m.profile_id
WHERE p.wmo_id = 6902746
  AND p.cycle_number = (SELECT MAX(cycle_number) FROM profiles WHERE wmo_id = 6902746)
ORDER BY m.depth_m""",
    },
    {
        "question": "Monthly mean surface temperature near the equator in 2023",
        "sql": """SELECT date_trunc('month', p.profile_time) AS month,
       AVG(p.surface_temp_c) AS mean_sst
FROM profiles p
WHERE p.latitude BETWEEN -2 AND 2
  AND p.profile_time >= '2023-01-01' AND p.profile_time < '2024-01-01'
GROUP BY 1 ORDER BY 1""",
    },
    {
        "question": "How many active floats are in the Bay of Bengal?",
        "sql": """SELECT COUNT(DISTINCT p.wmo_id) AS n_floats
FROM profiles p
JOIN regions r ON r.name = 'Bay of Bengal'
WHERE ST_Covers(r.bbox, p.geom)""",
    },
    {
        "question": "Show me salinity near the equator in March 2023",
        "sql": """SELECT p.wmo_id, p.profile_time, p.latitude, p.longitude, m.depth_m, m.salinity_psu
FROM measurements m
JOIN profiles p ON p.profile_id = m.profile_id
WHERE p.latitude BETWEEN -2 AND 2
  AND p.profile_time >= '2023-03-01' AND p.profile_time < '2023-04-01'
ORDER BY p.profile_time
LIMIT 500""",
    },
    {
        "question": "Trajectory of float 6902746",
        "sql": """SELECT p.cycle_number, p.profile_time, p.latitude, p.longitude
FROM profiles p
WHERE p.wmo_id = 6902746
ORDER BY p.cycle_number
LIMIT 500""",
    },
    {
        "question": "Current fishing zones near Kochi",
        "sql": """SELECT pz.zone_name, pz.latitude, pz.longitude, pz.sst_c,
       pz.chlorophyll_mg, pz.fish_species, pz.confidence
FROM pfz_advisories pz
WHERE pz.valid_from <= CURRENT_DATE AND pz.valid_to >= CURRENT_DATE
ORDER BY pz.geom <-> ST_SetSRID(ST_MakePoint(76.27, 9.93), 4326)::geography
LIMIT 10""",
    },
    {
        "question": "Average chlorophyll near the Arabian Sea coast in March 2023",
        "sql": """SELECT AVG(c.chl_a_mg_m3) AS avg_chlorophyll, COUNT(*) AS n_obs
FROM chlorophyll c
JOIN regions r ON r.name = 'Arabian Sea'
WHERE ST_Covers(r.bbox, c.geom)
  AND c.obs_date >= '2023-03-01' AND c.obs_date < '2023-04-01'""",
    },
    {
        "question": "Is the water warm enough for tuna near Kochi this week",
        "sql": """SELECT s.obs_date, s.latitude, s.longitude, s.sst_c, s.sst_anomaly_c
FROM sst_composites s
WHERE s.obs_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY s.geom <-> ST_SetSRID(ST_MakePoint(76.27, 9.93), 4326)::geography
LIMIT 20""",
    },
    {
        "question": "Which fishing zones have sardine this month",
        "sql": """SELECT pz.zone_name, pz.latitude, pz.longitude, pz.issued_date,
       pz.fish_species, pz.confidence
FROM pfz_advisories pz
WHERE array_to_string(pz.fish_species, ',') ILIKE '%sardine%'
  AND pz.valid_from <= CURRENT_DATE AND pz.valid_to >= CURRENT_DATE
ORDER BY pz.issued_date DESC
LIMIT 50""",
    },
]
