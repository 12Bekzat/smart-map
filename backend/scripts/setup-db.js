import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const sqlFiles = [
  'db/migrations/001_init.sql',
  'db/migrations/002_auth_preferences.sql',
  'db/migrations/003_map_features.sql',
  'db/seeds/001_almaty_seed.sql',
  'db/seeds/002_map_features_seed.sql'
];

const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:root@localhost:5432/safeway';
const pool = new Pool({ connectionString: databaseUrl });

try {
  for (const relativePath of sqlFiles) {
    const fullPath = path.join(repoRoot, relativePath);
    const sql = await readFile(fullPath, 'utf8');
    process.stdout.write(`Applying ${relativePath}... `);
    await pool.query(sql);
    process.stdout.write('ok\n');
  }

  const { rows } = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM risk_zones) AS risks,
      (SELECT count(*)::int FROM safe_places) AS places,
      (SELECT count(*)::int FROM map_features) AS features,
      (SELECT count(*)::int FROM users) AS users
  `);
  console.log(`Database ready: ${rows[0].risks} risks, ${rows[0].places} safe places, ${rows[0].features} map features, ${rows[0].users} users.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
