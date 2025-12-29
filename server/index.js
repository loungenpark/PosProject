import "./instrument.js"; // <--- ADD THIS (Must be line 1)
import * as Sentry from "@sentry/node"; // <--- ADD THIS
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
import { initDatabase } from './dbSetup.js';

// --- DATABASE CHECK ---
initDatabase();

const app = express();



const port = process.env.PORT || 3001;
const host = '0.0.0.0';

// --- 1. UNIVERSAL CORS (Allow All Origins) ---
app.use(cors({
  origin: "*", // Allow any computer/phone to connect
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));

app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const httpServer = http.createServer(app);

// --- SOCKET.IO CONFIGURATION ---
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow any computer/phone to connect
    methods: ["GET", "POST"]
    // Note: We removed 'credentials: true' because it conflicts with origin: '*'
  }
});

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Helper function to fetch and broadcast all active orders
const broadcastActiveOrders = async () => {
  try {
    // Fetch the complete, current list of all active orders from the database
    const { rows } = await query('SELECT * FROM active_orders');
    // Broadcast this full list to every single connected client
    io.emit('active-orders-updated', rows);
    console.log('📢 Broadcasted active orders update to all clients.');
  } catch (err) {
    console.error("❌ Failed to broadcast active orders:", err.message);
  }
};

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  // Note: We no longer use "Master Client". The Database is the Master.

  // 4. ORDER UPDATES (Active Table State - PERSISTED & BROADCAST)
  socket.on('client-order-update', async ({ tableId, order }) => {
    console.log(`🔄 Update received for Table ${tableId}`);

    try {
      const hasItems = order && order.items && order.items.length > 0;

      if (hasItems) {
        const sessionUuid = order.sessionUuid || `temp-${tableId}-${Date.now()}`;
        const itemsJson = JSON.stringify(order.items);

        await query(`
                INSERT INTO active_orders (table_id, session_uuid, items, status, updated_at)
                VALUES ($1, $2, $3, 'open', NOW())
                ON CONFLICT (table_id) 
                DO UPDATE SET 
                    items = EXCLUDED.items, 
                    session_uuid = CASE WHEN EXCLUDED.session_uuid LIKE 'temp-%' THEN active_orders.session_uuid ELSE EXCLUDED.session_uuid END,
                    updated_at = NOW();
            `, [tableId, sessionUuid, itemsJson]);
      } else {
        await query('DELETE FROM active_orders WHERE table_id = $1', [tableId]);
      }
    } catch (err) {
      console.error("❌ Failed to persist order update:", err.message);
    }

    // B. BROADCAST: Fetch the definitive state from the DB and send it to EVERYONE
    broadcastActiveOrders();
  });

  // NEW: Table Transfer Endpoint
  // Ideally this should be a REST endpoint, but since we are here in the socket logic...
  // Actually, the plan called for a PUT endpoint. Let's scroll down to API section.


  // 5. PRINTING (Sales-related notifications are now handled directly in the /api/sales endpoint)

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
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});


// --- API ENDPOINTS ---

// 1. LOGIN
app.post('/api/login', asyncHandler(async (req, res) => {
  const { pin } = req.body;
  // SECURITY: Check PIN in WHERE clause, but DO NOT select it
  const { rows } = await query('SELECT id, username, role, active FROM users WHERE pin = $1 AND active = TRUE', [pin]);
  if (rows.length > 0) res.json({ user: rows[0] });
  else res.json({ user: null });
}));

