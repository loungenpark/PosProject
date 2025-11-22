import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, MenuItem, Sale, Order, Table, UserRole, MenuCategory, HistoryEntry, OrderItem } from '../types';
import * as db from '../utils/db';
import * as api from '../utils/api';
import { io, Socket } from 'socket.io-client';

// Ensure API URL works on phones (dynamic IP)
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
  // --- STATE DEFINITIONS ---
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
  
  // Initialize tables immediately if possible, but it will be overwritten by useEffect
  const [tables, setTables] = useState<Table[]>([]);
  
  const [tablesPerRow, setTablesPerRowState] = useState<number>(5);
  const [tableSizePercent, setTableSizePercentState] = useState<number>(100);
  const [tableButtonSizePercent, setTableButtonSizePercentState] = useState<number>(100);
  const [taxRate, setTaxRateState] = useState<number>(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
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
          let { users: serverUsers, menuItems: serverItems, menuCategories: serverCats, taxRate, tableCount } = await api.bootstrap();
          
          if (typeof tableCount === 'number' && tableCount > 0) {
            const currentLocal = parseInt(localStorage.getItem('tableCount') || '0', 10);
            if (tableCount !== currentLocal) {
                console.log(`📥 Syncing Table Count from DB: ${tableCount}`);
                localStorage.setItem('tableCount', tableCount.toString());
                
                setTables(prevTables => {
                    return Array.from({ length: tableCount }, (_, i) => {
                        const tableId = i + 1;
                        const existing = prevTables.find(t => t.id === tableId);
                        if (existing && existing.order) {
                            return existing;
                        }
                        return { id: tableId, name: `${tableId}`, order: null };
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
    } catch (e) { console.error("Add menu item failed", e); }
  }, [isOnline, syncOfflineData]);

  const updateMenuItem = useCallback(async (updatedItem: MenuItem) => {
    try {
      setMenuItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
      await db.put(updatedItem, 'menuItems');
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
    const sortedItems = [...items].sort((a, b) => {
      if (a.display_order === null && b.display_order === null) return 0;
      if (a.display_order === null) return 1;
      if (b.display_order === null) return -1;
      return a.display_order - b.display_order;
    });
    setMenuItems(sortedItems);
    await db.bulkPut(sortedItems, 'menuItems');
    
    if (isOnline && isBackendConfigured) {
      const orderedIds = sortedItems.filter(item => item.display_order !== null).map(item => item.id);
      if (orderedIds.length > 0) {
        try {
          await fetch(`${SOCKET_URL}/api/menu-items/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedIds })
          });
        } catch (error) { console.error('Failed to sync reorder:', error); }
      }
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
      
        setTimeout(() => {
            if (socketRef.current?.connected) {
               socketRef.current.emit('print-order-ticket', printPayload);
            }
        }, 200);
    }
  }, [tables, updateOrderForTable, loggedInUser, isOnline]);

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
    if (isOnline) { setTimeout(() => { syncOfflineData(); }, 0); }

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
      console.log("Sent print request for Sale ID:", newSale.id);
      socketRef.current.emit('print-sale-receipt', newSale);
    }
  }, [loggedInUser, tables, menuItems, isOnline, updateOrderForTable, addHistoryEntry, updateMenuItem, syncOfflineData]);
  
  const setTablesPerRow = useCallback((count: number) => { localStorage.setItem('tablesPerRow', count.toString()); setTablesPerRowState(count); }, []);
  const setTableSizePercent = useCallback((size: number) => { localStorage.setItem('tableSizePercent', size.toString()); setTableSizePercentState(size); }, []);
  const setTableButtonSizePercent = useCallback((size: number) => { localStorage.setItem('tableButtonSizePercent', size.toString()); setTableButtonSizePercentState(size); }, []);
  
  const importMenuItemsFromCSV = useCallback(async (file: File) => {
    return { itemsAdded: 0, categoriesAdded: 0, itemsSkipped: 0 };
  }, []);

  const reorderMenuItemsFromCSV = useCallback(async (file: File) => {
      return { success: true, reorderedCount: 0, notFoundCount: 0 };
  }, []);

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

    socket.on('connect', () => { 
      console.log(`✅ SOCKET CONNECTED (${isMasterClient.current ? 'MASTER/ADMIN' : 'CLIENT/WAITER'})`);
      if (isMasterClient.current) socket.emit('identify-as-master');
      else socket.emit('request-latest-state');
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

    const bootstrap = async () => {
        setIsLoading(true);
        await db.initDB();
        
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

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};

export const usePos = (): PosContextState => {
  const context = useContext(PosContext);
  if (context === undefined) { throw new Error('usePos must be used within a PosProvider'); }
  return context;
};