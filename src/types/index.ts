// User Types
// Admin Levels:
// - admin: Full access (onboard shops, activate/deactivate, view analytics)
// - shop_admin: Can set qualifying purchase, edit items for their own shop only

export type AdminLevel = 'admin' | 'shop_admin';

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
  deviceId?: string;        // Device ID this admin is locked to
  deviceLocked?: boolean;   // Whether device locking is enabled for this admin
}

// Permission types for role-based access control
export interface AdminPermissions {
  canManageShops: boolean;      // Onboard, activate/deactivate shops
  canEditQualifyingPurchase: boolean; // Set qualifying purchase amount
  canEditItems: boolean;          // Edit the 17 items
  canViewAnalytics: boolean;      // View analytics
}

// Map admin level to permissions
export const ADMIN_PERMISSIONS: Record<AdminLevel, AdminPermissions> = {
  admin: {
    canManageShops: true,
    canEditQualifyingPurchase: false,  // admin can only READ
    canEditItems: false,  // admin can only READ
    canViewAnalytics: true,
  },
  shop_admin: {
    canManageShops: false,
    canEditQualifyingPurchase: true,
    canEditItems: true,
    canViewAnalytics: false,
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
  subscriptionId?: string;
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
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

// Pending customer purchase - recorded by shop staff
export interface PendingCustomer {
  id: string;
  phoneNumber: string;
  shopId: string;
  purchaseAmount: number;
  qualifyingAmount: number;
  itemId: string;          // Item they're attempting to win
  itemName: string;         // Item name for display
  recordedBy: string;       // admin ID who recorded
  recordedAt: Date;
  authorized: boolean;
  authorizedBy?: string;
  authorizedAt?: Date;
  used: boolean;             // whether they've played
  usedAt?: Date;
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

// Subscription Types
export type SubscriptionTier = 'basic' | 'medium' | 'pro';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'trial';

// Subscription channels/features for each tier
export interface SubscriptionChannels {
  maxShops: number;
  maxAdminsPerShop: number;
  analyticsEnabled: boolean;
  customBrandingEnabled: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
  multiLocation: boolean;
  advancedReporting: boolean;
  whitelabelMode: boolean;
}

export const SUBSCRIPTION_CHANNELS: Record<SubscriptionTier, SubscriptionChannels> = {
  basic: {
    maxShops: 1,
    maxAdminsPerShop: 3,
    analyticsEnabled: false,
    customBrandingEnabled: false,
    prioritySupport: false,
    apiAccess: false,
    multiLocation: false,
    advancedReporting: false,
    whitelabelMode: false,
  },
  medium: {
    maxShops: 3,
    maxAdminsPerShop: 5,
    analyticsEnabled: true,
    customBrandingEnabled: false,
    prioritySupport: false,
    apiAccess: false,
    multiLocation: false,
    advancedReporting: false,
    whitelabelMode: false,
  },
  pro: {
    maxShops: 10,
    maxAdminsPerShop: 10,
    analyticsEnabled: true,
    customBrandingEnabled: true,
    prioritySupport: true,
    apiAccess: true,
    multiLocation: true,
    advancedReporting: true,
    whitelabelMode: true,
  },
};

export interface Subscription {
  id: string;
  shopId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  monthlyPrice: number;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  price: number;
  features: string[];
  maxShops: number;
  maxAdmins: number;
  analyticsEnabled: boolean;
}
