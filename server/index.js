import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';
import { query } from './db.js';
import http from 'http';
import Papa from 'papaparse';
import { Server } from 'socket.io';
import multer from 'multer';

// --- 1. IMPORT PRINTER LIBRARY ---
import { printOrderTicket, printSaleReceipt } from './printer.js';

const __filename_index = fileURLToPath(import.meta.url);
const __dirname_index = path.dirname(__filename_index);
const projectRoot = path.join(__dirname_index, '..');
dotenv.config({ path: path.join(projectRoot, '.env.local') });

// --- DATABASE CHECK ---
(async () => {
  try {
    // 1. Ensure Users table has 'active' column
    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='active') THEN
              ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT TRUE;
          END IF;
      END
      $$;
    `);
    console.log('✅ Database schema checked: "active" column exists for users.');

    // 2. Create ORDER TICKETS table (For the "Blue P" history)
    // This stores every "Round" sent to the kitchen permanently.
    await query(`
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
    `);
    console.log('✅ Database schema checked: "order_tickets" table exists.');

  } catch (e) {
    console.error('⚠️ Database schema update warning:', e.message);
  }
})();

const app = express();
const port = process.env.PORT || 3001; 
const host = '0.0.0.0';

app.use(cors());

app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const httpServer = http.createServer(app);

// --- SOCKET.IO CONFIGURATION ---
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  }
});

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// --- SOCKET LOGIC ---
let masterClientId = null; // We still track it for Initial State requests

io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  
  // 1. Identification
  socket.on('identify-as-master', () => {
    console.log(`👑 Client ${socket.id} identified as MASTER (PC)`);
    masterClientId = socket.id;
  });

  // 2. Client asking for state (Waiter connects)
  socket.on('request-latest-state', () => {
    if (masterClientId) {
      socket.to(masterClientId).emit('share-your-state');
    } else {
        console.log("⚠️ No Master found to provide state.");
    }
  });

  // 3. Master providing state
  socket.on('here-is-my-state', (tablesData) => {
    io.emit('order-updated-from-server', tablesData);
  });

  // 4. ORDER UPDATES (Active Table State)
  socket.on('client-order-update', ({ tableId, order }) => {
    console.log(`🔄 Update received for Table ${tableId}`);
    socket.broadcast.emit('process-client-order-update', { tableId, order });
  });

  socket.on('order-update', (updatedTablesData) => {
    socket.broadcast.emit('order-updated-from-server', updatedTablesData);
  });

  // 5. SALES & PRINTING
  socket.on('sale-finalized', (newSaleData) => {
    socket.broadcast.emit('sale-finalized-from-server', newSaleData);
  });

  socket.on('print-order-ticket', async (orderData) => {
    console.log(`🖨️ Printing Order Ticket for Table: ${orderData.tableName}`);
    io.emit('print-order-ticket-from-server', orderData);
    printOrderTicket(orderData);    
  });
  
  socket.on('print-sale-receipt', async (saleData) => {
    console.log(`🖨️ Printing Receipt for Sale #${saleData.id}`);
    io.emit('print-sale-receipt-from-server', saleData);
    printSaleReceipt(saleData);
  });

  socket.on('tax-rate-update', (newTaxRate) => {
    socket.broadcast.emit('tax-rate-updated-from-server', newTaxRate);
  });

  // 6. NEW: TICKET CREATED (For Admin Dashboard real-time update)
  socket.on('ticket-created', (data) => {
      // Broadcast to everyone so Admin dashboard updates instantly without refresh
      socket.broadcast.emit('ticket-created-from-server', data);
  });

  socket.on('disconnect', () => {
    if (socket.id === masterClientId) {
      console.log(`👑 Master disconnected: ${socket.id}`);
      masterClientId = null;
    } else {
       console.log(`🔌 Client disconnected: ${socket.id}`);
    }
  });
});


// --- API ENDPOINTS ---

// 1. LOGIN
app.post('/api/login', asyncHandler(async (req, res) => {
  const { pin } = req.body;
  const { rows } = await query('SELECT * FROM users WHERE pin = $1 AND active = TRUE', [pin]);
  if (rows.length > 0) res.json({ user: rows[0] });
  else res.json({ user: null });
})); 

