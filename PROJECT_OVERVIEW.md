# Restaurant POS System – Project Overview

## 1. High-Level Architecture

- **Type**: Hybrid online/offline restaurant POS.
- **Frontend**: React + TypeScript (Vite) served from the same Node backend (static `dist` folder).
- **Backend**: Node.js/Express + PostgreSQL, plus Socket.IO for real‑time sync and print events.
- **Local persistence**: IndexedDB (via `utils/db.ts`) for offline mode + sync queue.
- **Communication**: REST API (`api.ts`) + Socket.IO (`PosContext.tsx` ↔ `server/index.js`).
- **Printing**: Browser-based printing of receipts and kitchen/bar order tickets (`utils/print.ts`, `utils/printManager.tsx`).

### Main runtime flow

1. User opens the app (served by Express from `dist/`, `index.html` → `index.tsx`).
2. React bootstraps `App` inside `PosProvider` (global state & side effects).
3. `PosProvider` boots IndexedDB, loads local data, tries to sync pending actions, then calls backend `/api/bootstrap` to fetch fresh users/menu/categories/tax.
4. Login PIN is checked locally first (IndexedDB data), then via `/api/login` if online.
5. After login:
   - `PosScreen` handles table selection, order editing, and sale finalization.
   - `AdminScreen` handles menu/categories, users, settings, reports, CSV import/reorder, and AI sales analysis.
6. Orders & sales are stored locally (IndexedDB) and optionally sent to backend.
7. Socket.IO keeps tables, orders, and print events in sync across devices.

---

## 2. Entry Points & Configuration

### 2.1 `index.html`
Standard Vite entry with a `div#root` where React mounts.

### 2.2 `index.tsx`
- Mounts React 18 app using `ReactDOM.createRoot`.
- Wraps `App` with `PosProvider`:
  - Ensures all components can use `usePos()` for state/actions.

### 2.3 `App.tsx`
- Reads `loggedInUser` and `isLoading` from context.
- **Loading screen**: centered spinner + restaurant icon while context bootstraps.
- **Routing-like logic** (no react-router):
  - If no user → show `LoginScreen`.
  - If logged in → show `PosScreen`.

### 2.4 `vite.config.ts`
- React plugin + TS support.
- Dev server on `0.0.0.0:3000`.
- `base: './'` – required so built app works when served by backend from arbitrary path.
- `@` alias to project root.
- Injects GEMINI API key into `process.env` for `SalesAI`.

---

## 3. Shared Types & Constants

### 3.1 `types.ts`
Central type definitions shared across frontend:

- **Enums**
  - `UserRole` – `ADMIN`, `CASHIER`.
  - `Printer` – `KITCHEN` (`Kuzhina`), `BAR` (`Shank`).

- **Core entities**
  - `User`: `{ id, username, pin, role }`.
  - `MenuItem`: menu metadata + stock controls + `display_order`.
  - `MenuCategory`: `{ id, name, display_order }`.
  - `OrderItem`: extends `MenuItem` with `{ quantity, addedBy }`.
  - `Order`: `{ items: OrderItem[], subtotal, tax, total }`.
  - `Sale`: `{ id, date, order, user, tableId, tableName }`.
  - `Table`: `{ id, name, order }`.
  - `HistoryEntry`: chronological logs `{ id, tableId, timestamp, user, details }`.

- **Sync queue types**
  - `SyncActionType`: union of all offline actions (add/update/delete user/menu/category/sale/history, set tax).
  - `SyncQueueItem`: `{ id?, type, payload, timestamp }` – stored in IndexedDB.

### 3.2 `constants.ts`
- `DEFAULT_USERS`: initial Admin + default cashier.
- `MENU_ITEMS`: starter menu data with prices, categories, printer routing, stock settings.
- `INITIAL_TAX_RATE`: defaults tax to 9% when backend doesn’t supply it.

---

## 4. Data Access & Offline Storage (`utils/`)

### 4.1 `utils/db.ts` – IndexedDB abstraction

