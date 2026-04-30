import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const mapFeaturesRouter = Router();

const featuresSchema = z.object({
  category: z.string().optional()
});

mapFeaturesRouter.get('/features', asyncHandler(async (req, res) => {
  const query = featuresSchema.parse(req.query);
  const categories = query.category
    ? query.category.split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  const result = await pool.query(`
    SELECT id, title, category, description, safety_score, radius_m, geometry
    FROM map_features
    WHERE active = true
      AND ($1::text[] IS NULL OR category = ANY($1::text[]))
    ORDER BY safety_score DESC, title ASC
  `, [categories.length ? categories : null]);

  res.json({ features: result.rows });
}));
