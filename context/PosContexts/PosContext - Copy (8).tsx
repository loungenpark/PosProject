import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, MenuItem, Sale, Order, Table, UserRole, MenuCategory, HistoryEntry, OrderItem, Printer } from '../types';
import * as db from '../utils/db';
import * as api from '../api';
import { DEFAULT_USERS } from '../constants';
import { io, Socket } from 'socket.io-client';
import Papa from 'papaparse';

const isBackendConfigured = !!(window as any).API_URL;

const SOCKET_URL = (window as any).API_URL || 'http://localhost:3001';
const socket: Socket = io(SOCKET_URL, {
  transports: ['websocket'],
});

interface OrderToPrint {
  table: Table;
  newItems: OrderItem[];
}

interface PosContextState {
  isLoading: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  loggedInUser: User | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  users: User[];
  addUser: (user: Omit<User, 'id'>) => Promise<void>;
  deleteUser: (userId: number) => Promise<boolean>;
  menuItems: MenuItem[];
  addMenuItem: (item: Omit<MenuItem, 'id'>) => Promise<void>;
  updateMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (id: number) => Promise<void>;
  importMenuItemsFromCSV: (file: File) => Promise<{ itemsAdded: number, categoriesAdded: number, itemsSkipped: number }>;
  // --- NEW: Add CSV reorder function to interface ---
  reorderMenuItemsFromCSV: (file: File) => Promise<{ success: boolean, reorderedCount: number, notFoundCount: number }>;
  reorderMenuItems: (items: MenuItem[]) => Promise<void>;
  menuCategories: MenuCategory[];
  addMenuCategory: (name: string) => Promise<void>;
  updateMenuCategory: (category: MenuCategory) => Promise<void>;
  deleteMenuCategory: (id: number) => Promise<void>;
  reorderMenuCategories: (categories: MenuCategory[]) => Promise<void>;
  sales: Sale[];
  addSale: (order: Order, tableId: number) => Promise<void>;
  saleToPrint: Sale | null;
  orderToPrint: OrderToPrint | null;
  tables: Table[];
  setTableCount: (count: number) => void;
  updateOrderForTable: (tableId: number, order: Order | null) => void;
  tablesPerRow: number;
  setTablesPerRow: (count: number) => void;
  tableSizePercent: number;
  setTableSizePercent: (size: number) => void;
  tableButtonSizePercent: number;
  setTableButtonSizePercent: (size: number) => void;
  taxRate: number;
  setTaxRate: (rate: number) => Promise<void>;
  history: HistoryEntry[];
  saveOrderForTable: (tableId: number, updatedOrder: Order | null, newItems: OrderItem[]) => Promise<void>;
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
  const [taxRate, setTaxRateState] = useState<number>(0.09);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const syncInProgress = useRef(false);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('✅ Real-time connection to server established.');
    });

    socket.on('disconnect', () => {
      console.log('🔌 Real-time connection to server lost.');
    });

    socket.on('order-updated-from-server', (updatedTables: Table[]) => {
      console.log('Received real-time order update from another device.');
      setTables(updatedTables);
    });
    
    socket.on('sale-finalized-from-server', (newSale: Sale) => {
        console.log('Received real-time finalized sale from another device.');
        setSales(prevSales => [newSale, ...prevSales].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setSaleToPrint(newSale);
    });

    socket.on('print-order-ticket-from-server', (orderData: OrderToPrint) => {
        console.log('Received real-time print request from another device.');
        setOrderToPrint(orderData);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('order-updated-from-server');
      socket.off('sale-finalized-from-server');
      socket.off('print-order-ticket-from-server');
    };
  }, []);

  const fetchAndCacheData = useCallback(async () => {
    if (!isBackendConfigured) return;
    try {
        const [{ users, menuItems, menuCategories }, salesData, historyData] = await Promise.all([
          api.bootstrap(),
          api.getSales(),
          api.getHistory(),
        ]);

        await db.clearStaticData();
        await db.bulkPut(users, 'users');
        await db.bulkPut(menuItems, 'menuItems');
        await db.bulkPut(menuCategories, 'menuCategories');

        setUsers(users);
        setMenuItems(menuItems);
        setMenuCategories(menuCategories);
        setSales(salesData.map(s => ({...s, date: new Date(s.date)})));
        setHistory(historyData.map(h => ({...h, timestamp: new Date(h.timestamp)})));
        
        setIsOnline(true);
    } catch (error) {
        console.error("Failed to fetch from API, going offline:", error);
        setIsOnline(false);
        await loadDataFromDb();
    }
  }, []);

  const syncOfflineData = useCallback(async () => {
    if (syncInProgress.current || !isBackendConfigured) return;
    syncInProgress.current = true;
    setIsSyncing(true);

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
                    case 'SET_TAX_RATE': break;
                }
                await db.removeFromSyncQueue(item.id!);
            } catch (error) {
                console.error(`Failed to sync action ${item.type}:`, error);
                if (item.type !== 'SET_TAX_RATE') {
                    setIsSyncing(false);
                    syncInProgress.current = false;
                    return; 
                }
            }
        }
    }

    await fetchAndCacheData();

    setIsSyncing(false);
    syncInProgress.current = false;
  }, [fetchAndCacheData]);

  const loadDataFromDb = useCallback(async () => {
    const [dbUsers, dbMenuItems, dbMenuCategories, dbSales, dbHistory] = await Promise.all([
        db.getAll<User>('users'),
        db.getAll<MenuItem>('menuItems'),
        db.getAll<MenuCategory>('menuCategories'),
        db.getAll<Sale>('sales'),
        db.getAll<HistoryEntry>('history'),
    ]);
    setUsers(dbUsers);
    setMenuItems(dbMenuItems);
    setMenuCategories(dbMenuCategories);
    setSales(dbSales.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setHistory(dbHistory.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  }, []);

  const setTableCount = useCallback((count: number) => {
    localStorage.setItem('tableCount', count.toString());
    setTables(currentTables => {
        const newTables: Table[] = [];
        for (let i = 0; i < count; i++) {
            if (currentTables[i]) {
                newTables.push(currentTables[i]);
            } else {
                newTables.push({ id: i + 1, name: `Tavolina ${i + 1}`, order: null });
            }
        }
        return newTables;
    });
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
        setIsLoading(true);
        await db.initDB();

        if (!isBackendConfigured) {
            const dbUsers = await db.getAll<User>('users');
            if (dbUsers.length === 0) {
                const usersToAdd: User[] = DEFAULT_USERS.map((user, index) => ({ ...user, id: index + 1 }));
                await db.bulkPut(usersToAdd, 'users');
            }
        }
        
        const savedTablesCount = parseInt(localStorage.getItem('tableCount') || '100', 10);
        const savedTablesPerRow = parseInt(localStorage.getItem('tablesPerRow') || '10', 10);
        const savedTableSize = parseInt(localStorage.getItem('tableSizePercent') || '100', 10);
        const savedButtonSize = parseInt(localStorage.getItem('tableButtonSizePercent') || '100', 10);
        const savedTaxRate = parseFloat(localStorage.getItem('taxRate') || '0.09');
        
        setTablesPerRowState(savedTablesPerRow);
        setTableSizePercentState(savedTableSize);
        setTableButtonSizePercentState(savedButtonSize);
        setTaxRateState(savedTaxRate);
        
        const savedTablesJSON = localStorage.getItem('activeTables');
        if (savedTablesJSON) {
          setTables(JSON.parse(savedTablesJSON));
        } else {
          setTableCount(savedTablesCount);
        }

        if (isBackendConfigured && navigator.onLine) {
            await syncOfflineData();
        } else {
            await loadDataFromDb();
        }
        setIsLoading(false);
    };
    bootstrap();

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineData();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, [setTableCount, syncOfflineData, loadDataFromDb]);
  
  useEffect(() => {
    if (tables.length > 0) {
      localStorage.setItem('activeTables', JSON.stringify(tables));
    }
  }, [tables]);

  const addHistoryEntry = useCallback(async (tableId: number, details: string) => {
    if (!loggedInUser) return;
    const newEntry: HistoryEntry = {
        id: `hist-${Date.now()}`,
        tableId,
        timestamp: new Date(),
        user: loggedInUser,
        details,
    };
    if (isOnline && isBackendConfigured) {
        try {
            const savedEntry = await api.addHistoryEntry(tableId, details, loggedInUser);
            setHistory(prev => [{...savedEntry, timestamp: new Date(savedEntry.timestamp)}, ...prev]);
            await db.put(savedEntry, 'history');
        } catch (e) {
            setIsOnline(false);
            await db.addToSyncQueue({ type: 'ADD_HISTORY_ENTRY', payload: { tableId, details, user: loggedInUser } });
            setHistory(prev => [newEntry, ...prev]);
            await db.put(newEntry, 'history');
        }
    } else {
        await db.addToSyncQueue({ type: 'ADD_HISTORY_ENTRY', payload: { tableId, details, user: loggedInUser } });
        setHistory(prev => [newEntry, ...prev]);
        await db.put(newEntry, 'history');
    }
  }, [loggedInUser, isOnline]);

  const setTaxRate = async (ratePercent: number) => {
    const newRate = Math.max(0, ratePercent) / 100;
    setTaxRateState(newRate);
    localStorage.setItem('taxRate', newRate.toString());
  };

  const login = async (pin: string): Promise<boolean> => {
    let user: User | undefined;
    if (isOnline && isBackendConfigured) {
        try {
            const response = await api.login(pin);
            user = response.user || undefined;
        } catch (e) {
             setIsOnline(false);
             const dbUsers = await db.getAll<User>('users');
             user = dbUsers.find((u) => u.pin === pin);
        }
    } else {
       const dbUsers = await db.getAll<User>('users');
       user = dbUsers.find((u) => u.pin === pin);
    }
    
    if (user) {
      setLoggedInUser(user);
      return true;
    }
    return false;
  };

  const logout = () => setLoggedInUser(null);

  const addUser = async (user: Omit<User, 'id'>) => {
    if (isOnline && isBackendConfigured) {
        try {
            const newUserFromServer = await api.addUser(user);
            setUsers(prev => [...prev, newUserFromServer]);
            await db.put(newUserFromServer, 'users');
        } catch (e) {
            console.error("Failed to add user online:", e);
            alert("Failed to save user. Check server connection.");
        }
    } else {
        alert("Cannot add user while offline.");
    }
  };

  const deleteUser = async (userId: number): Promise<boolean> => {
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) return false;
    if (userToDelete.role === UserRole.ADMIN && users.filter(u => u.role === UserRole.ADMIN).length <= 1) {
      alert("Nuk mund të fshini administratorin e fundit.");
      return false;
    }
    
    setUsers(prev => prev.filter(u => u.id !== userId));
    await db.remove(userId, 'users');

    if (isOnline && isBackendConfigured) {
        try {
            await api.deleteUser(userId);
        } catch (e) {
            setIsOnline(false);
            await db.addToSyncQueue({ type: 'DELETE_USER', payload: { userId } });
        }
    } else {
        await db.addToSyncQueue({ type: 'DELETE_USER', payload: { userId } });
    }
    return true;
  };

  const addMenuItem = async (item: Omit<MenuItem, 'id'>) => {
    if (isOnline && isBackendConfigured) {
        try {
            const newItemFromServer = await api.addMenuItem(item);
            setMenuItems(prev => [...prev, newItemFromServer].sort((a,b) => (a.display_order ?? 999) - (b.display_order ?? 999)));
            await db.put(newItemFromServer, 'menuItems');
        } catch (e) {
            console.error("Failed to add menu item online:", e);
            alert("Failed to save menu item. Check server connection.");
        }
    } else {
        alert("Cannot add menu item while offline.");
    }
  };

  const updateMenuItem = async (updatedItem: MenuItem) => {
    setMenuItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
    await db.put(updatedItem, 'menuItems');
    if (isOnline && isBackendConfigured) {
        try {
            await api.updateMenuItem(updatedItem);
        } catch (e) {
            setIsOnline(false);
            await db.addToSyncQueue({ type: 'UPDATE_MENU_ITEM', payload: updatedItem });
        }
    } else {
        await db.addToSyncQueue({ type: 'UPDATE_MENU_ITEM', payload: updatedItem });
    }
  };

  const deleteMenuItem = async (id: number) => {
    setMenuItems((prev) => prev.filter((item) => item.id !== id));
    await db.remove(id, 'menuItems');
    if (isOnline && isBackendConfigured) {
        try {
            await api.deleteMenuItem(id);
        } catch (e) {
            setIsOnline(false);
            await db.addToSyncQueue({ type: 'DELETE_MENU_ITEM', payload: { id } });
        }
    } else {
        await db.addToSyncQueue({ type: 'DELETE_MENU_ITEM', payload: { id } });
    }
  };
  
  const addMenuCategory = async (name: string) => {
    if (menuCategories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
        console.log(`Category "${name}" already exists in state. Skipping.`);
        return;
    }

    if (isOnline && isBackendConfigured) {
        try {
            const newCategoryFromServer = await api.addMenuCategory(name);
            setMenuCategories(prev => [...prev, newCategoryFromServer].sort((a,b) => (a.display_order ?? 999) - (b.display_order ?? 999)));
            await db.put(newCategoryFromServer, 'menuCategories');
        } catch (e) {
            console.error("Failed to add category online:", e);
            alert("Failed to save category. Check server connection.");
        }
    } else {
        alert("Cannot add category while offline.");
    }
  };

  const updateMenuCategory = async (updatedCategory: MenuCategory) => {
    const oldCategory = menuCategories.find(c => c.id === updatedCategory.id);
    if (!oldCategory) return;

    setMenuCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c).sort((a,b) => (a.display_order ?? 999) - (b.display_order ?? 999)));
    await db.put(updatedCategory, 'menuCategories');

    const itemsToUpdate = menuItems.filter(item => item.category === oldCategory.name);
    
    setMenuItems(prevItems => prevItems.map(item => item.category === oldCategory.name ? { ...item, category: updatedCategory.name } : item));
    for (const item of itemsToUpdate) {
        const updatedItem = { ...item, category: updatedCategory.name };
        await db.put(updatedItem, 'menuItems');
    }
    
    if (isOnline && isBackendConfigured) {
        try {
            await api.updateMenuCategory(updatedCategory);
        } catch (e) {
            setIsOnline(false);
            await db.addToSyncQueue({ type: 'UPDATE_MENU_CATEGORY', payload: updatedCategory });
        }
    } else {
        await db.addToSyncQueue({ type: 'UPDATE_MENU_CATEGORY', payload: updatedCategory });
    }
  };

  const deleteMenuCategory = async (id: number) => {
    const categoryToDelete = menuCategories.find(c => c.id === id);
    if (!categoryToDelete) return;
    if (menuItems.some(item => item.category === categoryToDelete.name)) {
        alert("Nuk mund ta fshini këtë menu sepse disa artikuj i janë caktuar akoma.");
        return;
    }
    
    setMenuCategories(prev => prev.filter(c => c.id !== id));
    await db.remove(id, 'menuCategories');

    if (isOnline && isBackendConfigured) {
        try {
            await api.deleteMenuCategory(id);
        } catch (e) {
            setIsOnline(false);
            await db.addToSyncQueue({ type: 'DELETE_MENU_CATEGORY', payload: { id } });
        }
    } else {
        await db.addToSyncQueue({ type: 'DELETE_MENU_CATEGORY', payload: { id } });
    }
  };

  // --- CORRECTED: Reordering functions now correctly update state and call the right API functions ---
  const reorderMenuCategories = async (categories: MenuCategory[]) => {
    setMenuCategories(categories);
    try {
        const orderedIds = categories.map(c => c.id);
        await api.reorderMenuCategories(orderedIds);
    } catch (error) {
        console.error("Failed to save category order:", error);
        alert("Ruajtja e renditjes së kategorive dështoi.");
        fetchAndCacheData(); // Revert on failure
    }
  };

  const reorderMenuItems = async (items: MenuItem[]) => {
    setMenuItems(items);
    try {
        const orderedIds = items.map(i => i.id);
        await api.reorderMenuItems(orderedIds);
    } catch (error) {
        console.error("Failed to save item order:", error);
        alert("Ruajtja e renditjes së artikujve dështoi.");
        fetchAndCacheData(); // Revert on failure
    }
  };
  // --- END CORRECTION ---

  const updateOrderForTable = (tableId: number, order: Order | null) => {
      const nextTablesState = tables.map(table => 
          table.id === tableId ? { ...table, order } : table
      );
      setTables(nextTablesState);
      socket.emit('order-update', nextTablesState);
  };

  const saveOrderForTable = async (tableId: number, updatedOrder: Order | null, newItems: OrderItem[]) => {
    updateOrderForTable(tableId, updatedOrder);
    
    const table = tables.find(t => t.id === tableId);

    if (newItems.length > 0 && table) {
        const kitchenItems = newItems.filter(item => item.printer === Printer.KITCHEN);
        const barItems = newItems.filter(item => item.printer === Printer.BAR);

        if (kitchenItems.length > 0) {
            const orderData = { table: table, newItems: kitchenItems };
            setOrderToPrint(orderData);
            socket.emit('print-order-ticket', orderData);
        }
        if (barItems.length > 0) {
            const orderData = { table: table, newItems: barItems };
            setOrderToPrint(orderData);
            socket.emit('print-order-ticket', orderData);
        }
        
        if (kitchenItems.length > 0) {
            const details = `Dërguar në Kuzhinë: ${kitchenItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}`;
            await addHistoryEntry(tableId, details);
        }
        if (barItems.length > 0) {
            const details = `Dërguar në Shank: ${barItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}`;
            await addHistoryEntry(tableId, details);
        }
    }
  };

  const addSale = async (order: Order, tableId: number) => {
    if (!loggedInUser) return;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const newSale: Sale = {
        id: `sale-${Date.now()}`,
        date: new Date(),
        order,
        user: loggedInUser,
        tableId: table.id,
        tableName: table.name,
    };
    
    setSales((prev) => [newSale, ...prev]);
    await db.put(newSale, 'sales');
    setSaleToPrint(newSale);
    updateOrderForTable(tableId, null); 
    await addHistoryEntry(tableId, `Fatura u finalizua. Totali: ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(order.total)}`);

    for (const saleItem of order.items) {
      const menuItem = menuItems.find(mi => mi.id === saleItem.id);
      if (menuItem && menuItem.trackStock && isFinite(menuItem.stock)) {
        const newStock = menuItem.stock - saleItem.quantity;
        await updateMenuItem({ ...menuItem, stock: newStock });
      }
    }
    
    socket.emit('sale-finalized', newSale);

    if (isOnline && isBackendConfigured) {
        try {
            await api.addSale(order, table.id, table.name, loggedInUser);
        } catch (e) {
            setIsOnline(false);
            await db.addToSyncQueue({ type: 'ADD_SALE', payload: { order, tableId: table.id, tableName: table.name, user: loggedInUser } });
        }
    } else {
        await db.addToSyncQueue({ type: 'ADD_SALE', payload: { order, tableId: table.id, tableName: table.name, user: loggedInUser } });
    }
  };

  useEffect(() => {
    if (saleToPrint) {
      const isThisDeviceThePrintStation = localStorage.getItem('isPrintStation') === 'true';
      
      if (isThisDeviceThePrintStation) {
        console.log('This is the Print Station. Printing receipt...');
        setTimeout(() => {
           window.print();
           setSaleToPrint(null);
        }, 100);
      } else {
        console.log('This is not the Print Station. Ignoring print request.');
        setSaleToPrint(null);
      }
    }
  }, [saleToPrint]);

  useEffect(() => {
    if (orderToPrint) {
      const isThisDeviceThePrintStation = localStorage.getItem('isPrintStation') === 'true';
      
      if (isThisDeviceThePrintStation) {
        console.log('This is the Print Station. Printing order ticket...');
        setTimeout(() => {
           window.print();
           setOrderToPrint(null);
        }, 100);
      } else {
        console.log('This is not the Print Station. Ignoring order print request.');
        setOrderToPrint(null);
      }
    }
  }, [orderToPrint]);
  
  const setTablesPerRow = (count: number) => {
      localStorage.setItem('tablesPerRow', count.toString());
      setTablesPerRowState(count);
  };
  const setTableSizePercent = (size: number) => {
      localStorage.setItem('tableSizePercent', size.toString());
      setTableSizePercentState(size);
  };
  const setTableButtonSizePercent = (size: number) => {
      localStorage.setItem('tableButtonSizePercent', size.toString());
      setTableButtonSizePercentState(size);
  };
  
  const importMenuItemsFromCSV = (file: File): Promise<{ itemsAdded: number, categoriesAdded: number, itemsSkipped: number }> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                let itemsAdded = 0;
                let categoriesAdded = 0;
                let itemsSkipped = 0;
                
                const currentItems = await db.getAll<MenuItem>('menuItems');
                const currentCategories = await db.getAll<MenuCategory>('menuCategories');

                const newCategoriesToCreate = new Set<string>();
                const existingCategoryNames = new Set(currentCategories.map(c => c.name.toLowerCase()));
                const existingItemNames = new Set(currentItems.map(i => i.name.toLowerCase()));

                for (const row of results.data as any[]) {
                    const name = (row as any).Name?.trim();
                    const price = parseFloat((row as any).Price);
                    const category = (row as any).Category?.trim();
                    let printer = (row as any).Printer?.trim().toUpperCase();

                    if (!name || isNaN(price) || !category || !printer) {
                        console.warn('Skipping invalid row:', row);
                        itemsSkipped++;
                        continue;
                    }
                    
                    if (existingItemNames.has(name.toLowerCase())) {
                        console.warn(`Skipping duplicate item: ${name}`);
                        itemsSkipped++;
                        continue;
                    }

                    if (printer !== 'BAR' && printer !== 'KITCHEN') {
                         printer = 'KITCHEN';
                    }
                    
                    if(printer === 'SHANK') {
                        printer = 'BAR';
                    }

                    if (!existingCategoryNames.has(category.toLowerCase())) {
                        if(!newCategoriesToCreate.has(category)) {
                           newCategoriesToCreate.add(category);
                        }
                    }
                }

                for (const newCatName of Array.from(newCategoriesToCreate)) {
                    try {
                        await addMenuCategory(newCatName);
                        categoriesAdded++;
                    } catch(error) {
                        console.error(`Failed to add new category "${newCatName}":`, error);
                    }
                }
                
                const finalCategories = await db.getAll<MenuCategory>('menuCategories');
                const finalCategoryNames = new Set(finalCategories.map(c => c.name.toLowerCase()));

                for (const row of results.data as any[]) {
                    const name = (row as any).Name?.trim();
                    const category = (row as an).Category?.trim();
                    
                    const printerValue = (row as any).Printer?.trim().toUpperCase();

                    if (!name || existingItemNames.has(name.toLowerCase()) || !category || !finalCategoryNames.has(category.toLowerCase())) {
                        continue; 
                    }

                    const newItem: Omit<MenuItem, 'id'> = {
                        name,
                        price: parseFloat((row as any).Price),
                        category: category,
                        printer: (printerValue === 'SHANK' ? Printer.BAR : (printerValue === 'BAR' ? Printer.BAR : Printer.KITCHEN)),
                        trackStock: false,
                        stock: Infinity,
                        stockThreshold: 0,
                    };

                    try {
                        await addMenuItem(newItem);
                        existingItemNames.add(name.toLowerCase());
                        itemsAdded++;
                    } catch (error) {
                        console.error(`Failed to add item "${name}":`, error);
                        itemsSkipped++;
                    }
                }
                
                await fetchAndCacheData();
                resolve({ itemsAdded, categoriesAdded, itemsSkipped });
            },
            error: (error) => {
                console.error("CSV parsing error:", error);
                reject(error);
            }
        });
    });
  };

  // --- NEW: Function to handle reordering from CSV ---
  const reorderMenuItemsFromCSV = async (file: File): Promise<{ success: boolean, reorderedCount: number, notFoundCount: number }> => {
    try {
        const result = await api.reorderMenuItemsFromCSV(file);
        // After a successful reorder, we must refetch everything to get the new order
        await fetchAndCacheData();
        return result;
    } catch (error) {
        console.error("Failed to reorder items from CSV:", error);
        alert(`Gabim gjatë renditjes: ${error instanceof Error ? error.message : 'Gabim i panjohur'}`);
        throw error; // Re-throw the error so the component knows it failed
    }
  };

  const value = {
    isLoading, isOnline, isSyncing,
    loggedInUser, login, logout,
    users, addUser, deleteUser,
    menuItems, addMenuItem, updateMenuItem, deleteMenuItem,
    importMenuItemsFromCSV,
    reorderMenuItemsFromCSV, // <-- Added new function
    reorderMenuItems,
    menuCategories, addMenuCategory, updateMenuCategory, deleteMenuCategory,
    reorderMenuCategories,
    sales, addSale, saleToPrint,
    orderToPrint,
    tables, setTableCount, updateOrderForTable,
    tablesPerRow, setTablesPerRow,
    tableSizePercent, setTableSizePercent,
    tableButtonSizePercent, setTableButtonSizePercent,
    taxRate, setTaxRate,
    history, saveOrderForTable,
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};

export const usePos = (): PosContextState => {
  const context = useContext(PosContext);
  if (context === undefined) {
    throw new Error('usePos must be used within a PosProvider');
  }
  return context;
};