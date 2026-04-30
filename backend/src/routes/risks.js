import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const riskRouter = Router();

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(10000).default(3000)
});

riskRouter.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT id, title, category, severity, radius_m, description, verified, lat, lng
    FROM risk_zones
    WHERE active = true
    ORDER BY severity DESC, title ASC
  `);
  res.json({ risks: result.rows });
}));

riskRouter.get('/nearby', asyncHandler(async (req, res) => {
  const query = nearbySchema.parse(req.query);
  const result = await pool.query(`
    SELECT *
    FROM (
      SELECT id, title, category, severity, radius_m, description, verified, lat, lng,
        6371000 * acos(least(1, greatest(-1,
          sin(radians($1)) * sin(radians(lat)) +
          cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2))
        ))) AS distance_m
      FROM risk_zones
      WHERE active = true
    ) nearby
    WHERE distance_m <= $3
    ORDER BY distance_m ASC
  `, [query.lat, query.lng, query.radius]);
  res.json({ risks: result.rows });
}));
