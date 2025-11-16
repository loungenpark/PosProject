import { MenuItem, Order, Sale, User, UserRole, MenuCategory } from "./types";


// --- ✅ START: MODIFIED API URL ✅ ---
// The old logic was causing all API requests to fail silently on the network.
// We are now forcing all API requests to go to the correct backend server address.
const API_URL = 'http://192.168.1.10:3001';
// --- ✅ END: MODIFIED API URL ✅ ---


// Standard request function for JSON APIs
async function requestJSON(endpoint: string, options: RequestInit = {}) {
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
        console.error(`Network Error on ${endpoint}:`, error);
        throw new Error('Network error. Could not connect to the server.');
    }
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

// Special request function for FormData (file uploads)
async function requestFormData(endpoint: string, formData: FormData) {
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
        console.error(`Network Error on ${endpoint}:`, error);
        throw new Error('Network error. Could not connect to the server.');
    }
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

// --- Auth ---
export const login = (pin: string): Promise<{user: User | null}> => requestJSON('/api/login', {
    method: 'POST',
    body: JSON.stringify({ pin }),
});

// --- MODIFIED: Bootstrap return type now includes taxRate ---
export const bootstrap = (): Promise<{ users: User[], menuItems: MenuItem[], menuCategories: MenuCategory[], taxRate: number }> => requestJSON('/api/bootstrap');

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