Responsibilities:

- Open/create DB (`pos-offline-db`, version 1) with stores:
  - `users`, `menuItems`, `menuCategories`, `sales`, `history`, `syncQueue`.
- Thin wrappers around IndexedDB transactions:
  - `initDB()` – ensures DB object is set and stores exist.
  - `put<T>(item, store)` – upsert one record.
  - `bulkPut<T>(items, store)` – upsert many.
  - `getAll<T>(store)` – read all items.
  - `remove(key, store)` – delete by key.
  - `clearStore(store)` / `clearStaticData()` – for resetting static data.
- **Sync queue helpers**:
  - `addToSyncQueue(item)` – adds typed action with timestamp.
  - `getSyncQueue()` – fetches all queued actions.
  - `removeFromSyncQueue(id)` – deletes processed action.

Data model is generic enough that context can use these helpers for users, menu, sales, and history.

### 4.2 `utils/print.ts` – Browser printing helper

- Opens a new window and clones all `<link rel="stylesheet">` and `<style>` tags so Tailwind styles apply when printing.
- Uses React 18 `createRoot` to render arbitrary React element (`component` argument) into print window, waits briefly, then calls `window.print()` and closes.

### 4.3 `utils/printManager.tsx` – High-level printing orchestrator

- `printSaleReceipt(sale)`:
  - Guard: checks `localStorage.isPrintStation === 'true'`.
  - If print station → renders `<Receipt sale={sale} />` into print window via `printComponent`.
  - Otherwise logs and skips printing.

- `printOrderTicket(table, newItems, user)`:
  - Same print‑station guard and `newItems.length > 0`.
  - Renders `<OrderTicket table={table} newItems={newItems} user={user} />`.

This decouples **when** printing should happen (in context or server) from **how** HTML is printed.

---

## 5. API Client (`api.ts`)

### Base setup

- `API_URL = 'http://192.168.1.10:3001'` – the backend base URL (adjust for deployment).

### Helpers

- `requestJSON(endpoint, options)`:
  - Adds JSON headers.
  - Logs outgoing request.
  - Parses text body (supports empty body).
  - Throws:
    - Network/TypeError → user-friendly "Network error".
    - Non-2xx with JSON `message` → throws meaningful error.

- `requestFormData(endpoint, formData)`:
  - POST with FormData, similar error handling.

### API surface

- **Auth & bootstrap**
  - `login(pin)` → `{ user: User | null }` (`/api/login`).
  - `bootstrap()` → `{ users, menuItems, menuCategories, taxRate }` from `/api/bootstrap`.

- **Users**
  - `addUser(user)` → created User.
  - `deleteUser(userId)` → `{ success }`.

- **Menu items**
  - `addMenuItem(item)` → new `MenuItem`.
  - `updateMenuItem(item)` → updated `MenuItem`.
  - `deleteMenuItem(id)` → `{ success }`.

- **Menu categories**
  - `addMenuCategory(name)` → new `MenuCategory`.
  - `updateMenuCategory(category)` → updated `MenuCategory`.
  - `deleteMenuCategory(id)` → `{ success }`.

- **Sales**
  - `addSale(order, tableId, tableName, user)` → created `Sale`.
  - `getSales()` → `Sale[]` with nested `order` and `items` hydrated by server.

- **History**
  - `addHistoryEntry(tableId, details, user)`.
  - `getHistory()` → `HistoryEntry[]`.

- **Settings**
  - `getSettings()` → `{ taxRate, tables }` (now mostly superseded by `bootstrap`).
  - `updateTaxRate(rate)` → `{ success, newRate }` at `/api/settings/tax`.

- **Ordering & CSV**
  - `reorderMenuCategories(orderedIds)` → POST `/api/menu-categories/reorder`.
  - `reorderMenuItems(orderedIds)` → POST `/api/menu-items/reorder`.
  - `reorderMenuItemsFromCSV(file)` → POST `/api/menu-items/reorder-from-csv` with CSV.

---

