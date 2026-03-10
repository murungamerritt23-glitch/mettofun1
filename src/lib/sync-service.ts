import { useUIStore, useSyncStore } from '@/store';
import { localAttempts, localItems, localShops, localNominationItems, localCustomerNominations, localSettings } from './local-db';
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

// Configuration for offline support
const SYNC_CONFIG = {
  // Auto-sync interval in milliseconds (5 minutes)
  AUTO_SYNC_INTERVAL: 5 * 60 * 1000,
  // Maximum retry attempts before giving up
  MAX_RETRY_ATTEMPTS: 5,
  // Base delay for exponential backoff (seconds)
  BASE_RETRY_DELAY: 2,
  // Maximum queue size (older items will be dropped if exceeded)
  MAX_QUEUE_SIZE: 1000,
  // Maximum age of queued items before considered stale (7 days)
  MAX_QUEUE_AGE_MS: 7 * 24 * 60 * 60 * 1000,
  // Maximum local data age before cleanup (30 days)
  MAX_DATA_AGE_MS: 30 * 24 * 60 * 60 * 1000,
  // Batch size for processing sync items
  BATCH_SIZE: 50,
};

// Global sync state
let syncInProgress = false;
let onlineStatusListeners: Set<() => void> = new Set();
let autoSyncInterval: ReturnType<typeof setInterval> | null = null;
let lastOnlineTime: number | null = null;

// Check if online
export const isOnline = (): boolean => {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
};

// Get time since last online
export const getTimeSinceLastOnline = (): number | null => {
  if (lastOnlineTime === null) return null;
  return Date.now() - lastOnlineTime;
};

// Calculate exponential backoff delay
const getRetryDelay = (retryCount: number): number => {
  const delay = SYNC_CONFIG.BASE_RETRY_DELAY * Math.pow(2, retryCount);
  // Cap at 5 minutes
  return Math.min(delay * 1000, 5 * 60 * 1000);
};

// Check if queue is full
const isQueueFull = async (): Promise<boolean> => {
  const { localDB } = await import('./local-db');
  const pendingItems = await localDB.getPendingSyncItems();
  return pendingItems.length >= SYNC_CONFIG.MAX_QUEUE_SIZE;
};

// Initialize online/offline detection
export const initSyncService = (): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => {
    console.log('[Sync] Back online - starting sync');
    lastOnlineTime = Date.now();
    useUIStore.getState().setOnline(true);
    
    // Clean stale queue items before syncing
    cleanStaleQueueItems();
    
    // Trigger sync
    processSyncQueue();
    
    // Start auto-sync
    startAutoSync();
  };

  const handleOffline = () => {
    console.log('[Sync] Gone offline');
    useUIStore.getState().setOnline(false);
    
    // Stop auto-sync when offline
    stopAutoSync();
  };

  // Set initial state
  useUIStore.getState().setOnline(navigator.onLine);
  lastOnlineTime = navigator.onLine ? Date.now() : null;

  // Add event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Start auto-sync if online
  if (navigator.onLine) {
    startAutoSync();
  }

  // Register background sync if available
  registerBackgroundSync();

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    stopAutoSync();
  };
};

// Start automatic periodic sync
const startAutoSync = (): void => {
  if (autoSyncInterval) return;
  
  autoSyncInterval = setInterval(() => {
    if (isOnline()) {
      console.log('[Sync] Auto-sync triggered');
      processSyncQueue();
    }
  }, SYNC_CONFIG.AUTO_SYNC_INTERVAL);
  
  console.log('[Sync] Auto-sync started with interval:', SYNC_CONFIG.AUTO_SYNC_INTERVAL, 'ms');
};

// Stop automatic periodic sync
const stopAutoSync = (): void => {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
    console.log('[Sync] Auto-sync stopped');
  }
};

// Register for background sync (Chrome/Edge)
const registerBackgroundSync = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  
  try {
    // Check if Background Sync is supported
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register('sync-game-data');
      console.log('[Sync] Background sync registered');
    } else {
      console.log('[Sync] Background sync not supported, using interval-based sync');
    }
  } catch (error) {
    console.log('[Sync] Background sync registration failed:', error);
  }
};

