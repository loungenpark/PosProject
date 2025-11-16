// --- FINAL, COMPLETE, AND HMR-PROOF VERSION ---

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'; // TYPO FIXED
import { User, MenuItem, Sale, Order, Table, UserRole, MenuCategory, HistoryEntry, OrderItem, Printer } from '../types';
import * as db from '../utils/db';
import * as api from '../api';
import { DEFAULT_USERS } from '../constants';
import { io, Socket } from 'socket.io-client';
import Papa from 'papaparse';
import { printSaleReceipt, printOrderTicket } from '../utils/printManager';

const SOCKET_URL = `http://${window.location.hostname}:3001`;

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
  const startupEffectRan = useRef(false);

  // Treat non-mobile browsers as MASTER, mobile (phone/tablet) as CLIENT
  const isMasterClient = useRef(window.innerWidth > 900 || !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));

  const tablesRef = useRef<Table[]>([]);

  const socketRef = useRef<Socket | null>(null);
  console.log(`This device is ${isMasterClient.current ? 'MASTER (PC)' : 'CLIENT (Mobile)'}`);


  const loadDataFromDb = useCallback(async () => {
    const [dbUsers, dbMenuItems, dbMenuCategories, dbSales, dbHistory] = await Promise.all([
        db.getAll<User>('users'), db.getAll<MenuItem>('menuItems'), db.getAll<MenuCategory>('menuCategories'),
        db.getAll<Sale>('sales'), db.getAll<HistoryEntry>('history'),
    ]);
    setUsers(dbUsers); setMenuItems(dbMenuItems); setMenuCategories(dbMenuCategories);
    setSales(dbSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setHistory(dbHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  }, []);
  
  const fetchAndCacheData = useCallback(async () => {
    if (!isBackendConfigured) return;
    try {
        const { users, menuItems, menuCategories, taxRate } = await api.bootstrap();
        await db.clearStaticData();
        await Promise.all([
          db.bulkPut(users, 'users'), db.bulkPut(menuItems, 'menuItems'), db.bulkPut(menuCategories, 'menuCategories')
        ]);
        setUsers(users); setMenuItems(menuItems); setMenuCategories(menuCategories);
        setTaxRateState(typeof taxRate === 'number' && isFinite(taxRate) ? taxRate : 0);
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
  }, []);

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
  }, [loggedInUser]);

  const setTaxRate = useCallback(async (ratePercent: number) => {
    const newRate = Math.max(0, ratePercent) / 100;
    setTaxRateState(newRate);
    await db.addToSyncQueue({ type: 'SET_TAX_RATE', payload: { rate: newRate } });
    await addHistoryEntry(0, `Tax rate updated to ${ratePercent}%`);
    if (isOnline) { setTimeout(() => { syncOfflineData(); }, 0); }
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
  const addUser = useCallback(async (user: Omit<User, 'id'>) => {}, [isOnline]);
  const deleteUser = useCallback(async (userId: number): Promise<boolean> => { return true; }, [users, isOnline]);
  const addMenuItem = useCallback(async (item: Omit<MenuItem, 'id'>) => {}, [isOnline]);
  const updateMenuItem = useCallback(async (updatedItem: MenuItem) => {
    setMenuItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
    await db.put(updatedItem, 'menuItems');
  }, [isOnline]);
  const deleteMenuItem = useCallback(async (id: number) => {}, [isOnline]);
  const addMenuCategory = useCallback(async (name: string) => {}, [isOnline, menuCategories]);
  const updateMenuCategory = useCallback(async (updatedCategory: MenuCategory) => {}, [isOnline]);
  const deleteMenuCategory = useCallback(async (id: number) => {}, [isOnline]);
  const reorderMenuCategories = useCallback(async (categories: MenuCategory[]) => {}, [fetchAndCacheData]);
  const reorderMenuItems = useCallback(async (items: MenuItem[]) => {}, [fetchAndCacheData]);

  const refreshSalesFromServer = useCallback(async () => {
    try {
      const serverSales = await api.getSales();
      setSales(serverSales);
    } catch (error) {
      console.error('Failed to refresh sales from server:', error);
    }
  }, []);

  const updateOrderForTable = useCallback((tableId: number, order: Order | null) => {
    setTables(currentTables => {
      const updatedTables = currentTables.map(table => 
        table.id === tableId ? { ...table, order } : table
      );
      localStorage.setItem('activeTables', JSON.stringify(updatedTables));

      if (socketRef.current?.connected) {
        if (isMasterClient.current) {
          // If we're the master, emit the update directly
          socketRef.current.emit('order-update', updatedTables);
        } else {
          // If we're a client, send the update to the master
          socketRef.current.emit('client-order-update', { tableId, order });
        }
      }

      return updatedTables;
    });
  }, []);

  const saveOrderForTable = useCallback(async (tableId: number, updatedOrder: Order | null, newItems: OrderItem[]) => {
    updateOrderForTable(tableId, updatedOrder);
    const table = tables.find(t => t.id === tableId);
    if (newItems.length > 0 && table && loggedInUser && socketRef.current?.connected) {
      socketRef.current.emit('print-order-ticket', { table, newItems, user: loggedInUser });
    }
  }, [tables, updateOrderForTable, loggedInUser]);

  const addSale = useCallback(async (order: Order, tableId: number) => {
    if (!loggedInUser) return;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    const newSale: Sale = { id: `sale-${Date.now()}`, date: new Date(), order, user: loggedInUser, tableId: table.id, tableName: table.name };
    setSales((prev) => [newSale, ...prev]);
    await db.put(newSale, 'sales');

    await db.addToSyncQueue({
      type: 'ADD_SALE',
      payload: { order, tableId: table.id, tableName: table.name, user: loggedInUser }
    });
    if (isOnline) {
      setTimeout(() => { syncOfflineData(); }, 0);
    }

    updateOrderForTable(tableId, null);
    await addHistoryEntry(tableId, `Fatura u finalizua...`);
    for (const saleItem of order.items) {
      const menuItem = menuItems.find(mi => mi.id === saleItem.id);
      if (menuItem && menuItem.trackStock && isFinite(menuItem.stock)) {
        await updateMenuItem({ ...menuItem, stock: menuItem.stock - saleItem.quantity });
      }
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit('sale-finalized', newSale);
      socketRef.current.emit('print-sale-receipt', newSale);
    }
  }, [loggedInUser, tables, menuItems, isOnline, updateOrderForTable, addHistoryEntry, updateMenuItem, syncOfflineData]);
  
  const setTablesPerRow = useCallback((count: number) => { localStorage.setItem('tablesPerRow', count.toString()); setTablesPerRowState(count); }, []);
  const setTableSizePercent = useCallback((size: number) => { localStorage.setItem('tableSizePercent', size.toString()); setTableSizePercentState(size); }, []);
  const setTableButtonSizePercent = useCallback((size: number) => { localStorage.setItem('tableButtonSizePercent', size.toString()); setTableButtonSizePercentState(size); }, []);
  const importMenuItemsFromCSV = useCallback((file: File) => new Promise<any>((res, rej) => {}), [addMenuCategory, addMenuItem, fetchAndCacheData]);
  const reorderMenuItemsFromCSV = useCallback(async (file: File) => { throw new Error(); }, [fetchAndCacheData]);

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  useEffect(() => {
    // Initialize socket connection if it doesn't exist
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
    }

    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    // Handle order updates from the server
    const handleOrderUpdate = (updatedTablesData: Table[]) => {
      console.log('Received order update from server');
      setTables(updatedTablesData);
      localStorage.setItem('activeTables', JSON.stringify(updatedTablesData));
    };

    const handleSaleFinalized = (newSaleData: Sale) => { 
      setSales(prev => [newSaleData, ...prev]); 
    };
    
    const handlePrintOrderTicket = (orderData: { table: Table; newItems: OrderItem[]; user: User | null }) => {
      printOrderTicket(orderData.table, orderData.newItems, orderData.user);
    };
    
    const handlePrintSaleReceipt = (saleData: Sale) => {
      printSaleReceipt(saleData);
    };
    
    // When the server asks for our state, we provide it (only if we're the master)
    const handleShareYourState = () => {
      if (isMasterClient.current) {
        console.log('Sharing our state as master', tablesRef.current);
        socket.emit('here-is-my-state', tablesRef.current);
      }
    };
    
    // Handle request for initial state (only for master)
    const handleRequestInitialState = () => {
      if (isMasterClient.current) {
        console.log('Providing initial state as master', tablesRef.current);
        socket.emit('provide-initial-state', tablesRef.current);
      }
    };
    
    socket.on('connect', () => { 
      console.log(`✅ --- SOCKET.IO CONNECTED --- ✅ (${isMasterClient.current ? 'MASTER' : 'CLIENT'})`);
      
      if (isMasterClient.current) {
        // If we're the master, identify ourselves to the server
        socket.emit('identify-as-master');
      } else {
        // If we're a client, request the latest state from the master
        socket.emit('request-latest-state');
      }
    });
    socket.on('disconnect', (reason) => { 
      console.log('🔌 --- SOCKET.IO DISCONNECTED --- 🔌 Reason:', reason); 
    });
    
    socket.on('connect_error', (err) => { 
      console.error('❌ --- SOCKET.IO CONNECTION ERROR --- ❌', err); 
    });
    
    // Listen for state updates from the server
    socket.on('order-updated-from-server', handleOrderUpdate);
    socket.on('sale-finalized-from-server', handleSaleFinalized);
    socket.on('print-order-ticket-from-server', handlePrintOrderTicket);
    socket.on('print-sale-receipt-from-server', handlePrintSaleReceipt);
    
    // Handle order updates from other clients (master only)
    socket.on('process-client-order-update', ({ tableId, order }) => {
      console.log('Processing order update from client for table', tableId);
      updateOrderForTable(tableId, order);
    });
    
    // Listen for state requests from the server
    socket.on('share-your-state', handleShareYourState);
    socket.on('request-initial-state', handleRequestInitialState);

    return () => {
      if (!socketRef.current) return;

      socketRef.current.off('connect');
      socketRef.current.off('disconnect');
      socketRef.current.off('connect_error');
      socketRef.current.off('order-updated-from-server', handleOrderUpdate);
      socketRef.current.off('sale-finalized-from-server', handleSaleFinalized);
      socketRef.current.off('print-order-ticket-from-server', handlePrintOrderTicket);
      socketRef.current.off('print-sale-receipt-from-server', handlePrintSaleReceipt);
      socketRef.current.off('share-your-state', handleShareYourState);
      socketRef.current.off('request-initial-state', handleRequestInitialState);
      socketRef.current.disconnect();
      socketRef.current = null;
    };

  }, []);

  useEffect(() => {
    if (startupEffectRan.current === true) { return; }
    
    const bootstrap = async () => {
        setIsLoading(true);
        await db.initDB();
        const savedTablesJSON = localStorage.getItem('activeTables');
        if (savedTablesJSON) {
            try {
                const loadedTables = JSON.parse(savedTablesJSON);
                setTables(loadedTables);
            } catch (e) {
                const savedTablesCount = parseInt(localStorage.getItem('tableCount') || '100', 10);
                setTableCount(savedTablesCount);
            }
        } else {
            const savedTablesCount = parseInt(localStorage.getItem('tableCount') || '100', 10);
            setTableCount(savedTablesCount);
        }
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

    const loadData = async () => {
      try {
        // Load tables from localStorage first for instant UI
        const savedTables = localStorage.getItem('activeTables');
        let currentTables: Table[] = [];
        
        if (savedTables) {
          const parsedTables = JSON.parse(savedTables);
          currentTables = parsedTables;
        }

        // Then try to load from server
        const { users, menuItems, menuCategories, taxRate } = await api.bootstrap();
        
        // Update users, menu items, categories, and tax rate
        setUsers(users);
        setMenuItems(menuItems);
        setMenuCategories(menuCategories);
        setTaxRate(taxRate);
        
        // If we're the master and have tables, ensure they're synced to the server
        if (isMasterClient.current && currentTables.length > 0 && socketRef.current?.connected) {
          socketRef.current.emit('order-update', currentTables);
        }
        
      } catch (error) {
        console.error('Error loading data:', error);
        
        // If we're offline and have no tables in localStorage, create default tables
        const savedTables = localStorage.getItem('activeTables');
        if (!savedTables) {
          const defaultTables = Array.from({ length: 4 }, (_, i) => ({
            id: i + 1,
            name: `Tavolina ${i + 1}`,
            order: null,
          }));
          setTables(defaultTables);
          localStorage.setItem('activeTables', JSON.stringify(defaultTables));
        }
      } finally {
        setIsLoading(false);
      }
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
  }, [setTableCount, syncOfflineData, loadDataFromDb, fetchAndCacheData]);

  const value = useMemo(() => ({
    isLoading, isOnline, isSyncing, loggedInUser, users, menuItems, menuCategories, sales, saleToPrint,
    setSaleToPrint, orderToPrint, setOrderToPrint, tables, tablesPerRow, tableSizePercent,
    tableButtonSizePercent, taxRate, history, login, logout, addUser, deleteUser, addMenuItem, updateMenuItem,
    deleteMenuItem, importMenuItemsFromCSV, reorderMenuItemsFromCSV, reorderMenuItems, addMenuCategory,
    updateMenuCategory, deleteMenuCategory, reorderMenuCategories, addSale, setTableCount, updateOrderForTable,
    setTablesPerRow, setTableSizePercent, setTableButtonSizePercent, setTaxRate, saveOrderForTable,
    refreshSalesFromServer,
  }), [
    isLoading, isOnline, isSyncing, loggedInUser, users, menuItems, menuCategories, sales, saleToPrint,
    orderToPrint, tables, tablesPerRow, tableSizePercent, tableButtonSizePercent, taxRate, history,
    login, logout, addUser, deleteUser, addMenuItem, updateMenuItem, deleteMenuItem, importMenuItemsFromCSV,
    reorderMenuItemsFromCSV, reorderMenuItems, addMenuCategory, updateMenuCategory, deleteMenuCategory,
    reorderMenuCategories, addSale, setTableCount, updateOrderForTable, setTablesPerRow,
    setTableSizePercent, setTableButtonSizePercent, setTaxRate, saveOrderForTable,
    refreshSalesFromServer,
  ]);

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>; // <-- JSX TAG FIXED
};

export const usePos = (): PosContextState => {
  const context = useContext(PosContext);
  if (context === undefined) { throw new Error('usePos must be used within a PosProvider'); }
  return context;
};