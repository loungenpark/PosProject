
import { SyncQueueItem } from "../types";

const DB_NAME = 'pos-offline-db';
const DB_VERSION = 1;

let db: IDBDatabase;

const STORES = {
    users: 'users',
    menuItems: 'menuItems',
    menuCategories: 'menuCategories',
    sales: 'sales',
    history: 'history',
    syncQueue: 'syncQueue',
};

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', request.error);
            reject('Error opening IndexedDB.');
        };

        request.onsuccess = (event) => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const tempDb = (event.target as IDBOpenDBRequest).result;
            if (!tempDb.objectStoreNames.contains(STORES.users)) {
                tempDb.createObjectStore(STORES.users, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(STORES.menuItems)) {
                tempDb.createObjectStore(STORES.menuItems, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(STORES.menuCategories)) {
                tempDb.createObjectStore(STORES.menuCategories, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(STORES.sales)) {
                tempDb.createObjectStore(STORES.sales, { keyPath: 'id' });
            }
             if (!tempDb.objectStoreNames.contains(STORES.history)) {
                tempDb.createObjectStore(STORES.history, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(STORES.syncQueue)) {
                tempDb.createObjectStore(STORES.syncQueue, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
};

export const put = <T>(item: T, storeName: keyof typeof STORES): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const bulkPut = <T>(items: T[], storeName: keyof typeof STORES): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (items.length === 0) return resolve();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        items.forEach(item => store.put(item));

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getAll = <T>(storeName: keyof typeof STORES): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const remove = (key: IDBValidKey, storeName: keyof typeof STORES): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const clearStore = (storeName: keyof typeof STORES): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const clearStaticData = async () => {
    await clearStore('users');
    await clearStore('menuItems');
    await clearStore('menuCategories');
}

// --- Sync Queue Specific Functions ---

export const addToSyncQueue = (item: Omit<SyncQueueItem, 'id' | 'timestamp'>): Promise<void> => {
    const queueItem: SyncQueueItem = {
        ...item,
        timestamp: Date.now()
    }
    return put(queueItem, 'syncQueue');
};

export const getSyncQueue = (): Promise<SyncQueueItem[]> => {
    return getAll<SyncQueueItem>('syncQueue');
};

export const removeFromSyncQueue = (id: number): Promise<void> => {
    return remove(id, 'syncQueue');
};