// 2. BOOTSTRAP
app.get('/api/bootstrap', asyncHandler(async (req, res) => {
  const [users, menuItems, menuCategories, settings] = await Promise.all([
    query('SELECT * FROM users WHERE active = TRUE ORDER BY username ASC'),
    query('SELECT *, category_name as category, stock_threshold as "stockThreshold", track_stock as "trackStock", stock_group_id as "stockGroupId" FROM menu_items ORDER BY display_order ASC, name ASC'),
    query('SELECT * FROM menu_categories ORDER BY display_order ASC, name ASC'),
    query("SELECT key, value FROM settings") 
  ]);

  const findSetting = (key, defaultValue) => {
    const row = settings.rows.find(r => r.key === key);
    return row ? row.value : defaultValue;
  };

  const taxRate = parseFloat(findSetting('taxRate', '0.09'));
  const tableCount = parseInt(findSetting('tableCount', '50'), 10);

  res.json({
    users: users.rows,
    menuItems: menuItems.rows,
    menuCategories: menuCategories.rows,
    taxRate: taxRate,
    tableCount: tableCount
  });
}));

// 3. ORDER TICKETS (NEW - The "Blue P" History Routes)
app.get('/api/order-tickets', asyncHandler(async (req, res) => {
    const { rows } = await query(`
        SELECT 
            t.ticket_uuid as id, t.table_id as "tableId", t.table_name as "tableName", 
            t.items, t.total, t.created_at as date,
            json_build_object('id', u.id, 'username', u.username) as user
        FROM order_tickets t
        LEFT JOIN users u ON t.user_id = u.id
        ORDER BY t.created_at DESC
    `);
    res.json(rows);
}));

app.post('/api/order-tickets', asyncHandler(async (req, res) => {
    const { tableId, tableName, userId, items, total } = req.body;
    const ticket_uuid = `ticket-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    
    await query(
        'INSERT INTO order_tickets (ticket_uuid, table_id, table_name, user_id, items, total) VALUES ($1, $2, $3, $4, $5, $6)',
        [ticket_uuid, tableId, tableName, userId, JSON.stringify(items), total]
    );

    const newTicket = { id: ticket_uuid, tableId, tableName, userId, items, total, date: new Date() };
    res.status(201).json(newTicket);
}));

// 4. SALES
app.get('/api/sales', asyncHandler(async (req, res) => {
    const { rows } = await query(`
        SELECT
            s.sale_uuid as id, s.date, s.table_id as "tableId", s.table_name as "tableName",
            s.subtotal, s.tax, s.total,
            json_build_object('id', u.id, 'username', u.username, 'pin', u.pin, 'role', u.role) as user,
            (
                SELECT json_agg(
                    json_build_object(
                        'id', si.item_id, 'name', si.item_name, 'price', si.price_at_sale, 'quantity', si.quantity,
                        'category', mi.category_name, 'printer', mi.printer, 'stock', mi.stock, 'stockThreshold', mi.stock_threshold,
                        'trackStock', mi.track_stock
                    )
                )
                FROM sale_items si 
                JOIN menu_items mi ON si.item_id = mi.id
                WHERE si.sale_id = s.id
            ) as items
        FROM sales s
        JOIN users u ON s.user_id = u.id
        ORDER BY s.date DESC
    `);
    const salesData = rows.map(row => ({
        ...row,
        order: {
            items: row.items || [],
            subtotal: parseFloat(row.subtotal),
            tax: parseFloat(row.tax),
            total: parseFloat(row.total)
        }
    }));
    res.json(salesData);
}));


app.post('/api/sales', asyncHandler(async (req, res) => {
  const { order, tableId, tableName, user } = req.body;
  const sale_uuid = `sale-${Date.now()}`;
  const date = new Date();

  // 1. Create the Sale Record
  const saleResult = await query(
      'INSERT INTO sales (sale_uuid, date, user_id, table_id, table_name, subtotal, tax, total) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [sale_uuid, date, user.id, tableId, tableName, order.subtotal, order.tax, order.total]
  );
  const saleId = saleResult.rows[0].id;

  // 2. Process Items and Update Stock
  for (const item of order.items) {
      // Record the sale item
      await query(
          'INSERT INTO sale_items (sale_id, item_id, item_name, price_at_sale, quantity) VALUES ($1, $2, $3, $4, $5)',
          [saleId, item.id, item.name, item.price, item.quantity]
      );

      // SMART STOCK UPDATE:
      // Updates stock for this item OR any item sharing the same stock_group_id
      await query(
          `UPDATE menu_items 
           SET stock = stock - $1 
           WHERE track_stock = TRUE 
           AND (
              id = $2 
              OR (
                  stock_group_id IS NOT NULL 
                  AND stock_group_id = (SELECT stock_group_id FROM menu_items WHERE id = $2)
              )
           )`,
          [item.quantity, item.id]
      );
  }

  const newSale = { id: sale_uuid, date, order, user, tableId, tableName };
  res.status(201).json(newSale);
}));



// 5. HISTORY
app.get('/api/history', asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT h.id, h.table_id AS "tableId", h.timestamp, h.details,
           json_build_object('id', u.id, 'username', u.username, 'pin', u.pin, 'role', u.role) as user
    FROM history h
    JOIN users u ON h.user_id = u.id
    ORDER BY h.timestamp DESC
  `);
  res.json(rows);
}));

