import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, MenuItem, Sale, Order, Table, UserRole, MenuCategory, HistoryEntry, OrderItem, CompanyInfo, StockUpdateItem, Section } from '../types';
import * as api from '../utils/api';
import { io, Socket } from 'socket.io-client';

// Ensure API URL works dynamically based on the environment (Dev vs Prod)
const getBackendUrl = () => {
  // 1. Use explicit Env Var if set
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  const hostname = window.location.hostname;
  const frontendPort = window.location.port;

  // 2. Dev Environment: If Frontend is 4000, Backend is 4001
  if (frontendPort === '4000') {
    return `http://${hostname}:4001`;
  }

  // 3. Prod Environment: If Frontend is 3000 (or anything else), Backend is 3001
  return `http://${hostname}:3001`;
};

const SOCKET_URL = getBackendUrl();
const isBackendConfigured = true;

interface OrderToPrint { table: Table; newItems: OrderItem[]; }

interface PosContextState {
  isLoading: boolean; isOnline: boolean; loggedInUser: User | null;
  activeScreen: 'pos' | 'sales' | 'admin' | 'stock';
  setActiveScreen: (screen: 'pos' | 'sales' | 'admin' | 'stock') => void;
  login: (pin: string) => Promise<boolean>; logout: () => void; users: User[];
  addUser: (user: Omit<User, 'id'>) => Promise<void>; deleteUser: (userId: number) => Promise<boolean>;
  menuItems: MenuItem[]; addMenuItem: (item: Omit<MenuItem, 'id'>) => Promise<void>;
  updateMenuItem: (item: MenuItem) => Promise<void>; deleteMenuItem: (id: number) => Promise<void>;
  importMenuItemsFromCSV: (file: File) => Promise<{ itemsAdded: number, categoriesAdded: number, itemsSkipped: number }>;
  reorderMenuItemsFromCSV: (file: File) => Promise<{ success: boolean, reorderedCount: number, notFoundCount: number }>;
  reorderMenuItems: (items: MenuItem[]) => Promise<void>; menuCategories: MenuCategory[];
  addMenuCategory: (name: string) => Promise<void>; updateMenuCategory: (category: MenuCategory) => Promise<void>;
  deleteMenuCategory: (id: number) => Promise<void>; reorderMenuCategories: (categories: MenuCategory[]) => Promise<void>;
  sales: Sale[]; addSale: (order: Order, tableId: number) => Promise<void>; saleToPrint: Sale | null;
  setSaleToPrint: React.Dispatch<React.SetStateAction<Sale | null>>; orderToPrint: OrderToPrint | null;
  setOrderToPrint: React.Dispatch<React.SetStateAction<OrderToPrint | null>>; tables: Table[];
  setTableCount: (count: number) => void; updateOrderForTable: (tableId: number, order: Order | null) => void;
  tablesPerRow: number; setTablesPerRow: (count: number) => void; taxRate: number;
  setTaxRate: (rate: number) => Promise<void>; history: HistoryEntry[];
  saveOrderForTable: (tableId: number, updatedOrder: Order | null, newItems: OrderItem[]) => Promise<void>;
  refreshSalesFromServer: () => Promise<void>;
  companyInfo: CompanyInfo;
  updateCompanySettings: (info: CompanyInfo) => Promise<void>;
  addBulkStock: (movements: StockUpdateItem[], reason: string, type?: 'supply' | 'correction') => Promise<void>;
  addWaste: (itemId: number, quantity: number, reason: string, type?: 'waste' | 'correction') => Promise<void>;
  operationalDayStartHour: number;
  updateOperationalDayStartHour: (hour: number) => Promise<void>;

  // Sections & Tables Management
  sections: Section[];
  allSectionConfig: { isHidden: boolean; isDefault: boolean; customName: string };
  addSection: (name: string) => Promise<void>;
  updateSectionName: (id: number | 'all', name: string) => Promise<void>;
  toggleSectionVisibility: (id: number | 'all') => void; // Updated Type
  setSectionDefault: (id: number | 'all') => void;       // Updated Type
  deleteSection: (id: number) => Promise<void>;
  // Tables
  addTable: (name: string, sectionId: number | null) => Promise<void>;
  updateTable: (id: number, name: string, sectionId: number | null) => Promise<void>;
  deleteTable: (id: number) => Promise<void>;
  // Updated to accept optional itemIds
  transferTable: (sourceId: number, destId: number, itemIds?: string[]) => Promise<void>;
}

