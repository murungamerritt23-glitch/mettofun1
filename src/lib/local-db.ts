import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Shop, Item, GameAttempt, Admin, SyncQueue, CustomerSession, PendingCustomer, AdminLevel } from '@/types';

interface MetoFunDB extends DBSchema {
  shops: {
    key: string;
    value: Shop;
    indexes: { 'by-code': string };
  };
  items: {
    key: string;
    value: Item;
    indexes: { 'by-shop': string };
  };
  attempts: {
    key: string;
    value: GameAttempt;
    indexes: { 'by-shop': string; 'by-phone': string; 'by-date': string };
  };
  admins: {
    key: string;
    value: Admin;
  };
  syncQueue: {
    key: string;
    value: SyncQueue;
    indexes: { 'by-status': string };
  };
  sessions: {
    key: string;
    value: CustomerSession;
  };
  pendingCustomers: {
    key: string;
    value: PendingCustomer;
    indexes: { 'by-shop': string; 'by-phone': string; 'by-authorized': string };
  };
  settings: {
    key: string;
    value: any;
  };
}

let db: IDBPDatabase<MetoFunDB> | null = null;

export const initDB = async (): Promise<IDBPDatabase<MetoFunDB>> => {
  if (db) return db;

  db = await openDB<MetoFunDB>('metofun-db', 2, {
    upgrade(database, oldVersion) {
      // Shops store - only create if it doesn't exist
      if (!database.objectStoreNames.contains('shops')) {
        const shopStore = database.createObjectStore('shops', { keyPath: 'id' });
        shopStore.createIndex('by-code', 'shopCode');
      }

      // Items store - only create if it doesn't exist
      if (!database.objectStoreNames.contains('items')) {
        const itemStore = database.createObjectStore('items', { keyPath: 'id' });
        itemStore.createIndex('by-shop', 'shopId');
      }

      // Attempts store - only create if it doesn't exist
      if (!database.objectStoreNames.contains('attempts')) {
        const attemptStore = database.createObjectStore('attempts', { keyPath: 'id' });
        attemptStore.createIndex('by-shop', 'shopId');
        attemptStore.createIndex('by-phone', 'phoneNumber');
        attemptStore.createIndex('by-date', 'timestamp');
      }

      // Admins store - only create if it doesn't exist
      if (!database.objectStoreNames.contains('admins')) {
        database.createObjectStore('admins', { keyPath: 'id' });
      }

      // Sync queue store - only create if it doesn't exist
      if (!database.objectStoreNames.contains('syncQueue')) {
        const syncStore = database.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('by-status', 'status');
      }

      // Sessions store - only create if it doesn't exist
      if (!database.objectStoreNames.contains('sessions')) {
        database.createObjectStore('sessions', { keyPath: 'phoneNumber' });
      }

      // Pending customers store (v2) - only create if it doesn't exist
      if (!database.objectStoreNames.contains('pendingCustomers')) {
        const pendingStore = database.createObjectStore('pendingCustomers', { keyPath: 'id' });
        pendingStore.createIndex('by-shop', 'shopId');
        pendingStore.createIndex('by-phone', 'phoneNumber');
        pendingStore.createIndex('by-authorized', 'authorized');
      }

      // Settings store - only create if it doesn't exist
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
    }
  });

  return db;
};

// Shop operations
export const localShops = {
  async getAll(): Promise<Shop[]> {
    const database = await initDB();
    return database.getAll('shops');
  },

  async get(id: string): Promise<Shop | undefined> {
    const database = await initDB();
    return database.get('shops', id);
  },

  async getByCode(code: string): Promise<Shop | undefined> {
    const database = await initDB();
    return database.getFromIndex('shops', 'by-code', code);
  },

  async getByCreator(createdBy: string): Promise<Shop[]> {
    const database = await initDB();
    const all = await database.getAll('shops');
    return all.filter(shop => shop.createdBy === createdBy);
  },

  async getByDeviceId(deviceId: string): Promise<Shop | undefined> {
    const database = await initDB();
    const all = await database.getAll('shops');
    return all.find(shop => shop.deviceId === deviceId);
  },

  async save(shop: Shop): Promise<void> {
    const database = await initDB();
    await database.put('shops', shop);
  },

  async ensureDefaultShop(): Promise<Shop> {
    // Check if default shop exists
    const existing = await this.getByCode('METOFUN');
    if (existing) return existing;
    
    // Create default shop
    const defaultShop: Shop = {
      id: crypto.randomUUID(),
      shopName: 'Metofun Demo Shop',
      shopCode: 'METOFUN',
      deviceId: crypto.randomUUID(),
      deviceLocked: false,
      qualifyingPurchase: 100,
      promoMessage: 'Play & Win Amazing Rewards!',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      backupEnabled: false
    };
    
    await this.save(defaultShop);
    return defaultShop;
  },

  async delete(id: string): Promise<void> {
    const database = await initDB();
    await database.delete('shops', id);
  }
};

