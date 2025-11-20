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
}

export interface Sale {
  id: string; // Can be a temporary string ID when offline
  date: Date;
  order: Order;
  user: User;
  tableId: number;
  tableName: string;
}

export interface Table {
  id: number;
  name: string;
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