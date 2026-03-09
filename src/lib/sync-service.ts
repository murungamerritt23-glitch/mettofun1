import { useUIStore, useSyncStore } from '@/store';
import { localAttempts, localItems, localShops, localNominationItems, localCustomerNominations } from './local-db';
import { firebaseAttempts, firebaseItems, firebaseShops, firebaseNominationItems, firebaseCustomerNominations } from './firebase';
import type { GameAttempt, Item, Shop, NominationItem, CustomerNomination } from '@/types';

// Sync service types
export type SyncItemType = 'attempt' | 'item' | 'shop' | 'nominationItem' | 'customerNomination';
export type SyncOperation = 'create' | 'update' | 'delete';

export interface SyncTask {
  id: string;
  type: SyncItemType;
  operation: SyncOperation;
  data: any;
  timestamp: Date;
  retryCount: number;
}

// Global sync state
let syncInProgress = false;
let onlineStatusListeners: Set<() => void> = new Set();

// Check if online
export const isOnline = (): boolean => {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
};

// Initialize online/offline detection
export const initSyncService = (): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => {
    console.log('[Sync] Back online - starting sync');
    useUIStore.getState().setOnline(true);
    processSyncQueue();
  };

  const handleOffline = () => {
    console.log('[Sync] Gone offline');
    useUIStore.getState().setOnline(false);
  };

  // Set initial state
  useUIStore.getState().setOnline(navigator.onLine);

  // Add event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

// Add item to sync queue (called when offline)
export const queueForSync = async (task: Omit<SyncTask, 'id' | 'timestamp' | 'retryCount'>): Promise<void> => {
  const syncTask: SyncTask = {
    ...task,
    id: crypto.randomUUID(),
    timestamp: new Date(),
    retryCount: 0,
  };

  // Save to IndexedDB queue
  const { localDB } = await import('./local-db');
  await localDB.addToSyncQueue({
    id: syncTask.id,
    type: syncTask.type,
    operation: syncTask.operation,
    data: JSON.stringify(syncTask.data),
    status: 'pending',
    createdAt: syncTask.timestamp.toISOString(),
    updatedAt: syncTask.timestamp.toISOString(),
  });

  // Update store
  useSyncStore.getState().addToQueue({
    type: syncTask.type,
    operation: syncTask.operation,
    data: syncTask.data,
    status: 'pending',
    createdAt: syncTask.timestamp.toISOString(),
    updatedAt: syncTask.timestamp.toISOString(),
  });

  console.log(`[Sync] Queued ${syncTask.type} ${syncTask.operation} for later sync`);
};

// Process the sync queue
export const processSyncQueue = async (): Promise<void> => {
  if (syncInProgress || !isOnline()) {
    console.log('[Sync] Already syncing or offline, skipping');
    return;
  }

  syncInProgress = true;
  useSyncStore.getState().setSyncing(true);

  try {
    // Get pending items from IndexedDB
    const { localDB } = await import('./local-db');
    const pendingItems = await localDB.getPendingSyncItems();

    console.log(`[Sync] Processing ${pendingItems.length} pending items`);

    for (const item of pendingItems) {
      try {
        const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
        
        await syncItem(item.type as SyncItemType, item.operation as SyncOperation, data);
        
        // Mark as synced
        await localDB.markSyncItemSynced(item.id);
        useSyncStore.getState().removeFromQueue(item.id);
        
        console.log(`[Sync] Successfully synced ${item.type} ${item.operation}`);
      } catch (error) {
        console.error(`[Sync] Error syncing ${item.type}:`, error);
        
        // Increment retry count
        await localDB.updateSyncItemStatus(item.id, 'failed');
        useSyncStore.getState().updateQueueItem(item.id, { 
          status: 'failed',
          retryCount: (item.retryCount || 0) + 1 
        });
      }
    }

    useSyncStore.getState().setLastSyncTime(new Date());
  } finally {
    syncInProgress = false;
    useSyncStore.getState().setSyncing(false);
  }
};

// Sync a single item to Firebase
const syncItem = async (type: SyncItemType, operation: SyncOperation, data: any): Promise<void> => {
  switch (type) {
    case 'attempt':
      await syncAttempt(operation, data);
      break;
    case 'item':
      await syncItemData(operation, data);
      break;
    case 'shop':
      await syncShop(operation, data);
      break;
    case 'nominationItem':
      await syncNominationItem(operation, data);
      break;
    case 'customerNomination':
      await syncCustomerNomination(operation, data);
      break;
  }
};

// Sync game attempt
const syncAttempt = async (operation: SyncOperation, data: GameAttempt): Promise<void> => {
  const { firebaseAttempts } = await import('./firebase');
  
  switch (operation) {
    case 'create':
      await firebaseAttempts.create(data);
      break;
    case 'update':
      await firebaseAttempts.update(data.id, data);
      break;
    case 'delete':
      await firebaseAttempts.delete(data.id);
      break;
  }
};

// Sync item
const syncItemData = async (operation: SyncOperation, data: Item): Promise<void> => {
  const { firebaseItems } = await import('./firebase');
  
  switch (operation) {
    case 'create':
      await firebaseItems.create(data);
      break;
    case 'update':
      await firebaseItems.update(data.id, data);
      break;
    case 'delete':
      await firebaseItems.delete(data.id);
      break;
  }
};

// Sync shop
const syncShop = async (operation: SyncOperation, data: Shop): Promise<void> => {
  const { firebaseShops } = await import('./firebase');
  
  switch (operation) {
    case 'create':
      await firebaseShops.save(data);
      break;
    case 'update':
      await firebaseShops.update(data.id, data);
      break;
    case 'delete':
      await firebaseShops.delete(data.id);
      break;
  }
};