// Item operations
export const localItems = {
  async getByShop(shopId: string): Promise<Item[]> {
    const database = await initDB();
    return database.getAllFromIndex('items', 'by-shop', shopId);
  },

  async get(id: string): Promise<Item | undefined> {
    const database = await initDB();
    return database.get('items', id);
  },

  async save(item: Item): Promise<void> {
    const database = await initDB();
    await database.put('items', item);
  },

  async saveMultiple(items: Item[]): Promise<void> {
    const database = await initDB();
    const tx = database.transaction('items', 'readwrite');
    await Promise.all([
      ...items.map(item => tx.store.put(item)),
      tx.done
    ]);
  },

  async delete(id: string): Promise<void> {
    const database = await initDB();
    await database.delete('items', id);
  },

  async deleteByShop(shopId: string): Promise<void> {
    const database = await initDB();
    const items = await database.getAllFromIndex('items', 'by-shop', shopId);
    const tx = database.transaction('items', 'readwrite');
    await Promise.all([
      ...items.map(item => tx.store.delete(item.id)),
      tx.done
    ]);
  }
};

// Attempt operations
export const localAttempts = {
  async getAll(): Promise<GameAttempt[]> {
    const database = await initDB();
    return database.getAll('attempts');
  },

  async getByShop(shopId: string): Promise<GameAttempt[]> {
    const database = await initDB();
    return database.getAllFromIndex('attempts', 'by-shop', shopId);
  },

  async getByPhone(phoneNumber: string): Promise<GameAttempt[]> {
    const database = await initDB();
    return database.getAllFromIndex('attempts', 'by-phone', phoneNumber);
  },

  async getUnsynced(): Promise<GameAttempt[]> {
    const database = await initDB();
    const all = await database.getAll('attempts');
    return all.filter(a => !a.synced);
  },

  async save(attempt: GameAttempt): Promise<void> {
    const database = await initDB();
    await database.put('attempts', attempt);
  },

  async markSynced(id: string): Promise<void> {
    const database = await initDB();
    const attempt = await database.get('attempts', id);
    if (attempt) {
      attempt.synced = true;
      await database.put('attempts', attempt);
    }
  },

  async getTodayAttempts(phoneNumber: string): Promise<GameAttempt[]> {
    const database = await initDB();
    const today = new Date().toISOString().split('T')[0];
    const all = await database.getAllFromIndex('attempts', 'by-phone', phoneNumber);
    return all.filter(a => a.timestamp.toString().split('T')[0] === today);
  },

  async getLastAttemptTime(phoneNumber: string): Promise<number | null> {
    const database = await initDB();
    const all = await database.getAllFromIndex('attempts', 'by-phone', phoneNumber);
    if (all.length === 0) return null;
    // Sort by timestamp descending and get the most recent
    const sorted = all.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return new Date(sorted[0].timestamp).getTime();
  }
};

// Admin operations
export const localAdmins = {
  async get(id: string): Promise<Admin | undefined> {
    const database = await initDB();
    return database.get('admins', id);
  },

  async getAll(): Promise<Admin[]> {
    const database = await initDB();
    return database.getAll('admins');
  },

  async getByLevel(level: AdminLevel): Promise<Admin[]> {
    const database = await initDB();
    const all = await database.getAll('admins');
    return all.filter(admin => admin.level === level);
  },

  async hasAdmin(): Promise<boolean> {
    const admins = await this.getByLevel('admin');
    return admins.length > 0;
  },

  async save(admin: Admin): Promise<void> {
    const database = await initDB();
    await database.put('admins', admin);
  },

  async delete(id: string): Promise<void> {
    const database = await initDB();
    await database.delete('admins', id);
  }
};