// 2. BOOTSTRAP
app.get('/api/bootstrap', asyncHandler(async (req, res) => {
  const [users, menuItems, menuCategories, settings, sections, tables, activeOrders] = await Promise.all([
    // SECURITY: Select specific columns to exclude 'pin'
    query('SELECT id, username, role, active FROM users WHERE active = TRUE ORDER BY username ASC'),
    query('SELECT *, category_name as category, stock_threshold as "stockThreshold", track_stock as "trackStock", stock_group_id as "stockGroupId", cost_price as "costPrice" FROM menu_items WHERE active = TRUE ORDER BY display_order ASC, name ASC'),
    query('SELECT * FROM menu_categories ORDER BY display_order ASC, name ASC'),
    query("SELECT key, value FROM settings"),
    query('SELECT * FROM sections WHERE active = TRUE ORDER BY display_order ASC'),
    query('SELECT * FROM tables WHERE active = TRUE ORDER BY display_order ASC NULLS LAST, name ASC'),
    query('SELECT * FROM active_orders') // <--- Load persisted orders
  ]);

  const findSetting = (key, defaultValue) => {
    const row = settings.rows.find(r => r.key === key);
    return row ? row.value : defaultValue;
  };

  const taxRate = parseFloat(findSetting('taxRate', '0.09'));
  const tableCount = parseInt(findSetting('tableCount', '50'), 10);
  const operationalDayStartHour = parseInt(findSetting('operational_day_start_hour', '5'), 10);

  const companyInfo = {
    name: findSetting('companyName', ''),
    nui: findSetting('companyNui', ''),
    address: findSetting('companyAddress', ''),
    phone: findSetting('companyPhone', '')
  };

  // NEW: Get the custom name for "All" view
  const allTablesCustomName = findSetting('all_tables_custom_name', '');

  res.json({
    users: users.rows,
    menuItems: menuItems.rows,
    menuCategories: menuCategories.rows,
    sections: sections.rows,
    tables: tables.rows,
    taxRate: taxRate,
    tableCount: tableCount,
    operationalDayStartHour: operationalDayStartHour,
    companyInfo,
    allTablesCustomName, // Add to bootstrap payload
    activeOrders: activeOrders.rows // <--- Send to client
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
  const ticket_uuid = `ticket-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  await query(
    'INSERT INTO order_tickets (ticket_uuid, table_id, table_name, user_id, items, total) VALUES ($1, $2, $3, $4, $5, $6)',
    [ticket_uuid, tableId, tableName, userId, JSON.stringify(items), total]
  );

  const newTicket = { id: ticket_uuid, tableId, tableName, userId, items, total, date: new Date() };
  res.status(201).json(newTicket);
}));

// --- NEW: TRANSFER ACTIVE ORDER (Partial & Merge Support) ---
app.put('/api/active-orders/transfer', asyncHandler(async (req, res) => {
  const { sourceTableId, destTableId, transferItemIds } = req.body;
  // transferItemIds: string[] (List of uniqueIds to move) - Optional

  if (!sourceTableId || !destTableId) {
    return res.status(400).json({ message: 'Missing source or destination table ID.' });
  }

  // 1. Fetch Source Order
  const sourceRes = await query('SELECT * FROM active_orders WHERE table_id = $1', [sourceTableId]);
  if (sourceRes.rows.length === 0) {
    return res.status(404).json({ message: 'Tavolina e burimit nuk ka porosi aktive.' });
  }
  const sourceOrder = sourceRes.rows[0];
  let sourceItems = typeof sourceOrder.items === 'string' ? JSON.parse(sourceOrder.items) : sourceOrder.items;

  // 2. Fetch Destination Order (for merging)
  const destRes = await query('SELECT * FROM active_orders WHERE table_id = $1', [destTableId]);
  let destItems = [];
  let destSessionUuid = destRes.rows.length > 0 ? destRes.rows[0].session_uuid : `session-${destTableId}-${Date.now()}`;

  if (destRes.rows.length > 0) {
    const destOrder = destRes.rows[0];
    destItems = typeof destOrder.items === 'string' ? JSON.parse(destOrder.items) : destOrder.items;
  }

  // 3. Determine Items to Move
  let itemsToMove = [];

  if (transferItemIds && Array.isArray(transferItemIds) && transferItemIds.length > 0) {
    // --- PARTIAL TRANSFER ---
    // Filter items that match the requested uniqueIds
    itemsToMove = sourceItems.filter(item => transferItemIds.includes(item.uniqueId));

    // Remove moved items from source
    sourceItems = sourceItems.filter(item => !transferItemIds.includes(item.uniqueId));
  } else {
    // --- FULL TRANSFER ---
    itemsToMove = [...sourceItems];
    sourceItems = []; // Empty source
  }

  if (itemsToMove.length === 0) {
    return res.status(400).json({ message: 'Asnjë artikull për të transferuar.' });
  }

  // 4. Append items to Destination (We DO NOT group/sum, we append lines to respect "No Grouping" rule)
  destItems = [...destItems, ...itemsToMove];

  // 5. Database Updates

  // A. Update Source Table
  if (sourceItems.length === 0) {
    // If empty, delete the order
    await query('DELETE FROM active_orders WHERE table_id = $1', [sourceTableId]);
  } else {
    // If items remain, update the JSON blob
    await query('UPDATE active_orders SET items = $1, updated_at = NOW() WHERE table_id = $2', [JSON.stringify(sourceItems), sourceTableId]);
  }

  // B. Update Destination Table (Upsert)
  const upsertQuery = `
    INSERT INTO active_orders (table_id, session_uuid, items, status, updated_at)
    VALUES ($1, $2, $3, 'open', NOW())
    ON CONFLICT (table_id) 
    DO UPDATE SET items = EXCLUDED.items, updated_at = NOW();
  `;
  await query(upsertQuery, [destTableId, destSessionUuid, JSON.stringify(destItems)]);

  // 6. Broadcast Update
  broadcastActiveOrders();

  res.json({ success: true, message: 'Transferimi u krye me sukses.' });
}));

// 4. SALES
app.get('/api/sales', asyncHandler(async (req, res) => {
  // 1. Fetch the operational day start hour setting
  const settingsResult = await query("SELECT value FROM settings WHERE key = 'operational_day_start_hour'");
  const startHour = settingsResult.rows.length > 0 ? parseInt(settingsResult.rows[0].value, 10) : 5; // Default to 5 AM

  // 2. Determine the date range
  const { from, to, operationalDate } = req.query;
  let startDate, endDate;

  // Case A: Date Range (From - To)
  if (from && to && !isNaN(new Date(from)) && !isNaN(new Date(to))) {
    startDate = new Date(from);
    startDate.setHours(startHour, 0, 0, 0);

    const toDate = new Date(to);
    endDate = new Date(toDate);
    endDate.setDate(endDate.getDate() + 1); // The operational day for the "To" date ends the NEXT calendar day
    endDate.setHours(startHour, 0, 0, 0);
    endDate.setSeconds(endDate.getSeconds() - 1);
  }
  // Case B: Single Date (Legacy or specific day)
  else if (operationalDate && !isNaN(new Date(operationalDate))) {
    startDate = new Date(operationalDate);
    startDate.setHours(startHour, 0, 0, 0);

    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setSeconds(endDate.getSeconds() - 1);
  }
  // Case C: Default (Current Operational Day)
  else {
    startDate = new Date();
    startDate.setHours(startHour, 0, 0, 0);

    // If now is before start hour (e.g. 3 AM), we are in previous day's operational cycle
    if (new Date() < startDate) {
      startDate.setDate(startDate.getDate() - 1);
    }

    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setSeconds(endDate.getSeconds() - 1);
  }

  console.log(`📈 Fetching sales for operational day: ${startDate.toISOString()} to ${endDate.toISOString()}`);

  // 4. Query the database within the calculated range
  const { rows } = await query(`
      SELECT
          s.sale_uuid as id, s.date, s.table_id as "tableId", s.table_name as "tableName",
          s.subtotal, s.tax, s.total,
          -- SECURITY: Exclude PIN
          json_build_object('id', u.id, 'username', u.username, 'role', u.role) as user,
          (
              SELECT json_agg(
                  json_build_object(
                      'id', si.item_id, 'name', si.item_name, 'price', si.price_at_sale, 'quantity', si.quantity,
                      'category', COALESCE(mi.category_name, 'Deleted'), 'printer', COALESCE(mi.printer, 'Unknown'), 'stock', mi.stock, 'stockThreshold', mi.stock_threshold,
                      'trackStock', mi.track_stock,
                      'stockGroupId', mi.stock_group_id
                  )
              )
              FROM sale_items si 
              LEFT JOIN menu_items mi ON si.item_id = mi.id
              WHERE si.sale_id = s.id
          ) as items
      FROM sales s
      JOIN users u ON s.user_id = u.id
      WHERE s.date BETWEEN $1 AND $2
      ORDER BY s.date DESC
  `, [startDate, endDate]);

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
  const sessionUuid = order.sessionUuid || null;

  // START TRANSACTION: Everything from here to COMMIT is "All or Nothing"
  await query('BEGIN');

  try {
    // 1. IDEMPOTENCY CHECK
    if (sessionUuid) {
      const duplicateCheck = await query('SELECT id FROM sales WHERE session_uuid = $1', [sessionUuid]);
      if (duplicateCheck.rows.length > 0) {
        await query('ROLLBACK');
        return res.status(409).json({ message: 'Kjo porosi është paguar tashmë!' });
      }
    }

    // 2. Create Sale Header
    const saleResult = await query(
      'INSERT INTO sales (sale_uuid, date, user_id, table_id, table_name, subtotal, tax, total, session_uuid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [sale_uuid, date, user.id, tableId, tableName, order.subtotal, order.tax, order.total, sessionUuid]
    );
    const saleId = saleResult.rows[0].id;

    // 3. Clear Active Order
    if (tableId) {
      await query('DELETE FROM active_orders WHERE table_id = $1', [tableId]);
    }

    // 4. Process Items
    for (const item of order.items) {
      // CRITICAL VALIDATION: Reject any item without a valid ID immediately
      if (!item.id || isNaN(parseInt(item.id))) {
        throw new Error(`Artikulli "${item.name}" ka ID të pavlefshme. Pagesa u anulua.`);
      }

      // Verify item exists in DB
      const itemCheck = await query('SELECT id, track_stock, stock_group_id FROM menu_items WHERE id = $1 AND active = TRUE', [item.id]);

      if (itemCheck.rows.length === 0) {
        throw new Error(`Artikulli "${item.name}" nuk ekziston në meny. Pagesa u anulua.`);
      }

      const dbItem = itemCheck.rows[0];

      // Insert into sale_items
      await query(
        'INSERT INTO sale_items (sale_id, item_id, item_name, price_at_sale, quantity) VALUES ($1, $2, $3, $4, $5)',
        [saleId, item.id, item.name, item.price, item.quantity]
      );

      // 5. Stock Logic
      const updateResult = await query(
        `UPDATE menu_items 
         SET stock = COALESCE(stock, 0) - $1 
         WHERE track_stock = TRUE 
         AND (
            id = $2 
            OR (
                stock_group_id IS NOT NULL 
                AND stock_group_id = $3
            )
         )`,
        [item.quantity, item.id, dbItem.stock_group_id]
      );

      if (updateResult.rowCount > 0) {
        await query(
          `INSERT INTO stock_movements (item_id, quantity, type, reason, user_id)
            VALUES ($1, $2, 'sale', 'Sale', $3)`,
          [item.id, -item.quantity, user.id]
        );
      }
    }

    // IF WE REACHED HERE, EVERYTHING IS OK
    await query('COMMIT');

    const newSale = { id: sale_uuid, date, order, user, tableId, tableName };

    // Notifications trigger only after successful database commit
    broadcastActiveOrders();
    io.emit('sale-finalized-from-server', newSale);

    res.status(201).json(newSale);

  } catch (error) {
    // IF ANY STEP FAILED, UNDO EVERYTHING
    await query('ROLLBACK');
    console.error("❌ TRANSACTION FAILED - Sale Rollbacked:", error.message);
    res.status(500).json({ message: error.message || 'Gabim gjatë procesimit të shitjes.' });
  }
}));



// 5. HISTORY
app.get('/api/history', asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT h.id, h.table_id AS "tableId", h.timestamp, h.details,
           -- SECURITY: Exclude PIN
           json_build_object('id', u.id, 'username', u.username, 'role', u.role) as user
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

  // 1. Check if user already exists (active or inactive)
  const checkResult = await query('SELECT * FROM users WHERE username = $1', [username]);

  if (checkResult.rows.length > 0) {
    const existingUser = checkResult.rows[0];

    if (existingUser.active) {
      // User exists and is currently active
      return res.status(400).json({ message: 'Ky përdorues ekziston tashmë!' });
    } else {
      // User exists but was "deleted" -> Reactivate them and update PIN/Role
      const { rows } = await query(
        'UPDATE users SET active = TRUE, pin = $1, role = $2 WHERE id = $3 RETURNING id, username, role, active',
        [pin, role, existingUser.id]
      );
      return res.json(rows[0]);
    }
  }

  // 2. If user doesn't exist, create new
  const { rows } = await query('INSERT INTO users (username, pin, role) VALUES ($1, $2, $3) RETURNING id, username, role, active', [username, pin, role]);
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

  let finalStock = stock;
  let finalThreshold = stockThreshold;
  let finalTrackStock = trackStock;

  // 1. SMART INHERITANCE: Inherit ALL inventory settings from the group
  if (stockGroupId) {
    const existingGroupParams = await query(
      'SELECT stock, stock_threshold, track_stock FROM menu_items WHERE stock_group_id = $1 LIMIT 1',
      [stockGroupId]
    );

    if (existingGroupParams.rows.length > 0) {
      const groupData = existingGroupParams.rows[0];
      finalStock = groupData.stock;
      finalThreshold = groupData.stock_threshold;
      finalTrackStock = groupData.track_stock;
      console.log(`🔗 Linking to Group "${stockGroupId}". Inheriting: Stock=${finalStock}, Threshold=${finalThreshold}, Track=${finalTrackStock}`);
    }
  }

  // 2. Insert with potentially inherited values
  const { rows } = await query(
    'INSERT INTO menu_items (name, price, category_name, printer, stock, stock_threshold, track_stock, display_order, stock_group_id) VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM menu_items), $8) RETURNING *',
    [name, price, category, printer, finalStock, finalThreshold, finalTrackStock, stockGroupId || null]
  );

  const newItem = {
    ...rows[0],
    category: rows[0].category_name,
    stockThreshold: rows[0].stock_threshold,
    trackStock: rows[0].track_stock,
    stockGroupId: rows[0].stock_group_id,
    costPrice: rows[0].cost_price
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

  // SAFETY CHECK: Reject temporary IDs (Timestamps) to prevent DB crash
  // Max PostgreSQL Integer is 2,147,483,647. Timestamps are ~1,700,000,000,000.
  if (parseInt(id, 10) > 2147483647) {
    console.warn(`⚠️ Blocked attempt to update temporary ID: ${id}`);
    return res.status(400).json({ message: 'Cannot update temporary item. Please sync or re-create.' });
  }

  let { name, price, category, printer, stock, stockThreshold, trackStock, stockGroupId } = req.body;

  // Sanitize
  stockGroupId = stockGroupId ? stockGroupId.trim() : null;

  // 1. Update the specific item
  const { rows } = await query(
    'UPDATE menu_items SET name = $1, price = $2, category_name = $3, printer = $4, stock = $5, stock_threshold = $6, track_stock = $7, stock_group_id = $8 WHERE id = $9 RETURNING *',
    [name, price, category, printer, stock, stockThreshold, trackStock, stockGroupId || null, id]
  );
  //...

  // 2. FULL SYNC: Propagate Stock, Threshold, AND Tracking Status to the whole group
  if (stockGroupId) {
    await query(
      'UPDATE menu_items SET stock = $1, stock_threshold = $2, track_stock = $3 WHERE stock_group_id = $4 AND id != $5',
      [stock, stockThreshold, trackStock, stockGroupId, id]
    );
  }

  const updatedItem = {
    ...rows[0],
    category: rows[0].category_name,
    stockThreshold: rows[0].stock_threshold,
    trackStock: rows[0].track_stock,
    stockGroupId: rows[0].stock_group_id,
    costPrice: rows[0].cost_price
  };
  res.json(updatedItem);
}));

app.delete('/api/menu-items/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // SAFETY CHECK
  if (parseInt(id, 10) > 2147483647) {
    return res.json({ success: true }); // Just say success to clear it from the queue
  }

  // SOFT DELETE: Mark as inactive instead of removing from DB
  const result = await query('UPDATE menu_items SET active = FALSE WHERE id = $1', [id]);
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
app.post('/api/settings/company', asyncHandler(async (req, res) => {
  const { name, nui, address, phone } = req.body;
  console.log("📥 Saving Company Info:", { name, nui, address, phone });

  const settingsToUpdate = [
    { key: 'companyName', value: name },
    { key: 'companyNui', value: nui },
    { key: 'companyAddress', value: address },
    { key: 'companyPhone', value: phone }
  ];

  for (const setting of settingsToUpdate) {
    // Ensure we handle potential nulls as empty strings
    const val = setting.value === undefined || setting.value === null ? '' : setting.value;

    // Simple UPSERT using ON CONFLICT (Requires unique key, which we ensured above)
    const upsertQuery = `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`;
    await query(upsertQuery, [setting.key, val]);
  }

  res.json({ success: true });
}));

app.post('/api/settings/tax', asyncHandler(async (req, res) => {
  const { rate } = req.body;
  if (typeof rate !== 'number' || rate < 0) { return res.status(400).json({ message: 'Invalid tax rate.' }); }
  const upsertQuery = `INSERT INTO settings (key, value) VALUES ('taxRate', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`;
  await query(upsertQuery, [rate.toString()]);
  res.json({ success: true, newRate: rate });
}));

app.post('/api/settings/operational-day', asyncHandler(async (req, res) => {
  const { hour } = req.body;
  if (typeof hour !== 'number' || hour < 0 || hour > 23) {
    return res.status(400).json({ message: 'Ora duhet të jetë një numër ndërmjet 0 dhe 23.' });
  }
  const upsertQuery = `INSERT INTO settings (key, value) VALUES ('operational_day_start_hour', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`;
  await query(upsertQuery, [hour.toString()]);
  console.log(`✅ Database: Operational Day Start Hour updated to ${hour}:00`);
  res.json({ success: true, newHour: hour });
}));

// NEW: Generic Setting Updater
app.post('/api/settings', asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  if (!key) {
    return res.status(400).json({ message: 'Key is required.' });
  }

  const upsertQuery = `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`;
  await query(upsertQuery, [key, String(value)]);

  // Notify all clients of the change
  io.emit('setting-updated', { key, value });

  console.log(`✅ Setting updated: ${key} = ${value}`);
  res.json({ success: true, key, value });
}));

// 10. STOCK MANAGEMENT (Bulk Update - Now with Weighted Average Cost)
app.post('/api/stock/bulk-update', asyncHandler(async (req, res) => {
  const { movements, reason, userId, type } = req.body;
  const movementType = type || 'supply'; // Default to 'supply'

  // movements: [{ itemId, quantity, totalCost }]

  if (!Array.isArray(movements) || movements.length === 0) {
    return res.status(400).json({ message: 'No items to update.' });
  }

  for (const move of movements) {
    const { itemId, quantity, totalCost } = move;

    const addedQty = parseFloat(quantity);
    const inputTotalCost = parseFloat(totalCost) || 0;

    // Calculate the specific cost per unit for THIS batch
    const batchUnitCost = addedQty !== 0 ? (inputTotalCost / addedQty) : 0;

    // 1. Fetch current state to calculate Weighted Average
    const itemRes = await query('SELECT id, stock, cost_price, stock_group_id FROM menu_items WHERE id = $1', [itemId]);

    if (itemRes.rows.length === 0) continue;

    const item = itemRes.rows[0];
    const currentStock = parseFloat(item.stock) || 0;
    const currentAvgCost = parseFloat(item.cost_price) || 0;

    // CALCULATION: Weighted Average Cost (WAC)
    const effectiveOldStock = currentStock > 0 ? currentStock : 0;

    // SMART FIX: If current cost is 0 (legacy item), assume the OLD stock 
    // has the SAME value as this NEW batch. This prevents "diluting" the price 
    // (e.g., treating old Cola as €0.00).
    const effectiveOldAvgCost = (currentAvgCost === 0 && effectiveOldStock > 0)
      ? batchUnitCost
      : currentAvgCost;

    const oldTotalValue = effectiveOldStock * effectiveOldAvgCost;
    const newTotalValue = oldTotalValue + inputTotalCost;
    const newTotalQty = effectiveOldStock + addedQty;

    let newAvgCost = currentAvgCost;
    if (newTotalQty > 0) {
      newAvgCost = newTotalValue / newTotalQty;
    }

    // 2. Update Menu Item (Stock + New Average Cost)
    // This handles Shared Stock Groups automatically via the WHERE clause
    await query(
      `UPDATE menu_items 
       SET stock = COALESCE(stock, 0) + $1,
           cost_price = $2
       WHERE track_stock = TRUE 
       AND (
          id = $3 
          OR (
              stock_group_id IS NOT NULL 
              AND stock_group_id = (SELECT stock_group_id FROM menu_items WHERE id = $3)
          )
       )`,
      [addedQty, newAvgCost, itemId]
    );

    // 3. Log the Movement (Record the SPECIFIC batch cost, not the average)
    await query(
      `INSERT INTO stock_movements (item_id, quantity, type, reason, user_id, cost_price)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [itemId, addedQty, movementType, reason, userId, batchUnitCost]
    );
  }

  res.json({ success: true });
}));

// 10.5 STOCK WASTE (Humbje)
app.post('/api/stock/waste', asyncHandler(async (req, res) => {
  const { itemId, quantity, reason, userId, type } = req.body;
  const movementType = type || 'waste'; // Default to 'waste'

  if (!itemId || !quantity || quantity <= 0) {
    return res.status(400).json({ message: 'Invalid data.' });
  }

  // 1. Update Menu Item Stock (Decrease) - Handles Shared Stock Groups
  await query(
    `UPDATE menu_items 
       SET stock = COALESCE(stock, 0) - $1 
       WHERE track_stock = TRUE 
       AND (
          id = $2 
          OR (
              stock_group_id IS NOT NULL 
              AND stock_group_id = (SELECT stock_group_id FROM menu_items WHERE id = $2)
          )
       )`,
    [quantity, itemId]
  );

  // 2. Log the Movement (Negative quantity for waste)
  await query(
    `INSERT INTO stock_movements (item_id, quantity, type, reason, user_id)
       VALUES ($1, $2, $3, $4, $5)`,
    [itemId, -quantity, movementType, reason, userId]
  );

  res.json({ success: true });
}));

// 11. STOCK HISTORY (Aggregated Smart Group Fetch)
app.get('/api/stock/movements/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const itemResult = await query('SELECT stock_group_id FROM menu_items WHERE id = $1', [id]);
  if (itemResult.rows.length === 0) {
    return res.status(404).json({ message: "Item not found" });
  }
  const stockGroupId = itemResult.rows[0].stock_group_id;

  let filterClause;
  let params;

  if (stockGroupId) {
    filterClause = `WHERE mi.stock_group_id = $1`;
    params = [stockGroupId];
  } else {
    filterClause = `WHERE sm.item_id = $1`;
    params = [id];
  }

  const aggregationQuery = `
      SELECT 
        COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = 'supply'), 0) as "supplyTotal",
        COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = 'waste'), 0) as "wasteTotal",
        COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = 'sale'), 0) as "saleTotal",
        COALESCE(SUM(sm.quantity) FILTER (WHERE sm.type = 'correction'), 0) as "correctionTotal",

        COALESCE(json_agg(
            json_build_object(
                'id', sm.id, 'quantity', sm.quantity, 'type', sm.type, 'reason', sm.reason, 
                'createdAt', sm.created_at, 'user', u.username, 'itemName', mi.name
            ) ORDER BY sm.created_at DESC
        ) FILTER (WHERE sm.type = 'supply'), '[]'::json) as "supplyDetails",
        
        COALESCE(json_agg(
            json_build_object(
                'id', sm.id, 'quantity', sm.quantity, 'type', sm.type, 'reason', sm.reason, 
                'createdAt', sm.created_at, 'user', u.username, 'itemName', mi.name
            ) ORDER BY sm.created_at DESC
        ) FILTER (WHERE sm.type = 'waste'), '[]'::json) as "wasteDetails",

        COALESCE(json_agg(
            json_build_object(
                'id', sm.id, 'quantity', sm.quantity, 'type', sm.type, 'reason', sm.reason, 
                'createdAt', sm.created_at, 'user', u.username, 'itemName', mi.name
            ) ORDER BY sm.created_at DESC
        ) FILTER (WHERE sm.type = 'sale'), '[]'::json) as "saleDetails",

        COALESCE(json_agg(
            json_build_object(
                'id', sm.id, 'quantity', sm.quantity, 'type', sm.type, 'reason', sm.reason, 
                'createdAt', sm.created_at, 'user', u.username, 'itemName', mi.name
            ) ORDER BY sm.created_at DESC
        ) FILTER (WHERE sm.type = 'correction'), '[]'::json) as "correctionDetails"

      FROM stock_movements sm
      JOIN menu_items mi ON sm.item_id = mi.id
      LEFT JOIN users u ON sm.user_id = u.id
      ${filterClause}
  `;

  const { rows } = await query(aggregationQuery, params);

  if (rows.length === 0) {
    return res.json({
      supply: { total: 0, details: [] },
      waste: { total: 0, details: [] },
      sale: { total: 0, details: [] },
      correction: { total: 0, details: [] }
    });
  }

  const result = rows[0];
  const formattedResponse = {
    supply: {
      total: Number(result.supplyTotal),
      details: result.supplyDetails
    },
    waste: {
      total: Number(result.wasteTotal),
      details: result.wasteDetails
    },
    sale: {
      total: Number(result.saleTotal),
      details: result.saleDetails
    },
    correction: {
      total: Number(result.correctionTotal),
      details: result.correctionDetails
    }
  };

  res.json(formattedResponse);
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

// 12. SECTIONS & ZONES
app.get('/api/sections', asyncHandler(async (req, res) => {
  // Map snake_case from DB to camelCase for Frontend
  const { rows } = await query(`
    SELECT id, name, display_order, is_hidden as "isHidden", is_default as "isDefault" 
    FROM sections 
    ORDER BY display_order ASC
  `);
  res.json(rows);
}));

app.post('/api/sections', asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'Emri i zonës nuk mund të jetë bosh.' });
  }

  // 1. Check if a section with this name exists (active or inactive)
  const existing = await query('SELECT * FROM sections WHERE name = $1', [name]);

  if (existing.rows.length > 0) {
    const section = existing.rows[0];
    if (section.active) {
      // It exists and is active, so this is a conflict.
      return res.status(409).json({ message: 'Një zonë me këtë emër ekziston tashmë.' });
    } else {
      // It exists but is inactive -> reactivate it.
      const { rows } = await query('UPDATE sections SET active = TRUE WHERE id = $1 RETURNING *', [section.id]);
      return res.json(rows[0]);
    }
  } else {
    // It does not exist -> create it.
    const { rows } = await query(
      'INSERT INTO sections (name, display_order) VALUES ($1, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM sections)) RETURNING *',
      [name]
    );
    res.status(201).json(rows[0]);
  }
}));