## 6. Global State & Business Logic (`context/PosContext.tsx`)

`PosContext` is the **heart** of the app: it combines backend, IndexedDB, sockets, printing, and UI-facing actions.

### 6.1 Context state exposed

Key pieces (see `PosContextState`):

- **Connectivity**: `isLoading`, `isOnline`, `isSyncing`.
- **Auth**: `loggedInUser`, `login(pin)`, `logout()`.
- **Users**: `users`, `addUser`, `deleteUser`.
- **Menu**: `menuItems`, `menuCategories` and full CRUD + reordering + CSV helpers.
- **Sales**: `sales`, `addSale(order, tableId)`.
- **History**: `history`.
- **Tables UI layout**: `tables`, `setTableCount`, `tablesPerRow`, `tableSizePercent`, `tableButtonSizePercent` and setters (stored in `localStorage`).
- **Tax**: `taxRate`, `setTaxRate(ratePercent)`.
- **Printing triggers**: `saleToPrint`, `setSaleToPrint`, `orderToPrint`, `setOrderToPrint` (plus direct socket events).
- **Order persistence**: `updateOrderForTable`, `saveOrderForTable`.

All of this is memoized in `value` and exposed via `usePos()` hook.

### 6.2 Boot sequence

On first mount (`startupEffectRan` guard):

1. `db.initDB()` – ensure IndexedDB structure.
2. Load `activeTables` from `localStorage` or create a default number of tables (`tableCount`, default 100).
3. Load table layout preferences from `localStorage`.
4. If backend configured and online:
   - `syncOfflineData()` – push `syncQueue` items to server via `api.*`.
   - `fetchAndCacheData()` – call `/api/bootstrap`, clear static IndexedDB stores, and store new `users/menu/menuCategories` + `taxRate`.
5. Otherwise fall back to `loadDataFromDb()` to run purely offline.
6. Subscribe to `window` `online/offline` events to update `isOnline` and resync when coming online.

### 6.3 Sync logic

- `syncOfflineData()`:
  - Guards against re‑entry via `syncInProgress` ref.
  - Reads queue from IndexedDB; for each item dispatches to appropriate `api.*` call.
  - On success → removes from queue.
  - On error → stops sync but keeps queue (so user can try again later).

- `setTaxRate(ratePercent)`:
  - Converts percent to fraction (`0–1`) and updates local state.
  - Enqueues `SET_TAX_RATE` action into sync queue.
  - Adds a history entry noting the change.
  - If online, triggers `syncOfflineData()` asynchronously.

### 6.4 Socket.IO integration

- Connects to `SOCKET_URL = http://<host>:3001`.
- Listens/handles:
  - `order-updated-from-server` → replace `tables` and persist in `localStorage`.
  - `sale-finalized-from-server` → prepend new sale locally.
  - `print-order-ticket-from-server` → calls `printOrderTicket` (only prints on stations).
  - `print-sale-receipt-from-server` → calls `printSaleReceipt`.
  - `share-your-state` → emits `here-is-my-state` with local `tables` state when requested.
- On connect → emits `request-latest-state` so one client shares current tables to others.

### 6.5 Tables & orders

- `setTableCount(count)`:
  - Sets `tableCount` in `localStorage`.
  - Builds `count` tables: uses current tables if exist, otherwise new default entries.
  - Stores full table list in `localStorage.activeTables`.

- `updateOrderForTable(tableId, order)`:
  - Replaces `order` for given table.
  - Stores tables in `localStorage`.
  - Emits `order-update` via socket so other clients reflect the change.

- `saveOrderForTable(tableId, updatedOrder, newItems)`:
  - Calls `updateOrderForTable` to store order.
  - If there are `newItems`, emits `print-order-ticket` with table, items, and current user (kitchen/bar ticket).

- `addSale(order, tableId)`:
  - Creates local `Sale` object with unique id/time and table/user info.
  - Adds sale to local state and IndexedDB.
  - Clears table order (via `updateOrderForTable`).
  - Adds history entry "Fatura u finalizua...".
  - Decrements stock of each `trackStock` item via `updateMenuItem`.
  - Emits `sale-finalized` + `print-sale-receipt` events over socket.