app.post('/api/history', asyncHandler(async (req, res) => {
    const { tableId, details, user } = req.body;
    const timestamp = new Date();
    const { rows } = await query(
        'INSERT INTO history (table_id, timestamp, user_id, details) VALUES ($1, $2, $3, $4) RETURNING id',
        [tableId, timestamp, user.id, details]
    );
    res.status(201).json({ id: rows[0].id, tableId, timestamp, user, details });
}));

// 6. USERS
app.post('/api/users', asyncHandler(async (req, res) => {
    const { username, pin, role } = req.body;
    const { rows } = await query('INSERT INTO users (username, pin, role) VALUES ($1, $2, $3) RETURNING *', [username, pin, role]);
    res.status(201).json(rows[0]);
}));

app.delete('/api/users/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    await query('UPDATE users SET active = FALSE WHERE id = $1', [id]);
    res.json({ success: true });
}));

// 7. MENU ITEMS

app.post('/api/menu-items', asyncHandler(async (req, res) => {
  const { name, price, category, printer, stock, stockThreshold, trackStock, stockGroupId } = req.body;
  
  // 1. Insert the new item (including stock_group_id)
  const { rows } = await query(
      'INSERT INTO menu_items (name, price, category_name, printer, stock, stock_threshold, track_stock, display_order, stock_group_id) VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM menu_items), $8) RETURNING *',
      [name, price, category, printer, stock, stockThreshold, trackStock, stockGroupId || null]
  );

  // 2. STOCK SYNC: If this new item belongs to a group, update ALL others in that group to match this stock level
  if (stockGroupId && trackStock) {
       await query(
          'UPDATE menu_items SET stock = $1 WHERE stock_group_id = $2 AND id != $3',
          [stock, stockGroupId, rows[0].id]
      );
  }

  const newItem = {
    ...rows[0],
    category: rows[0].category_name,
    stockThreshold: rows[0].stock_threshold,
    trackStock: rows[0].track_stock,
    stockGroupId: rows[0].stock_group_id
  };
  res.status(201).json(newItem);
}));

app.get('/api/menu-items/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rows } = await query('SELECT * FROM menu_items WHERE id = $1', [id]);
    if (rows.length > 0) { res.json(rows[0]); }
    else { res.status(404).json({ message: `Menu item with id ${id} not found.` }); }
}));

