import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, MenuItem, Sale, Order, Table, UserRole, MenuCategory, HistoryEntry, OrderItem, Printer } from '../types';
import * as db from '../utils/db';
import * as api from '../api';
import { DEFAULT_USERS } from '../constants';
import { io, Socket } from 'socket.io-client';
import Papa from 'papaparse';
import { printSaleReceipt, printOrderTicket } from '../utils/printManager';

const SOCKET_URL = 'http://192.168.1.10:3001';
const socket: Socket = io(SOCKET_URL, { transports: ['websocket'] });

const isBackendConfigured = true;

interface OrderToPrint { table: Table; newItems: OrderItem[]; }

interface PosContextState {
  isLoading: boolean; isOnline: boolean; isSyncing: boolean; loggedInUser: User | null;
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
  // --- ADDED MISSING FUNCTION DEFINITION HERE ---
  refreshSalesFromServer: () => Promise<void>; 
}

const PosContext = createContext<PosContextState | undefined>(undefined);

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);
  const [orderToPrint, setOrderToPrint] = useState<OrderToPrint | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [tablesPerRow, setTablesPerRowState] = useState<number>(10);
  const [tableSizePercent, setTableSizePercentState] = useState<number>(100);
  const [tableButtonSizePercent, setTableButtonSizePercentState] = useState<number>(100);
  const [taxRate, setTaxRateState] = useState<number>(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const syncInProgress = useRef(false);

  const loadDataFromDb = useCallback(async () => {
    const [dbUsers, dbMenuItems, dbMenuCategories, dbSales, dbHistory] = await Promise.all([
        db.getAll<User>('users'), db.getAll<MenuItem>('menuItems'), db.getAll<MenuCategory>('menuCategories'),
        db.getAll<Sale>('sales'), db.getAll<HistoryEntry>('history'),
    ]);
    setUsers(dbUsers); setMenuItems(dbMenuItems); setMenuCategories(dbMenuCategories);
    setSales(dbSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setHistory(dbHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    setTaxRateState(0); 
  }, []);

  // --- ADDED MISSING FUNCTION IMPLEMENTATION HERE ---
  const refreshSalesFromServer = useCallback(async () => {
    if (!isBackendConfigured || !navigator.onLine) return;
    try {
        const salesData = await api.getSales();
        setSales(salesData.map(s => ({...s, date: new Date(s.date)})));
    } catch (e) {
        console.error("Error refreshing sales:", e);
    }
  }, []);

  const fetchAndCacheData = useCallback(async () => {
    if (!isBackendConfigured) return;
    try {
        const [{ users, menuItems, menuCategories, taxRate }, salesData, historyData] = await Promise.all([
          api.bootstrap(), api.getSales(), api.getHistory(),
        ]);
        await db.clearStaticData();
        await Promise.all([
          db.bulkPut(users, 'users'), db.bulkPut(menuItems, 'menuItems'), db.bulkPut(menuCategories, 'menuCategories')
        ]);
        setUsers(users); setMenuItems(menuItems); setMenuCategories(menuCategories);
        setTaxRateState(typeof taxRate === 'number' && isFinite(taxRate) ? taxRate : 0);
        setSales(salesData.map(s => ({...s, date: new Date(s.date)})));
        setHistory(historyData.map(h => ({...h, timestamp: new Date(h.timestamp)})));
        setIsOnline(true);
    } catch (error) { console.error("--- SERVER FETCH FAILED ---", error); setIsOnline(false); await loadDataFromDb(); }
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
  }, [fetchAndCacheData]); 

  const setTableCount = useCallback((count: number) => {
    localStorage.setItem('tableCount', count.toString());
    setTables(currentTables => {
        const newTables: Table[] = Array.from({ length: count }, (_, i) => 
            currentTables?.[i] || { id: i + 1, name: `${i + 1}`, order: null }
        );
        localStorage.setItem('activeTables', JSON.stringify(newTables));
        return newTables;
    });
  }, []);

  const addHistoryEntry = useCallback(async (tableId: number, details: string) => {
    if (!loggedInUser) return;
    const newEntry: HistoryEntry = { id: `hist-${Date.now()}`, tableId, timestamp: new Date(), user: loggedInUser, details };
    setHistory(prev => [newEntry, ...prev]);
    await db.put(newEntry, 'history');
    await db.addToSyncQueue({ type: 'ADD_HISTORY_ENTRY', payload: { tableId, details, user: loggedInUser } });
    if (isOnline) syncOfflineData();
  }, [loggedInUser, isOnline, syncOfflineData]);

  const setTaxRate = useCallback(async (ratePercent: number) => {
    const newRate = Math.max(0, ratePercent) / 100;
    setTaxRateState(newRate);
    await db.addToSyncQueue({ type: 'SET_TAX_RATE', payload: { rate: newRate } });
    await addHistoryEntry(0, `Tax rate updated to ${ratePercent}%`);
    if (isOnline) await syncOfflineData();
  }, [isOnline, addHistoryEntry, syncOfflineData]);

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

  const logout = useCallback(() => setLoggedInUser(null), []);

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
      const tempId = Date.now();
      const newItem: MenuItem = { ...itemData, id: tempId };
      
      setMenuItems((prev) => [...prev, newItem]);
      await db.put(newItem, 'menuItems');
      await db.addToSyncQueue({ type: 'ADD_MENU_ITEM', payload: itemData });
      
      if (isOnline && isBackendConfigured) await syncOfflineData();
    } catch (e) { console.error("Add item failed", e); }
  }, [isOnline, syncOfflineData]);

  const updateMenuItem = useCallback(async (updatedItem: MenuItem) => {
    try {
      setMenuItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
      await db.put(updatedItem, 'menuItems');
      await db.addToSyncQueue({ type: 'UPDATE_MENU_ITEM', payload: updatedItem });
      
      if (isOnline && isBackendConfigured) await syncOfflineData();
    } catch (e) { console.error("Update item failed", e); }
  }, [isOnline, syncOfflineData]);

  const deleteMenuItem = useCallback(async (id: number) => {
    try {
      setMenuItems(prev => prev.filter(item => item.id !== id));
      await db.deleteItem(id, 'menuItems');
      await db.addToSyncQueue({ type: 'DELETE_MENU_ITEM', payload: { id } });
      
      if (isOnline && isBackendConfigured) await syncOfflineData();
    } catch (e) { console.error("Delete item failed", e); }
  }, [isOnline, syncOfflineData]);

  const addMenuCategory = useCallback(async (name: string) => {
    try {
      const tempId = Date.now();
      const newCat: MenuCategory = { id: tempId, name };
      
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
    setMenuItems(items);
    await db.bulkPut(items, 'menuItems');
  }, []);

  const updateOrderForTable = useCallback((tableId: number, order: Order | null) => {
    setTables(currentTables => {
        const nextTablesState = currentTables.map(table => table.id === tableId ? { ...table, order } : table);
        localStorage.setItem('activeTables', JSON.stringify(nextTablesState));
        socket.emit('order-update', nextTablesState);
        return nextTablesState;
    });
  }, []);

  const saveOrderForTable = useCallback(async (tableId: number, updatedOrder: Order | null, newItems: OrderItem[]) => {
    updateOrderForTable(tableId, updatedOrder);
    const table = tables.find(t => t.id === tableId);
    if (newItems.length > 0 && table && loggedInUser) {
        printOrderTicket(table, newItems, loggedInUser);
        socket.emit('print-order-ticket', { table, newItems, user: loggedInUser });
    }
  }, [tables, updateOrderForTable, loggedInUser]);

  const addSale = useCallback(async (order: Order, tableId: number) => {
    if (!loggedInUser) return;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    const newSale: Sale = { id: `sale-${Date.now()}`, date: new Date(), order, user: loggedInUser, tableId: table.id, tableName: table.name };
    
    setSales((prev) => [newSale, ...prev]);
    await db.put(newSale, 'sales');
    
    for (const saleItem of order.items) {
      const menuItem = menuItems.find(mi => mi.id === saleItem.id);
      if (menuItem && menuItem.trackStock && isFinite(menuItem.stock)) {
        const updatedItem = { ...menuItem, stock: menuItem.stock - saleItem.quantity };
        await updateMenuItem(updatedItem);
      }
    }

    updateOrderForTable(tableId, null);
    await addHistoryEntry(tableId, `Fatura u finalizua...`);
    
    await db.addToSyncQueue({ type: 'ADD_SALE', payload: { order, tableId, tableName: table.name, user: loggedInUser } });

    socket.emit('sale-finalized', newSale);
    printSaleReceipt(newSale);
    
    if (isOnline) syncOfflineData();
  }, [loggedInUser, tables, menuItems, isOnline, updateOrderForTable, addHistoryEntry, updateMenuItem, syncOfflineData]);

  const setTablesPerRow = useCallback((count: number) => { localStorage.setItem('tablesPerRow', count.toString()); setTablesPerRowState(count); }, []);
  const setTableSizePercent = useCallback((size: number) => { localStorage.setItem('tableSizePercent', size.toString()); setTableSizePercentState(size); }, []);
  const setTableButtonSizePercent = useCallback((size: number) => { localStorage.setItem('tableButtonSizePercent', size.toString()); setTableButtonSizePercentState(size); }, []);
  const importMenuItemsFromCSV = useCallback((file: File) => new Promise<any>((res, rej) => {}), [addMenuCategory, addMenuItem, fetchAndCacheData]);
  const reorderMenuItemsFromCSV = useCallback(async (file: File) => { throw new Error(); }, [fetchAndCacheData]);

  useEffect(() => {
    const handleOrderUpdate = (updatedTablesData: Table[]) => {
      setTables(updatedTablesData);
      localStorage.setItem('activeTables', JSON.stringify(updatedTablesData));
    };
    const handleSaleFinalized = (newSaleData: Sale) => {
      setSales(prev => [newSaleData, ...prev]);
    };
    const handlePrintOrderTicket = (orderData: { table: Table; newItems: OrderItem[]; user: User | null }) => {
      printOrderTicket(orderData.table, orderData.newItems, orderData.user);
    };

    socket.on('connect', () => { console.log('✅ --- SOCKET.IO CONNECTED --- ✅'); });
    socket.on('disconnect', (reason) => { console.log('🔌 --- SOCKET.IO DISCONNECTED --- 🔌 Reason:', reason); });
    socket.on('connect_error', (err) => { console.error('❌ --- SOCKET.IO CONNECTION ERROR --- ❌', err); });
    socket.on('order-updated-from-server', handleOrderUpdate);
    socket.on('sale-finalized-from-server', handleSaleFinalized);
    socket.on('print-order-ticket-from-server', handlePrintOrderTicket);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('order-updated-from-server', handleOrderUpdate);
      socket.off('sale-finalized-from-server', handleSaleFinalized);
      socket.off('print-order-ticket-from-server', handlePrintOrderTicket);
    };
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
        setIsLoading(true); await db.initDB();
        const savedTablesJSON = localStorage.getItem('activeTables');
        const savedTablesCount = parseInt(localStorage.getItem('tableCount') || '100', 10);
        if (savedTablesJSON) {
            const loadedTables = JSON.parse(savedTablesJSON);
            if (loadedTables.length !== savedTablesCount) { setTableCount(savedTablesCount); } else { setTables(loadedTables); }
        } else { setTableCount(savedTablesCount); }
        setTablesPerRowState(parseInt(localStorage.getItem('tablesPerRow') || '10', 10));
        setTableSizePercentState(parseInt(localStorage.getItem('tableSizePercent') || '100', 10));
        setTableButtonSizePercentState(parseInt(localStorage.getItem('tableButtonSizePercent') || '100', 10));
        if (isBackendConfigured && navigator.onLine) {
            await syncOfflineData();
            await fetchAndCacheData(); 
        } else {
            await loadDataFromDb();
        }
        setIsLoading(false);
    };
    bootstrap();
    const handleOnline = () => { setIsOnline(true); syncOfflineData(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [setTableCount, syncOfflineData, loadDataFromDb, fetchAndCacheData]);

  const value = useMemo(() => ({
    isLoading, isOnline, isSyncing, loggedInUser, users, menuItems, menuCategories, sales, saleToPrint,
    setSaleToPrint, orderToPrint, setOrderToPrint, tables, tablesPerRow, tableSizePercent,
    tableButtonSizePercent, taxRate, history, login, logout, addUser, deleteUser, addMenuItem, updateMenuItem,
    deleteMenuItem, importMenuItemsFromCSV, reorderMenuItemsFromCSV, reorderMenuItems, addMenuCategory,
    updateMenuCategory, deleteMenuCategory, reorderMenuCategories, addSale, setTableCount, updateOrderForTable,
    setTablesPerRow, setTableSizePercent, setTableButtonSizePercent, setTaxRate, saveOrderForTable,
    // --- ADDED MISSING FUNCTION EXPORT HERE ---
    refreshSalesFromServer 
  }), [
    isLoading, isOnline, isSyncing, loggedInUser, users, menuItems, menuCategories, sales, saleToPrint,
    orderToPrint, tables, tablesPerRow, tableSizePercent, tableButtonSizePercent, taxRate, history,
    login, logout, addUser, deleteUser, addMenuItem, updateMenuItem, deleteMenuItem, importMenuItemsFromCSV,
    reorderMenuItemsFromCSV, reorderMenuItems, addMenuCategory, updateMenuCategory, deleteMenuCategory,
    reorderMenuCategories, addSale, setTableCount, updateOrderForTable, setTablesPerRow,
    setTableSizePercent, setTableButtonSizePercent, setTaxRate, saveOrderForTable,
    refreshSalesFromServer // <--- AND HERE
  ]);

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};

export const usePos = (): PosContextState => {
  const context = useContext(PosContext);
  if (context === undefined) { throw new Error('usePos must be used within a PosProvider'); }
  return context;
};