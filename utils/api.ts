console.log("⚠️ API IS POINTING TO:", import.meta.env.VITE_API_URL || "http://localhost:3001");
import { MenuItem, Order, Sale, User, UserRole, MenuCategory } from "../types";

// --- ✅ START: MODIFIED API URL ✅ ---
// Ensure this IP matches your Server PC's IP address
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
// --- ✅ END: MODIFIED API URL ✅ ---


// Standard request function for JSON APIs
async function requestJSON(endpoint: string, options: RequestInit = {}) {
  // --- NEW LOG ---
  console.log(`--- ATTEMPTING TO FETCH: ${API_URL}${endpoint} ---`);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    
    if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    
    if (!response.ok) {
      throw new Error(data.message || `API request failed with status ${response.status}`);
    }
    return data;
  } catch (error) {
    if (error instanceof TypeError) {
        console.error(`--- NETWORK ERROR on ${endpoint}:`, error);
        throw new Error('Network error. Could not connect to the server.');
    }
    console.error(`--- API ERROR on ${endpoint}:`, error);
    throw error;
  }
}

// Special request function for FormData (file uploads)
async function requestFormData(endpoint: string, formData: FormData) {
  // --- NEW LOG ---
  console.log(`--- ATTEMPTING TO FETCH (FormData): ${API_URL}${endpoint} ---`);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      body: formData,
    });
    
    if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    
    if (!response.ok) {
      throw new Error(data.message || `API request failed with status ${response.status}`);
    }
    return data;
  } catch (error) {
    if (error instanceof TypeError) {
        console.error(`--- NETWORK ERROR on ${endpoint}:`, error);
        throw new Error('Network error. Could not connect to the server.');
    }
    console.error(`--- API ERROR on ${endpoint}:`, error);
    throw error;
  }
}

// --- Auth ---
export const login = (pin: string): Promise<{user: User | null}> => requestJSON('/api/login', {
    method: 'POST',
    body: JSON.stringify({ pin }),
});

// --- Bootstrap (Updated with tableCount) ---
export const bootstrap = (): Promise<{ users: User[], menuItems: MenuItem[], menuCategories: MenuCategory[], taxRate: number, tableCount: number, companyInfo?: any }> => requestJSON('/api/bootstrap');

// --- Users ---
export const addUser = (user: Omit<User, 'id'>): Promise<User> => requestJSON('/api/users', {
    method: 'POST',
    body: JSON.stringify(user),
});
export const deleteUser = (userId: number): Promise<{ success: boolean }> => requestJSON(`/api/users/${userId}`, {
    method: 'DELETE',
});

// --- Menu Items ---
export const addMenuItem = (item: Omit<MenuItem, 'id'>): Promise<MenuItem> => requestJSON('/api/menu-items', {
    method: 'POST',
    body: JSON.stringify(item),
});
export const updateMenuItem = (item: MenuItem): Promise<MenuItem> => requestJSON(`/api/menu-items/${item.id}`, {
    method: 'PUT',
    body: JSON.stringify(item),
});
export const deleteMenuItem = (id: number): Promise<{ success: boolean }> => requestJSON(`/api/menu-items/${id}`, {
    method: 'DELETE',
});

// --- Menu Categories ---
export const addMenuCategory = (name: string): Promise<MenuCategory> => requestJSON('/api/menu-categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
});
export const updateMenuCategory = (category: MenuCategory): Promise<MenuCategory> => requestJSON(`/api/menu-categories/${category.id}`, {
    method: 'PUT',
    body: JSON.stringify(category),
});
export const deleteMenuCategory = (id: number): Promise<{ success: boolean }> => requestJSON(`/api/menu-categories/${id}`, {
    method: 'DELETE',
});

// --- Sales ---
export const addSale = (order: Order, tableId: number, tableName: string, user: User): Promise<Sale> => requestJSON('/api/sales', {
    method: 'POST',
    body: JSON.stringify({ order, tableId, tableName, user }),
});
export const getSales = (): Promise<Sale[]> => requestJSON('/api/sales');

// --- History ---
export const addHistoryEntry = (tableId: number, details: string, user: User): Promise<any> => requestJSON('/api/history', {
    method: 'POST',
    body: JSON.stringify({ tableId, details, user }),
});
export const getHistory = (): Promise<any[]> => requestJSON('/api/history');

// --- Settings ---
// Note: getSettings is no longer needed as bootstrap handles it. Keeping it here won't cause harm.
export const getSettings = (): Promise<{ taxRate: number, tables: any[] }> => requestJSON('/api/settings');

// --- MODIFIED: updateTaxRate now points to the correct POST endpoint ---
export const updateTaxRate = (rate: number): Promise<{ success: boolean, newRate: number }> => requestJSON('/api/settings/tax', {
    method: 'POST',
    body: JSON.stringify({ rate }),
});

// --- Reordering Functions ---
export const reorderMenuCategories = (orderedIds: number[]): Promise<{ success: boolean }> => requestJSON('/api/menu-categories/reorder', {
    method: 'POST',
    body: JSON.stringify({ orderedIds }),
});

export const reorderMenuItems = (orderedIds: number[]): Promise<{ success: boolean }> => requestJSON('/api/menu-items/reorder', {
    method: 'POST',
    body: JSON.stringify({ orderedIds }),
});

// --- Reordering from CSV ---
export const reorderMenuItemsFromCSV = (file: File): Promise<{ success: boolean, reorderedCount: number, notFoundCount: number }> => {
    const formData = new FormData();
    formData.append('reorderFile', file);
    return requestFormData('/api/menu-items/reorder-from-csv', formData);
};

// --- ✅ NEW: ORDER TICKET FUNCTIONS (Blue P History) ✅ ---
export const saveOrderTicket = (ticketData: { tableId: number; tableName: string; userId: number; items: any[]; total: number }): Promise<any> => requestJSON('/api/order-tickets', {
    method: 'POST',
    body: JSON.stringify(ticketData),
});

export const getOrderTickets = (): Promise<any[]> => requestJSON('/api/order-tickets');

// --- Company Settings ---
export const updateCompanyInfo = (info: { name: string, nui: string, address: string, phone: string }): Promise<any> => requestJSON('/api/settings/company', {
    method: 'POST',
    body: JSON.stringify(info),
});

// --- Stock Management ---
export const addBulkStock = (movements: { itemId: number, quantity: number }[], reason: string, userId: number): Promise<any> => requestJSON('/api/stock/bulk-update', {
    method: 'POST',
    body: JSON.stringify({ movements, reason, userId }),
});

export const addWaste = (itemId: number, quantity: number, reason: string, userId: number): Promise<any> => requestJSON('/api/stock/waste', {
    method: 'POST',
    body: JSON.stringify({ itemId, quantity, reason, userId }),
});

export const getStockMovements = (itemId: number): Promise<any> => requestJSON(`/api/stock/movements/${itemId}`);