app.put('/api/sections/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, isHidden, isDefault } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'Emri i zonës nuk mund të jetë bosh.' });
  }

  // 1. If setting as Default, remove default from all others first
  if (isDefault === true) {
    await query('UPDATE sections SET is_default = false');
  }

  // 2. Update the section
  // COALESCE ensures we don't overwrite with NULL if the frontend sends a partial update
  const { rows } = await query(
    `UPDATE sections 
     SET name = $1, 
         is_hidden = COALESCE($2, is_hidden), 
         is_default = COALESCE($3, is_default)
     WHERE id = $4 
     RETURNING id, name, display_order, is_hidden as "isHidden", is_default as "isDefault"`,
    [name, isHidden, isDefault, id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: 'Zona nuk u gjet.' });
  }

  res.json(rows[0]);
}));

app.delete('/api/sections/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  // 1. Soft-delete all tables within this section
  await query('UPDATE tables SET active = FALSE WHERE section_id = $1', [id]);
  // 2. Soft-delete the section itself
  await query('UPDATE sections SET active = FALSE WHERE id = $1', [id]);
  res.json({ success: true });
}));

// 13. TABLE MANAGEMENT (Physical Tables)
app.get('/api/tables', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM tables WHERE active = TRUE ORDER BY display_order ASC NULLS LAST, name ASC');
  res.json(rows);
}));

