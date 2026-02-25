// User Types
// Admin Levels:
// - super_admin: Full access (add/remove admins, onboard shops, activate/deactivate shops, set qualifying purchase, edit items)
// - agent_admin: Can onboard shops, activate/deactivate shops
// - shop_admin: Can set qualifying purchase, edit items

export type AdminLevel = 'super_admin' | 'agent_admin' | 'shop_admin';

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

// Permission types for role-based access control
export interface AdminPermissions {
  canManageAdmins: boolean;      // Add/remove other admins
  canOnboardShops: boolean;      // Create new shops
  canActivateShops: boolean;     // Activate/deactivate shops
  canEditQualifyingPurchase: boolean; // Set qualifying purchase amount
  canEditItems: boolean;          // Edit the 17 items
  canViewAnalytics: boolean;      // View analytics
  canBackupData: boolean;         // Backup/restore data
  canManageSettings: boolean;     // App settings
}

// Map admin level to permissions
export const ADMIN_PERMISSIONS: Record<AdminLevel, AdminPermissions> = {
  super_admin: {
    canManageAdmins: true,
    canOnboardShops: true,
    canActivateShops: true,
    canEditQualifyingPurchase: true,
    canEditItems: true,
    canViewAnalytics: true,
    canBackupData: true,
    canManageSettings: true,
  },
  agent_admin: {
    canManageAdmins: false,
    canOnboardShops: true,
    canActivateShops: true,
    canEditQualifyingPurchase: false,
    canEditItems: false,
    canViewAnalytics: false,
    canBackupData: false,
    canManageSettings: false,
  },
  shop_admin: {
    canManageAdmins: false,
    canOnboardShops: false,
    canActivateShops: false,
    canEditQualifyingPurchase: true,
    canEditItems: true,
    canViewAnalytics: false,
    canBackupData: false,
    canManageSettings: false,
  },
};

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
  boxCount: number;  // Always 17
  threshold: number; // How many winning numbers (1-6 based on purchase)
  ratio: string;     // Display ratio for UI
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
