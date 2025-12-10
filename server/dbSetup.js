import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    
    // 1. Read the Master Schema File
    if (!fs.existsSync(schemaPath)) {
      throw new Error('schema.sql file not found in server directory');
    }
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔄 Initializing Database Schema...');
    
    // 2. Execute the entire SQL script
    await query(schemaSql);

    // --- MIGRATION: Ensure sections has new columns (Safe for existing DBs) ---
    await query(`
      ALTER TABLE sections 
      ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
    `);

    // --- ARCHITECTURE FIX: Active Orders & Idempotency ---
    
    // 1. Create Active Orders Table (Persist open tables)
    await query(`
      CREATE TABLE IF NOT EXISTS active_orders (
        id SERIAL PRIMARY KEY,
        table_id VARCHAR(50) NOT NULL UNIQUE,
        session_uuid VARCHAR(100) NOT NULL,
        items JSONB DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Add session_uuid to Sales (Prevent double spending)
    await query(`
      ALTER TABLE sales 
      ADD COLUMN IF NOT EXISTS session_uuid VARCHAR(100);
    `);

    // 3. Enforce Uniqueness on Sales session_uuid (The actual bug fix)
    // We use a DO block to ensure we don't try to add the constraint twice
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_session_uuid_key') THEN
            ALTER TABLE sales ADD CONSTRAINT sales_session_uuid_key UNIQUE (session_uuid);
        END IF;
      END
      $$;
    `);
    
    console.log('✅ Database schema applied successfully.');

    // 3. Seed Default Users (If fresh install)
    const userCheck = await query('SELECT count(*) FROM users');
    if (parseInt(userCheck.rows[0].count) === 0) {
        console.log('👤 Fresh Install Detected: Seeding default users...');
        await query(`
            INSERT INTO users (username, pin, role, active) VALUES 
            ('Admin', '1234', 'ADMIN', true),
            ('Kamarier', '0000', 'CASHIER', true);
        `);
        console.log('✅ Default users created (Admin: 1234, Kamarier: 0000)');
    }

  } catch (e) {
    console.error('❌ Database initialization failed:', e.message);
    // We don't exit process here so dev server keeps running, but it logs the error clearly
  }
}