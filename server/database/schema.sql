-- 1. Users & Auth
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  pin VARCHAR(10) NOT NULL,
  role VARCHAR(20) NOT NULL, -- 'ADMIN' or 'CASHIER'
  active BOOLEAN DEFAULT TRUE
);

-- 2. Menu Structure
CREATE TABLE IF NOT EXISTS menu_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  category_name VARCHAR(50), -- Loose link to allow category name edits without ID pain
  printer VARCHAR(20) DEFAULT 'Kuzhina', -- 'Kuzhina' or 'Shank'
  stock INTEGER DEFAULT 0,
  stock_threshold INTEGER DEFAULT 10,
  track_stock BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  stock_group_id VARCHAR(50) -- For shared inventory
);

-- 3. Settings (Key-Value Store for Config & Company Profile)
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT
);

-- 4. Sales & Transactions
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY, -- Internal integer ID
  sale_uuid VARCHAR(50) UNIQUE NOT NULL, -- Public string ID
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER REFERENCES users(id),
  table_id INTEGER,
  table_name VARCHAR(50),
  subtotal NUMERIC(10, 2),
  tax NUMERIC(10, 2),
  total NUMERIC(10, 2)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  item_id INTEGER, -- Weak reference kept even if item deleted from menu
  item_name VARCHAR(100),
  price_at_sale NUMERIC(10, 2),
  quantity INTEGER
);

-- 5. Logging & History
CREATE TABLE IF NOT EXISTS history (
  id SERIAL PRIMARY KEY,
  table_id INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER REFERENCES users(id),
  details TEXT
);

CREATE TABLE IF NOT EXISTS order_tickets (
  id SERIAL PRIMARY KEY,
  ticket_uuid VARCHAR(50) UNIQUE NOT NULL,
  table_id INT NOT NULL,
  table_name VARCHAR(50),
  user_id INT,
  items JSONB NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES menu_items(id),
  quantity INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'supply', 'sale', 'waste'
  reason VARCHAR(255),
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Floor Plan & Zones
CREATE TABLE IF NOT EXISTS sections (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS tables (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL, -- Enforce global uniqueness
  section_id INTEGER REFERENCES sections(id), -- Removed ON DELETE SET NULL
  x INTEGER DEFAULT 0,
  y INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE
);


-- --------------------------------------------------------
-- AUTO-MIGRATION SECTION
-- Safe updates for existing tables
-- --------------------------------------------------------

-- 1. Add 'active' to users
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='active') THEN 
        ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT TRUE; 
    END IF; 
END $$;

-- 2. Add 'stock_group_id' and 'display_order' to menu_items
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='stock_group_id') THEN 
        ALTER TABLE menu_items ADD COLUMN stock_group_id VARCHAR(50) DEFAULT NULL; 
    END IF; 

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='display_order') THEN 
        ALTER TABLE menu_items ADD COLUMN display_order INTEGER DEFAULT 0; 
    END IF;
END $$;

-- 3. Ensure settings table has unique key constraint
DO $$
BEGIN
    -- Check if the constraint exists, if not (or to be safe), we might need to handle this carefully.
    -- For simplicity in this app, we assume if the table exists, we just want to ensure the constraint.
    -- If it fails, it usually means duplicates exist or it's already there. 
    -- The safest generic way without complex logic is to rely on the CREATE TABLE above.
    -- But for the UPSERT logic to work, we need the constraint.
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='settings_pkey' AND table_name='settings') THEN
        -- Primary key exists, which implies uniqueness. Good.
        NULL;
    END IF;
END $$;

-- 4. Ensure tables/sections structure (Safe Migration for future updates)
DO $$ 
BEGIN 
    -- Check if 'tables' table exists (if created previously) and ensure it has section_id
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tables') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tables' AND column_name='section_id') THEN 
            ALTER TABLE tables ADD COLUMN section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL; 
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tables' AND column_name='active') THEN 
            ALTER TABLE tables ADD COLUMN active BOOLEAN DEFAULT TRUE; 
        END IF;
    END IF;
END $$;

-- 5. Add 'active' to sections and update existing rows
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sections' AND column_name='active') THEN 
        ALTER TABLE sections ADD COLUMN active BOOLEAN DEFAULT TRUE; 
    END IF; 

    -- CRITICAL FIX: Update existing rows that had NULL set for the new 'active' column.
    UPDATE sections SET active = TRUE WHERE active IS NULL;
END $$;