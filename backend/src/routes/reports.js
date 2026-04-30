import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertInsideAlmaty } from '../utils/almaty.js';

export const reportsRouter = Router();

const reportSchema = z.object({
  category: z.enum(['traffic', 'poor_lighting', 'construction', 'crowd', 'underpass', 'slope', 'incident']),
  severity: z.number().int().min(1).max(5),
  description: z.string().max(500).default(''),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  })
});

reportsRouter.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT id, category, severity, description, lat, lng, status, created_at
    FROM user_reports
    WHERE status IN ('pending', 'verified')
    ORDER BY created_at DESC
    LIMIT 200
  `);

  res.json({ reports: result.rows });
}));

reportsRouter.post('/', optionalAuth, asyncHandler(async (req, res) => {
  const body = reportSchema.parse(req.body);
  assertInsideAlmaty(body.location, 'Report location');

  const result = await pool.query(`
    INSERT INTO user_reports (user_id, category, severity, description, lat, lng)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, category, severity, description, lat, lng, status, created_at
  `, [req.user?.id || null, body.category, body.severity, body.description, body.location.lat, body.location.lng]);

  res.status(201).json({ report: result.rows[0] });
}));