const PosContext = createContext<PosContextState | undefined>(undefined);

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- STATE DEFINITIONS ---
  const [activeScreen, setActiveScreen] = useState<'pos' | 'sales' | 'admin' | 'stock'>('pos');
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  // Removed isSyncing
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [serverSections, setServerSections] = useState<Section[]>([]);
  const [sectionPrefs, setSectionPrefs] = useState<Record<string, any>>({}); // The new source of truth for local prefs

  // We compute the final 'sections' by merging Server Data + React State
  const { sections, allSectionConfig } = useMemo(() => {
    const localPrefs = sectionPrefs; // Read from React state, not localStorage

    const computedSections = serverSections.map(s => ({
      ...s,
      isHidden: localPrefs[s.id]?.isHidden ?? false,
      isDefault: localPrefs[s.id]?.isDefault ?? false
    }));

    const allConfig = {
      isHidden: localPrefs['all']?.isHidden ?? false,
      isDefault: localPrefs['all']?.isDefault ?? false,
      customName: localPrefs['all']?.customName || ''
    };

    return { sections: computedSections, allSectionConfig: allConfig };
  }, [serverSections, sectionPrefs]); // Depend on the new state variable
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);
  const [orderToPrint, setOrderToPrint] = useState<OrderToPrint | null>(null);

  // Initialize tables immediately if possible, but it will be overwritten by useEffect
  const [tables, setTables] = useState<Table[]>([]);

  // --- Smart Default for Tables Per Row ---
  const isMobile = useMemo(() => window.innerWidth <= 768, []);
  const defaultTablesPerRow = isMobile ? 5 : 10;
  // ---

  const [tablesPerRow, setTablesPerRowState] = useState<number>(defaultTablesPerRow);
  const [taxRate, setTaxRateState] = useState<number>(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [operationalDayStartHour, setOperationalDayStartHour] = useState<number>(5); // Default to 5 AM
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: '', nui: '', address: '', phone: '' });
  const startupEffectRan = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  // --- 1. AUTO-SAVE ACTIVE TABLES ---
  useEffect(() => {
    if (tables.length > 0) {
      localStorage.setItem('activeTables', JSON.stringify(tables));
    }
  }, [tables]);

  // --- 2. SET TABLE COUNT ---
  const setTableCount = useCallback((count: number) => {
    if (!count || count < 1) {
      console.warn("Attempted to set table count to 0. Defaulting to 50.");
      count = 50;
    }

    localStorage.setItem('tableCount', count.toString());

    setTables(prevTables => {
      const newTables = Array.from({ length: count }, (_, i) => {
        const tableId = i + 1;
        const existingTable = prevTables.find(t => t.id === tableId);
        if (existingTable && existingTable.order) {
          return existingTable;
        }
        return { id: tableId, name: `${tableId}`, order: null };
      });
      return newTables;
    });

    if (isBackendConfigured && navigator.onLine) {
      fetch(`${SOCKET_URL}/api/settings/table-count`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count })
      }).catch(err => console.error("Failed to save table count:", err));
    }
  }, []);

  // --- ONLINE ONLY: NO DB FALLBACK ---
  const fetchAndCacheData = useCallback(async () => {
    if (!isBackendConfigured) return;
    try {
      // --- UPDATED DESTRUCTURING to include activeOrders ---
      let {
        users: serverUsers,
        menuItems: serverItems,
        menuCategories: serverCats,
        sections: serverSections,
        tables: serverTables,
        activeOrders, // <--- SERVER TRUTH
        taxRate,
        tableCount,
        companyInfo: serverCompanyInfo,
        operationalDayStartHour: serverStartHour,
        allTablesCustomName
      } = await api.bootstrap();

      // NEW: Update state with the synced custom name
      if (typeof allTablesCustomName === 'string') {
        setSectionPrefs(currentPrefs => ({
          ...currentPrefs,
          'all': { ...(currentPrefs['all'] || {}), customName: allTablesCustomName }
        }));
      }

      if (serverCompanyInfo) setCompanyInfo(serverCompanyInfo);
      if (typeof serverStartHour === 'number') setOperationalDayStartHour(serverStartHour);

      // 1. SET SECTIONS (Raw server data only)
      setServerSections(serverSections || []);

      // --- HELPER: Resolve Order from Server DB ---
      const activeOrderMap = new Map();
      if (Array.isArray(activeOrders)) {
        activeOrders.forEach((ao: any) => activeOrderMap.set(String(ao.table_id), ao));
      }

      const resolveTableOrder = (tableId: number) => {
        const dbOrder = activeOrderMap.get(String(tableId));
        if (dbOrder) {
          try {
            const items = typeof dbOrder.items === 'string' ? JSON.parse(dbOrder.items) : dbOrder.items;
            const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
            const calculatedTax = subtotal * (typeof taxRate === 'number' ? taxRate : 0);

            return {
              items,
              subtotal,
              tax: calculatedTax,
              total: subtotal + calculatedTax,
              sessionUuid: dbOrder.session_uuid // <--- IDEMPOTENCY KEY
            } as Order;
          } catch (e) {
            console.error(`Failed to parse order for table ${tableId}`, e);
            return null;
          }
        }
        return null;
      };

      // 2. SMART TABLE INIT (Server Authority)
      if (serverTables && serverTables.length > 0) {
        console.log(`📥 Loaded ${serverTables.length} explicit tables from DB.`);
        setTables(prevTables => {
          return serverTables.map((st: any) => {
            return {
              id: st.id,
              name: st.name,
              sectionId: st.section_id,
              order: resolveTableOrder(st.id) // <--- Load from DB
            };
          });
        });
      }
      else if (typeof tableCount === 'number' && tableCount > 0) {
        const currentLocal = parseInt(localStorage.getItem('tableCount') || '0', 10);
        // Sync Table Count from DB
        localStorage.setItem('tableCount', tableCount.toString());
        setTables(prevTables => {
          return Array.from({ length: tableCount }, (_, i) => {
            const tableId = i + 1;
            return {
              id: tableId,
              name: `${tableId}`,
              order: resolveTableOrder(tableId) // <--- Load from DB
            };
          });
        });
      }

      const salesData = await api.getSales();
      const historyData = await api.getHistory();

      // --- UPDATE STATE DIRECTLY (No DB Queue Logic) ---
      setUsers(serverUsers);
      const sortedServerItems = [...serverItems].sort((a, b) => {
        if (a.display_order === null && b.display_order === null) return 0;
        if (a.display_order === null) return 1;
        if (b.display_order === null) return -1;
        return a.display_order - b.display_order;
      });
      setMenuItems(sortedServerItems);
      setMenuCategories(serverCats);
      setTaxRateState(typeof taxRate === 'number' && isFinite(taxRate) ? taxRate : 0);
      setSales(salesData.map(s => ({ ...s, date: new Date(s.date) })));
      setHistory(historyData.map(h => ({ ...h, timestamp: new Date(h.timestamp) })));

      setIsOnline(true);
    } catch (error) {
      console.error("--- SERVER FETCH FAILED ---", error);
      setIsOnline(false);
      // NO FALLBACK: We deliberately show that we are offline/error state.
    }
  }, []);

  const addHistoryEntry = useCallback(async (tableId: number, details: string) => {
    if (!loggedInUser) return;
    // We optimistically update state, but don't save to DB. 
    // Usually this is triggered by an API action that saves history on server.
    const newEntry: HistoryEntry = { id: `hist-${Date.now()}`, tableId, timestamp: new Date(), user: loggedInUser, details };
    setHistory(prev => [newEntry, ...prev]);
  }, [loggedInUser]);

  const setTaxRate = useCallback(async (ratePercent: number) => {
    const newRate = Math.max(0, ratePercent) / 100;
    try {
      await api.updateTaxRate(newRate); // Direct API Call
      setTaxRateState(newRate);
      await addHistoryEntry(0, `Tax rate updated to ${ratePercent}%`);
    } catch (e) {
      console.error("Failed to update tax rate", e);
    }
  }, [addHistoryEntry]);

  const updateCompanySettings = useCallback(async (info: CompanyInfo) => {
    setCompanyInfo(info);
    if (isOnline && isBackendConfigured) {
      try {
        await api.updateCompanyInfo(info);
      } catch (error) {
        console.error('Failed to update company info:', error);
      }
    } else {
      console.warn('Saving company info is online-only for now');
    }
  }, [isOnline]);

  const updateOperationalDayStartHour = useCallback(async (hour: number) => {
    setOperationalDayStartHour(hour);
    if (isOnline && isBackendConfigured) {
      try {
        await api.updateOperationalDayStartHour(hour);
        await addHistoryEntry(0, `Operational day start hour set to ${hour}:00`);
      } catch (error) { console.error('Failed to update operational day start hour:', error); }
    }
  }, [isOnline, addHistoryEntry]);

  // --- SECTIONS & TABLES MANAGEMENT (Online Only for Config Safety) ---

  const addSection = useCallback(async (name: string) => {
    try {
      const res = await fetch(`${SOCKET_URL}/api/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const newSection = await res.json();
      setServerSections(prev => [...prev, newSection]);
    } catch (e) { console.error("Failed to add section", e); }
  }, []);

  // A. Update Section Name (Server for standard, AND now for 'all')
  const updateSectionName = useCallback(async (id: number | 'all', name: string) => {
    if (id === 'all') {
      // Now saves to server via the new generic endpoint
      await fetch(`${SOCKET_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'all_tables_custom_name', value: name })
      });
      // The server will broadcast the change via socket, no need for optimistic update
    } else {
      try {
        setServerSections(prev => prev.map(s => s.id === id ? { ...s, name } : s));
        await fetch(`${SOCKET_URL}/api/sections/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
      } catch (e) { console.error("Failed to update section name", e); fetchAndCacheData(); }
    }
  }, [fetchAndCacheData]);

  // B. Local Visibility Toggle
  const toggleSectionVisibility = useCallback((id: number | 'all') => {
    setSectionPrefs(currentPrefs => {
      const key = String(id);
      const newPrefs = { ...currentPrefs }; // Create a shallow copy
      const currentSettings = newPrefs[key] || {};

      newPrefs[key] = { ...currentSettings, isHidden: !currentSettings.isHidden };

      localStorage.setItem('sectionPreferences', JSON.stringify(newPrefs));
      return newPrefs;
    });
  }, []);

  // C. Local Default Toggle
  const setSectionDefault = useCallback((id: number | 'all') => {
    setSectionPrefs(currentPrefs => {
      const newPrefs: Record<string, any> = {};

      // Step 1: Copy all preferences and set their isDefault to false
      for (const key in currentPrefs) {
        if (Object.prototype.hasOwnProperty.call(currentPrefs, key)) {
          newPrefs[key] = { ...currentPrefs[key], isDefault: false };
        }
      }

      const keyForDefault = String(id);

      // Step 2: Set the target key's isDefault to true, preserving other properties
      const existingTargetPrefs = newPrefs[keyForDefault] || {};
      newPrefs[keyForDefault] = { ...existingTargetPrefs, isDefault: true };

      localStorage.setItem('sectionPreferences', JSON.stringify(newPrefs));
      return newPrefs;
    });
  }, []);

  const deleteSection = useCallback(async (id: number) => {
    try {
      // 1. Delete from Server
      await fetch(`${SOCKET_URL}/api/sections/${id}`, { method: 'DELETE' });

      // 2. Remove from Local State
      setServerSections(prev => prev.filter(s => s.id !== id));

      // 3. Clean up Local Preferences State and localStorage
      setSectionPrefs(currentPrefs => {
        const key = String(id);
        const newPrefs = { ...currentPrefs };
        if (newPrefs[key]) {
          delete newPrefs[key];
          localStorage.setItem('sectionPreferences', JSON.stringify(newPrefs));
        }
        return newPrefs;
      });

      // 4. Refresh table data to handle any tables that were in the deleted section
      await fetchAndCacheData();
    } catch (e) { console.error("Failed to delete section", e); }
  }, [fetchAndCacheData]);

  const addTable = useCallback(async (name: string, sectionId: number | null) => {
    try {
      const res = await fetch(`${SOCKET_URL}/api/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sectionId })
      });
      const newDbTable = await res.json();
      // Convert snake_case to camelCase and add order:null
      const newTable: Table = {
        id: newDbTable.id,
        name: newDbTable.name,
        sectionId: newDbTable.section_id,
        order: null
      };
      setTables(prev => [...prev, newTable]);
    } catch (e) { console.error("Failed to add table", e); }
  }, []);

  const updateTable = useCallback(async (id: number, name: string, sectionId: number | null) => {
    // Pessimistic Update: We wait for the server's response before changing the state.
    try {
      const res = await fetch(`${SOCKET_URL}/api/tables/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sectionId })
      });

      if (!res.ok) {
        const errorData = await res.json();
        // Throw an error that the component can catch and display
        throw new Error(errorData.message || `Server responded with status ${res.status}`);
      }

      const updatedDbTable = await res.json();

      // --- SUCCESS ---
      // Only update the state after a successful response from the server.
      setTables(prev => prev.map(t =>
        t.id === id
          ? { ...t, name: updatedDbTable.name, sectionId: updatedDbTable.section_id }
          : t
      ));
    } catch (e) {
      console.error("Failed to update table:", e);
      // Re-throw the error so the calling component (TableManager) knows about the failure.
      throw e;
    }
  }, []);

  const deleteTable = useCallback(async (id: number) => {
    try {
      await fetch(`${SOCKET_URL}/api/tables/${id}`, { method: 'DELETE' });
      setTables(prev => prev.filter(t => t.id !== id));
    } catch (e) { console.error("Failed to delete table", e); }
  }, []);

  const transferTable = useCallback(async (sourceId: number, destId: number, itemIds?: string[]) => {
    try {
      const payload = {
        sourceTableId: sourceId,
        destTableId: destId,
        transferItemIds: itemIds // Optional: If missing, does full transfer
      };

      const res = await fetch(`${SOCKET_URL}/api/active-orders/transfer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Transfer failed');
      }
      // Success: Socket will handle the update via 'active-orders-updated'
    } catch (e) {
      console.error("Transfer failed", e);
      throw e;
    }
  }, []);

  const login = useCallback(async (pin: string): Promise<boolean> => {
    // SECURITY UPDATE: We no longer store PINs in the browser.
    // We must ask the server to verify the PIN every time.
    try {
      if (!navigator.onLine) {
        alert("Nuk jeni të lidhur me rrjetin. Identifikimi kërkon serverin.");
        return false;
      }

      const response = await api.login(pin);
      if (response && response.user) {
        setLoggedInUser(response.user);
        return true;
      }
    } catch (e) {
      console.error("Login failed:", e);
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setLoggedInUser(null);
    setActiveScreen('pos');
  }, []);

  // ADD THE FOLLOWING FUNCTION DIRECTLY AFTER IT:
  const handleAutoLogout = useCallback(() => {
    const isEnabled = localStorage.getItem('autoLogoutAfterAction') === 'true';
    if (isEnabled) {
      // Use a small delay to ensure other operations like printing are triggered first
      setTimeout(() => {
        logout();
      }, 500);
    }
  }, [logout]);

  const addUser = useCallback(async (userData: Omit<User, 'id'>) => {
    try {
      await api.addUser(userData); // Direct API
      // We rely on socket/refresh, or we can manually refetch. 
      // For simplicity in this online-model, we refetch to get the real ID.
      await fetchAndCacheData();
    } catch (e) { console.error("Add user failed", e); }
  }, [fetchAndCacheData]);

  const deleteUser = useCallback(async (userId: number): Promise<boolean> => {
    try {
      await api.deleteUser(userId); // Direct API
      setUsers(prev => prev.filter(u => u.id !== userId));
      return true;
    } catch (e) { console.error("Delete user failed", e); return false; }
  }, []);

  // --- MENU MANAGEMENT (Direct API) ---
  const addMenuItem = useCallback(async (itemData: Omit<MenuItem, 'id'>) => {
    try {
      const serverItem = await api.addMenuItem(itemData);
      setMenuItems((prev) => [...prev, serverItem]);
    } catch (e) { console.error("Add menu item failed", e); }
  }, []);

  const updateMenuItem = useCallback(async (updatedItem: MenuItem) => {
    try {
      await api.updateMenuItem(updatedItem);
      // Smart State Update (Siblings)
      setMenuItems((prev) => prev.map((item) => {
        if (item.id === updatedItem.id) return updatedItem;
        if (updatedItem.stockGroupId &&
          item.stockGroupId === updatedItem.stockGroupId &&
          updatedItem.trackStock) {
          return { ...item, stock: updatedItem.stock };
        }
        return item;
      }));
    } catch (e) { console.error("Update menu item failed", e); }
  }, []);

  const deleteMenuItem = useCallback(async (id: number) => {
    try {
      await api.deleteMenuItem(id);
      setMenuItems(prev => prev.filter(item => item.id !== id));
    } catch (e) { console.error("Delete menu item failed", e); }
  }, []);

  const addMenuCategory = useCallback(async (name: string) => {
    try {
      await api.addMenuCategory(name);
      fetchAndCacheData(); // Refetch to get ID
    } catch (e) { console.error("Add category failed", e); }
  }, [fetchAndCacheData]);

  const updateMenuCategory = useCallback(async (updatedCategory: MenuCategory) => {
    try {
      await api.updateMenuCategory(updatedCategory);
      setMenuCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c));
    } catch (e) { console.error("Update category failed", e); }
  }, []);

  const deleteMenuCategory = useCallback(async (id: number) => {
    try {
      await api.deleteMenuCategory(id);
      setMenuCategories(prev => prev.filter(c => c.id !== id));
    } catch (e) { console.error("Delete category failed", e); }
  }, []);

  const reorderMenuCategories = useCallback(async (categories: MenuCategory[]) => {
    setMenuCategories(categories);
    // Note: We need a backend endpoint for category reordering if we want this to persist
  }, []);

  const reorderMenuItems = useCallback(async (items: MenuItem[]) => {
    const updatedItems = items.map((item, index) => ({
      ...item,
      display_order: index + 1
    }));
    setMenuItems(updatedItems);
    if (isBackendConfigured) {
      const orderedIds = updatedItems.map(item => item.id);
      try {
        await fetch(`${SOCKET_URL}/api/menu-items/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds })
        });
      } catch (error) { console.error('Failed to sync reorder:', error); }
    }
  }, []);

  const refreshSalesFromServer = useCallback(async () => {
    try {
      const serverSales = await api.getSales();
      setSales(serverSales.map(s => ({ ...s, date: new Date(s.date) })));
    } catch (error) { console.error('Failed to refresh sales:', error); }
  }, []);

  // --- UPDATED: Order Logic (Direct to Server) ---
  const updateOrderForTable = useCallback((tableId: number, order: Order | null, emitToSocket = true) => {
    setTables(currentTables => {
      return currentTables.map(table =>
        table.id === tableId ? { ...table, order } : table
      );
    });

    if (emitToSocket && socketRef.current?.connected) {
      console.log(`📡 Sending update for Table ${tableId} to Server`);
      socketRef.current.emit('client-order-update', { tableId, order });
    }
  }, []);

  const saveOrderForTable = useCallback(async (tableId: number, updatedOrder: Order | null, newItems: OrderItem[]) => {

    // --- IDEMPOTENCY FIX: Generate Session UUID ---
    if (updatedOrder) {
      const currentTable = tables.find(t => t.id === tableId);
      const existingUuid = (currentTable?.order as any)?.sessionUuid;
      const newUuid = (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : (Date.now().toString(36) + Math.random().toString(36).substr(2));

      (updatedOrder as any).sessionUuid = existingUuid || newUuid;
    }

    // 1. Update the "Active" state
    updateOrderForTable(tableId, updatedOrder, true);

    // 2. CREATE HISTORY TICKET (For Admin "Blue P")
    if (newItems.length > 0 && loggedInUser) {
      const table = tables.find(t => t.id === tableId);

      // Calculate the total cost of ONLY the new items being sent
      const ticketTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const ticketPayload = {
        tableId: tableId,
        tableName: table ? table.name : `${tableId}`,
        userId: loggedInUser.id,
        items: newItems,
        total: ticketTotal
      };

      // Save to DB
      if (isBackendConfigured && navigator.onLine) {
        try {
          const savedTicket = await api.saveOrderTicket(ticketPayload);
          // Emit so Admin updates instantly
          if (socketRef.current?.connected) {
            socketRef.current.emit('ticket-created', savedTicket);
          }
        } catch (e) {
          console.error("Failed to save order ticket to DB:", e);
          // Optional: queue for offline sync if you want strict offline support for this feature
        }
      }

      // 3. PRINTING (Existing Logic)
      const uniquePrintId = `${tableId}-${Date.now()}`;
      const printPayload = {
        printId: uniquePrintId,
        tableName: table ? table.name : `${tableId}`,
        user: loggedInUser,
        items: newItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        }))
      };

      // --- START: Add this block ---
      setTimeout(() => {
        // REMOVED: const isStation = localStorage.getItem('isPrintStation') === 'true';
        const isOrderTicketPrintingEnabled = localStorage.getItem('isOrderTicketPrintingEnabled') !== 'false'; // Default to true

        // LOGIC CHANGE: We removed '&& isStation'. Now any device can request a print if the toggle is ON.
        if (socketRef.current?.connected && isOrderTicketPrintingEnabled) {
          socketRef.current.emit('print-order-ticket', printPayload);
        }
      }, 200);
      // --- END: Add this block ---
    }
    handleAutoLogout();

  }, [tables, updateOrderForTable, loggedInUser, isOnline, handleAutoLogout]);



  // --- SALE LOGIC (Direct API) ---
  const addSale = useCallback(async (order: Order, tableId: number) => {
    if (!loggedInUser) return;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    try {
      // 1. Send to Server (Authoritative)
      await api.addSale(order, table.id, table.name, loggedInUser);

      // 2. Clear Local Table State (Socket will likely do this too, but for UI responsiveness we do it here)
      updateOrderForTable(tableId, null, false); // false = don't emit 'update', the server knows we sold it
      await addHistoryEntry(tableId, `Fatura u finalizua...`);

      // 3. UI Stock Updates (Visual Only - Refresh cleans it up)
      const deductions = new Map<string | number, number>();
      for (const saleItem of order.items) {
        const realItem = menuItems.find(i => i.id === saleItem.id);
        if (!realItem || !realItem.trackStock) continue;
        const key = realItem.stockGroupId ? realItem.stockGroupId : realItem.id;
        deductions.set(key, (deductions.get(key) || 0) + saleItem.quantity);
      }
      setMenuItems(prev => {
        const nextState = prev.map(item => ({ ...item }));
        deductions.forEach((qtyToRemove, key) => {
          if (typeof key === 'string') {
            const sampleItem = nextState.find(i => i.stockGroupId === key);
            if (sampleItem && isFinite(sampleItem.stock)) {
              const newStock = Math.max(0, sampleItem.stock - qtyToRemove);
              nextState.forEach(i => { if (i.stockGroupId === key) i.stock = newStock; });
            }
          } else {
            const target = nextState.find(i => i.id === key);
            if (target && isFinite(target.stock)) target.stock = Math.max(0, target.stock - qtyToRemove);
          }
        });
        return nextState;
      });

      // 4. Print Logic (Via Socket)
      if (socketRef.current?.connected) {
        const isReceiptPrintingEnabled = localStorage.getItem('isReceiptPrintingEnabled') !== 'false';
        if (isReceiptPrintingEnabled) {
          // Construct a temporary sale object just for the printer
          const tempSale: Sale = { id: `sale-${Date.now()}`, date: new Date(), order, user: loggedInUser, tableId: table.id, tableName: table.name };
          socketRef.current.emit('print-sale-receipt', tempSale);
        }
      }

      handleAutoLogout();

    } catch (e) {
      console.error("Sale failed:", e);
      alert("Gabim gjatë finalizimit të faturës! Kontrolloni serverin.");
    }
  }, [loggedInUser, tables, menuItems, updateOrderForTable, addHistoryEntry, handleAutoLogout]);





  const setTablesPerRow = useCallback((count: number) => { localStorage.setItem('tablesPerRow', count.toString()); setTablesPerRowState(count); }, []);






  // --- REPLACEMENT CODE ---

  const importMenuItemsFromCSV = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${SOCKET_URL}/api/menu-items/import-csv`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();

      // Refresh local data to show new items immediately
      await fetchAndCacheData();

      return {
        itemsAdded: data.added || 0,
        categoriesAdded: 0,
        itemsSkipped: data.skipped || 0
      };
    } catch (error) {
      console.error("CSV Import failed:", error);
      throw error;
    }
  }, [fetchAndCacheData]);

  const reorderMenuItemsFromCSV = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('reorderFile', file);

    try {
      const response = await fetch(`${SOCKET_URL}/api/menu-items/reorder-from-csv`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();

      // Refresh local data to show new order
      await fetchAndCacheData();

      return {
        success: data.success,
        reorderedCount: data.reorderedCount || 0,
        notFoundCount: data.notFoundCount || 0
      };
    } catch (error) {
      console.error("Reorder import failed:", error);
      throw error;
    }
  }, [fetchAndCacheData]);


  // --- SOCKET CONNECTION (CLEAN - SERVER AUTHORITY) ---
  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling']
      });
    }
    const socket = socketRef.current;

    // Handlers
    const handleSaleFinalized = (newSaleData: Sale) => {
      // This function's only job is to add the new sale to the list for the reports screen.
      // Clearing the table is now handled by the 'active-orders-updated' event.
      setSales(prev => [newSaleData, ...prev]);
    };

    const handleSettingUpdated = ({ key, value }: { key: string, value: any }) => {
      if (key === 'all_tables_custom_name') {
        setSectionPrefs(currentPrefs => ({
          ...currentPrefs,
          'all': { ...(currentPrefs['all'] || {}), customName: value }
        }));
      }
    };

    // This is the new, authoritative handler for all table state changes
    const handleTablesReordered = () => {
      console.log('📢 Tables reordered. Refreshing data...');
      fetchAndCacheData();
    };

    const handleActiveOrdersUpdate = (activeOrders: any[]) => {
      console.log('📢 Received full active orders update from server.');
      // Create a map for quick lookups of server orders
      const activeOrderMap = new Map();
      activeOrders.forEach((ao: any) => activeOrderMap.set(String(ao.table_id), ao));

      setTables(currentTables => {
        return currentTables.map(table => {
          const serverOrderData = activeOrderMap.get(String(table.id));
          let newOrder: Order | null = null;

          if (serverOrderData) {
            // If the server has an order for this table, parse it
            try {
              const items = typeof serverOrderData.items === 'string' ? JSON.parse(serverOrderData.items) : serverOrderData.items;
              const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
              const calculatedTax = subtotal * taxRate; // Use the current client-side taxRate

              newOrder = {
                items,
                subtotal,
                tax: calculatedTax,
                total: subtotal + calculatedTax,
                sessionUuid: serverOrderData.session_uuid
              };
            } catch (e) {
              console.error(`Failed to parse incoming order for table ${table.id}`, e);
            }
          }
          // Return the table with the new order state (which will be null if the server didn't provide an order)
          return { ...table, order: newOrder };
        });
      });
    };

    // 3. Attach Listeners
    socket.off('connect');
    socket.off('active-orders-updated'); // Our new, single source of truth for table state
    socket.off('sale-finalized-from-server');
    socket.off('setting-updated');

    socket.on('connect', () => {
      console.log(`✅ SOCKET CONNECTED`);
    });

    // This one listener now handles all table state changes
    socket.on('active-orders-updated', handleActiveOrdersUpdate);

    // This listener is now only for updating the Sales/Reports screen
    socket.on('sale-finalized-from-server', handleSaleFinalized);
    socket.on('setting-updated', handleSettingUpdated);
    socket.on('tables-reordered', handleTablesReordered);

    return () => {
      socket.off('active-orders-updated', handleActiveOrdersUpdate);
      socket.off('sale-finalized-from-server', handleSaleFinalized);
      socket.off('setting-updated', handleSettingUpdated);
      socket.off('tables-reordered', handleTablesReordered);
    };
  }, []);

  // --- BOOTSTRAP (INIT) LOGIC ---
  useEffect(() => {
    if (startupEffectRan.current === true) { return; }

    const bootstrap = async () => {
      try {
        setIsLoading(true);

        // --- CLEANUP: Force Delete Old IndexedDB (Security Fix) ---
        // This ensures old PINs are removed from client browsers
        try {
          const dbs = await window.indexedDB.databases();
          const dbExists = dbs.some(db => db.name === 'pos_db');
          if (dbExists) {
            console.warn("⚠️ Old Database detected. Deleting for security...");
            window.indexedDB.deleteDatabase('pos_db');
            console.log("✅ Old Database deleted.");
          }
        } catch (e) {
          // Fallback for older browsers
          window.indexedDB.deleteDatabase('pos_db');
        }
        // ---------------------------------------------------------

        // Safe JSON Parse for Preferences
        try {
          const savedPrefs = localStorage.getItem('sectionPreferences');
          setSectionPrefs(savedPrefs ? JSON.parse(savedPrefs) : {});
        } catch (e) {
          setSectionPrefs({});
        }

        // 1. LOAD TABLES INIT (Visual Placeholder only)
        let countToLoad = parseInt(localStorage.getItem('tableCount') || '50', 10);
        if (!countToLoad || countToLoad < 1) countToLoad = 50;

        let initialTables: Table[] = Array.from({ length: countToLoad }, (_, i) => ({
          id: i + 1, name: `${i + 1}`, order: null
        }));
        setTables(initialTables);

        // Load Settings
        const savedTablesPerRow = localStorage.getItem('tablesPerRow');
        setTablesPerRowState(savedTablesPerRow ? parseInt(savedTablesPerRow, 10) : defaultTablesPerRow);

        // 2. FETCH DATA (Strict Online)
        if (isBackendConfigured && navigator.onLine) {
          await fetchAndCacheData();
        }

      } catch (fatalError) {
        console.error("CRITICAL BOOTSTRAP FAILURE:", fatalError);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
    startupEffectRan.current = true;

    const handleOnline = () => { setIsOnline(true); fetchAndCacheData(); }; // Re-fetch on reconnect
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchAndCacheData]);

  const addBulkStock = useCallback(async (movements: StockUpdateItem[], reason: string, type: 'supply' | 'correction' = 'supply') => {
    if (!loggedInUser) return;
    try {
      // Pass the type (defaults to 'supply' if not provided)
      await api.addBulkStock(movements, reason, loggedInUser.id, type);

      // CRITICAL: We must fetch from server to get the newly calculated "Weighted Average Cost".
      await fetchAndCacheData();

    } catch (e) {
      console.error("Bulk stock update failed", e);
      throw e;
    }
  }, [loggedInUser, fetchAndCacheData]);

  const addWaste = useCallback(async (itemId: number, quantity: number, reason: string, type: 'waste' | 'correction' = 'waste') => {
    if (!loggedInUser) return;
    try {
      // 1. Call API with type
      await api.addWaste(itemId, quantity, reason, loggedInUser.id, type);

      // 2. Update Local State (Decrease Stock)
      setMenuItems(prev => {
        const nextState = prev.map(item => ({ ...item }));
        const targetItem = nextState.find(i => i.id === itemId);

        if (targetItem) {
          if (targetItem.stockGroupId) {
            // Update all siblings
            nextState.forEach(i => {
              if (i.stockGroupId === targetItem.stockGroupId) {
                i.stock = Math.max(0, (i.stock || 0) - quantity);
              }
            });
          } else {
            // Update single item
            targetItem.stock = Math.max(0, (targetItem.stock || 0) - quantity);
          }
        }
        return nextState;
      });

      // No Local DB Update for Waste

    } catch (e) {
      console.error("Add waste failed", e);
      throw e;
    }
  }, [loggedInUser]);

  const value = useMemo(() => ({
    isLoading, isOnline, isSyncing: false, loggedInUser, activeScreen, setActiveScreen,
    users, menuItems, menuCategories, sales, saleToPrint,
    setSaleToPrint, orderToPrint, setOrderToPrint, tables, tablesPerRow, taxRate, history, login, logout, addUser, deleteUser, addMenuItem, updateMenuItem,
    deleteMenuItem, importMenuItemsFromCSV, reorderMenuItemsFromCSV, reorderMenuItems, addMenuCategory,
    updateMenuCategory, deleteMenuCategory, reorderMenuCategories, addSale, setTableCount, updateOrderForTable,
    setTablesPerRow, setTaxRate, saveOrderForTable,
    refreshSalesFromServer, companyInfo, updateCompanySettings, addBulkStock, addWaste,
    operationalDayStartHour, updateOperationalDayStartHour,
    sections, allSectionConfig, addSection, updateSectionName, toggleSectionVisibility, setSectionDefault, deleteSection,
    addTable, updateTable, deleteTable, transferTable
  }), [
    isLoading, isOnline, loggedInUser, activeScreen,
    users, menuItems, menuCategories, sales, saleToPrint,
    orderToPrint, tables, tablesPerRow, taxRate, history,
    login, logout, addUser, deleteUser, addMenuItem, updateMenuItem, deleteMenuItem, importMenuItemsFromCSV,
    reorderMenuItemsFromCSV, reorderMenuItems, addMenuCategory, updateMenuCategory, deleteMenuCategory,
    reorderMenuCategories, addSale, setTableCount, updateOrderForTable, setTablesPerRow,
    setTaxRate, saveOrderForTable,
    refreshSalesFromServer, companyInfo, updateCompanySettings, addBulkStock, addWaste,
    operationalDayStartHour, updateOperationalDayStartHour,
    sections, allSectionConfig, addSection, updateSectionName, toggleSectionVisibility, setSectionDefault, deleteSection,
    addTable, updateTable, deleteTable, transferTable
  ]);

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};

export const usePos = (): PosContextState => {
  const context = useContext(PosContext);
  if (context === undefined) { throw new Error('usePos must be used within a PosProvider'); }
  return context;
};