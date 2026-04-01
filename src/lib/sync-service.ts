import { useUIStore, useSyncStore } from '@/store';
import { localAttempts, localItems, localShops, localNominationItems, localCustomerNominations, localSettings } from './local-db';
import { rtdbAttempts, rtdbItems, rtdbShops, rtdbNominationItems, rtdbCustomerNominations } from './firebase';
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
  // Initial sync delay in milliseconds (2 seconds after going online)
  INITIAL_SYNC_DELAY: 2000,
  // Auto-sync interval in milliseconds (5 minutes) - only while online
  AUTO_SYNC_INTERVAL: 5 * 60 * 1000,
  // Maximum retry attempts before giving up
  MAX_RETRY_ATTEMPTS: 3,
  // Base delay for exponential backoff (seconds) - wait longer between retries
  BASE_RETRY_DELAY: 10,
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
let hasInitialSyncBeenTriggered = false;
let userIsActive = false; // Pause sync when user is actively editing

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

// Calculate exponential backoff delay - much longer to avoid numerous attempts
const getRetryDelay = (retryCount: number): number => {
  const delay = SYNC_CONFIG.BASE_RETRY_DELAY * Math.pow(2, retryCount);
  // Cap at 5 minutes max
  return Math.min(delay * 1000, 5 * 60 * 1000);
};

// Check if queue is full
const isQueueFull = async (): Promise<boolean> => {
  const { localDB } = await import('./local-db');
  const pendingItems = await localDB.getPendingSyncItems();
  return pendingItems.length >= SYNC_CONFIG.MAX_QUEUE_SIZE;
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

// Reset failed sync items back to pending for retry
export const resetFailedSyncItems = async (): Promise<void> => {
  const { localDB } = await import('./local-db');
  const pendingItems = await localDB.getPendingSyncItems();
  
  let resetCount = 0;
  for (const item of pendingItems) {
    if (item.status === 'failed') {
      await localDB.updateSyncItemStatus(item.id, 'pending', 0);
      resetCount++;
    }
  }
  
  if (resetCount > 0) {
    console.log(`[Sync] Reset ${resetCount} failed items to pending for retry`);
  }
};

// Initialize online/offline detection
export const initSyncService = (): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = async () => {
    console.log('[Sync] Back online - starting sync');
    lastOnlineTime = Date.now();
    useUIStore.getState().setOnline(true);
    
    // Clean stale queue items before syncing
    await cleanStaleQueueItems();
    
    // Reset failed items to pending so they get retried
    await resetFailedSyncItems();
    
    // Trigger immediate sync after 2 seconds
    setTimeout(() => {
      if (isOnline()) {
        console.log('[Sync] Running delayed sync after 2 seconds');
        processSyncQueue();
      }
    }, SYNC_CONFIG.INITIAL_SYNC_DELAY);
    
    // Start periodic auto-sync while online
    startAutoSync();
  };

  const handleOffline = () => {
    console.log('[Sync] Gone offline');
    useUIStore.getState().setOnline(false);
    lastOnlineTime = Date.now();
    
    // Stop auto-sync when offline - NO MORE ATTEMPTS WHILE OFFLINE
    stopAutoSync();
  };

  // Set initial state
  useUIStore.getState().setOnline(navigator.onLine);
  lastOnlineTime = navigator.onLine ? Date.now() : null;

  // Add event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Trigger initial sync if already online
  if (navigator.onLine && !hasInitialSyncBeenTriggered) {
    hasInitialSyncBeenTriggered = true;
    // Initial sync after 2 seconds
    setTimeout(() => {
      if (isOnline()) {
        console.log('[Sync] Initial sync on app load');
        processSyncQueue();
      }
    }, SYNC_CONFIG.INITIAL_SYNC_DELAY);
  }

  // Start auto-sync if online
  if (navigator.onLine) {
    startAutoSync();
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    stopAutoSync();
  };
};