app.put('/api/tables/reorder', asyncHandler(async (req, res) => {
  const { tables } = req.body; // Expects [{ id, display_order }]
  if (!Array.isArray(tables)) { return res.status(400).json({ message: 'Invalid payload.' }); }

  // Construct the CASE statement for bulk update
  let queryText = 'UPDATE tables SET display_order = CASE id ';
  const ids = [];

  tables.forEach(({ id, display_order }) => {
    queryText += `WHEN ${parseInt(id, 10)} THEN ${parseInt(display_order, 10)} `;
    ids.push(id);
  });

  queryText += 'END WHERE id = ANY($1::int[])';

  if (ids.length > 0) {
    await query(queryText, [ids]);
  }

  // Emit event for real-time sync
  io.emit('tables-reordered');

  res.json({ success: true });
}));

app.post('/api/sections/:id/reset-order', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await query('UPDATE tables SET display_order = NULL WHERE section_id = $1', [id]);
  io.emit('tables-reordered');
  res.json({ success: true });
}));

app.post('/api/tables/:id/reset-order', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await query('UPDATE tables SET display_order = NULL WHERE id = $1', [id]);
  io.emit('tables-reordered');
  res.json({ success: true });
}));

app.post('/api/tables', asyncHandler(async (req, res) => {
  const { name, sectionId } = req.body;
  const finalSectionId = sectionId ? parseInt(sectionId) : null;

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'Emri i tavolinës nuk mund të jetë bosh.' });
  }

  // 1. Check if a table with this name exists (globally)
  const existing = await query('SELECT * FROM tables WHERE name = $1', [name]);

  if (existing.rows.length > 0) {
    const table = existing.rows[0];
    if (table.active) {
      // It exists and is active, conflict.
      return res.status(409).json({ message: 'Një tavolinë me këtë emër ekziston tashmë.' });
    } else {
      // It exists but is inactive -> reactivate and move it to the new section.
      const { rows } = await query(
        'UPDATE tables SET active = TRUE, section_id = $1 WHERE id = $2 RETURNING *',
        [finalSectionId, table.id]
      );
      return res.json(rows[0]);
    }
  } else {
    // It does not exist -> create a new one.
    const { rows } = await query(
      'INSERT INTO tables (name, section_id, active) VALUES ($1, $2, TRUE) RETURNING *',
      [name, finalSectionId]
    );
    res.status(201).json(rows[0]);
  }
}));

