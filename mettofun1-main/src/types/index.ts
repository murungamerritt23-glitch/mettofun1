// User Types
// Admin Levels:
// - super_admin: Full system control, create/manage shops, global analytics
// - agent_admin (Middle Admin): Onboard/support assigned shops, limited analytics
// - shop_admin: Manage their own shop only

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
  deviceId?: string;        // Device ID this admin is locked to
  deviceLocked?: boolean;   // Whether device locking is enabled for this admin
  dashboardPassword?: string; // 4-digit PIN for shop_admin dashboard access
}

// Permission types for role-based access control
export interface AdminPermissions {
  canManageAllShops: boolean;      // super_admin: Create/manage all shops
  canManageAssignedShops: boolean; // agent_admin: Manage assigned shops only
  canOnboardShops: boolean;        // Create new shops
  canDeleteShops: boolean;         // Delete shops permanently
  canActivateShops: boolean;       // Activate/deactivate shops
  canAssignSubscription: boolean;  // Assign subscription tiers
  canManageAdmins: boolean;        // Create/manage other admins
  canAssignShops: boolean;         // Assign shops to agent_admins
  canEditQualifyingPurchase: boolean; // Set qualifying purchase amount
  canEditItems: boolean;           // Edit the 17 items
  canViewAnalytics: boolean;        // View analytics
  canViewGlobalAnalytics: boolean;  // super_admin: View global analytics
  canEditTermsHelp: boolean;        // super_admin: Edit terms & help
  canManageVersions: boolean;       // super_admin: Manage app versions
  canBackupRestore: boolean;        // Backup/restore functionality
  canResetDevices: boolean;         // Reset device locks
  canViewAllShops: boolean;         // super_admin: View all shops including inactive
}

// Map admin level to permissions
export const ADMIN_PERMISSIONS: Record<AdminLevel, AdminPermissions> = {
  super_admin: {
    canManageAllShops: true,
    canManageAssignedShops: false,
    canOnboardShops: true,
    canDeleteShops: true,
    canActivateShops: true,
    canAssignSubscription: true,
    canManageAdmins: true,
    canAssignShops: true,
    canEditQualifyingPurchase: false,
    canEditItems: false,
    canViewAnalytics: true,
    canViewGlobalAnalytics: true,
    canEditTermsHelp: true,
    canManageVersions: true,
    canBackupRestore: true,
    canResetDevices: true,
    canViewAllShops: true,
  },
  agent_admin: {
    canManageAllShops: false,
    canManageAssignedShops: true,
    canOnboardShops: true,
    canDeleteShops: false,
    canActivateShops: false,
    canAssignSubscription: false,
    canManageAdmins: false,
    canAssignShops: true,
    canEditQualifyingPurchase: false,
    canEditItems: false,
    canViewAnalytics: true,
    canViewGlobalAnalytics: false,
    canEditTermsHelp: false,
    canManageVersions: false,
    canBackupRestore: false,
    canResetDevices: false,
    canViewAllShops: false,
  },
  shop_admin: {
    canManageAllShops: false,
    canManageAssignedShops: false,
    canOnboardShops: false,
    canDeleteShops: false,
    canActivateShops: false,
    canAssignSubscription: false,
    canManageAdmins: false,
    canAssignShops: false,
    canEditQualifyingPurchase: true,
    canEditItems: true,
    canViewAnalytics: true,
    canViewGlobalAnalytics: false,
    canEditTermsHelp: false,
    canManageVersions: false,
    canBackupRestore: false,
    canResetDevices: false,
    canViewAllShops: false,
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
  addedBy?: string;         // agent_admin ID who added this shop
  addedByName?: string;     // agent_admin name for display
  backupEnabled: boolean;
  lastBackup?: Date;
  location?: ShopLocation;
  subscriptionId?: string;
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
  adminEmail: string;       // Shop admin email - must match login email
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
  createdAt?: Date;
  updatedAt?: Date;
}

// Item of the Day - global marketing banner controlled by Super Admin
export interface ItemOfTheDay {
  id: string;
  name: string;
  value: number;
  imageUrl?: string;
  isActive: boolean;
  likes: number; // Customer likes count
  createdAt: Date;
  updatedAt: Date;
}

// Nomination Types - for customer feedback after game attempts
export interface NominationItem {
  id: string;
  name: string;
  value: number;
  imageUrl?: string;
  nominationCount: number;
  isActive: boolean;
  shopId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Track which items a customer has nominated this attempt
export interface CustomerNomination {
  id: string;
  phoneNumber: string;
  shopId: string;
  itemId: string;
  gameAttemptId: string;
  timestamp: Date;
  synced: boolean;
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
  isTest?: boolean; // Test mode flag - marks test attempts to exclude from real analytics
  entrySource?: 'PURCHASE' | 'NPN'; // Track how customer gained entry
  // Anti-tamper fields
  integrityHash?: string;      // SHA256 hash of game data for integrity verification
  integrityVerified?: boolean; // Whether the integrity has been verified
  hashSeed?: string;           // Random seed used for generating the result
}

// NPN (No Purchase Needed) Entry - single-use, expires at midnight
export interface NPNEntry {
  id: string;
  phoneNumber: string;      // Normalized phone (e.g., "+254700...")
  shopId: string;           // Shop where entry is valid
  createdAt: Date;
  used: boolean;            // True if attempt has been consumed
  usedAt?: Date;            // Timestamp when used
  usedAttemptId?: string;   // Linked attempt ID
  isActive: boolean;        // True if unused and not expired
  expiresAt: Date;          // End-of-day expiration (midnight)
  createdBy: string;        // Admin ID who created this entry
  entrySource: 'NPN';       // Always 'NPN'
}

export interface CustomerSession {
  phoneNumber: string;
  attemptsToday: number;
  lastAttemptDate: string;
  authorized: boolean;
  purchaseAmount?: number;
  entrySource?: 'PURCHASE' | 'NPN'; // Track how customer entered
  npnEntryId?: string;             // NPN entry ID if entrySource === 'NPN'
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
  tamperedCount: number;  // Number of attempts with failed integrity check
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
export type SyncItemType = 'attempt' | 'item' | 'shop' | 'nominationItem' | 'customerNomination' | 'setting' | 'npn';
export type SyncOperation = 'create' | 'update' | 'delete';

export interface SyncQueue {
  id: string;
  type: SyncItemType;
  operation: SyncOperation;
  data: string; // JSON stringified data
  status: 'pending' | 'synced' | 'failed';
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  retryCount?: number;
  lastError?: string;
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