// Session operations
export const localSessions = {
  async get(phoneNumber: string): Promise<CustomerSession | undefined> {
    const database = await initDB();
    return database.get('sessions', phoneNumber);
  },

  async save(session: CustomerSession): Promise<void> {
    const database = await initDB();
    await database.put('sessions', session);
  },

  async delete(phoneNumber: string): Promise<void> {
    const database = await initDB();
    await database.delete('sessions', phoneNumber);
  }
};

// Settings operations
export const localSettings = {
  async get(key: string): Promise<any> {
    const database = await initDB();
    const setting = await database.get('settings', key);
    return setting?.value;
  },

  async set(key: string, value: any): Promise<void> {
    const database = await initDB();
    await database.put('settings', { key, value });
  }
};

// Pending customers operations
export const localPendingCustomers = {
  async get(id: string): Promise<PendingCustomer | undefined> {
    const database = await initDB();
    return database.get('pendingCustomers', id);
  },

  async getAll(): Promise<PendingCustomer[]> {
    const database = await initDB();
    return database.getAll('pendingCustomers');
  },

  async getByShop(shopId: string): Promise<PendingCustomer[]> {
    const database = await initDB();
    return database.getAllFromIndex('pendingCustomers', 'by-shop', shopId);
  },

  async getByPhone(phoneNumber: string): Promise<PendingCustomer[]> {
    const database = await initDB();
    return database.getAllFromIndex('pendingCustomers', 'by-phone', phoneNumber);
  },

  async getAuthorized(shopId: string): Promise<PendingCustomer[]> {
    const database = await initDB();
    const all = await database.getAllFromIndex('pendingCustomers', 'by-shop', shopId);
    return all.filter(c => c.authorized && !c.used);
  },

  async save(customer: PendingCustomer): Promise<void> {
    const database = await initDB();
    await database.put('pendingCustomers', customer);
  },

  async authorize(id: string, authorizedBy: string): Promise<void> {
    const database = await initDB();
    const customer = await database.get('pendingCustomers', id);
    if (customer) {
      customer.authorized = true;
      customer.authorizedBy = authorizedBy;
      customer.authorizedAt = new Date();
      await database.put('pendingCustomers', customer);
    }
  },

  async markUsed(id: string): Promise<void> {
    const database = await initDB();
    const customer = await database.get('pendingCustomers', id);
    if (customer) {
      customer.used = true;
      customer.usedAt = new Date();
      await database.put('pendingCustomers', customer);
    }
  },

  async delete(id: string): Promise<void> {
    const database = await initDB();
    await database.delete('pendingCustomers', id);
  }
};
export const localSync = {
  async addToQueue(type: SyncQueue['type'], data: any): Promise<void> {
    const database = await initDB();
    const queueItem: SyncQueue = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: new Date(),
      status: 'pending'
    };
    await database.put('syncQueue', queueItem);
  },

  async getPending(): Promise<SyncQueue[]> {
    const database = await initDB();
    const all = await database.getAll('syncQueue');
    return all.filter(q => q.status === 'pending');
  },

  async markSynced(id: string): Promise<void> {
    const database = await initDB();
    const item = await database.get('syncQueue', id);
    if (item) {
      item.status = 'synced';
      await database.put('syncQueue', item);
    }
  },

  async markFailed(id: string): Promise<void> {
    const database = await initDB();
    const item = await database.get('syncQueue', id);
    if (item) {
      item.status = 'failed';
      await database.put('syncQueue', item);
    }
  }
};

// Device ID operations
export const getDeviceId = async (): Promise<string> => {
  let deviceId = await localSettings.get('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    await localSettings.set('deviceId', deviceId);
  }
  return deviceId;
};

// Clear all data (for testing or logout)
export const clearAllData = async (): Promise<void> => {
  const database = await initDB();
  const stores = ['shops', 'items', 'attempts', 'admins', 'syncQueue', 'sessions', 'settings'] as const;
  for (const store of stores) {
    await database.clear(store);
  }
};
