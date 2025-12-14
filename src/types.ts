export enum UserRole {
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER',
}

export enum Printer {
  KITCHEN = 'Kuzhina',
  BAR = 'Shank',
}

export interface User {
  id: number;
  username: string;
  pin: string;
  role: UserRole;
  active: boolean;
}

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  printer: Printer;
  stock: number;
  stockThreshold: number;
  trackStock: boolean;
  display_order: number | null; // --- MODIFIED: Added display_order
  stockGroupId?: string | null;
  cost_price?: number; // --- ADDED: Weighted Average Cost
}

export interface MenuCategory {
  id: number;
  name: string;
  display_order: number | null; // --- MODIFIED: Added display_order
}

// --- MODIFIED: Added 'addedBy' and optional 'status' to track order item metadata ---
export interface OrderItem extends MenuItem {
  quantity: number;
  addedBy: string; // Will store the username, e.g., "Admin"
  status?: 'new' | 'ordered';
  uniqueId?: string; // Made optional with ?
}
// --- END MODIFICATION ---

export interface Order {
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  sessionUuid?: string; // --- ADDED: Unique ID for Idempotency
}

// --- ADDED: Interface for Active Orders from DB ---
export interface ActiveOrder {
  id: number;
  table_id: string;
  session_uuid: string;
  items: OrderItem[];
  status: string;
  updated_at: string;
}

export interface Sale {
  id: string; // Can be a temporary string ID when offline
  date: Date;
  order: Order;
  user: User;
  tableId: number;
  tableName: string;
}

export interface Section {
  id: number;
  name: string;
  display_order: number;
  isHidden?: boolean;
  isDefault?: boolean;
}

export interface Table {
  id: number;
  name: string;
  sectionId?: number | null; // --- ADDED: Links table to a section
  display_order?: number | null; // Added: Custom sort order for manual reordering (NULL = use name-based sort)
  order: Order | null;
}

export interface HistoryEntry {
  id: number | string; // Can be temp string ID when offline
  tableId: number;
  timestamp: Date;
  user: User;
  details: string;
}

// --- Types for Offline Sync Queue ---

export type SyncActionType =
  | 'ADD_USER' | 'DELETE_USER'
  | 'ADD_SALE'
  | 'ADD_MENU_ITEM' | 'UPDATE_MENU_ITEM' | 'DELETE_MENU_ITEM'
  | 'ADD_MENU_CATEGORY' | 'UPDATE_MENU_CATEGORY' | 'DELETE_MENU_CATEGORY'
  | 'ADD_HISTORY_ENTRY'
  | 'SET_TAX_RATE';

export interface SyncQueueItem {
  id?: number;
  type: SyncActionType;
  payload: any;
  timestamp: number;
}

export interface CompanyInfo {
  name: string;
  nui: string;
  address: string;
  phone: string;
}

export interface BootstrapData {
  users: User[];
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  sections: Section[];
  tables: any[];
  activeOrders: ActiveOrder[]; // --- ADDED: Persistence Source of Truth
  taxRate: number;
  tableCount: number;
  companyInfo: CompanyInfo;
  history: HistoryEntry[];
  operationalDayStartHour: number;
  allTablesCustomName: string;
}

export interface StockUpdateItem {
  itemId: number;
  quantity: number;
  totalCost?: number; // --- ADDED: For supply valuation
}

export interface StockMovement {
  id: number;
  quantity: number;
  type: 'supply' | 'sale' | 'waste' | 'correction';
  reason: string;
  created_at: string;
  username: string;
  item_name?: string;
}

// Add this to your Table interface in src/types.ts
export interface Table {
  // ... existing fields
  display_order?: number | null;
}