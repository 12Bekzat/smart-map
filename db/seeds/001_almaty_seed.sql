INSERT INTO risk_zones (title, category, severity, radius_m, description, source, lat, lng) VALUES
  ('Abay / Dostyk crossing', 'traffic', 4, 260, 'Heavy traffic and a difficult pedestrian crossing.', 'demo', 43.2396, 76.9557),
  ('Green Bazaar area', 'crowd', 3, 320, 'Dense pedestrian and transport flow during the day.', 'demo', 43.2603, 76.9545),
  ('Sairan bus station', 'crowd', 3, 280, 'High transport load and crowded stops.', 'demo', 43.2372, 76.8735),
  ('Raiymbek underpass', 'underpass', 3, 180, 'Underpass is better avoided at night.', 'demo', 43.2715, 76.9436),
  ('Kok-Tobe slope', 'slope', 4, 420, 'Steep slope, less safe in winter or after rain.', 'demo', 43.2345, 76.9766),
  ('Tole bi / Rozybakiev construction', 'construction', 2, 240, 'Periodic road works and narrow sidewalks.', 'demo', 43.2418, 76.8995),
  ('28 Panfilov Park evening perimeter', 'poor_lighting', 2, 210, 'Demo zone with reduced lighting in the evening.', 'demo', 43.2581, 76.9569),
  ('Industrial area below Raiymbek', 'poor_lighting', 4, 520, 'Low pedestrian density and lighting in the evening.', 'demo', 43.2827, 76.9185)
ON CONFLICT DO NOTHING;

INSERT INTO safe_places (title, type, address, open_24h, lat, lng) VALUES
  ('Almaty Police Department', 'police', 'Masanchi St 57A', true, 43.2448, 76.9342),
  ('Central City Clinical Hospital', 'hospital', 'Zhandosov St 6', true, 43.2349, 76.9028),
  ('Abay Metro', 'metro', 'Abay Ave / Nazarbayev Ave', false, 43.2422, 76.9455),
  ('Almaly Metro', 'metro', 'Panfilov St / Karasai Batyr St', false, 43.2495, 76.9459),
  ('Dostyk Plaza', 'mall', 'Dostyk Ave 109B', false, 43.2341, 76.9583),
  ('Almaty-2 railway station', 'transport', 'Abylai Khan Ave 1', true, 43.2726, 76.9394),
  ('28 Panfilov Guardsmen Park', 'public', 'Gogol St', false, 43.2584, 76.9550)
ON CONFLICT DO NOTHING;
