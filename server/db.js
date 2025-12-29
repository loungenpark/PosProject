import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Explicitly load .env.local from the project root ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..'); // Go up one level from /server to the root
dotenv.config({ path: path.join(projectRoot, '.env.local') });
// --- End of new code ---

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Success logs removed to reduce terminal noise.
// pool.on('connect', ...);

pool.on('error', (err) => {
  console.error('❌ Unexpected database error on idle client', err);
  process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);