// Sync nomination item
const syncNominationItem = async (operation: SyncOperation, data: NominationItem): Promise<void> => {
  const { firebaseNominationItems } = await import('./firebase');
  
  switch (operation) {
    case 'create':
      await firebaseNominationItems.create(data);
      break;
    case 'update':
      await firebaseNominationItems.update(data.id, data);
      break;
    case 'delete':
      await firebaseNominationItems.delete(data.id);
      break;
  }
};

// Sync customer nomination
const syncCustomerNomination = async (operation: SyncOperation, data: CustomerNomination): Promise<void> => {
  const { firebaseCustomerNominations } = await import('./firebase');
  
  switch (operation) {
    case 'create':
      await firebaseCustomerNominations.create(data);
      break;
    case 'update':
      await firebaseCustomerNominations.update(data.id, data);
      break;
    case 'delete':
      await firebaseCustomerNominations.delete(data.id);
      break;
  }
};

// Save attempt with offline support
export const saveAttemptWithSync = async (attempt: GameAttempt): Promise<void> => {
  // Always save to local first
  await localAttempts.save(attempt);

  if (isOnline()) {
    try {
      const { firebaseAttempts } = await import('./firebase');
      await firebaseAttempts.create(attempt);
      console.log('[Sync] Attempt synced to Firebase');
    } catch (error) {
      console.error('[Sync] Error syncing attempt to Firebase, queuing:', error);
      await queueForSync({ type: 'attempt', operation: 'create', data: attempt });
    }
  } else {
    console.log('[Sync] Offline - queued attempt for sync');
    await queueForSync({ type: 'attempt', operation: 'create', data: attempt });
  }
};

// Save item with offline support
export const saveItemWithSync = async (item: Item, isNew: boolean = true): Promise<void> => {
  // Always save to local first
  await localItems.save(item);

  if (isOnline()) {
    try {
      const { firebaseItems } = await import('./firebase');
      if (isNew) {
        await firebaseItems.create(item);
      } else {
        await firebaseItems.update(item.id, item);
      }
      console.log('[Sync] Item synced to Firebase');
    } catch (error) {
      console.error('[Sync] Error syncing item to Firebase, queuing:', error);
      await queueForSync({ 
        type: 'item', 
        operation: isNew ? 'create' : 'update', 
        data: item 
      });
    }
  } else {
    console.log('[Sync] Offline - queued item for sync');
    await queueForSync({ 
      type: 'item', 
      operation: isNew ? 'create' : 'update', 
      data: item 
    });
  }
};

// Save shop with offline support
export const saveShopWithSync = async (shop: Shop, isNew: boolean = true): Promise<void> => {
  // Always save to local first
  await localShops.save(shop);

  if (isOnline()) {
    try {
      const { firebaseShops } = await import('./firebase');
      if (isNew) {
        await firebaseShops.save(shop);
      } else {
        await firebaseShops.update(shop.id, shop);
      }
      console.log('[Sync] Shop synced to Firebase');
    } catch (error) {
      console.error('[Sync] Error syncing shop to Firebase, queuing:', error);
      await queueForSync({ 
        type: 'shop', 
        operation: isNew ? 'create' : 'update', 
        data: shop 
      });
    }
  } else {
    console.log('[Sync] Offline - queued shop for sync');
    await queueForSync({ 
      type: 'shop', 
      operation: isNew ? 'create' : 'update', 
      data: shop 
    });
  }
};

// Save nomination with offline support
export const saveNominationWithSync = async (nomination: CustomerNomination): Promise<void> => {
  // Always save to local first
  await localCustomerNominations.save(nomination);

  if (isOnline()) {
    try {
      const { firebaseCustomerNominations } = await import('./firebase');
      await firebaseCustomerNominations.create(nomination);
      console.log('[Sync] Nomination synced to Firebase');
    } catch (error) {
      console.error('[Sync] Error syncing nomination to Firebase, queuing:', error);
      await queueForSync({ type: 'customerNomination', operation: 'create', data: nomination });
    }
  } else {
    console.log('[Sync] Offline - queued nomination for sync');
    await queueForSync({ type: 'customerNomination', operation: 'create', data: nomination });
  }
};

// Save nomination item with offline support
export const saveNominationItemWithSync = async (item: NominationItem, isNew: boolean = true): Promise<void> => {
  // Always save to local first
  await localNominationItems.save(item);

  if (isOnline()) {
    try {
      const { firebaseNominationItems } = await import('./firebase');
      if (isNew) {
        await firebaseNominationItems.create(item);
      } else {
        await firebaseNominationItems.update(item.id, item);
      }
      console.log('[Sync] Nomination item synced to Firebase');
    } catch (error) {
      console.error('[Sync] Error syncing nomination item to Firebase, queuing:', error);
      await queueForSync({ 
        type: 'nominationItem', 
        operation: isNew ? 'create' : 'update', 
        data: item 
      });
    }
  } else {
    console.log('[Sync] Offline - queued nomination item for sync');
    await queueForSync({ 
      type: 'nominationItem', 
      operation: isNew ? 'create' : 'update', 
      data: item 
    });
  }
};

// Manual sync trigger (for UI)
export const triggerSync = async (): Promise<void> => {
  if (!isOnline()) {
    console.log('[Sync] Cannot sync while offline');
    return;
  }
  await processSyncQueue();
};

// Clear sync queue
export const clearSyncQueue = async (): Promise<void> => {
  const { localDB } = await import('./local-db');
  await localDB.clearSyncQueue();
  useSyncStore.getState().clearQueue();
  console.log('[Sync] Queue cleared');
};