// Start automatic periodic sync - ONLY runs while online
const startAutoSync = (): void => {
  if (autoSyncInterval) return;
  
  // Don't start if offline
  if (!isOnline()) {
    console.log('[Sync] Not starting auto-sync - offline');
    return;
  }
  
  autoSyncInterval = setInterval(() => {
    // Don't sync if user is active
    if (userIsActive) {
      console.log('[Sync] Auto-sync skipped - user is active');
      return;
    }
    
    if (isOnline()) {
      console.log('[Sync] Auto-sync triggered');
      processSyncQueue();
    } else {
      // Stop auto-sync if we go offline
      console.log('[Sync] Auto-sync stopping - offline');
      stopAutoSync();
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

// Process the sync queue - ONLY runs when online
// Uses setTimeout to avoid blocking user interactions
export const processSyncQueue = async (): Promise<void> => {
  // DON'T SYNC IF OFFLINE - wait for internet connection
  if (!isOnline()) {
    console.log('[Sync] Offline - not attempting sync, waiting for connection');
    return;
  }
  
  if (syncInProgress) {
    console.log('[Sync] Already syncing, skipping');
    return;
  }

  syncInProgress = true;

  try {
    // Use setTimeout to defer and not block the main thread
    await new Promise(resolve => setTimeout(resolve, 100));
    
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
      
      // Skip if retry count exceeded - don't keep trying failed items
      const currentRetryCount = (item.retryCount ?? 0) as number;
      if (currentRetryCount >= SYNC_CONFIG.MAX_RETRY_ATTEMPTS) {
        console.log(`[Sync] Skipping item ${item.id} - max retries exceeded`);
        await localDB.updateSyncItemStatus(item.id, 'failed', currentRetryCount);
        failed++;
        continue;
      }
      
      // Skip if retry count exceeded - don't keep trying failed items
      if (currentRetryCount > 0 && item.updatedAt) {
        const lastAttempt = new Date(item.updatedAt).getTime();
        const delay = getRetryDelay(currentRetryCount);
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
        
        // Increment retry count - just update IndexedDB, don't trigger UI updates
        const newRetryCount = currentRetryCount + 1;
        await localDB.updateSyncItemStatus(item.id, 'pending', newRetryCount);
        // Don't update UI store here - causes re-renders!
        failed++;
      }
      
      // Small delay between items to not block UI
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Update UI store only once at the end
    useSyncStore.getState().setLastSyncTime(new Date());
    useSyncStore.getState().setSyncing(false);
    console.log(`[Sync] Sync complete: ${processed} processed, ${failed} failed, ${pendingItems.length - processed - failed} remaining`);

    // Pull latest data from RTDB to keep local in sync with other devices
    // This ensures the super admin dashboard sees data from all devices
    try {
      await pullFromRTDB();
    } catch (pullError) {
      console.error('[Sync] Post-sync pull failed:', pullError);
    }
  } catch (error) {
    console.error('[Sync] Sync error:', error);
    useSyncStore.getState().setSyncing(false);
  } finally {
    syncInProgress = false;
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
  const { rtdbAttempts } = await import('./firebase');
  const shopId = data.shopId || 'unknown';
  
  switch (operation) {
    case 'create':
      await rtdbAttempts.create(shopId, data);
      break;
    case 'update':
      await rtdbAttempts.update(shopId, data.id, data);
      break;
    case 'delete':
      await rtdbAttempts.delete(shopId, data.id);
      break;
  }
};

// Sync item
const syncItemData = async (operation: SyncOperation, data: Item): Promise<void> => {
  const { rtdbItems } = await import('./firebase');
  const shopId = data.shopId || 'unknown';
  
  switch (operation) {
    case 'create':
      await rtdbItems.create(shopId, data);
      break;
    case 'update':
      await rtdbItems.update(shopId, data.id, data);
      break;
    case 'delete':
      await rtdbItems.delete(shopId, data.id);
      break;
  }
};

// Sync shop
const syncShop = async (operation: SyncOperation, data: Shop): Promise<void> => {
  const { rtdbShops } = await import('./firebase');
  
  switch (operation) {
    case 'create':
      await rtdbShops.save(data);
      break;
    case 'update':
      await rtdbShops.update(data.id, data);
      break;
    case 'delete':
      await rtdbShops.delete(data.id);
      break;
  }
};

// Sync nomination item
const syncNominationItem = async (operation: SyncOperation, data: NominationItem): Promise<void> => {
  const { rtdbNominationItems } = await import('./firebase');
  
  switch (operation) {
    case 'create':
      await rtdbNominationItems.create(data);
      break;
    case 'update':
      await rtdbNominationItems.update(data.id, data);
      break;
    case 'delete':
      await rtdbNominationItems.delete(data.id);
      break;
  }
};

// Sync customer nomination
const syncCustomerNomination = async (operation: SyncOperation, data: CustomerNomination): Promise<void> => {
  const { rtdbCustomerNominations } = await import('./firebase');
  
  switch (operation) {
    case 'create':
      await rtdbCustomerNominations.create(data);
      break;
    case 'update':
      await rtdbCustomerNominations.update(data.id, data);
      break;
    case 'delete':
      await rtdbCustomerNominations.delete(data.id, data.shopId);
      break;
  }
};

// Save attempt with offline support
export const saveAttemptWithSync = async (attempt: GameAttempt): Promise<void> => {
  // Always save to local first
  await localAttempts.save(attempt);
  console.log('[Sync] Attempt saved locally');

  if (isOnline()) {
    console.log('[Sync] Online - attempting to sync...');
    try {
      const { rtdbAttempts } = await import('./firebase');
      const shopId = attempt.shopId || 'unknown';
      const result = await rtdbAttempts.create(shopId, attempt);
      console.log('[Sync] Attempt synced to Realtime Database:', result);
    } catch (error) {
      console.error('[Sync] Error syncing attempt to Realtime Database:', error);
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
      const { rtdbItems } = await import('./firebase');
      const shopId = item.shopId || 'unknown';
      if (isNew) {
        await rtdbItems.create(shopId, item);
      } else {
        await rtdbItems.update(shopId, item.id, item);
      }
      console.log('[Sync] Item synced to Realtime Database');
    } catch (error) {
      console.error('[Sync] Error syncing item to Realtime Database, queuing:', error);
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
      const { rtdbShops } = await import('./firebase');
      if (isNew) {
        await rtdbShops.save(shop);
      } else {
        await rtdbShops.update(shop.id, shop);
      }
      console.log('[Sync] Shop synced to Realtime Database');
    } catch (error) {
      console.error('[Sync] Error syncing shop to Realtime Database, queuing:', error);
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

// Force sync (bypass user active check, reset failed items)
export const forceSyncNow = async (): Promise<void> => {
  userIsActive = false;
  await resetFailedSyncItems();
  await processSyncQueue();
};

// Save nomination with offline support
export const saveNominationWithSync = async (nomination: CustomerNomination): Promise<void> => {
  // Always save to local first
  await localCustomerNominations.save(nomination);

  if (isOnline()) {
    try {
      const { rtdbCustomerNominations } = await import('./firebase');
      await rtdbCustomerNominations.create(nomination);
      console.log('[Sync] Nomination synced to Realtime Database');
    } catch (error) {
      console.error('[Sync] Error syncing nomination to Realtime Database, queuing:', error);
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
      const { rtdbNominationItems } = await import('./firebase');
      if (isNew) {
        await rtdbNominationItems.create(item);
      } else {
        await rtdbNominationItems.update(item.id, item);
      }
      console.log('[Sync] Nomination item synced to Realtime Database');
    } catch (error) {
      console.error('[Sync] Error syncing nomination item to Realtime Database, queuing:', error);
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
  
  // Reset failed items for retry
  await resetFailedSyncItems();
  
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

// Set user active state - sync will pause while user is editing
export const setUserActive = (active: boolean): void => {
  userIsActive = active;
  console.log(`[Sync] User ${active ? 'active (sync paused)' : 'inactive (sync resumed)'}`);
};

// Check if user is active
export const isUserActive = (): boolean => userIsActive;

// Pull data from RTDB to local - bidirectional sync
export const pullFromRTDB = async (shopId?: string): Promise<void> => {
  if (!isOnline()) return;
  
  try {
    const { rtdbShops, rtdbItems, rtdbAdmins, rtdbAttempts, rtdbNominationItems, rtdbCustomerNominations } = await import('./firebase');
    const { localShops, localItems, localAdmins, localAttempts, localNominationItems, localCustomerNominations } = await import('./local-db');
    
    // Pull shops - with conflict resolution to prevent overwriting newer local data
    const fbShops = await rtdbShops.getAll();
    if (fbShops && fbShops.length > 0) {
      const existingLocalShops = await localShops.getAll();
      const localShopMap = new Map(existingLocalShops.map(s => [s.id, s]));

      for (const remoteShop of fbShops) {
        const localShop = localShopMap.get(remoteShop.id);
        if (!localShop) {
          // New shop from RTDB - save it
          await localShops.save(remoteShop);
        } else {
          // Shop exists locally - only overwrite if RTDB version is newer
          const localTime = localShop.updatedAt instanceof Date
            ? localShop.updatedAt.getTime()
            : new Date(localShop.updatedAt || 0).getTime();
          const remoteTime = remoteShop.updatedAt instanceof Date
            ? remoteShop.updatedAt.getTime()
            : new Date(remoteShop.updatedAt || 0).getTime();
          if (remoteTime > localTime) {
            await localShops.save(remoteShop);
          }
          // else: keep local version (it's newer, sync hasn't propagated yet)
        }
      }
    }
    
    // Pull items, attempts, nominations for specific shop or all shops
    if (shopId) {
      // Pull items for specific shop
      const fbItems = await rtdbItems.getByShop(shopId);
      if (fbItems && fbItems.length > 0) {
        for (const item of fbItems) {
          await localItems.save(item);
        }
      }
      
      // Pull attempts for specific shop
      const fbAttempts = await rtdbAttempts.getByShop(shopId);
      if (fbAttempts && fbAttempts.length > 0) {
        for (const attempt of fbAttempts) {
          await localAttempts.save(attempt);
        }
      }

      // Pull nomination items for specific shop
      const fbNominationItems = await rtdbNominationItems.getAll();
      const shopNominationItems = fbNominationItems.filter(item => item.shopId === shopId);
      if (shopNominationItems.length > 0) {
        for (const item of shopNominationItems) {
          await localNominationItems.save(item);
        }
      }

      // Pull customer nominations for specific shop
      const fbCustomerNominations = await rtdbCustomerNominations.getByShop(shopId);
      if (fbCustomerNominations && fbCustomerNominations.length > 0) {
        for (const nomination of fbCustomerNominations) {
          await localCustomerNominations.save(nomination);
        }
      }
    } else {
      // Pull items, attempts, nominations for all shops
      for (const shop of fbShops || []) {
        const fbItems = await rtdbItems.getByShop(shop.id);
        if (fbItems && fbItems.length > 0) {
          for (const item of fbItems) {
            await localItems.save(item);
          }
        }
        
        // Pull attempts for this shop
        const fbAttempts = await rtdbAttempts.getByShop(shop.id);
        if (fbAttempts && fbAttempts.length > 0) {
          for (const attempt of fbAttempts) {
            await localAttempts.save(attempt);
          }
        }

        // Pull customer nominations for this shop
        const fbNominations = await rtdbCustomerNominations.getByShop(shop.id);
        if (fbNominations && fbNominations.length > 0) {
          for (const nomination of fbNominations) {
            await localCustomerNominations.save(nomination);
          }
        }
      }

      // Pull all nomination items (not shop-specific in RTDB structure)
      const fbNominationItems = await rtdbNominationItems.getAll();
      if (fbNominationItems && fbNominationItems.length > 0) {
        for (const item of fbNominationItems) {
          await localNominationItems.save(item);
        }
      }
    }
    
    // Pull admins
    const fbAdmins = await rtdbAdmins.getAll();
    if (fbAdmins && fbAdmins.length > 0) {
      for (const admin of fbAdmins) {
        await localAdmins.save(admin);
      }
    }
    
    console.log('[Sync] Pull from RTDB completed');
  } catch (error) {
    console.error('[Sync] Pull from RTDB failed:', error);
  }
};

// Pull attempts from RTDB
export const pullAttemptsFromRTDB = async (shopId: string): Promise<void> => {
  if (!isOnline()) return;
  
  try {
    const { rtdbAttempts } = await import('./firebase');
    const { localAttempts } = await import('./local-db');
    
    const fbAttempts = await rtdbAttempts.getByShop(shopId);
    if (fbAttempts && fbAttempts.length > 0) {
      for (const attempt of fbAttempts) {
        await localAttempts.save(attempt);
      }
    }
    
    console.log('[Sync] Pull attempts from RTDB completed');
  } catch (error) {
    console.error('[Sync] Pull attempts from RTDB failed:', error);
  }
};