app.put('/api/menu-items/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Added stockGroupId to the input variables
  const { name, price, category, printer, stock, stockThreshold, trackStock, stockGroupId } = req.body;

  // 1. Update the specific item (now including stock_group_id)
  const { rows } = await query(
      'UPDATE menu_items SET name = $1, price = $2, category_name = $3, printer = $4, stock = $5, stock_threshold = $6, track_stock = $7, stock_group_id = $8 WHERE id = $9 RETURNING *',
      [name, price, category, printer, stock, stockThreshold, trackStock, stockGroupId || null, id]
  );

  // 2. STOCK SYNC: If this item belongs to a group and tracks stock, update ALL other items in that group to match
  if (stockGroupId && trackStock) {
       await query(
          'UPDATE menu_items SET stock = $1 WHERE stock_group_id = $2 AND id != $3',
          [stock, stockGroupId, id]
      );
  }

  const updatedItem = {
    ...rows[0],
    category: rows[0].category_name,
    stockThreshold: rows[0].stock_threshold,
    trackStock: rows[0].track_stock,
    stockGroupId: rows[0].stock_group_id
  };
  res.json(updatedItem);
}));

app.delete('/api/menu-items/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await query('DELETE FROM menu_items WHERE id = $1', [id]);
    if (result.rowCount === 0) { console.log(`Attempted to delete menu item ${id}, but it was not found.`); }
    res.json({ success: true });
}));

// 8. MENU CATEGORIES
app.post('/api/menu-categories', asyncHandler(async (req, res) => {
    const { name } = req.body;
    const { rows } = await query('INSERT INTO menu_categories (name, display_order) VALUES ($1, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM menu_categories)) RETURNING *', [name]);
    res.status(201).json(rows[0]);
}));

app.put('/api/menu-categories/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const oldCategoryResult = await query('SELECT name FROM menu_categories WHERE id = $1', [id]);
    if (oldCategoryResult.rows.length === 0) { return res.status(404).json({ message: 'Category not found' }); }
    const oldName = oldCategoryResult.rows[0].name;
    await query('UPDATE menu_items SET category_name = $1 WHERE category_name = $2', [name, oldName]);
    const { rows } = await query('UPDATE menu_categories SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
    res.json(rows[0]);
}));

app.delete('/api/menu-categories/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    await query('DELETE FROM menu_categories WHERE id = $1', [id]);
    res.json({ success: true });
}));

app.post('/api/menu-categories/reorder', asyncHandler(async (req, res) => {
    const { orderedIds } = req.body; 
    if (!Array.isArray(orderedIds)) { return res.status(400).json({ message: 'Invalid payload.' }); }
    let queryText = 'UPDATE menu_categories SET display_order = CASE id ';
    orderedIds.forEach((id, index) => { queryText += `WHEN ${parseInt(id, 10)} THEN ${index + 1} `; });
    queryText += 'END WHERE id = ANY($1::int[])';
    await query(queryText, [orderedIds]);
    res.json({ success: true });
}));

app.post('/api/menu-items/reorder', asyncHandler(async (req, res) => {
    const { orderedIds } = req.body; 
    if (!Array.isArray(orderedIds)) { return res.status(400).json({ message: 'Invalid payload.' }); }
    let queryText = 'UPDATE menu_items SET display_order = CASE id ';
    orderedIds.forEach((id, index) => { queryText += `WHEN ${parseInt(id, 10)} THEN ${index + 1} `; });
    queryText += 'END WHERE id = ANY($1::int[])';
    await query(queryText, [orderedIds]);
    res.json({ success: true });
}));

app.post('/api/menu-items/reorder-from-csv', upload.single('reorderFile'), asyncHandler(async (req, res) => {
    if (!req.file) { return res.status(400).json({ message: 'No file uploaded.' }); }
    const fileContent = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = fileContent.split(/\r?\n/);
    const orderedNamesFromCsv = lines.slice(1).map(line => line.split(',')[0].trim()).filter(name => name);
    const dbItemsResult = await query('SELECT id, name FROM menu_items');
    const dbItemsMap = new Map(dbItemsResult.rows.map(item => [item.name, item.id]));
    const orderedIds = [];
    let notFoundCount = 0;
    orderedNamesFromCsv.forEach(name => {
        if (dbItemsMap.has(name)) { orderedIds.push(dbItemsMap.get(name)); }
        else { notFoundCount++; }
    });
    if (orderedIds.length === 0) { return res.status(400).json({ message: 'No matching items found.', reorderedCount: 0, notFoundCount }); }
    let queryText = 'UPDATE menu_items SET display_order = CASE id ';
    orderedIds.forEach((id, index) => { queryText += `WHEN ${id} THEN ${index + 1} `; });
    queryText += 'END WHERE id = ANY($1::int[])';
    await query(queryText, [orderedIds]);
    res.json({ success: true, message: 'Reordering complete.', reorderedCount: orderedIds.length, notFoundCount });
}));