// Clean stale queue items (older than MAX_QUEUE_AGE_MS)
export const cleanStaleQueueItems = async (): Promise<void> => {
  const { localDB } = await import('./local-db');
  const pendingItems = await localDB.getPendingSyncItems();
  const now = Date.now();
  
  let cleaned = 0;
  for (const item of pendingItems) {
    const itemTime = new Date(item.createdAt).getTime();
    if (now - itemTime > SYNC_CONFIG.MAX_QUEUE_AGE_MS) {
      await localDB.deleteSyncItem(item.id);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[Sync] Cleaned ${cleaned} stale queue items`);
  }
};

// Clean old synced data from IndexedDB
export const cleanOldSyncedData = async (): Promise<number> => {
  const { localAttempts } = await import('./local-db');
  let cleaned = 0;
  const now = Date.now();
  
  try {
    // Get all synced attempts older than MAX_DATA_AGE_MS
    const allAttempts = await localAttempts.getAll(true);
    for (const attempt of allAttempts) {
      if (attempt.synced) {
        const attemptTime = new Date(attempt.timestamp).getTime();
        if (now - attemptTime > SYNC_CONFIG.MAX_DATA_AGE_MS) {
          // Keep attempts for analytics - just log for now
          // In production, you might want to archive them differently
          console.log('[Sync] Old synced attempt found:', attempt.id);
        }
      }
    }
  } catch (error) {
    console.error('[Sync] Error cleaning old data:', error);
  }
  
  return cleaned;
};

// Add item to sync queue (called when offline)
export const queueForSync = async (task: Omit<SyncTask, 'id' | 'timestamp' | 'retryCount'>): Promise<boolean> => {
  // Check if queue is full
  if (await isQueueFull()) {
    console.warn('[Sync] Queue is full, cannot add more items');
    
    // Try to clean stale items first
    await cleanStaleQueueItems();
    
    // Check again
    if (await isQueueFull()) {
      console.error('[Sync] Queue still full after cleanup, dropping item');
      return false;
    }
  }

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
  return true;
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
    let pendingItems = await localDB.getPendingSyncItems();

    console.log(`[Sync] Processing ${pendingItems.length} pending items`);

    // Process in batches
    let processed = 0;
    let failed = 0;
    
    for (const item of pendingItems) {
      // Stop if we've processed too many in one go (prevent UI freeze)
      if (processed >= SYNC_CONFIG.BATCH_SIZE) {
        console.log('[Sync] Batch limit reached, will continue on next sync');
        break;
      }
      
      // Skip if retry count exceeded
      const retryCount = item.retryCount ?? 0;
      if (retryCount >= SYNC_CONFIG.MAX_RETRY_ATTEMPTS) {
        console.log(`[Sync] Skipping item ${item.id} - max retries exceeded`);
        await localDB.updateSyncItemStatus(item.id, 'failed');
        failed++;
        continue;
      }
      
      // Check if we should wait before retrying (exponential backoff)
      if (retryCount > 0 && item.updatedAt) {
        const lastAttempt = new Date(item.updatedAt).getTime();
        const delay = getRetryDelay(retryCount);
        if (Date.now() - lastAttempt < delay) {
          console.log(`[Sync] Skipping item ${item.id} - waiting for backoff`);
          continue;
        }
      }

      try {
        const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
        
        await syncItem(item.type as SyncItemType, item.operation as SyncOperation, data);
        
        // Mark as synced
        await localDB.markSyncItemSynced(item.id);
        useSyncStore.getState().removeFromQueue(item.id);
        
        console.log(`[Sync] Successfully synced ${item.type} ${item.operation}`);
        processed++;
      } catch (error) {
        console.error(`[Sync] Error syncing ${item.type}:`, error);
        
        // Increment retry count
        const newRetryCount = (item.retryCount || 0) + 1;
        await localDB.updateSyncItemStatus(item.id, 'pending', newRetryCount);
        useSyncStore.getState().updateQueueItem(item.id, { 
          status: 'pending',
          retryCount: newRetryCount,
          lastError: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    useSyncStore.getState().setLastSyncTime(new Date());
    console.log(`[Sync] Sync complete: ${processed} processed, ${failed} failed, ${pendingItems.length - processed - failed} remaining`);
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
  
  // Clean stale items first
  await cleanStaleQueueItems();
  
  await processSyncQueue();
};

// Clear sync queue
export const clearSyncQueue = async (): Promise<void> => {
  const { localDB } = await import('./local-db');
  await localDB.clearSyncQueue();
  useSyncStore.getState().clearQueue();
  console.log('[Sync] Queue cleared');
};

// Get sync status info
export const getSyncStatus = async (): Promise<{
  pendingCount: number;
  failedCount: number;
  lastSyncTime: Date | null;
  isOnline: boolean;
  timeSinceLastOnline: number | null;
}> => {
  const { localDB } = await import('./local-db');
  const pendingItems = await localDB.getPendingSyncItems();
  const failedItems = pendingItems.filter(item => item.status === 'failed');
  const syncState = useSyncStore.getState();
  
  return {
    pendingCount: pendingItems.filter(item => item.status === 'pending').length,
    failedCount: failedItems.length,
    lastSyncTime: syncState.lastSyncTime,
    isOnline: isOnline(),
    timeSinceLastOnline: getTimeSinceLastOnline()
  };
};

// Export configuration for debugging
export const getSyncConfig = () => SYNC_CONFIG;
