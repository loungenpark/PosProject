import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';
import { query } from './db.js';
import http from 'http';
import { Server } from 'socket.io';

const __filename_index = fileURLToPath(import.meta.url);
const __dirname_index = path.dirname(__filename_index);
const projectRoot_index = path.join(__dirname_index, '..');
dotenv.config({ path: path.join(projectRoot_index, '.env.local') });

const app = express();
const port = process.env.PORT || 3001;
const host = '0.0.0.0';

app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..'); 

express.static.mime.define({'application/javascript': ['ts', 'tsx']});
app.use(express.static(projectRoot));

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

io.on('connection', (socket) => {
  console.log(`✅ Real-time client connected: ${socket.id}`);

  socket.on('order-update', (updatedTablesData) => {
    socket.broadcast.emit('order-updated-from-server', updatedTablesData);
  });

  socket.on('sale-finalized', (newSaleData) => {
    socket.broadcast.emit('sale-finalized-from-server', newSaleData);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Real-time client disconnected: ${socket.id}`);
  });
});

app.post('/api/login', asyncHandler(async (req, res) => {
  const { pin } = req.body;
  console.log('\n--- LOGIN ATTEMPT ---');
  console.log(`PIN received from frontend: ${pin}`);
  console.log(`Type of PIN received: ${typeof pin}`);
  try {
    const { rows } = await query('SELECT * FROM users WHERE pin = $1', [pin]);
    console.log(`Database query found ${rows.length} users.`);
    if (rows.length > 0) {
      console.log('User found:', rows[0]);
    }
    console.log('--- END LOGIN ATTEMPT ---\n');
    if (rows.length > 0) {
      res.json({ user: rows[0] });
    } else {
      res.json({ user: null });
    }
  } catch (error) {
    console.error('!!! DATABASE QUERY FAILED !!!');
    console.error(error);
    console.log('--- END LOGIN ATTEMPT ---\n');
    res.status(500).json({ message: 'Database query failed.' });
  }
}));

app.get('/api/bootstrap', asyncHandler(async (req, res) => {
  const [users, menuItems, menuCategories] = await Promise.all([
    query('SELECT * FROM users ORDER BY username ASC'),
    query('SELECT id, name, price, category_name as category, printer, stock, stock_threshold as "stockThreshold", track_stock as "trackStock" FROM menu_items ORDER BY name ASC'),
    query('SELECT * FROM menu_categories ORDER BY name ASC')
  ]);
  res.json({
    users: users.rows,
    menuItems: menuItems.rows,
    menuCategories: menuCategories.rows,
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
    
    const newSale = {
        id: sale_uuid,
        date,
        order,
        user,
        tableId,
        tableName,
    };
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
    await query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
}));

app.post('/api/menu-items', asyncHandler(async (req, res) => {
    const { name, price, category, printer, stock, stockThreshold, trackStock } = req.body;
    const { rows } = await query(
        'INSERT INTO menu_items (name, price, category_name, printer, stock, stock_threshold, track_stock) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, price, category_name as category, printer, stock, stock_threshold as "stockThreshold", track_stock as "trackStock"',
        [name, price, category, printer, stock, stockThreshold, trackStock]
    );
    res.status(201).json(rows[0]);
}));

app.get('/api/menu-items/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rows } = await query(
        'SELECT id, name, price, category_name as category, printer, stock, stock_threshold as "stockThreshold", track_stock as "trackStock" FROM menu_items WHERE id = $1',
        [id]
    );

    if (rows.length > 0) {
        res.json(rows[0]);
    } else {
        res.status(404).json({ message: `Menu item with id ${id} not found.` });
    }
}));

app.put('/api/menu-items/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, price, category, printer, stock, stockThreshold, trackStock } = req.body;
    const { rows } = await query(
        'UPDATE menu_items SET name = $1, price = $2, category_name = $3, printer = $4, stock = $5, stock_threshold = $6, track_stock = $7 WHERE id = $8 RETURNING id, name, price, category_name as category, printer, stock, stock_threshold as "stockThreshold", track_stock as "trackStock"',
        [name, price, category, printer, stock, stockThreshold, trackStock, id]
    );
    res.json(rows[0]);
}));

// --- MODIFIED: This route is now more robust ---
app.delete('/api/menu-items/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    // The query result includes 'rowCount', which tells us how many rows were deleted.
    const result = await query('DELETE FROM menu_items WHERE id = $1', [id]);
    
    // If rowCount is 0, it means the item was not found, but it's not an error.
    // The desired state (the item being gone) is achieved.
    if (result.rowCount === 0) {
        console.log(`Attempted to delete menu item ${id}, but it was not found. Already deleted.`);
    }

    // Always return success because the item is gone, which was the goal.
    res.json({ success: true });
}));
// --- END MODIFICATION ---

app.post('/api/menu-categories', asyncHandler(async (req, res) => {
    const { name } = req.body;
    const { rows } = await query('INSERT INTO menu_categories (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json(rows[0]);
}));

app.put('/api/menu-categories/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const oldCategoryResult = await query('SELECT name FROM menu_categories WHERE id = $1', [id]);
    if (oldCategoryResult.rows.length === 0) {
        return res.status(404).json({ message: 'Category not found' });
    }
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

app.get('*', (req, res) => {
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).send({ message: 'API endpoint not found' });
    }
    res.sendFile(path.join(projectRoot, 'index.html'));
});

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
              if (!results[name]) {
                  results[name] = [];
              }
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