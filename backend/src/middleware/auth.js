import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = header.slice('Bearer '.length);
    const payload = jwt.verify(token, getJwtSecret());
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [payload.sub]
    );
    req.user = result.rows[0] || null;
  } catch {
    req.user = null;
  }

  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export function signUserToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    getJwtSecret(),
    { expiresIn: '30d' }
  );
}

function getJwtSecret() {
  return process.env.JWT_SECRET || 'safeway-dev-secret';
}