### 6.6 Auth helpers

- `login(pin)`:
  - First attempts to find matching PIN in `users` in memory (from IndexedDB/bootstrap).
  - If not found and online → calls backend `/api/login`.
  - On success → sets `loggedInUser` and returns `true`, else `false`.

- `logout()` – clears `loggedInUser`.

### 6.7 CSV utilities (stubs in current snapshot)

- `importMenuItemsFromCSV(file)` / `reorderMenuItemsFromCSV(file)` are currently planned interfaces but partially stubbed in this snapshot (implementation may exist in older versions).

---

## 7. UI Components (`components/`)

Only the main, current versions are described here ("Copy" variants are historical).

### 7.1 `components/common/Icons.tsx`

- Exposes the set of SVG icons used throughout the app (logout, plus/minus, trash, tables, printer, charts, etc.).
- Imported heavily by `PosScreen`, `AdminScreen`, `LoginScreen`, etc.

### 7.2 `LoginScreen.tsx`

- Numeric keypad login UI.
- Core logic:
  - `pin` state, accepts exactly 4 digits.
  - `handleKeyPress` appends digits and triggers login when length hits 4.
  - `handleBackspace` / `handleClear` modify PIN.
  - `attemptLogin` calls `usePos().login(pin)` and shows transient error if invalid.
  - `useEffect` attaches `keydown` listener so physical keyboard digits/C/backspace also work.

### 7.3 `PosScreen.tsx`

Main operational POS UI for waiters/cashiers.

- Uses context selectors: `loggedInUser`, `logout`, `menuItems`, `menuCategories`, `addSale`, `tables`, `saveOrderForTable`, layout values, `taxRate`.
- `PaymentModal` inner component:
  - Collects `amountPaid`, computes `change`, validates that amount ≥ total.
  - Calls `onFinalize(amountPaid)` (→ `handleFinalizeSale`).

Key flows:

1. **Table selection** view (when `activeTableId === null`):
   - Shows grid of table buttons (size controlled by layout preferences).
   - Each button shows table number and current order total if table has an order.
   - Admin has quick access to `AdminScreen` from header.

2. **Order screen** (once table selected):
   - Category tabs -> `selectedCategory` state.
   - Menu grid filtered by category, shows stock status and disables out‑of‑stock items.
   - Adds items to `currentOrderItems` with `addedBy = loggedInUser.username` and `status` (`new` vs `ordered`).
   - Grouped order list by `addedBy` user.
   - Quantity controls for `new` items (plus/minus/trash) with stock checks.
   - Summary area shows subtotal, tax, and total using shared `taxRate`.
   - Actions:
     - `Porosit` (send order): persists order to table (`saveOrderForTable`) and triggers print ticket for new items.
     - `Fatura` (invoice): opens PaymentModal; `handleFinalizeSale` then calls `addSale`, closes modal, clears table, and logs out.

### 7.4 `AdminScreen.tsx`

Heavy admin panel with multiple sub‑modules, all inside a modal from `PosScreen`.

Key features:

- **Menu & category management (`MenuManagement`)**
  - Tabs: `Menutë` (categories) and `Artikujt` (items).
  - Drag-and-drop via `react-beautiful-dnd` to reorder categories/items.
  - Category table: edit/delete, maintain `display_order`, `MenuForm` for CRUD.
  - Item table: category, printer, price, stock controls, `MenuItemForm` for CRUD.
  - `DataManagement` panel:
    - CSV import for new items (with `Name, Price, Category, Printer`).
    - CSV reorder for existing items (by `Name`).

- **SalesDashboard**
  - Uses context `sales` and `users`.
  - Two sets of filters:
    - Detailed transaction list date range (defaults to today).
    - Summary date range + user filter for aggregated revenue.
  - Splits revenue by printer (`Shank` vs `Kuzhina`) by computing per‑sale ratios.
  - Renders:
    - Summary cards for bar, kitchen, total.
    - Scrollable list of transactions with item breakdown, totals, and timestamps.

