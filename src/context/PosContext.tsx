import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, MenuItem, Sale, Order, Table, UserRole, MenuCategory, HistoryEntry, OrderItem, CompanyInfo, StockUpdateItem, Section  } from '../types';
import * as db from '../utils/db';
import * as api from '../utils/api';
import { io, Socket } from 'socket.io-client';

// Ensure API URL works on phones (dynamic IP)
const SOCKET_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
const isBackendConfigured = true;

interface OrderToPrint { table: Table; newItems: OrderItem[]; }

interface PosContextState {
  isLoading: boolean; isOnline: boolean; isSyncing: boolean; loggedInUser: User | null;
  activeScreen: 'pos' | 'sales' | 'admin';
  setActiveScreen: (screen: 'pos' | 'sales' | 'admin') => void;
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
  tablesPerRow: number; setTablesPerRow: (count: number) => void; tableSizePercent: number;
  setTableSizePercent: (size: number) => void; tableButtonSizePercent: number;
  setTableButtonSizePercent: (size: number) => void; taxRate: number;
  setTaxRate: (rate: number) => Promise<void>; history: HistoryEntry[];
  saveOrderForTable: (tableId: number, updatedOrder: Order | null, newItems: OrderItem[]) => Promise<void>;
  refreshSalesFromServer: () => Promise<void>;
  companyInfo: CompanyInfo;
  updateCompanySettings: (info: CompanyInfo) => Promise<void>;
  addBulkStock: (movements: StockUpdateItem[], reason: string) => Promise<void>;
  addWaste: (itemId: number, quantity: number, reason: string) => Promise<void>;
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
}

