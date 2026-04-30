import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const placesRouter = Router();

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(100).max(10000).default(5000)
});

placesRouter.get('/', asyncHandler(async (req, res) => {
  const query = nearbySchema.parse(req.query);

  if (query.lat != null && query.lng != null) {
    const result = await pool.query(`
      SELECT *
      FROM (
        SELECT id, title, type, address, open_24h, lat, lng,
          6371000 * acos(least(1, greatest(-1,
            sin(radians($1)) * sin(radians(lat)) +
            cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2))
          ))) AS distance_m
        FROM safe_places
      ) nearby
      WHERE distance_m <= $3
      ORDER BY distance_m ASC
    `, [query.lat, query.lng, query.radius]);
    res.json({ places: result.rows });
    return;
  }

  const result = await pool.query(`
    SELECT id, title, type, address, open_24h, lat, lng
    FROM safe_places
    ORDER BY type ASC, title ASC
  `);
  res.json({ places: result.rows });
}));
