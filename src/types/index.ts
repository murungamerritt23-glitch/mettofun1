// User Types
export type AdminLevel = 'super_admin' | 'shop_admin' | 'manager_admin' | 'mini_admin';

export interface Admin {
  id: string;
  email: string;
  phone: string;
  name: string;
  level: AdminLevel;
  createdAt: Date;
  lastLogin: Date;
  isActive: boolean;
  assignedShops?: string[];
  region?: string;
}

// Shop Types
export interface ShopLocation {
  latitude: number;
  longitude: number;
  radiusMeters: number; // How close user must be to play (default 100m)
}

export interface Shop {
  id: string;
  shopName: string;
  shopCode: string;
  deviceId: string;
  deviceLocked: boolean;
  qualifyingPurchase: number;
  promoMessage: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  backupEnabled: boolean;
  lastBackup?: Date;
  location?: ShopLocation;
}

// Item Types
export interface Item {
  id: string;
  name: string;
  value: number;
  imageUrl?: string;
  stockStatus: 'in_stock' | 'out_of_stock' | 'unlimited';
  isActive: boolean;
  shopId: string;
  order: number;
}

// Game Types
export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export interface GameAttempt {
  id: string;
  shopId: string;
  phoneNumber: string;
  purchaseAmount: number;
  qualifyingAmount: number;
  selectedBox: number;
  correctNumber: number;
  won: boolean;
  selectedItem?: Item;
  timestamp: Date;
  synced: boolean;
}

export interface CustomerSession {
  phoneNumber: string;
  attemptsToday: number;
  lastAttemptDate: string;
  authorized: boolean;
  purchaseAmount?: number;
}

// Dynamic Odds Types
export interface BoxConfiguration {
  boxCount: number;
  ratio: string;
}

// Analytics Types
export interface ShopAnalytics {
  shopId: string;
  totalAttempts: number;
  totalWins: number;
  winRate: number;
  mostSelectedItems: { itemId: string; count: number }[];
  hourlyEngagement: { hour: number; attempts: number }[];
  dailyAttempts: { date: string; attempts: number; wins: number }[];
}

export interface GlobalAnalytics {
  totalActiveShops: number;
  totalActiveUsers: number;
  totalAttempts: number;
  totalWins: number;
  regionPerformance: { region: string; attempts: number; shops: number }[];
  deviceHealth: { online: number; offline: number };
}

// Settings Types
export interface AppSettings {
  version: string;
  releaseNotes: string;
  termsContent: string;
  helpContent: string;
  maxActivationsPerDay: number;
  activationCapEnabled: boolean;
}

// Sync Types
export interface SyncQueue {
  id: string;
  type: 'attempt' | 'shop_update' | 'item_update' | 'settings_update';
  data: any;
  timestamp: Date;
  status: 'pending' | 'synced' | 'failed';
}
