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