- **UserManagement integration**
  - A dedicated `UserManagement` component embedded to add/delete users.

Also manages tax and table layout in parts not fully displayed in the current slice but wired through `usePos()`.

### 7.5 `UserManagement.tsx`

- Modal-based UI to create new users and list/delete existing ones.
- `UserForm` collects username, PIN, and role.
- `handleSaveUser` calls `addUser()` from context.
- `handleDeleteUser` calls `deleteUser()` with confirm dialog.
- Displays role badges (Admin vs Cashier).

### 7.6 `Receipt.tsx`

- Simple receipt rendering component:
  - Header with restaurant address and phone.
  - Sale metadata (id, date, cashier, table).
  - Items table with quantity and totals.
  - Tax breakdown (if tax > 0) and overall total.
  - Footer "Thank you" message.
- Used exclusively via `printManager.printSaleReceipt`.

### 7.7 `OrderTicket.tsx` (inferred)

- Component (not fully opened here) used by `printManager.printOrderTicket`.
- Receives `{ table, newItems, user }` and renders a kitchen/bar order ticket.

### 7.8 `SalesAI.tsx`

AI-powered analysis panel (optional, requires Gemini API key).

- Uses `@google/genai` with `GoogleGenAI` client.
- Props: `salesData: Sale[]`, `menuItems: MenuItem[]`.
- Internal state: prompt, loading, conversation history, error.
- If `process.env.API_KEY` missing → shows instructions instead of UI.
- For each user prompt:
  - Serializes an aggregate JSON of simplified sales and menu items.
  - Builds a system-style instruction prompt (Albanian responses, EUR currency).
  - Calls Gemini model `gemini-2.5-flash` to analyze and answer.
  - Renders conversation as chat bubbles.

---

## 8. Backend (`server/`)

### 8.1 `server/db.js`

- Loads `.env.local` from project root (so DB credentials can be configured outside code).
- Creates a `pg.Pool` with `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `DB_PORT`.
- Logs on successful connection; logs & exits on unexpected errors.
- Exposes `query(text, params)` convenience function used by `index.js`.

### 8.2 `server/index.js`

Core Node/Express server.

- **Setup**:
  - Loads `.env.local`.
  - Creates Express app, HTTP server, and Socket.IO instance.
  - CORS limited to `http://localhost:3000` and `http://192.168.1.10:3000`.
  - Serves static files from `dist`.

- **Socket.IO events** (mirrors `PosContext`):
  - `order-update` → broadcast `order-updated-from-server`.
  - `sale-finalized` → broadcast `sale-finalized-from-server`.
  - `print-order-ticket` → broadcast `print-order-ticket-from-server` (to all clients).
  - `print-sale-receipt` → broadcast `print-sale-receipt-from-server`.
  - `tax-rate-update` → broadcast new tax rate (context currently uses sync queue instead).
  - `request-latest-state` / `share-your-state` / `here-is-my-state` handshake:
    - New client requests; existing ones provide current tables; server rebroadcasts.

