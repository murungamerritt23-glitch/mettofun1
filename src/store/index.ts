import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Admin, Shop, Item, GameAttempt, CustomerSession, AppSettings, NominationItem, ItemOfTheDay, SyncQueue, SyncItemType, SyncOperation } from '@/types';
import { localShops, localItems, localAttempts, localSessions, localSettings, getDeviceId } from '@/lib/local-db';

// Auth Store with Security Features
interface AuthState {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  // Security: Session tracking
  lastActivity: number;
  sessionTimeout: number; // Session timeout in milliseconds (default 30 minutes)
  // Security: Rate limiting
  failedAttempts: number;
  lockoutUntil: number | null;
  // Security: PIN attempts
  pinAttempts: number;
  pinLockoutUntil: number | null;
  // Offline login support
  hasLoggedInBefore: boolean; // true after first successful online login
  setAdmin: (admin: Admin | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateActivity: () => void;
  checkSession: () => boolean;
  recordFailedAttempt: () => void;
  resetFailedAttempts: () => void;
  recordPinAttempt: (success: boolean) => void;
  setHasLoggedInBefore: (value: boolean) => void;
  logout: () => void;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_PIN_ATTEMPTS = 3;
const PIN_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      admin: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastActivity: Date.now(),
      sessionTimeout: SESSION_TIMEOUT_MS,
      failedAttempts: 0,
      lockoutUntil: null,
      pinAttempts: 0,
      pinLockoutUntil: null,
      hasLoggedInBefore: false,
      setAdmin: (admin) => set({ admin, isAuthenticated: !!admin, lastActivity: Date.now() }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      updateActivity: () => set({ lastActivity: Date.now() }),
      checkSession: () => {
        const state = get();
        const now = Date.now();
        // Check if locked out
        if (state.lockoutUntil && now < state.lockoutUntil) {
          return false;
        }
        // Clear lockout if expired
        if (state.lockoutUntil && now >= state.lockoutUntil) {
          set({ lockoutUntil: null, failedAttempts: 0 });
        }
        // Check session timeout
        if (now - state.lastActivity > state.sessionTimeout) {
          set({ admin: null, isAuthenticated: false });
          return false;
        }
        return state.isAuthenticated;
      },
      recordFailedAttempt: () => {
        const state = get();
        const newAttempts = state.failedAttempts + 1;
        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
          set({ 
            failedAttempts: newAttempts, 
            lockoutUntil: Date.now() + LOCKOUT_DURATION_MS,
            error: `Too many failed attempts. Please try again in ${LOCKOUT_DURATION_MS / 60000} minutes.`
          });
        } else {
          set({ 
            failedAttempts: newAttempts,
            error: `Invalid credentials. ${MAX_FAILED_ATTEMPTS - newAttempts} attempts remaining.`
          });
        }
      },
      resetFailedAttempts: () => set({ failedAttempts: 0, lockoutUntil: null, error: null }),
      recordPinAttempt: (success) => {
        if (success) {
          set({ pinAttempts: 0, pinLockoutUntil: null });
        } else {
          const newAttempts = get().pinAttempts + 1;
          if (newAttempts >= MAX_PIN_ATTEMPTS) {
            set({ 
              pinAttempts: newAttempts, 
              pinLockoutUntil: Date.now() + PIN_LOCKOUT_MS,
              error: `Too many PIN attempts. Please try again in ${PIN_LOCKOUT_MS / 60000} minutes.`
            });
          } else {
            set({ 
              pinAttempts: newAttempts,
              error: `Invalid PIN. ${MAX_PIN_ATTEMPTS - newAttempts} attempts remaining.`
            });
          }
        }
      },
      setHasLoggedInBefore: (value) => set({ hasLoggedInBefore: value }),
      logout: () => set({ 
        admin: null, 
        isAuthenticated: false, 
        error: null,
        lastActivity: Date.now(),
        failedAttempts: 0,
        lockoutUntil: null,
        pinAttempts: 0,
        pinLockoutUntil: null
      })
    }),
    {
      name: 'metofun-auth'
    }
  )
);

// Shop Store
interface ShopState {
  currentShop: Shop | null;
  shops: Shop[];
  isLoading: boolean;
  setCurrentShop: (shop: Shop | null) => void;
  setShops: (shops: Shop[]) => void;
  addShop: (shop: Shop) => void;
  updateShop: (shop: Shop) => void;
  removeShop: (id: string) => void;
}