// IMPROVED CSV IMPORT ENDPOINT (With Duplicate Check)
app.post('/api/menu-items/import-csv', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // 1. FIX BOM & TRIM
  const fileContent = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '').trim();
  
  // 2. PARSE CSV
  const results = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: "", // Auto-detect
  });

  let added = 0;
  let skipped = 0;

  for (const item of results.data) {
      // Find keys case-insensitively
      const findKey = (target) => Object.keys(item).find(k => k.toLowerCase() === target.toLowerCase());

      const name = item[findKey('name')];
      const priceStr = item[findKey('price')];
      const category = item[findKey('category')];
      const printerRaw = item[findKey('printer')];

      if (!name || !priceStr || !category) {
          skipped++;
          continue;
      }

      try {
          // --- 3. CHECK FOR DUPLICATES ---
          // This prevents adding "Pica Margarita" if it's already in the DB
          const existingItem = await query('SELECT id FROM menu_items WHERE name = $1', [name]);
          
          if (existingItem.rows.length > 0) {
              skipped++; // Skip this item
              continue;
          }

          // --- 4. AUTO-CREATE CATEGORY ---
          const catResult = await query('SELECT id FROM menu_categories WHERE name = $1', [category]);
          if (catResult.rows.length === 0) {
              await query('INSERT INTO menu_categories (name, display_order) VALUES ($1, 0)', [category]);
          }

          // --- 5. INSERT ITEM ---
          const printer = (printerRaw && printerRaw.toLowerCase().includes('shank')) ? 'Shank' : 'Kuzhina';
          
          await query(
              'INSERT INTO menu_items (name, price, category_name, printer, stock, track_stock, display_order) VALUES ($1, $2, $3, $4, 100, false, 0)',
              [name, parseFloat(priceStr), category, printer]
          );
          added++;
      } catch (err) {
          console.error(`Failed to insert ${name}:`, err.message);
          skipped++;
      }
  }
  
  res.json({ 
      message: `${added} artikuj u shtuan, ${skipped} artikuj u anashkaluan (të dublikuar ose pa të dhëna)`, 
      added, 
      skipped 
  });
}));

// 9. SETTINGS
app.post('/api/settings/tax', asyncHandler(async (req, res) => {
    const { rate } = req.body;
    if (typeof rate !== 'number' || rate < 0) { return res.status(400).json({ message: 'Invalid tax rate.' }); }
    const upsertQuery = `INSERT INTO settings (key, value) VALUES ('taxRate', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`;
    await query(upsertQuery, [rate.toString()]);
    res.json({ success: true, newRate: rate });
}));

app.post('/api/settings/table-count', asyncHandler(async (req, res) => {
    const { count } = req.body;
    if (typeof count !== 'number' || count < 1) { 
        return res.status(400).json({ message: 'Invalid table count.' }); 
    }
    
    const upsertQuery = `
        INSERT INTO settings (key, value) 
        VALUES ('tableCount', $1) 
        ON CONFLICT (key) 
        DO UPDATE SET value = EXCLUDED.value;
    `;
    await query(upsertQuery, [count.toString()]);
    
    console.log(`✅ Database: Table count updated to ${count}`);
    res.json({ success: true, newCount: count });
}));

// --- SERVE FRONTEND (Production) ---
if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(projectRoot, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send('Backend API is running. Use localhost:3000 for frontend.');
    });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Something went wrong on the server!' });
});



httpServer.listen(port, host, () => {
  console.log(`✅ POS server is running!`);
  const nets = networkInterfaces();
  const results = {};
  for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
              if (!results[name]) { results[name] = []; }
              results[name].push(net.address);
          }
      }
  }
  console.log(`   - Local:   http://localhost:${port}`);
  Object.values(results).flat().forEach(address => {
      console.log(`   - Network: http://${address}:${port}`);
  });
});