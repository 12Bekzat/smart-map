import { Router } from 'express';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const healthRouter = Router();

healthRouter.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT now() AS now');
  res.json({ ok: true, database: true, now: result.rows[0].now });
}));

