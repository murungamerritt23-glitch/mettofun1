import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Admin, Shop, Item, GameAttempt, CustomerSession, AppSettings, NominationItem } from '@/types';
import { localShops, localItems, localAttempts, localSessions, localSettings, getDeviceId } from '@/lib/local-db';

// Auth Store
interface AuthState {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setAdmin: (admin: Admin | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      admin: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      setAdmin: (admin) => set({ admin, isAuthenticated: !!admin }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      logout: () => set({ admin: null, isAuthenticated: false, error: null })
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
      resetGame: () => set({
        gameStatus: 'idle',
        selectedBox: null,
        correctNumber: null,
        thresholdNumber: null,
        selectedItem: null,
        currentGameAttemptId: null,
        hasNominatedThisAttempt: false
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

// UI Store
interface UIState {
  isOnline: boolean;
  showSplash: boolean;
  currentView: 'login' | 'admin' | 'customer' | 'shop-select';
  setOnline: (online: boolean) => void;
  setShowSplash: (show: boolean) => void;
  setCurrentView: (view: 'login' | 'admin' | 'customer' | 'shop-select') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isOnline: true,
      showSplash: true,
      currentView: 'login',
      setOnline: (isOnline) => set({ isOnline }),
      setShowSplash: (showSplash) => set({ showSplash }),
      setCurrentView: (currentView) => set({ currentView })
    }),
    {
      name: 'metofun-ui'
    }
  )
);

// Initialize local data from IndexedDB
export const initializeFromLocal = async () => {
  const shops = await localShops.getAll();
  useShopStore.getState().setShops(shops);
  
  // If there's a current shop, load its items
  const currentShop = useShopStore.getState().currentShop;
  if (currentShop) {
    const items = await localItems.getByShop(currentShop.id);
    useItemStore.getState().setItems(items);
  }
  
  // Get device ID
  const deviceId = await getDeviceId();
  return deviceId;
};