export const useShopStore = create<ShopState>()(
  persist(
    (set) => ({
      currentShop: null,
      shops: [],
      isLoading: false,
      setCurrentShop: (currentShop) => set({ currentShop }),
      setShops: (shops) => set({ shops }),
      addShop: (shop) => set((state) => ({ shops: [...state.shops, shop] })),
      updateShop: (shop) => set((state) => ({
        shops: state.shops.map(s => s.id === shop.id ? shop : s)
      })),
      removeShop: (id) => set((state) => ({
        shops: state.shops.filter(s => s.id !== id)
      }))
    }),
    {
      name: 'metofun-shop'
    }
  )
);

// Item Store
interface ItemState {
  items: Item[];
  isLoading: boolean;
  setItems: (items: Item[]) => void;
  addItem: (item: Item) => void;
  updateItem: (item: Item) => void;
  removeItem: (id: string) => void;
}

export const useItemStore = create<ItemState>()(
  persist(
    (set) => ({
      items: [],
      isLoading: false,
      setItems: (items) => set({ items }),
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
      updateItem: (item) => set((state) => ({
        items: state.items.map(i => i.id === item.id ? item : i)
      })),
      removeItem: (id) => set((state) => ({
        items: state.items.filter(i => i.id !== id)
      }))
    }),
    {
      name: 'metofun-items'
    }
  )
);

// Game Store
interface GameState {
  gameStatus: 'idle' | 'playing' | 'won' | 'lost' | 'nominating';
  selectedBox: number | null;
  correctNumber: number | null;
  thresholdNumber: number | null; // Winning threshold based on purchase amount
  customerSession: CustomerSession | null;
  selectedItem: Item | null;
  isDemoMode: boolean;
  language: 'en' | 'sw';
  // Test Mode - only for Super Admin
  isTestMode: boolean;
  testPhonePrefix: string; // Mock phone prefix for test data isolation
  // Nomination state
  nominationItems: NominationItem[];
  currentGameAttemptId: string | null;
  hasNominatedThisAttempt: boolean;
  // Item of the Day - global marketing banner
  itemOfTheDay: ItemOfTheDay | null;
  hasLikedItemOfDay: boolean; // Track if customer has liked in this session
  setGameStatus: (status: 'idle' | 'playing' | 'won' | 'lost' | 'nominating') => void;
  setSelectedBox: (box: number | null) => void;
  setCorrectNumber: (number: number | null) => void;
  setThresholdNumber: (threshold: number | null) => void;
  setCustomerSession: (session: CustomerSession | null) => void;
  setSelectedItem: (item: Item | null) => void;
  setDemoMode: (isDemo: boolean) => void;
  setTestMode: (isTest: boolean, prefix?: string) => void;
  setLanguage: (lang: 'en' | 'sw') => void;
  setNominationItems: (items: NominationItem[]) => void;
  setCurrentGameAttemptId: (id: string | null) => void;
  setHasNominatedThisAttempt: (hasNominated: boolean) => void;
  setItemOfTheDay: (item: ItemOfTheDay | null) => void;
  incrementItemOfDayLikes: () => void;
  setHasLikedItemOfDay: (hasLiked: boolean) => void;
  resetGame: () => void;
  clearTestData: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      gameStatus: 'idle',
      selectedBox: null,
      correctNumber: null,
      thresholdNumber: null,
      customerSession: null,
      selectedItem: null,
      isDemoMode: false,
      language: 'en',
      // Test Mode - only for Super Admin
      isTestMode: false,
      testPhonePrefix: 'TEST',
      // Nomination state
      nominationItems: [],
      currentGameAttemptId: null,
      hasNominatedThisAttempt: false,
      // Item of the Day
      itemOfTheDay: null,
      hasLikedItemOfDay: false,
      setGameStatus: (gameStatus) => set({ gameStatus }),
      setSelectedBox: (selectedBox) => set({ selectedBox }),
      setCorrectNumber: (correctNumber) => set({ correctNumber }),
      setThresholdNumber: (thresholdNumber) => set({ thresholdNumber }),
      setCustomerSession: (customerSession) => set({ customerSession }),
      setSelectedItem: (selectedItem) => set({ selectedItem }),
      setDemoMode: (isDemoMode) => set({ isDemoMode }),
      setTestMode: (isTestMode, testPhonePrefix = 'TEST') => set({ isTestMode, testPhonePrefix }),
      setLanguage: (language) => set({ language }),
      setNominationItems: (nominationItems) => set({ nominationItems }),
      setCurrentGameAttemptId: (currentGameAttemptId) => set({ currentGameAttemptId }),
      setHasNominatedThisAttempt: (hasNominatedThisAttempt) => set({ hasNominatedThisAttempt }),
      setItemOfTheDay: (itemOfTheDay) => set({ itemOfTheDay }),
      incrementItemOfDayLikes: async () => {
        const current = useGameStore.getState().itemOfTheDay;
        if (!current) return;

        const newLikes = (current.likes || 0) + 1;
        const updated = { ...current, likes: newLikes };

        set({ itemOfTheDay: updated });
        await localSettings.set('itemOfTheDay', updated);

        // Queue for sync to RTDB so likes persist across devices
        try {
          const { queueForSync } = await import('@/lib/sync-service');
          await queueForSync({
            type: 'setting',
            operation: 'update',
            data: { key: 'itemOfTheDay', value: updated }
          });
        } catch (error) {
          console.error('[Sync] Failed to queue item of the day update:', error);
        }
      },
      setHasLikedItemOfDay: (hasLikedItemOfDay) => set({ hasLikedItemOfDay }),
      resetGame: () => set({
        gameStatus: 'idle',
        selectedBox: null,
        correctNumber: null,
        thresholdNumber: null,
        selectedItem: null,
        currentGameAttemptId: null,
        hasNominatedThisAttempt: false,
        hasLikedItemOfDay: false
      }),
      clearTestData: () => set({
        isTestMode: false,
        testPhonePrefix: 'TEST'
      })
    }),
    {
      name: 'metofun-game'
    }
  )
);

