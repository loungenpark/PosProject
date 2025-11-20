import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';
import { query } from './db.js';
import http from 'http';
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
  } catch (e) {
    console.error('⚠️ Database schema update warning:', e.message);
  }
})();

// --- 2. CONFIGURE PRINTER ---
// ⚠️ CHANGE 'interface' TO YOUR ACTUAL PRINTER PATH

const app = express();
const port = process.env.PORT || 3001; // Keeps your Port 3001
const host = '0.0.0.0';

const allowedOrigins = [
  'http://localhost:3000',
  'http://192.168.1.10:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      // Allow dynamic local IPs for development convenience
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // simplified for local dev
    methods: ["GET", "POST"],
    credentials: true
  }
});

// const distPath = path.join(projectRoot, 'dist');
// app.use(express.static(distPath));

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Track the master client (PC)
let masterClientId = null;

io.on('connection', (socket) => {
  console.log(`✅ Real-time client connected: ${socket.id}`);
  
  socket.on('identify-as-master', () => {
    console.log(`Client ${socket.id} identified as master (PC)`);
    masterClientId = socket.id;
    socket.emit('request-initial-state');
  });
  
  socket.on('order-update', (updatedTablesData) => {
    if (socket.id === masterClientId) {
      socket.broadcast.emit('order-updated-from-server', updatedTablesData);
    }
  });

  socket.on('sale-finalized', (newSaleData) => {
    socket.broadcast.emit('sale-finalized-from-server', newSaleData);
  });

  // --- 3. NEW PRINTING LOGIC ---
  
  // A. KITCHEN TICKET / ORDER TICKET
  socket.on('print-order-ticket', async (orderData) => {
    console.log(`🖨️ Printing Order Ticket for Table: ${orderData.tableName}`);
    
    // 1. Broadcast to other screens (optional, if needed)
    io.emit('print-order-ticket-from-server', orderData);

    // 2. Call the new file
    printOrderTicket(orderData);    

  });
  
  // B. SALES RECEIPT
  socket.on('print-sale-receipt', async (saleData) => {
    console.log(`🖨️ Printing Receipt for Sale #${saleData.id}`);

    // 1. Broadcast
    io.emit('print-sale-receipt-from-server', saleData);

    // 2. Call the new file
    printSaleReceipt(saleData);
  });

  socket.on('tax-rate-update', (newTaxRate) => {
    socket.broadcast.emit('tax-rate-updated-from-server', newTaxRate);
  });

  socket.on('request-latest-state', () => {
    if (masterClientId) {
      socket.to(masterClientId).emit('share-your-state');
    }
  });

  socket.on('here-is-my-state', (tablesData) => {
    if (socket.id === masterClientId) {
      io.emit('order-updated-from-server', tablesData);
    }
  });

  socket.on('provide-initial-state', (tablesData) => {
    if (socket.id === masterClientId) {
      io.emit('order-updated-from-server', tablesData);
    }
  });

  socket.on('client-order-update', ({ tableId, order }) => {
    if (masterClientId) {
      socket.to(masterClientId).emit('process-client-order-update', { 
        tableId, 
        order,
        clientId: socket.id 
      });
    }
  });

  socket.on('process-client-order-update', ({ tableId, order }) => {
    if (socket.id === masterClientId) {
      // Master handled it
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Real-time client disconnected: ${socket.id}`);
    if (socket.id === masterClientId) {
      masterClientId = null;
    }
  });
});


// --- API ENDPOINTS (Unchanged) ---
app.post('/api/login', asyncHandler(async (req, res) => {
  const { pin } = req.body;
  const { rows } = await query('SELECT * FROM users WHERE pin = $1 AND active = TRUE', [pin]);
  if (rows.length > 0) res.json({ user: rows[0] });
  else res.json({ user: null });
})); 

app.get('/api/bootstrap', asyncHandler(async (req, res) => {
  const [users, menuItems, menuCategories, settings] = await Promise.all([
    query('SELECT * FROM users WHERE active = TRUE ORDER BY username ASC'),
    query('SELECT *, category_name as category, stock_threshold as "stockThreshold", track_stock as "trackStock" FROM menu_items ORDER BY display_order ASC, name ASC'),
    query('SELECT * FROM menu_categories ORDER BY display_order ASC, name ASC'),
    // CHANGED: Get ALL settings (key, value), not just taxRate
    query("SELECT key, value FROM settings") 
  ]);

  // Helper to find a setting from the DB rows
  const findSetting = (key, defaultValue) => {
    const row = settings.rows.find(r => r.key === key);
    return row ? row.value : defaultValue;
  };

  const taxRate = parseFloat(findSetting('taxRate', '0.09'));
  // Load Table Count (Default to 50 if database is empty)
  const tableCount = parseInt(findSetting('tableCount', '50'), 10);

  res.json({
    users: users.rows,
    menuItems: menuItems.rows,
    menuCategories: menuCategories.rows,
    taxRate: taxRate,
    tableCount: tableCount // <--- Sending this to Frontend
  });
}));

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
    const saleResult = await query(
        'INSERT INTO sales (sale_uuid, date, user_id, table_id, table_name, subtotal, tax, total) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [sale_uuid, date, user.id, tableId, tableName, order.subtotal, order.tax, order.total]
    );
    const saleId = saleResult.rows[0].id;
    for (const item of order.items) {
        await query(
            'INSERT INTO sale_items (sale_id, item_id, item_name, price_at_sale, quantity) VALUES ($1, $2, $3, $4, $5)',
            [saleId, item.id, item.name, item.price, item.quantity]
        );
        await query('UPDATE menu_items SET stock = stock - $1 WHERE id = $2 AND track_stock = TRUE', [item.quantity, item.id]);
    }
    const newSale = { id: sale_uuid, date, order, user, tableId, tableName };
    res.status(201).json(newSale);
}));

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

app.post('/api/menu-items', asyncHandler(async (req, res) => {
    const { name, price, category, printer, stock, stockThreshold, trackStock } = req.body;
    const { rows } = await query(
        'INSERT INTO menu_items (name, price, category_name, printer, stock, stock_threshold, track_stock, display_order) VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM menu_items)) RETURNING *',
        [name, price, category, printer, stock, stockThreshold, trackStock]
    );
    res.status(201).json(rows[0]);
}));

app.get('/api/menu-items/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rows } = await query('SELECT * FROM menu_items WHERE id = $1', [id]);
    if (rows.length > 0) { res.json(rows[0]); }
    else { res.status(404).json({ message: `Menu item with id ${id} not found.` }); }
}));

app.put('/api/menu-items/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, price, category, printer, stock, stockThreshold, trackStock } = req.body;
    const { rows } = await query(
        'UPDATE menu_items SET name = $1, price = $2, category_name = $3, printer = $4, stock = $5, stock_threshold = $6, track_stock = $7 WHERE id = $8 RETURNING *',
        [name, price, category, printer, stock, stockThreshold, trackStock, id]
    );
    res.json(rows[0]);
}));

app.delete('/api/menu-items/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await query('DELETE FROM menu_items WHERE id = $1', [id]);
    if (result.rowCount === 0) { console.log(`Attempted to delete menu item ${id}, but it was not found.`); }
    res.json({ success: true });
}));

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
    const fileContent = req.file.buffer.toString('utf-8');
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
    
    // Insert or Update the tableCount setting
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

// Checks if we are in Production (npm start) or Development (npm run dev)
if (process.env.NODE_ENV === 'production') {
    // In Production: Serve the React app
    const distPath = path.join(projectRoot, 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    // In Development: Just show a message
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
  console.log('\nUse the Network URL to connect from other devices on the same Wi-Fi.');
});