- **REST endpoints** (selected):

  - **Auth & bootstrap**
    - `POST /api/login` – simple PIN lookup.
    - `GET /api/bootstrap` – returns:
      - `users` sorted by username.
      - `menuItems` with DB column mapping to frontend shape (category, stock fields, `display_order`).
      - `menuCategories` with ordering.
      - `taxRate` from `settings` table (key `taxRate`) as float (defaults to 0.09).

  - **Sales**
    - `GET /api/sales` – complex query joining `sales`, `users`, `sale_items`, and `menu_items` to reconstruct `Sale` objects with nested `order/items`.
    - `POST /api/sales` – inserts into `sales` and `sale_items`, updates inventory, and returns a `Sale` payload.

  - **History**
    - `GET /api/history` – returns joined history entries with user info.
    - `POST /api/history` – inserts a new history entry.

  - **Users**
    - `POST /api/users` – create user.
    - `DELETE /api/users/:id` – hard delete.

  - **Menu items**
    - `POST /api/menu-items` – create with auto `display_order`.
    - `GET /api/menu-items/:id` – fetch one.
    - `PUT /api/menu-items/:id` – update fields.
    - `DELETE /api/menu-items/:id` – delete, logging if not found.

  - **Menu categories**
    - `POST /api/menu-categories` – create with `display_order`.
    - `PUT /api/menu-categories/:id` – rename and propagate category name change into menu items.
    - `DELETE /api/menu-categories/:id` – delete.

  - **Reordering & CSV**
    - `POST /api/menu-categories/reorder` – updates `display_order` via CASE expression built from provided `orderedIds`.
    - `POST /api/menu-items/reorder` – same for menu items.
    - `POST /api/menu-items/reorder-from-csv` –
      - accepts uploaded CSV (`reorderFile`).
      - reads item names, maps them to DB ids, builds `orderedIds`.
      - applies `display_order` accordingly and reports `reorderedCount` / `notFoundCount`.

  - **Tax settings**
    - `POST /api/settings/tax` – validates `rate` and upserts into `settings` table as text.

  - **Fallback & error handling**
    - `GET *` → returns `dist/index.html` (SPA fallback).
    - Error middleware logs stack and returns JSON with message.

- **Server startup**
  - Listens on `host:port` (defaults to `0.0.0.0:3001`).
  - Logs both `localhost` and LAN IP addresses (so tablets/phones on Wi‑Fi can connect).

---

## 9. How Things Fit Together

### 9.1 Order lifecycle

1. Admin configures menus, items, tax, and tables (via `AdminScreen` → API → DB → bootstrap).
2. Cashier logs in (`LoginScreen` → `PosContext.login`).
3. Cashier selects a table and builds an order (`PosScreen`):
   - Items added become `OrderItem` entries in `currentOrderItems` (client-side only initially).
4. Cashier sends order to kitchen/bar:
   - `saveOrderForTable` persists to `tables` state + `localStorage` and emits socket event.
   - Socket event triggers `printOrderTicket` on designated print stations.
5. When guest pays:
   - `PaymentModal` collects payment and triggers `handleFinalizeSale`.
   - `addSale` creates local `Sale`, persists to IndexedDB, clears table order, updates stock, emits `sale-finalized` + `print-sale-receipt`.
   - Sync queue (if offline) later pushes sale to server; online path can call `api.addSale` directly (expected in a completed implementation).

### 9.2 Offline/online behavior

- Any critical mutating action should be recorded in IndexedDB and enqueued in `syncQueue`.
- `syncOfflineData` flushes queue whenever there is connectivity.
- UI always reads state from context, which in turn reads from IndexedDB/bootstrap rather than directly from network.

### 9.3 Multi‑device coordination

- Socket.IO ties multiple tablets/PCs together:
  - Tables and orders stay in sync (`order-update` events).
  - Sales list and dashboards update live (`sale-finalized` events).
  - Print commands (`print-order-ticket`, `print-sale-receipt`) travel from any device to any device flagged as `isPrintStation`.

---

## 10. Files/Modules Not Covered In Detail

- `components/AdminScreen - Copy*.tsx`, `PosScreen - Copy*.tsx`, etc.: historical versions kept for reference while iterating.
- `context/PosContext - *.tsx`: previous iterations of context logic.
- `scripts/` and `server/copies/`: probably hold earlier migration/schema scripts and backups.

For everyday development and debugging, focus on:

- **Frontend composition**: `App.tsx`, `index.tsx`, `PosContext.tsx`, `PosScreen.tsx`, `AdminScreen.tsx`, `LoginScreen.tsx`.
- **Data & side effects**: `types.ts`, `api.ts`, `utils/db.ts`, `utils/print*.ts[x]`.
- **Backend**: `server/index.js`, `server/db.js`, DB schema (`server/schema.sql`).
