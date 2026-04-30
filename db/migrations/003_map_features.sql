CREATE TABLE IF NOT EXISTS map_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'lit_street',
    'crowded_corridor',
    'safe_zone',
    'quiet_zone',
    'transport_hub'
  )),
  description TEXT NOT NULL DEFAULT '',
  safety_score INTEGER NOT NULL DEFAULT 70 CHECK (safety_score BETWEEN 1 AND 100),
  radius_m INTEGER NOT NULL DEFAULT 120 CHECK (radius_m BETWEEN 20 AND 2000),
  geometry JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS map_features_category_idx ON map_features (active, category);
CREATE UNIQUE INDEX IF NOT EXISTS map_features_title_unique_idx ON map_features (title);
