-- Approximate bounding boxes for named Indian-Ocean regions.
-- ST_MakeEnvelope(lon_min, lat_min, lon_max, lat_max, 4326)
INSERT INTO regions (name, aliases, bbox) VALUES
  ('Arabian Sea',
   ARRAY['arabian','arab sea','अरब सागर','arabian sea'],
   ST_MakeEnvelope(45, 0, 78, 27, 4326)::geography),
  ('Bay of Bengal',
   ARRAY['bob','bengal','बंगाल की खाड़ी','வங்காள விரிகுடா','bay of bengal'],
   ST_MakeEnvelope(78, 0, 100, 24, 4326)::geography),
  ('Equatorial Indian Ocean',
   ARRAY['equator','equatorial','भूमध्य रेखा','near the equator'],
   ST_MakeEnvelope(40, -10, 110, 10, 4326)::geography),
  ('Southern Indian Ocean',
   ARRAY['southern indian ocean','south indian ocean'],
   ST_MakeEnvelope(20, -40, 120, -10, 4326)::geography),
  ('Indian Ocean',
   ARRAY['indian ocean','हिंद महासागर'],
   ST_MakeEnvelope(20, -40, 120, 30, 4326)::geography)
ON CONFLICT (name) DO NOTHING;
