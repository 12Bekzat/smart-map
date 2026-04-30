import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { optionalAuth, requireAuth, signUserToken } from '../middleware/auth.js';
import { defaultPreferences, mergePreferences } from '../services/defaultPreferences.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  password: z.string().min(6).max(120),
  preferences: z.record(z.any()).optional()
});

const loginSchema = z.object({
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(120),
  preferences: z.record(z.any()).optional()
});

const preferencesSchema = z.object({
  settings: z.record(z.any())
});

authRouter.post('/register', asyncHandler(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [body.email]);
  if (existing.rows.length) {
    res.status(409).json({ error: 'Email is already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const userResult = await client.query(`
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at
    `, [body.name, body.email, passwordHash]);

    const settings = mergePreferences(body.preferences || defaultPreferences);
    await client.query(`
      INSERT INTO user_preferences (user_id, settings)
      VALUES ($1, $2::jsonb)
    `, [userResult.rows[0].id, JSON.stringify(settings)]);

    await client.query('COMMIT');
    const user = userResult.rows[0];
    res.status(201).json({ user, token: signUserToken(user), preferences: settings });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const result = await pool.query(`
    SELECT u.id, u.name, u.email, u.password_hash, u.created_at, p.settings
    FROM users u
    LEFT JOIN user_preferences p ON p.user_id = u.id
    WHERE u.email = $1
  `, [body.email]);

  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const mergedSettings = mergePreferences({
    ...(user.settings || {}),
    ...(body.preferences || {})
  });

  await pool.query(`
    INSERT INTO user_preferences (user_id, settings, updated_at)
    VALUES ($1, $2::jsonb, now())
    ON CONFLICT (user_id)
    DO UPDATE SET settings = EXCLUDED.settings, updated_at = now()
  `, [user.id, JSON.stringify(mergedSettings)]);

  delete user.password_hash;
  delete user.settings;

  res.json({ user, token: signUserToken(user), preferences: mergedSettings });
}));

authRouter.get('/me', optionalAuth, requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT settings FROM user_preferences WHERE user_id = $1',
    [req.user.id]
  );
  res.json({
    user: req.user,
    preferences: mergePreferences(result.rows[0]?.settings || {})
  });
}));

authRouter.get('/preferences', optionalAuth, requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT settings FROM user_preferences WHERE user_id = $1',
    [req.user.id]
  );
  res.json({ preferences: mergePreferences(result.rows[0]?.settings || {}) });
}));

authRouter.put('/preferences', optionalAuth, requireAuth, asyncHandler(async (req, res) => {
  const body = preferencesSchema.parse(req.body);
  const settings = mergePreferences(body.settings);

  await pool.query(`
    INSERT INTO user_preferences (user_id, settings, updated_at)
    VALUES ($1, $2::jsonb, now())
    ON CONFLICT (user_id)
    DO UPDATE SET settings = EXCLUDED.settings, updated_at = now()
  `, [req.user.id, JSON.stringify(settings)]);

  res.json({ preferences: settings });
}));