app.put('/api/tables/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, sectionId } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'Emri i tavolinës nuk mund të jetë bosh.' });
  }

  // 1. Check for conflicts: Does another table already use this name?
  const conflictCheck = await query(
    'SELECT id FROM tables WHERE name = $1 AND id != $2 AND active = TRUE',
    [name.trim(), id]
  );

  if (conflictCheck.rows.length > 0) {
    return res.status(409).json({ message: 'Një tavolinë tjetër me këtë emër ekziston tashmë.' });
  }

  // 2. If no conflict, proceed with the update.
  const finalSectionId = sectionId ? parseInt(sectionId) : null;
  const { rows } = await query(
    'UPDATE tables SET name = $1, section_id = $2 WHERE id = $3 RETURNING *',
    [name.trim(), finalSectionId, id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: 'Tavolina nuk u gjet.' });
  }

  res.json(rows[0]);
}));

app.delete('/api/tables/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await query('UPDATE tables SET active = FALSE WHERE id = $1', [id]);
  res.json({ success: true });
}));


// --- SERVE FRONTEND (Production) ---
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(projectRoot, 'dist');

  // Serve static files
  app.use(express.static(distPath));

  console.log(`🚀 Production Mode: Serving static files from ${distPath}`);

  // Handle "Catch All" for SPA, but avoid swallowing API 404s
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next(); // Pass to error handler if it's an unknown API route
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Backend API is running. Point your Frontend to this IP/Port.');
  });
}

// --- SENTRY ERROR HANDLER (MUST BE BEFORE CUSTOM ERROR HANDLER) ---
Sentry.setupExpressErrorHandler(app);

// Your Existing Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Something went wrong on the server!' });
});

// --- AUTO-MIGRATION ---
// This ensures the 'active' column exists on both PC1 and PC2 without manual SQL commands.
(async () => {
  try {
    await query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE`);
    console.log("✅ Migration Checked: 'active' column verified on menu_items.");
  } catch (e) {
    console.error("⚠️ Migration Warning:", e.message);
  }
})();

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