const PosContext = createContext<PosContextState | undefined>(undefined);

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- STATE DEFINITIONS ---
  const [activeScreen, setActiveScreen] = useState<'pos' | 'sales' | 'admin'>('pos');
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
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
  
  const [tablesPerRow, setTablesPerRowState] = useState<number>(5);
  const [tableSizePercent, setTableSizePercentState] = useState<number>(100);
  const [tableButtonSizePercent, setTableButtonSizePercentState] = useState<number>(100);
  const [taxRate, setTaxRateState] = useState<number>(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [operationalDayStartHour, setOperationalDayStartHour] = useState<number>(5); // Default to 5 AM
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: '', nui: '', address: '', phone: '' });
  const syncInProgress = useRef(false);
  const startupEffectRan = useRef(false);

  // We consider "Desktop" or non-mobile to be the potential "Master" (usually the Admin/Cashier PC)
  const isMasterClient = useRef(window.innerWidth > 900 || !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  
  // Ref to keep track of tables for Socket callbacks without dependency cycles
  const tablesRef = useRef<Table[]>([]); 
  const socketRef = useRef<Socket | null>(null);
  
  // --- 1. AUTO-SAVE ACTIVE TABLES & UPDATE REF ---
  useEffect(() => {
    tablesRef.current = tables; // Update ref for socket access
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

  const loadDataFromDb = useCallback(async () => {
    const [dbUsers, dbMenuItems, dbMenuCategories, dbSales, dbHistory] = await Promise.all([
        db.getAll<User>('users'), db.getAll<MenuItem>('menuItems'), db.getAll<MenuCategory>('menuCategories'),
        db.getAll<Sale>('sales'), db.getAll<HistoryEntry>('history'),
    ]);
    setUsers(dbUsers); 
    const sortedDbMenuItems = [...dbMenuItems].sort((a, b) => {
      if (a.display_order === null && b.display_order === null) return 0;
      if (a.display_order === null) return 1;
      if (b.display_order === null) return -1;
      return a.display_order - b.display_order;
    });
    setMenuItems(sortedDbMenuItems); 
    setMenuCategories(dbMenuCategories);
    setSales(dbSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setHistory(dbHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  }, []);

  const fetchAndCacheData = useCallback(async () => {
    if (!isBackendConfigured) return;
    try {
      // --- UPDATED DESTRUCTURING to include sections and tables ---
      let { 
          users: serverUsers, 
          menuItems: serverItems, 
          menuCategories: serverCats, 
          sections: serverSections, 
          tables: serverTables,
          taxRate, 
          tableCount, 
          companyInfo: serverCompanyInfo, 
          operationalDayStartHour: serverStartHour,
          allTablesCustomName // NEW: Get custom name from server
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

      // 2. SMART TABLE INIT
      // Check if we have Explicit Tables from DB (Sections Mode)
      if (serverTables && serverTables.length > 0) {
          console.log(`📥 Loaded ${serverTables.length} explicit tables from DB.`);
          
          setTables(prevTables => {
              // Map server tables to local state, preserving active orders if IDs match
              return serverTables.map((st: any) => {
                  const existing = prevTables.find(t => t.id === st.id);
                  return {
                      id: st.id,
                      name: st.name,
                      sectionId: st.section_id, // Map snake_case from DB to camelCase
                      order: existing ? existing.order : null
                  };
              });
          });
      } 
      else if (typeof tableCount === 'number' && tableCount > 0) {
          // Fallback: Legacy Numeric Mode
          const currentLocal = parseInt(localStorage.getItem('tableCount') || '0', 10);
          // Only force update if count changed or we have no tables
          if (tableCount !== currentLocal || tables.length === 0) {
              console.log(`📥 Syncing Table Count from DB: ${tableCount}`);
              localStorage.setItem('tableCount', tableCount.toString());
              setTables(prevTables => {
                  return Array.from({ length: tableCount }, (_, i) => {
                      const tableId = i + 1;
                      const existing = prevTables.find(t => t.id === tableId);
                      return existing || { id: tableId, name: `${tableId}`, order: null };
                  });
              });
          }
      }
          
          const salesData = await api.getSales();
          const historyData = await api.getHistory();
          const queue = await db.getSyncQueue();

          if (queue.length > 0) {
            queue.forEach(action => {
              const tempId = Date.now() + Math.floor(Math.random() * 1000);
              switch (action.type) {
                case 'DELETE_USER': serverUsers = serverUsers.filter(u => u.id !== action.payload.userId); break;
                case 'DELETE_MENU_ITEM': serverItems = serverItems.filter(i => i.id !== action.payload.id); break;
                case 'DELETE_MENU_CATEGORY': serverCats = serverCats.filter(c => c.id !== action.payload.id); break;
                case 'ADD_USER': if (!serverUsers.some(u => u.pin === action.payload.pin)) serverUsers.push({ ...action.payload, id: tempId }); break;
                case 'ADD_MENU_ITEM': serverItems.push({ ...action.payload, id: tempId }); break;
                case 'ADD_MENU_CATEGORY': serverCats.push({ ...action.payload, id: tempId }); break;
                case 'UPDATE_MENU_ITEM': serverItems = serverItems.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i); break;
                case 'SET_TAX_RATE': taxRate = action.payload.rate; break;
              }
            });
          }

          await db.clearStaticData();
          await Promise.all([
            db.bulkPut(serverUsers, 'users'), 
            db.bulkPut(serverItems, 'menuItems'), 
            db.bulkPut(serverCats, 'menuCategories')
          ]);

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
          setSales(salesData.map(s => ({...s, date: new Date(s.date)})));
          setHistory(historyData.map(h => ({...h, timestamp: new Date(h.timestamp)})));
          
          setIsOnline(true);
      } catch (error) { 
          console.error("--- SERVER FETCH FAILED ---", error); 
          setIsOnline(false); 
          await loadDataFromDb(); 
      }
    }, [loadDataFromDb]);

  const syncOfflineData = useCallback(async () => {
    if (syncInProgress.current || !isBackendConfigured) return;
    syncInProgress.current = true; setIsSyncing(true);
    const queue = await db.getSyncQueue();
    if (queue.length > 0) {
        for (const item of queue) {
            try {
                switch(item.type) {
                    case 'ADD_SALE': await api.addSale(item.payload.order, item.payload.tableId, item.payload.tableName, item.payload.user); break;
                    case 'ADD_USER': await api.addUser(item.payload); break;
                    case 'DELETE_USER': await api.deleteUser(item.payload.userId); break;
                    case 'ADD_MENU_ITEM': await api.addMenuItem(item.payload); break;
                    case 'UPDATE_MENU_ITEM': await api.updateMenuItem(item.payload); break;
                    case 'DELETE_MENU_ITEM': await api.deleteMenuItem(item.payload.id); break;
                    case 'ADD_MENU_CATEGORY': await api.addMenuCategory(item.payload.name); break;
                    case 'UPDATE_MENU_CATEGORY': await api.updateMenuCategory(item.payload); break;
                    case 'DELETE_MENU_CATEGORY': await api.deleteMenuCategory(item.payload.id); break;
                    case 'ADD_HISTORY_ENTRY': await api.addHistoryEntry(item.payload.tableId, item.payload.details, item.payload.user); break;
                    case 'SET_TAX_RATE': await api.updateTaxRate(item.payload.rate); break;
                }
                await db.removeFromSyncQueue(item.id!);
            } catch (error) { console.error(`Sync failed for ${item.type}:`, error); setIsSyncing(false); syncInProgress.current = false; return; }
        }
    } 
    setIsSyncing(false); 
    syncInProgress.current = false;
  }, []);

  const addHistoryEntry = useCallback(async (tableId: number, details: string) => {
    if (!loggedInUser) return;
    const newEntry: HistoryEntry = { id: `hist-${Date.now()}`, tableId, timestamp: new Date(), user: loggedInUser, details };
    setHistory(prev => [newEntry, ...prev]);
    await db.put(newEntry, 'history');
  }, [loggedInUser]);

  const setTaxRate = useCallback(async (ratePercent: number) => {
    const newRate = Math.max(0, ratePercent) / 100;
    setTaxRateState(newRate);
    await db.addToSyncQueue({ type: 'SET_TAX_RATE', payload: { rate: newRate } });
    await addHistoryEntry(0, `Tax rate updated to ${ratePercent}%`);
    if (isOnline) { setTimeout(() => { syncOfflineData(); }, 0); }
  }, [isOnline, addHistoryEntry, syncOfflineData]);

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
  
  const login = useCallback(async (pin: string): Promise<boolean> => {
    let user = users.find((u) => u.pin === pin);
    if (user) { setLoggedInUser(user); return true; }
    if (isOnline && isBackendConfigured) {
      try {
        const response = await api.login(pin);
        user = response.user || undefined;
        if (user) { setLoggedInUser(user); return true; }
      } catch (e) { setIsOnline(false); }
    }
    return false;
  }, [isOnline, users]);

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
      const tempId = Date.now();
      const newUser: User = { ...userData, id: tempId };
      setUsers((prev) => [...prev, newUser]);
      await db.put(newUser, 'users');
      await db.addToSyncQueue({ type: 'ADD_USER', payload: userData });
      if (isOnline && isBackendConfigured) await syncOfflineData();
    } catch (e) { console.error("Add user failed", e); }
  }, [isOnline, syncOfflineData]);

  const deleteUser = useCallback(async (userId: number): Promise<boolean> => {
    try {
      setUsers(prev => prev.filter(u => u.id !== userId));
      await db.deleteItem(userId, 'users');
      await db.addToSyncQueue({ type: 'DELETE_USER', payload: { userId } });
      if (isOnline && isBackendConfigured) await syncOfflineData();
      return true;
    } catch (e) { console.error("Delete user failed", e); return false; }
  }, [isOnline, syncOfflineData]);

  const addMenuItem = useCallback(async (itemData: Omit<MenuItem, 'id'>) => {
    try {
      if (isOnline && isBackendConfigured) {
          // 1. ONLINE MODE:
          // Call the server directly so we get the "Real" item back immediately.
          // This allows us to capture the inherited Stock/Threshold from the group logic we just wrote.
          const serverItem = await api.addMenuItem(itemData);
          
          setMenuItems((prev) => [...prev, serverItem]);
          await db.put(serverItem, 'menuItems');
          // Note: We do NOT add to syncQueue here because we just executed it successfully.
      } else {
          // 2. OFFLINE MODE:
          // Use optimistic updates. The user won't see inherited stock until they go online and refresh,
          // but at least they can keep working.
          const tempId = Date.now();
          const newItem: MenuItem = { ...itemData, id: tempId };
          
          setMenuItems((prev) => [...prev, newItem]);
          await db.put(newItem, 'menuItems');
          await db.addToSyncQueue({ type: 'ADD_MENU_ITEM', payload: itemData });
      }
    } catch (e) { console.error("Add menu item failed", e); }
  }, [isOnline]);

  const updateMenuItem = useCallback(async (updatedItem: MenuItem) => {
    try {
      // 1. SMART STATE UPDATE: Update this item AND any siblings in the same Stock Group
      setMenuItems((prev) => prev.map((item) => {
        // Case A: It is the exact item being updated
        if (item.id === updatedItem.id) return updatedItem;
        
        // Case B: It is a "sibling" sharing the same Stock Group ID
        if (updatedItem.stockGroupId && 
            item.stockGroupId === updatedItem.stockGroupId && 
            updatedItem.trackStock) {
           // Sync the stock value
           return { ...item, stock: updatedItem.stock };
        }
        
        return item;
      }));

      // 2. Persist Main Item to Local DB
      await db.put(updatedItem, 'menuItems');

      // 3. Persist Siblings to Local DB (for offline consistency)
      if (updatedItem.stockGroupId) {
         // We fetch all items to find siblings because 'menuItems' state might be stale in this async block
         const allItems = await db.getAll<MenuItem>('menuItems');
         const siblings = allItems.filter(i => 
             i.stockGroupId === updatedItem.stockGroupId && i.id !== updatedItem.id
         );
         for (const sibling of siblings) {
             const updatedSibling = { ...sibling, stock: updatedItem.stock };
             await db.put(updatedSibling, 'menuItems');
         }
      }

      // 4. Queue Sync (Server handles the group update logic automatically, so we just send the main item)
      await db.addToSyncQueue({ type: 'UPDATE_MENU_ITEM', payload: updatedItem });
      
      if (isOnline && isBackendConfigured) await syncOfflineData();
    } catch (e) { console.error("Update menu item failed", e); }
  }, [isOnline, syncOfflineData]);

  const deleteMenuItem = useCallback(async (id: number) => {
    try {
      setMenuItems(prev => prev.filter(item => item.id !== id));
      await db.deleteItem(id, 'menuItems');
      await db.addToSyncQueue({ type: 'DELETE_MENU_ITEM', payload: { id } });
      if (isOnline && isBackendConfigured) await syncOfflineData();
    } catch (e) { console.error("Delete menu item failed", e); }
  }, [isOnline, syncOfflineData]);

  const addMenuCategory = useCallback(async (name: string) => {
    try {
      const tempId = Date.now();
      const newCat: MenuCategory = { id: tempId, name, display_order: null };
      setMenuCategories(prev => [...prev, newCat]);
      await db.put(newCat, 'menuCategories');
      await db.addToSyncQueue({ type: 'ADD_MENU_CATEGORY', payload: { name } });
      if (isOnline && isBackendConfigured) await syncOfflineData();
    } catch (e) { console.error("Add category failed", e); }
  }, [isOnline, syncOfflineData]);

  const updateMenuCategory = useCallback(async (updatedCategory: MenuCategory) => {
    try {
      setMenuCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c));
      await db.put(updatedCategory, 'menuCategories');
      await db.addToSyncQueue({ type: 'UPDATE_MENU_CATEGORY', payload: updatedCategory });
      if (isOnline && isBackendConfigured) await syncOfflineData();
    } catch (e) { console.error("Update category failed", e); }
  }, [isOnline, syncOfflineData]);

  const deleteMenuCategory = useCallback(async (id: number) => {
    try {
      setMenuCategories(prev => prev.filter(c => c.id !== id));
      await db.deleteItem(id, 'menuCategories');
      await db.addToSyncQueue({ type: 'DELETE_MENU_CATEGORY', payload: { id } });
      if (isOnline && isBackendConfigured) await syncOfflineData();
    } catch (e) { console.error("Delete category failed", e); }
  }, [isOnline, syncOfflineData]);

  const reorderMenuCategories = useCallback(async (categories: MenuCategory[]) => {
    setMenuCategories(categories);
    await db.bulkPut(categories, 'menuCategories');
  }, []);

  const reorderMenuItems = useCallback(async (items: MenuItem[]) => {
    // 1. Assign new display_order based on their current array index
    const updatedItems = items.map((item, index) => ({
      ...item,
      display_order: index + 1
    }));

    // 2. Update State Immediately
    setMenuItems(updatedItems);
    
    // 3. Update Local DB
    await db.bulkPut(updatedItems, 'menuItems');
    
    // 4. Sync with Server
    if (isOnline && isBackendConfigured) {
      const orderedIds = updatedItems.map(item => item.id);
      try {
        await fetch(`${SOCKET_URL}/api/menu-items/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds })
        });
      } catch (error) { console.error('Failed to sync reorder:', error); }
    }
  }, [isOnline]);

  const refreshSalesFromServer = useCallback(async () => {
    try {
      const serverSales = await api.getSales();
      setSales(serverSales.map(s => ({...s, date: new Date(s.date)})));
    } catch (error) { console.error('Failed to refresh sales:', error); }
  }, []);

  // --- UPDATED: Order Logic with better Socket Communication ---
  const updateOrderForTable = useCallback((tableId: number, order: Order | null, emitToSocket = true) => {
    setTables(currentTables => {
      // 1. Calculate New State
      const updatedTables = currentTables.map(table => 
        table.id === tableId ? { ...table, order } : table
      );
      
      // 2. Emit if initiated locally
      if (emitToSocket && socketRef.current?.connected) {
        if (isMasterClient.current) {
          // Admin/Master broadcasts to everyone
          console.log(`📡 MASTER: Broadcasting update for Table ${tableId}`);
          socketRef.current.emit('order-update', updatedTables);
        } else {
          // Waiter/Client sends request to server -> server tells Master -> Master broadcasts
          console.log(`📡 CLIENT: Sending update for Table ${tableId} to Server`);
          socketRef.current.emit('client-order-update', { tableId, order });
        }
      }
      return updatedTables;
    });
  }, []);

  const saveOrderForTable = useCallback(async (tableId: number, updatedOrder: Order | null, newItems: OrderItem[]) => {
    // 1. Update the "Active" state (for Waiter view) - keeps local sync working
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

  

  const addSale = useCallback(async (order: Order, tableId: number) => {
    if (!loggedInUser) return;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    // 1. Create Sale Object
    const newSale: Sale = { id: `sale-${Date.now()}`, date: new Date(), order, user: loggedInUser, tableId: table.id, tableName: table.name };
    
    // 2. Optimistic UI Update for Sales list
    setSales((prev) => [newSale, ...prev]);
    await db.put(newSale, 'sales');

    // 3. Queue Sync
    await db.addToSyncQueue({
      type: 'ADD_SALE',
      payload: { order, tableId: table.id, tableName: table.name, user: loggedInUser }
    });
    if (isOnline) { setTimeout(() => { syncOfflineData(); }, 0); }

    // 4. Clear Table Order
    updateOrderForTable(tableId, null);
    await addHistoryEntry(tableId, `Fatura u finalizua...`);

    // --- 5. SMART STOCK DEDUCTION (Shared Groups) ---
    
    // Step A: Calculate total deductions per "Stock Identity" (Group ID or Item ID)
    const deductions = new Map<string | number, number>();

    for (const saleItem of order.items) {
        // Find the real item in our current state (to check for group ID)
        const realItem = menuItems.find(i => i.id === saleItem.id);
        if (!realItem || !realItem.trackStock) continue;

        // Key is GroupID (string) if it exists, otherwise ItemID (number)
        const key = realItem.stockGroupId ? realItem.stockGroupId : realItem.id;
        const currentDeduction = deductions.get(key) || 0;
        deductions.set(key, currentDeduction + saleItem.quantity);
    }

    // Step B: Apply updates to React State (Bulk Update)
    setMenuItems(prev => {
        const nextState = prev.map(item => ({ ...item })); // Shallow copy
        
        deductions.forEach((qtyToRemove, key) => {
            if (typeof key === 'string') {
                 // It's a Group ID -> Update ALL items in this group
                 // 1. Find current stock from any item in this group
                 const sampleItem = nextState.find(i => i.stockGroupId === key);
                 if (sampleItem && isFinite(sampleItem.stock)) {
                     const newStock = Math.max(0, sampleItem.stock - qtyToRemove);
                     // 2. Apply to all siblings
                     nextState.forEach(i => {
                         if (i.stockGroupId === key) i.stock = newStock;
                     });
                 }
            } else {
                // It's a specific Item ID
                const target = nextState.find(i => i.id === key);
                if (target && isFinite(target.stock)) {
                    target.stock = Math.max(0, target.stock - qtyToRemove);
                }
            }
        });
        return nextState;
    });

    // Step C: Apply updates to Local DB (IndexedDB)
    // We re-iterate deductions to ensure DB is consistent
    const allDbItems = await db.getAll<MenuItem>('menuItems');
    
    deductions.forEach((qtyToRemove, key) => {
        if (typeof key === 'string') {
            const sample = allDbItems.find(i => i.stockGroupId === key);
            if (sample && isFinite(sample.stock)) {
                const newStock = Math.max(0, sample.stock - qtyToRemove);
                // Update all siblings in DB
                allDbItems.forEach(i => {
                    if (i.stockGroupId === key) {
                        i.stock = newStock;
                        db.put(i, 'menuItems'); 
                    }
                });
            }
        } else {
             const target = allDbItems.find(i => i.id === key);
             if (target && isFinite(target.stock)) {
                 target.stock = Math.max(0, target.stock - qtyToRemove);
                 db.put(target, 'menuItems');
             }
        }
    });

    // 6. Socket Emission
    if (socketRef.current?.connected) {
      socketRef.current.emit('sale-finalized', newSale);
      console.log("Sent print request for Sale ID:", newSale.id);
      // --- START: MODIFIED BLOCK ---
      // REMOVED: const isStation = localStorage.getItem('isPrintStation') === 'true';
      const isReceiptPrintingEnabled = localStorage.getItem('isReceiptPrintingEnabled') !== 'false'; // Default to true

      // LOGIC CHANGE: Removed '&& isStation'.       
      if (isReceiptPrintingEnabled) {
        socketRef.current.emit('print-sale-receipt', newSale);
      }
      // --- END: Add this block ---
    }
  // ADD these lines in its place. We are adding the handleAutoLogout() call and updating the dependency array.
    // --- AUTO-LOGOUT ---
    handleAutoLogout();
    
  }, [loggedInUser, tables, menuItems, isOnline, updateOrderForTable, addHistoryEntry, syncOfflineData, handleAutoLogout]);





  const setTablesPerRow = useCallback((count: number) => { localStorage.setItem('tablesPerRow', count.toString()); setTablesPerRowState(count); }, []);
  const setTableSizePercent = useCallback((size: number) => { localStorage.setItem('tableSizePercent', size.toString()); setTableSizePercentState(size); }, []);
  const setTableButtonSizePercent = useCallback((size: number) => { localStorage.setItem('tableButtonSizePercent', size.toString()); setTableButtonSizePercentState(size); }, []);
  





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


  // --- SOCKET CONNECTION (ROBUST) ---
  useEffect(() => {
    // 1. Establish Connection
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        reconnection: true, 
        reconnectionAttempts: 10, 
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling'] // Force stable transport
      });
    }
    const socket = socketRef.current;

    // 2. Define Handlers
    const handleOrderUpdate = (updatedTablesData: Table[]) => {
      console.log('📥 RECEIVED ORDER UPDATE from Server', updatedTablesData.length);
      setTables(updatedTablesData);
    };
    
    const handleSaleFinalized = (newSaleData: Sale) => { 
        setSales(prev => [newSaleData, ...prev]); 
    };
    
    // Logic for Master (Admin) to share state with new Clients
    const handleShareYourState = () => { 
        if (isMasterClient.current) {
            console.log('📤 MASTER: Sharing state with new client...');
            socket.emit('here-is-my-state', tablesRef.current);
            // Critical: Re-assert identity in case server restarted and forgot us
            socket.emit('identify-as-master'); 
        }
    };
    
    // Logic for Client (Waiter) to ask for state
    const handleRequestInitialState = () => { 
        if (isMasterClient.current) {
             socket.emit('provide-initial-state', tablesRef.current); 
        }
    };
    
    // 3. Attach Listeners (Remove duplicates first)
    socket.off('connect');
    socket.off('order-updated-from-server');
    socket.off('sale-finalized-from-server');
    socket.off('process-client-order-update');
    socket.off('share-your-state');
    socket.off('request-initial-state');
    socket.off('setting-updated'); // NEW: Remove previous listener

    socket.on('connect', () => { 
      console.log(`✅ SOCKET CONNECTED (${isMasterClient.current ? 'MASTER/ADMIN' : 'CLIENT/WAITER'})`);
      if (isMasterClient.current) socket.emit('identify-as-master');
      else socket.emit('request-latest-state');
    });

    // NEW: Listen for setting updates from the server
    socket.on('setting-updated', ({ key, value }) => {
        console.log(`🔧 Received setting update: ${key} = ${value}`);
        if (key === 'all_tables_custom_name') {
            setSectionPrefs(currentPrefs => ({
                ...currentPrefs,
                'all': { ...(currentPrefs['all'] || {}), customName: value }
            }));
        }
    });

    socket.on('order-updated-from-server', handleOrderUpdate);
    socket.on('sale-finalized-from-server', handleSaleFinalized);
    
    // Critical: Listen for client updates and route them correctly
    socket.on('process-client-order-update', ({ tableId, order }) => {
        console.log(`🔄 Processing Client Update for Table ${tableId}`);
        updateOrderForTable(tableId, order, false); // false = Don't re-emit to avoid loops
    });

    socket.on('share-your-state', handleShareYourState);
    socket.on('request-initial-state', handleRequestInitialState);

    // 4. Cleanup (Only disconnect on actual unmount, not re-render)
    return () => {
       // We INTENTIONALLY do not disconnect here in development to prevent 
       // flickering connections during hot-reloads.
       // However, we must remove listeners to prevent duplicates.
       socket.off('order-updated-from-server', handleOrderUpdate);
       socket.off('sale-finalized-from-server', handleSaleFinalized);
    };
  }, []); // Empty dependency array = Run once on mount

  // --- BOOTSTRAP (INIT) LOGIC ---
  useEffect(() => {
    if (startupEffectRan.current === true) { return; }

    // ... inside bootstrap function of main useEffect
    const bootstrap = async () => {
      setIsLoading(true);
      await db.initDB();
      
      // Load section preferences into React State once on startup
      setSectionPrefs(JSON.parse(localStorage.getItem('sectionPreferences') || '{}'));

      // 1. LOAD FROM LOCALSTORAGE
      let countToLoad = parseInt(localStorage.getItem('tableCount') || '50', 10);
        if (!countToLoad || countToLoad < 1) countToLoad = 50;
        
        const savedTablesJSON = localStorage.getItem('activeTables');
        let initialTables: Table[] = [];

        if (savedTablesJSON) {
            try {
                const parsed = JSON.parse(savedTablesJSON);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    initialTables = parsed;
                }
            } catch (e) { console.error("Error parsing activeTables", e); } 
        }

        if (initialTables.length === 0) {
            initialTables = Array.from({ length: countToLoad }, (_, i) => ({
                id: i + 1, name: `${i + 1}`, order: null
            }));
        }

        setTables(initialTables);

        setTablesPerRowState(parseInt(localStorage.getItem('tablesPerRow') || '5', 10));
        setTableSizePercentState(parseInt(localStorage.getItem('tableSizePercent') || '100', 10));
        setTableButtonSizePercentState(parseInt(localStorage.getItem('tableButtonSizePercent') || '100', 10));

        // 2. SERVER SYNC
        if (isBackendConfigured && navigator.onLine) {
            try {          
                await fetchAndCacheData();            
                await syncOfflineData();
            } catch (error) {
                console.error("Startup sync failed:", error);
            }
        } else {
            await loadDataFromDb();
        }
        setIsLoading(false);
    };

    bootstrap();
    startupEffectRan.current = true;

    const handleOnline = () => { setIsOnline(true); syncOfflineData(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline); 
    window.addEventListener('offline', handleOffline);
    return () => { 
      window.removeEventListener('online', handleOnline); 
      window.removeEventListener('offline', handleOffline); 
    };
  }, [syncOfflineData, loadDataFromDb, fetchAndCacheData]);

  const addBulkStock = useCallback(async (movements: StockUpdateItem[], reason: string) => {
    if (!loggedInUser) return;
    try {
      await api.addBulkStock(movements, reason, loggedInUser.id);

      // Local State Update (Reflect changes immediately without refresh)
      setMenuItems(prev => {
        const nextState = prev.map(item => ({ ...item }));
        
        movements.forEach(move => {
           const targetItem = nextState.find(i => i.id === move.itemId);
           if (!targetItem) return;

           if (targetItem.stockGroupId) {
               // Update all items in this group
               nextState.forEach(i => {
                   if (i.stockGroupId === targetItem.stockGroupId) {
                       i.stock = (i.stock || 0) + move.quantity;
                   }
               });
           } else {
               // Update just this item
               targetItem.stock = (targetItem.stock || 0) + move.quantity;
           }
        });
        return nextState;
      });
      
      // Update IndexedDB for consistency
      const allDbItems = await db.getAll<MenuItem>('menuItems');
      for (const move of movements) {
          const targetItem = allDbItems.find(i => i.id === move.itemId);
          if (targetItem) {
               if (targetItem.stockGroupId) {
                   allDbItems.filter(i => i.stockGroupId === targetItem.stockGroupId).forEach(sibling => {
                       sibling.stock = (sibling.stock || 0) + move.quantity;
                       db.put(sibling, 'menuItems');
                   });
               } else {
                   targetItem.stock = (targetItem.stock || 0) + move.quantity;
                   await db.put(targetItem, 'menuItems');
               }
          }
      }

    } catch (e) {
      console.error("Bulk stock update failed", e);
      throw e;
    }
  }, [loggedInUser]);

  const addWaste = useCallback(async (itemId: number, quantity: number, reason: string) => {
    if (!loggedInUser) return;
    try {
      // 1. Call API
      await api.addWaste(itemId, quantity, reason, loggedInUser.id);

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

      // 3. Update IndexedDB
      const allDbItems = await db.getAll<MenuItem>('menuItems');
      const targetItem = allDbItems.find(i => i.id === itemId);
      
      if (targetItem) {
          if (targetItem.stockGroupId) {
             const siblings = allDbItems.filter(i => i.stockGroupId === targetItem.stockGroupId);
             for (const sibling of siblings) {
                 sibling.stock = Math.max(0, (sibling.stock || 0) - quantity);
                 await db.put(sibling, 'menuItems');
             }
          } else {
             targetItem.stock = Math.max(0, (targetItem.stock || 0) - quantity);
             await db.put(targetItem, 'menuItems');
          }
      }

    } catch (e) {
      console.error("Add waste failed", e);
      throw e;
    }
  }, [loggedInUser]);

  const value = useMemo(() => ({
    isLoading, isOnline, isSyncing, loggedInUser, activeScreen, setActiveScreen,
    users, menuItems, menuCategories, sales, saleToPrint,
    setSaleToPrint, orderToPrint, setOrderToPrint, tables, tablesPerRow, tableSizePercent,
    tableButtonSizePercent, taxRate, history, login, logout, addUser, deleteUser, addMenuItem, updateMenuItem,
    deleteMenuItem, importMenuItemsFromCSV, reorderMenuItemsFromCSV, reorderMenuItems, addMenuCategory,
    updateMenuCategory, deleteMenuCategory, reorderMenuCategories, addSale, setTableCount, updateOrderForTable,
    setTablesPerRow, setTableSizePercent, setTableButtonSizePercent, setTaxRate, saveOrderForTable,
    refreshSalesFromServer, companyInfo, updateCompanySettings, addBulkStock, addWaste,
    operationalDayStartHour, updateOperationalDayStartHour,
    sections, allSectionConfig, addSection, updateSectionName, toggleSectionVisibility, setSectionDefault, deleteSection,
    addTable, updateTable, deleteTable
  }), [
    isLoading, isOnline, isSyncing, loggedInUser, activeScreen,
    users, menuItems, menuCategories, sales, saleToPrint,
    orderToPrint, tables, tablesPerRow, tableSizePercent, tableButtonSizePercent, taxRate, history,
    login, logout, addUser, deleteUser, addMenuItem, updateMenuItem, deleteMenuItem, importMenuItemsFromCSV,
    reorderMenuItemsFromCSV, reorderMenuItems, addMenuCategory, updateMenuCategory, deleteMenuCategory,
    reorderMenuCategories, addSale, setTableCount, updateOrderForTable, setTablesPerRow,
    setTableSizePercent, setTableButtonSizePercent, setTaxRate, saveOrderForTable,
    refreshSalesFromServer, companyInfo, updateCompanySettings, addBulkStock, addWaste,
    operationalDayStartHour, updateOperationalDayStartHour,
    sections, allSectionConfig, addSection, updateSectionName, toggleSectionVisibility, setSectionDefault, deleteSection,
    addTable, updateTable, deleteTable
  ]);

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};

export const usePos = (): PosContextState => {
  const context = useContext(PosContext);
  if (context === undefined) { throw new Error('usePos must be used within a PosProvider'); }
  return context;
};