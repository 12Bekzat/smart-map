INSERT INTO map_features (title, category, description, safety_score, radius_m, geometry) VALUES
  (
    'Abay Avenue lit corridor',
    'lit_street',
    'Well-lit central avenue with metro access and active pedestrian flow.',
    88,
    140,
    '[{"lat":43.2422,"lng":76.9455},{"lat":43.2396,"lng":76.9557},{"lat":43.2364,"lng":76.9662},{"lat":43.2345,"lng":76.9766}]'::jsonb
  ),
  (
    'Dostyk Avenue active corridor',
    'lit_street',
    'Bright mixed-use street with shops, cafes and visible crossings.',
    86,
    140,
    '[{"lat":43.2584,"lng":76.9550},{"lat":43.2495,"lng":76.9459},{"lat":43.2396,"lng":76.9557},{"lat":43.2341,"lng":76.9583}]'::jsonb
  ),
  (
    'Panfilov pedestrian street',
    'crowded_corridor',
    'Pedestrian area with steady foot traffic and public spaces.',
    90,
    120,
    '[{"lat":43.2584,"lng":76.9550},{"lat":43.2543,"lng":76.9496},{"lat":43.2495,"lng":76.9459}]'::jsonb
  ),
  (
    'Nazarbayev Avenue lit corridor',
    'lit_street',
    'Central avenue with strong lighting and transit access.',
    84,
    130,
    '[{"lat":43.2632,"lng":76.9443},{"lat":43.2540,"lng":76.9449},{"lat":43.2422,"lng":76.9455},{"lat":43.2349,"lng":76.9463}]'::jsonb
  ),
  (
    'Dostyk Plaza safe zone',
    'safe_zone',
    'Mall area with security, lighting and public activity.',
    92,
    260,
    '[{"lat":43.2341,"lng":76.9583}]'::jsonb
  ),
  (
    'Almaly metro safe zone',
    'transport_hub',
    'Metro station area with public transport access.',
    88,
    220,
    '[{"lat":43.2495,"lng":76.9459}]'::jsonb
  ),
  (
    '28 Panfilov park daytime safe area',
    'safe_zone',
    'Public park perimeter with visible pedestrian activity.',
    78,
    260,
    '[{"lat":43.2584,"lng":76.9550}]'::jsonb
  )
ON CONFLICT DO NOTHING;