// UI Store with Theme Support
interface UIState {
  isOnline: boolean;
  showSplash: boolean;
  currentView: 'login' | 'admin' | 'customer' | 'shop-select';
  theme: 'dark' | 'light';
  setOnline: (online: boolean) => void;
  setShowSplash: (show: boolean) => void;
  setCurrentView: (view: 'login' | 'admin' | 'customer' | 'shop-select') => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      isOnline: true,
      showSplash: true,
      currentView: 'login',
      theme: 'dark',
      setOnline: (isOnline) => set({ isOnline }),
      setShowSplash: (showSplash) => set({ showSplash }),
      setCurrentView: (currentView) => set({ currentView }),
      setTheme: (theme) => {
        document.documentElement.classList.toggle('light', theme === 'light');
        document.documentElement.classList.toggle('dark', theme === 'dark');
        set({ theme });
      },
      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark';
        document.documentElement.classList.toggle('light', newTheme === 'light');
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        set({ theme: newTheme });
      }
    }),
    {
      name: 'metofun-ui'
    }
  )
);

// Sync Queue Store - Tracks pending offline sync items
export interface SyncQueueItem {
  id: string;
  type: SyncItemType;
  operation: SyncOperation;
  data: any;
  status: 'pending' | 'synced' | 'failed';
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastError?: string;
}

interface SyncState {
  queue: SyncQueueItem[];
  isSyncing: boolean;
  lastSyncTime: Date | null;
  addToQueue: (item: Omit<SyncQueueItem, 'retryCount'>) => void;
  removeFromQueue: (id: string) => void;
  updateQueueItem: (id: string, updates: Partial<SyncQueueItem>) => void;
  clearQueue: () => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: Date | null) => void;
  getPendingCount: () => number;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,
      lastSyncTime: null,
      addToQueue: (item) => set((state) => ({
        queue: [...state.queue, { ...item, retryCount: 0 }]
      })),
      removeFromQueue: (id) => set((state) => ({
        queue: state.queue.filter(item => item.id !== id)
      })),
      updateQueueItem: (id, updates) => set((state) => ({
        queue: state.queue.map(item => 
          item.id === id ? { ...item, ...updates } : item
        )
      })),
      clearQueue: () => set({ queue: [] }),
      setSyncing: (isSyncing) => set({ isSyncing }),
      setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
      getPendingCount: () => get().queue.filter(item => item.status === 'pending').length
    }),
    {
      name: 'metofun-sync',
      partialize: (state) => ({ queue: state.queue, lastSyncTime: state.lastSyncTime })
    }
  )
);

// Initialize local data from IndexedDB - with timeout protection
export const initializeFromLocal = async () => {
  const initTimeout = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Init timeout')), 15000)
  );
  
  try {
    const shops = await Promise.race([localShops.getAll(), initTimeout]) as Shop[];
    useShopStore.getState().setShops(shops);
  } catch (e) {
    console.error('Failed to load shops during init:', e);
  }
  
  // If there's a current shop, load its items
  const currentShop = useShopStore.getState().currentShop;
  if (currentShop) {
    try {
      const items = await Promise.race([localItems.getByShop(currentShop.id), initTimeout]) as Item[];
      useItemStore.getState().setItems(items);
    } catch (e) {
      console.error('Failed to load items during init:', e);
    }
  }
  
  // Load Item of the Day
  try {
    const itemOfDay = await Promise.race([localSettings.get('itemOfTheDay'), initTimeout]);
    if (itemOfDay) {
      useGameStore.getState().setItemOfTheDay(itemOfDay);
    }
  } catch (e) {
    console.error('Failed to load item of day:', e);
  }
  
  // Get device ID
  const deviceId = await getDeviceId();
  return deviceId;
};
