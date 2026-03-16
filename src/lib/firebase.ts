import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  Auth,
  User,
  connectAuthEmulator
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Firestore,
  serverTimestamp,
  connectFirestoreEmulator
} from 'firebase/firestore';
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  off,
  query as rtdbQuery,
  orderByChild,
  equalTo,
  limitToFirst,
  limitToLast,
  Database,
  connectDatabaseEmulator
} from 'firebase/database';
import type { Shop, Subscription, SubscriptionTier, Admin, GameAttempt, Item, NominationItem, CustomerNomination } from '@/types';
import { localSettings } from './local-db';

// Firebase configuration - Replace with your own config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://demo-project-default-rtdb.firebaseio.com"
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let rtdb: Database;

if (typeof window !== 'undefined') {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  rtdb = getDatabase(app);
  
  // Connect to emulators only if explicitly set to 'true'
  // Default is production (safer default)
  const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';
  
  if (useEmulators) {
    // Only use emulators if explicitly enabled
    if (process.env.NODE_ENV === 'development') {
      connectAuthEmulator(auth, "http://localhost:9099");
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectDatabaseEmulator(rtdb, 'localhost', 9000);
      console.log('🔧 Using Firebase emulators (explicitly enabled)');
    } else {
      console.warn('⚠️ Cannot use emulators in production! Set NEXT_PUBLIC_USE_EMULATORS=false');
    }
  } else {
    // Production mode - verify Firebase is configured
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId || projectId === 'demo-project') {
      console.warn('⚠️ Firebase not configured! Set NEXT_PUBLIC_FIREBASE_* env vars.');
    } else {
      console.log('🔗 Using production Firebase project:', projectId);
      console.log('📡 Using Realtime Database');
    }
  }
}

// Auth functions
export const firebaseAuth = {
  signIn: async (email: string, password: string) => {
    if (!auth) return { error: 'Auth not initialized' };
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { user: result.user };
    } catch (error: any) {
      return { error: error.message };
    }
  },

  signUp: async (email: string, password: string) => {
    if (!auth) return { error: 'Auth not initialized' };
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return { user: result.user };
    } catch (error: any) {
      return { error: error.message };
    }
  },

  signOut: async () => {
    if (!auth) return;
    await signOut(auth);
  },

  onAuthChange: (callback: (user: User | null) => void) => {
    if (!auth) return () => {};
    return onAuthStateChanged(auth, callback);
  },

  getCurrentUser: () => {
    return auth?.currentUser;
  }
};

// Firestore functions
export const firebaseDb = {
  // Create or update document
  set: async (collectionName: string, docId: string, data: any) => {
    if (!db) return { error: 'Database not initialized' };
    try {
      await setDoc(doc(db, collectionName, docId), {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  },

  // Get document
  get: async (collectionName: string, docId: string) => {
    if (!db) return { error: 'Database not initialized' };
    try {
      const docSnap = await getDoc(doc(db, collectionName, docId));
      if (docSnap.exists()) {
        return { data: { id: docSnap.id, ...docSnap.data() } };
      }
      return { data: null };
    } catch (error: any) {
      return { error: error.message };
    }
  },

  // Get all documents in collection
  getAll: async (collectionName: string, constraints?: any[]) => {
    if (!db) return { error: 'Database not initialized' };
    try {
      let q = collection(db, collectionName);
      if (constraints && constraints.length > 0) {
        q = query(collection(db, collectionName), ...constraints) as any;
      }
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return { data: docs };
    } catch (error: any) {
      return { error: error.message };
    }
  },

  // Update document
  update: async (collectionName: string, docId: string, data: any) => {
    if (!db) return { error: 'Database not initialized' };
    try {
      await updateDoc(doc(db, collectionName, docId), {
        ...data,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  },

  // Delete document
  delete: async (collectionName: string, docId: string) => {
    if (!db) return { error: 'Database not initialized' };
    try {
      await deleteDoc(doc(db, collectionName, docId));
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  },

  // Subscribe to real-time updates
  subscribe: (collectionName: string, constraints: any[], callback: (docs: any[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, collectionName), ...constraints);
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(docs);
    });
  }
};

export { app, auth, db };

// Shop collection helper functions for Firestore
const SHOPS_COLLECTION = 'shops';

export const firebaseShops = {
  // Get all active shops
  async getAllActive(): Promise<Shop[]> {
    const result = await firebaseDb.getAll(SHOPS_COLLECTION, [
      where('isActive', '==', true)
    ]);
    if (result.error) {
      console.error('Error fetching shops:', result.error);
      return [];
    }
    return (result.data || []).map((doc: any) => ({
      id: doc.id,
      shopName: doc.shopName,
      shopCode: doc.shopCode,
      deviceId: doc.deviceId,
      deviceLocked: doc.deviceLocked,
      qualifyingPurchase: doc.qualifyingPurchase,
      promoMessage: doc.promoMessage,
      isActive: doc.isActive,
      createdAt: doc.createdAt?.toDate?.() ? doc.createdAt.toDate() : (doc.createdAt ? new Date(doc.createdAt) : new Date()),
      updatedAt: doc.updatedAt?.toDate?.() ? doc.updatedAt.toDate() : (doc.updatedAt ? new Date(doc.updatedAt) : new Date()),
      createdBy: doc.createdBy,
      backupEnabled: doc.backupEnabled,
      addedBy: doc.addedBy,
      addedByName: doc.addedByName,
      location: doc.location,
      subscriptionTier: doc.subscriptionTier,
      subscriptionStatus: doc.subscriptionStatus,
      subscriptionId: doc.subscriptionId,
      adminEmail: doc.adminEmail || '',
    }));
  },

  // Get shop by code
  async getByCode(code: string): Promise<Shop | null> {
    const result = await firebaseDb.getAll(SHOPS_COLLECTION, [
      where('shopCode', '==', code)
    ]);
    if (result.error || !result.data || result.data.length === 0) {
      return null;
    }
    const doc = result.data[0] as any;
    return {
      id: doc.id,
      shopName: doc.shopName,
      shopCode: doc.shopCode,
      deviceId: doc.deviceId,
      deviceLocked: doc.deviceLocked,
      qualifyingPurchase: doc.qualifyingPurchase,
      promoMessage: doc.promoMessage,
      isActive: doc.isActive,
      createdAt: doc.createdAt?.toDate?.() ? doc.createdAt.toDate() : (doc.createdAt ? new Date(doc.createdAt) : new Date()),
      updatedAt: doc.updatedAt?.toDate?.() ? doc.updatedAt.toDate() : (doc.updatedAt ? new Date(doc.updatedAt) : new Date()),
      createdBy: doc.createdBy,
      backupEnabled: doc.backupEnabled,
      addedBy: doc.addedBy,
      addedByName: doc.addedByName,
      location: doc.location,
      subscriptionTier: doc.subscriptionTier,
      subscriptionStatus: doc.subscriptionStatus,
      subscriptionId: doc.subscriptionId,
      adminEmail: doc.adminEmail || '',
    };
  },

  // Get shop by admin email
  async getByEmail(email: string): Promise<Shop | null> {
    const result = await firebaseDb.getAll(SHOPS_COLLECTION, [
      where('adminEmail', '==', email.toLowerCase())
    ]);
    if (result.error || !result.data || result.data.length === 0) {
      return null;
    }
    const doc = result.data[0] as any;
    return {
      id: doc.id,
      shopName: doc.shopName,
      shopCode: doc.shopCode,
      deviceId: doc.deviceId,
      deviceLocked: doc.deviceLocked,
      qualifyingPurchase: doc.qualifyingPurchase,
      promoMessage: doc.promoMessage,
      isActive: doc.isActive,
      createdAt: doc.createdAt?.toDate?.() ? doc.createdAt.toDate() : (doc.createdAt ? new Date(doc.createdAt) : new Date()),
      updatedAt: doc.updatedAt?.toDate?.() ? doc.updatedAt.toDate() : (doc.updatedAt ? new Date(doc.updatedAt) : new Date()),
      createdBy: doc.createdBy,
      backupEnabled: doc.backupEnabled,
      addedBy: doc.addedBy,
      addedByName: doc.addedByName,
      location: doc.location,
      subscriptionTier: doc.subscriptionTier,
      subscriptionStatus: doc.subscriptionStatus,
      subscriptionId: doc.subscriptionId,
      adminEmail: doc.adminEmail || '',
    };
  },

  // Create or update a shop
  async save(shop: Shop): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.set(SHOPS_COLLECTION, shop.id, {
      shopName: shop.shopName,
      shopCode: shop.shopCode,
      deviceId: shop.deviceId,
      deviceLocked: shop.deviceLocked,
      qualifyingPurchase: shop.qualifyingPurchase,
      promoMessage: shop.promoMessage,
      isActive: shop.isActive,
      createdAt: shop.createdAt instanceof Date ? shop.createdAt.toISOString() : shop.createdAt,
      createdBy: shop.createdBy,
      backupEnabled: shop.backupEnabled,
      addedBy: shop.addedBy || null,
      addedByName: shop.addedByName || null,
      adminEmail: shop.adminEmail || null,
    });
    return { success: !result.error, error: result.error };
  },

  // Subscribe to active shops (real-time)
  subscribeToActiveShops(callback: (shops: Shop[]) => void): () => void {
    return firebaseDb.subscribe(
      SHOPS_COLLECTION,
      [where('isActive', '==', true)],
      (docs: any[]) => {
        const shops = docs.map((doc) => ({
          id: doc.id,
          shopName: doc.shopName,
          shopCode: doc.shopCode,
          deviceId: doc.deviceId,
          deviceLocked: doc.deviceLocked,
          qualifyingPurchase: doc.qualifyingPurchase,
          promoMessage: doc.promoMessage,
          isActive: doc.isActive,
          createdAt: doc.createdAt?.toDate?.() ? doc.createdAt.toDate() : (doc.createdAt ? new Date(doc.createdAt) : new Date()),
          updatedAt: doc.updatedAt?.toDate?.() ? doc.updatedAt.toDate() : (doc.updatedAt ? new Date(doc.updatedAt) : new Date()),
          createdBy: doc.createdBy,
          backupEnabled: doc.backupEnabled,
          addedBy: doc.addedBy,
          addedByName: doc.addedByName,
          location: doc.location,
          subscriptionTier: doc.subscriptionTier,
          subscriptionStatus: doc.subscriptionStatus,
          subscriptionId: doc.subscriptionId,
          adminEmail: doc.adminEmail || '',
        }));
        callback(shops);
      }
    );
  },

  // Get ALL shops (including inactive) - for super admin
  async getAll(): Promise<Shop[]> {
    const result = await firebaseDb.getAll(SHOPS_COLLECTION, []);
    if (result.error) {
      console.error('Error fetching all shops:', result.error);
      return [];
    }
    return (result.data || []).map((doc: any) => ({
      id: doc.id,
      shopName: doc.shopName,
      shopCode: doc.shopCode,
      deviceId: doc.deviceId,
      deviceLocked: doc.deviceLocked,
      qualifyingPurchase: doc.qualifyingPurchase,
      promoMessage: doc.promoMessage,
      isActive: doc.isActive,
      createdAt: doc.createdAt?.toDate?.() ? doc.createdAt.toDate() : (doc.createdAt ? new Date(doc.createdAt) : new Date()),
      updatedAt: doc.updatedAt?.toDate?.() ? doc.updatedAt.toDate() : (doc.updatedAt ? new Date(doc.updatedAt) : new Date()),
      createdBy: doc.createdBy,
      backupEnabled: doc.backupEnabled,
      addedBy: doc.addedBy,
      addedByName: doc.addedByName,
      location: doc.location,
      subscriptionTier: doc.subscriptionTier,
      subscriptionStatus: doc.subscriptionStatus,
      subscriptionId: doc.subscriptionId,
      adminEmail: doc.adminEmail || '',
    }));
  },

  // Delete a shop (soft delete - just mark inactive)
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.update(SHOPS_COLLECTION, id, {
      isActive: false,
      updatedAt: new Date(),
    });
    return { success: !result.error, error: result.error };
  },

  // Hard delete a shop (permanent)
  async hardDelete(id: string): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.delete(SHOPS_COLLECTION, id);
    return { success: !result.error, error: result.error };
  },

  // Update shop (activate/deactivate, update subscription)
  async update(id: string, data: Partial<Shop>): Promise<{ success: boolean; error?: string }> {
    const updateData: any = { ...data, updatedAt: new Date() };
    delete updateData.id;
    
    const result = await firebaseDb.update(SHOPS_COLLECTION, id, updateData);
    return { success: !result.error, error: result.error };
  },
};

// Settings collection helper functions for Firestore
const SETTINGS_COLLECTION = 'settings';

// Admin collection helper functions for Firestore
const ADMINS_COLLECTION = 'admins';

export const firebaseAdmins = {
  // Get all admins
  async getAll(): Promise<Admin[]> {
    const result = await firebaseDb.getAll(ADMINS_COLLECTION, []);
    if (result.error) {
      console.error('Error fetching admins:', result.error);
      return [];
    }
    return (result.data || []).map((doc: any) => ({
      id: doc.id,
      email: doc.email,
      phone: doc.phone,
      name: doc.name,
      level: doc.level,
      createdAt: doc.createdAt?.toDate?.() || new Date(doc.createdAt),
      lastLogin: doc.lastLogin?.toDate?.() || new Date(doc.lastLogin),
      isActive: doc.isActive,
      assignedShops: doc.assignedShops || [],
      region: doc.region,
      deviceId: doc.deviceId,
      deviceLocked: doc.deviceLocked,
    }));
  },

  // Get admin by ID
  async getById(id: string): Promise<Admin | null> {
    const result = await firebaseDb.get(ADMINS_COLLECTION, id);
    if (result.error || !result.data) return null;
    const doc = result.data as any;
    return {
      id: doc.id,
      email: doc.email,
      phone: doc.phone,
      name: doc.name,
      level: doc.level,
      createdAt: doc.createdAt?.toDate?.() || new Date(doc.createdAt),
      lastLogin: doc.lastLogin?.toDate?.() || new Date(doc.lastLogin),
      isActive: doc.isActive,
      assignedShops: doc.assignedShops || [],
      region: doc.region,
      deviceId: doc.deviceId,
      deviceLocked: doc.deviceLocked,
    };
  },

  // Create or update admin
  async save(admin: Admin): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.set(ADMINS_COLLECTION, admin.id, {
      email: admin.email,
      phone: admin.phone,
      name: admin.name,
      level: admin.level,
      createdAt: admin.createdAt,
      lastLogin: admin.lastLogin,
      isActive: admin.isActive,
      assignedShops: admin.assignedShops || [],
      region: admin.region,
      deviceId: admin.deviceId,
      deviceLocked: admin.deviceLocked,
    });
    return { success: !result.error, error: result.error };
  },

  // Update admin (e.g., assigned shops)
  async update(id: string, data: Partial<Admin>): Promise<{ success: boolean; error?: string }> {
    const updateData: any = { ...data, updatedAt: new Date() };
    delete updateData.id;
    delete updateData.createdAt;
    
    const result = await firebaseDb.update(ADMINS_COLLECTION, id, updateData);
    return { success: !result.error, error: result.error };
  },

  // Delete admin
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.delete(ADMINS_COLLECTION, id);
    return { success: !result.error, error: result.error };
  },

  // Assign shops to an admin
  async assignShops(adminId: string, shopIds: string[]): Promise<{ success: boolean; error?: string }> {
    return this.update(adminId, { assignedShops: shopIds });
  },
};

export const firebaseSettings = {
  // Get app settings (includes terms and conditions)
  async getSettings(): Promise<{ termsContent: string; helpContent: string; version: string }> {
    const result = await firebaseDb.get(SETTINGS_COLLECTION, 'app_settings');
    if (result.error) {
      // Try to get from local storage as fallback
      const localValue = await localSettings.get('app_settings');
      if (localValue) {
        return {
          termsContent: localValue.termsContent || '',
          helpContent: localValue.helpContent || '',
          version: localValue.version || '1.0.0'
        };
      }
      // Return defaults if nothing found
      return {
        termsContent: '',
        helpContent: '',
        version: '1.0.0'
      };
    }
    if (result.data) {
      const data = result.data as any;
      const settings = {
        termsContent: data.termsContent || '',
        helpContent: data.helpContent || '',
        version: data.version || '1.0.0'
      };
      // Cache to local storage for offline use
      await localSettings.set('app_settings', settings);
      return settings;
    }
    return {
      termsContent: '',
      helpContent: '',
      version: '1.0.0'
    };
  },

  // Update terms and conditions (super admin only)
  async updateTerms(termsContent: string): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.set(SETTINGS_COLLECTION, 'app_settings', {
      termsContent,
      updatedAt: new Date()
    });
    return { success: result.success || false, error: result.error };
  },

  // Update help content (super admin only)
  async updateHelp(helpContent: string): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.set(SETTINGS_COLLECTION, 'app_settings', {
      helpContent,
      updatedAt: new Date()
    });
    return { success: result.success || false, error: result.error };
  },

  // Update all settings at once (super admin only)
  async updateAllSettings(settings: {
    termsContent?: string;
    helpContent?: string;
    version?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.set(SETTINGS_COLLECTION, 'app_settings', {
      ...settings,
      updatedAt: new Date()
    });
    return { success: result.success || false, error: result.error };
  }
};

// Subscription collection helper functions for Firestore
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

export const firebaseSubscriptions = {
  // Create a new subscription
  async create(subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const id = `${subscription.shopId}_${Date.now()}`;
      const result = await firebaseDb.set(SUBSCRIPTIONS_COLLECTION, id, {
        ...subscription,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: !result.error, id, error: result.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Get subscription by ID
  async getById(id: string): Promise<Subscription | null> {
    const result = await firebaseDb.get(SUBSCRIPTIONS_COLLECTION, id);
    if (result.error || !result.data) return null;
    const data = result.data as any;
    return {
      id: data.id,
      shopId: data.shopId,
      tier: data.tier,
      status: data.status,
      startDate: data.startDate?.toDate?.() || new Date(data.startDate),
      endDate: data.endDate?.toDate?.() || new Date(data.endDate),
      autoRenew: data.autoRenew,
      monthlyPrice: data.monthlyPrice,
      features: data.features || [],
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
    };
  },

  // Get subscription by shop ID
  async getByShopId(shopId: string): Promise<Subscription | null> {
    const result = await firebaseDb.getAll(SUBSCRIPTIONS_COLLECTION, [
      where('shopId', '==', shopId),
      orderBy('createdAt', 'desc'),
      limit(1)
    ]);
    if (result.error || !result.data || result.data.length === 0) return null;
    const data = result.data[0] as any;
    return {
      id: data.id,
      shopId: data.shopId,
      tier: data.tier,
      status: data.status,
      startDate: data.startDate?.toDate?.() || new Date(data.startDate),
      endDate: data.endDate?.toDate?.() || new Date(data.endDate),
      autoRenew: data.autoRenew,
      monthlyPrice: data.monthlyPrice,
      features: data.features || [],
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
    };
  },

  // Update subscription
  async update(id: string, data: Partial<Subscription>): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.update(SUBSCRIPTIONS_COLLECTION, id, {
      ...data,
      updatedAt: serverTimestamp()
    });
    return { success: !result.error, error: result.error };
  },

  // Cancel subscription
  async cancel(id: string): Promise<{ success: boolean; error?: string }> {
    return this.update(id, { status: 'cancelled' });
  },

  // Renew subscription
  async renew(id: string, newEndDate: Date): Promise<{ success: boolean; error?: string }> {
    return this.update(id, { 
      status: 'active',
      endDate: newEndDate
    });
  },

  // Check if subscription is valid (active and not expired)
  async isValid(shopId: string): Promise<boolean> {
    const sub = await this.getByShopId(shopId);
    if (!sub || sub.status !== 'active') return false;
    return new Date(sub.endDate) > new Date();
  }
};

// Game Attempts collection helper functions for Firestore
const ATTEMPTS_COLLECTION = 'attempts';

export const firebaseAttempts = {
  // Create a new game attempt
  async create(attempt: GameAttempt): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const result = await firebaseDb.set(ATTEMPTS_COLLECTION, attempt.id, {
        ...attempt,
        timestamp: attempt.timestamp?.toISOString?.() || attempt.timestamp,
        syncedAt: serverTimestamp()
      });
      return { success: !result.error, id: attempt.id, error: result.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Get all attempts
  async getAll(): Promise<GameAttempt[]> {
    const result = await firebaseDb.getAll(ATTEMPTS_COLLECTION, []);
    if (result.error) {
      console.error('Error fetching attempts:', result.error);
      return [];
    }
    return (result.data || []).map((doc: any) => ({
      ...doc,
      timestamp: doc.timestamp?.toDate?.() ? doc.timestamp.toDate() : (doc.timestamp ? new Date(doc.timestamp) : new Date())
    }));
  },

  // Get attempts by shop
  async getByShop(shopId: string): Promise<GameAttempt[]> {
    const result = await firebaseDb.getAll(ATTEMPTS_COLLECTION, [
      where('shopId', '==', shopId)
    ]);
    if (result.error) return [];
    return (result.data || []).map((doc: any) => ({
      ...doc,
      timestamp: doc.timestamp?.toDate?.() ? doc.timestamp.toDate() : (doc.timestamp ? new Date(doc.timestamp) : new Date())
    }));
  },

  // Update attempt
  async update(id: string, data: Partial<GameAttempt>): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.update(ATTEMPTS_COLLECTION, id, data);
    return { success: !result.error, error: result.error };
  },

  // Delete attempt
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.delete(ATTEMPTS_COLLECTION, id);
    return { success: !result.error, error: result.error };
  }
};

// Items collection helper functions for Firestore
const ITEMS_COLLECTION = 'items';

export const firebaseItems = {
  // Create a new item
  async create(item: Item): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const result = await firebaseDb.set(ITEMS_COLLECTION, item.id, {
        ...item,
        createdAt: item.createdAt?.toISOString?.() || item.createdAt,
        updatedAt: item.updatedAt?.toISOString?.() || item.updatedAt
      });
      return { success: !result.error, id: item.id, error: result.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Get all items
  async getAll(): Promise<Item[]> {
    const result = await firebaseDb.getAll(ITEMS_COLLECTION, []);
    if (result.error) {
      console.error('Error fetching items:', result.error);
      return [];
    }
    return (result.data || []).map((doc: any) => ({
      ...doc,
      createdAt: doc.createdAt?.toDate?.() ? doc.createdAt.toDate() : (doc.createdAt ? new Date(doc.createdAt) : new Date()),
      updatedAt: doc.updatedAt?.toDate?.() ? doc.updatedAt.toDate() : (doc.updatedAt ? new Date(doc.updatedAt) : new Date())
    }));
  },

  // Get items by shop
  async getByShop(shopId: string): Promise<Item[]> {
    const result = await firebaseDb.getAll(ITEMS_COLLECTION, [
      where('shopId', '==', shopId)
    ]);
    if (result.error) return [];
    return (result.data || []).map((doc: any) => ({
      ...doc,
      createdAt: doc.createdAt?.toDate?.() ? doc.createdAt.toDate() : (doc.createdAt ? new Date(doc.createdAt) : new Date()),
      updatedAt: doc.updatedAt?.toDate?.() ? doc.updatedAt.toDate() : (doc.updatedAt ? new Date(doc.updatedAt) : new Date())
    }));
  },

  // Update item
  async update(id: string, data: Partial<Item>): Promise<{ success: boolean; error?: string }> {
    const updateData: any = { ...data, updatedAt: new Date() };
    delete updateData.id;
    const result = await firebaseDb.update(ITEMS_COLLECTION, id, updateData);
    return { success: !result.error, error: result.error };
  },

  // Delete item
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.delete(ITEMS_COLLECTION, id);
    return { success: !result.error, error: result.error };
  }
};

// Nomination Items collection helper functions for Firestore
const NOMINATION_ITEMS_COLLECTION = 'nominationItems';

export const firebaseNominationItems = {
  // Create a new nomination item
  async create(item: NominationItem): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const result = await firebaseDb.set(NOMINATION_ITEMS_COLLECTION, item.id, {
        ...item,
        createdAt: item.createdAt?.toISOString?.() || item.createdAt,
        updatedAt: item.updatedAt?.toISOString?.() || item.updatedAt
      });
      return { success: !result.error, id: item.id, error: result.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Get all nomination items
  async getAll(): Promise<NominationItem[]> {
    const result = await firebaseDb.getAll(NOMINATION_ITEMS_COLLECTION, []);
    if (result.error) {
      console.error('Error fetching nomination items:', result.error);
      return [];
    }
    return (result.data || []).map((doc: any) => ({
      ...doc,
      createdAt: doc.createdAt?.toDate?.() ? doc.createdAt.toDate() : (doc.createdAt ? new Date(doc.createdAt) : new Date()),
      updatedAt: doc.updatedAt?.toDate?.() ? doc.updatedAt.toDate() : (doc.updatedAt ? new Date(doc.updatedAt) : new Date())
    }));
  },

  // Get nomination items by shop
  async getByShop(shopId: string): Promise<NominationItem[]> {
    const result = await firebaseDb.getAll(NOMINATION_ITEMS_COLLECTION, [
      where('shopId', '==', shopId)
    ]);
    if (result.error) return [];
    return (result.data || []).map((doc: any) => ({
      ...doc,
      createdAt: doc.createdAt?.toDate?.() ? doc.createdAt.toDate() : (doc.createdAt ? new Date(doc.createdAt) : new Date()),
      updatedAt: doc.updatedAt?.toDate?.() ? doc.updatedAt.toDate() : (doc.updatedAt ? new Date(doc.updatedAt) : new Date())
    }));
  },

  // Update nomination item
  async update(id: string, data: Partial<NominationItem>): Promise<{ success: boolean; error?: string }> {
    const updateData: any = { ...data, updatedAt: new Date() };
    delete updateData.id;
    const result = await firebaseDb.update(NOMINATION_ITEMS_COLLECTION, id, updateData);
    return { success: !result.error, error: result.error };
  },

  // Delete nomination item
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.delete(NOMINATION_ITEMS_COLLECTION, id);
    return { success: !result.error, error: result.error };
  }
};

// Customer Nominations collection helper functions for Firestore
const CUSTOMER_NOMINATIONS_COLLECTION = 'customerNominations';

export const firebaseCustomerNominations = {
  // Create a new customer nomination
  async create(nomination: CustomerNomination): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const result = await firebaseDb.set(CUSTOMER_NOMINATIONS_COLLECTION, nomination.id, {
        ...nomination,
        timestamp: nomination.timestamp?.toISOString?.() || nomination.timestamp
      });
      return { success: !result.error, id: nomination.id, error: result.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Get all customer nominations
  async getAll(): Promise<CustomerNomination[]> {
    const result = await firebaseDb.getAll(CUSTOMER_NOMINATIONS_COLLECTION, []);
    if (result.error) {
      console.error('Error fetching customer nominations:', result.error);
      return [];
    }
    return (result.data || []).map((doc: any) => ({
      ...doc,
      timestamp: doc.timestamp?.toDate?.() ? doc.timestamp.toDate() : (doc.timestamp ? new Date(doc.timestamp) : new Date())
    }));
  },

  // Get nominations by shop
  async getByShop(shopId: string): Promise<CustomerNomination[]> {
    const result = await firebaseDb.getAll(CUSTOMER_NOMINATIONS_COLLECTION, [
      where('shopId', '==', shopId)
    ]);
    if (result.error) return [];
    return (result.data || []).map((doc: any) => ({
      ...doc,
      timestamp: doc.timestamp?.toDate?.() ? doc.timestamp.toDate() : (doc.timestamp ? new Date(doc.timestamp) : new Date())
    }));
  },

  // Update customer nomination
  async update(id: string, data: Partial<CustomerNomination>): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.update(CUSTOMER_NOMINATIONS_COLLECTION, id, data);
    return { success: !result.error, error: result.error };
  },

  // Delete customer nomination
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    const result = await firebaseDb.delete(CUSTOMER_NOMINATIONS_COLLECTION, id);
    return { success: !result.error, error: result.error };
  }
};

// ============================================
// REALTIME DATABASE FUNCTIONS
// ============================================

const convertToSerializable = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(convertToSerializable);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = convertToSerializable(obj[key]);
    }
    return result;
  }
  return obj;
};

const serializeForRTDB = (data: any): any => {
  const serialized = convertToSerializable(data);
  if (serialized && serialized.createdAt) {
    serialized.createdAt = typeof serialized.createdAt === 'string' 
      ? serialized.createdAt 
      : serialized.createdAt.toISOString();
  }
  if (serialized && serialized.updatedAt) {
    serialized.updatedAt = typeof serialized.updatedAt === 'string'
      ? serialized.updatedAt
      : serialized.updatedAt.toISOString();
  }
  return serialized;
};

// Shops - Realtime Database
export const rtdbShops = {
  async getAllActive(): Promise<Shop[]> {
    try {
      const snapshot = await get(ref(rtdb, 'shops'));
      if (!snapshot.exists()) return [];
      const data = snapshot.val();
      return Object.entries(data)
        .filter(([_, shop]: [string, any]) => shop.isActive)
        .map(([id, shop]: [string, any]) => ({ ...shop, id }));
    } catch (error) {
      console.error('RTDB Error fetching shops:', error);
      return [];
    }
  },

  async getByEmail(email: string): Promise<Shop | null> {
    try {
      const snapshot = await get(ref(rtdb, 'shops'));
      if (!snapshot.exists()) return null;
      const data = snapshot.val();
      const shops = Object.entries(data).map(([id, shop]: [string, any]) => ({ ...shop, id }));
      const shop = shops.find(s => s.adminEmail?.toLowerCase() === email.toLowerCase());
      return shop || null;
    } catch (error) {
      console.error('RTDB Error fetching shop by email:', error);
      return null;
    }
  },

  async getAll(): Promise<Shop[]> {
    try {
      const snapshot = await get(ref(rtdb, 'shops'));
      if (!snapshot.exists()) return [];
      const data = snapshot.val();
      return Object.entries(data).map(([id, shop]: [string, any]) => ({ ...shop, id }));
    } catch (error) {
      console.error('RTDB Error fetching all shops:', error);
      return [];
    }
  },

  async get(id: string): Promise<Shop | null> {
    try {
      const snapshot = await get(ref(rtdb, `shops/${id}`));
      if (!snapshot.exists()) return null;
      return { ...snapshot.val(), id };
    } catch (error) {
      console.error('RTDB Error fetching shop:', error);
      return null;
    }
  },

  async save(shop: Shop): Promise<{ success: boolean; error?: string }> {
    try {
      await set(ref(rtdb, `shops/${shop.id}`), serializeForRTDB(shop));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async update(id: string, data: Partial<Shop>): Promise<{ success: boolean; error?: string }> {
    try {
      await update(ref(rtdb, `shops/${id}`), { ...serializeForRTDB(data), updatedAt: new Date().toISOString() });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await remove(ref(rtdb, `shops/${id}`));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async hardDelete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await remove(ref(rtdb, `shops/${id}`));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

// Items - Realtime Database
export const rtdbItems = {
  async getAll(): Promise<Item[]> {
    try {
      const snapshot = await get(ref(rtdb, 'items'));
      if (!snapshot.exists()) return [];
      const data = snapshot.val();
      return Object.entries(data).map(([id, item]: [string, any]) => ({ ...item, id }));
    } catch (error) {
      console.error('RTDB Error fetching items:', error);
      return [];
    }
  },

  async getByShop(shopId: string): Promise<Item[]> {
    try {
      const q = rtdbQuery(ref(rtdb, 'items'), equalTo('shopId', shopId));
      const snapshot = await get(q);
      if (!snapshot.exists()) return [];
      const data = snapshot.val();
      return Object.entries(data).map(([id, item]: [string, any]) => ({ ...item, id }));
    } catch (error) {
      console.error('RTDB Error fetching items by shop:', error);
      return [];
    }
  },

  async get(id: string): Promise<Item | null> {
    try {
      const snapshot = await get(ref(rtdb, `items/${id}`));
      if (!snapshot.exists()) return null;
      return { ...snapshot.val(), id };
    } catch (error) {
      console.error('RTDB Error fetching item:', error);
      return null;
    }
  },

  async create(item: Item): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const newRef = push(ref(rtdb, 'items'));
      await set(newRef, serializeForRTDB(item));
      return { success: true, id: newRef.key || item.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async update(id: string, data: Partial<Item>): Promise<{ success: boolean; error?: string }> {
    try {
      await update(ref(rtdb, `items/${id}`), { ...serializeForRTDB(data), updatedAt: new Date().toISOString() });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await remove(ref(rtdb, `items/${id}`));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

// Attempts - Realtime Database
export const rtdbAttempts = {
  async create(attempt: GameAttempt): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const newRef = push(ref(rtdb, 'attempts'));
      await set(newRef, serializeForRTDB(attempt));
      return { success: true, id: newRef.key || attempt.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async getAll(): Promise<GameAttempt[]> {
    try {
      const snapshot = await get(ref(rtdb, 'attempts'));
      if (!snapshot.exists()) return [];
      const data = snapshot.val();
      return Object.entries(data).map(([id, attempt]: [string, any]) => ({ ...attempt, id }));
    } catch (error) {
      console.error('RTDB Error fetching attempts:', error);
      return [];
    }
  },

  async getByShop(shopId: string): Promise<GameAttempt[]> {
    try {
      const q = rtdbQuery(ref(rtdb, 'attempts'), equalTo('shopId', shopId));
      const snapshot = await get(q);
      if (!snapshot.exists()) return [];
      const data = snapshot.val();
      return Object.entries(data).map(([id, attempt]: [string, any]) => ({ ...attempt, id }));
    } catch (error) {
      console.error('RTDB Error fetching attempts by shop:', error);
      return [];
    }
  },

  async update(id: string, data: Partial<GameAttempt>): Promise<{ success: boolean; error?: string }> {
    try {
      await update(ref(rtdb, `attempts/${id}`), serializeForRTDB(data));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await remove(ref(rtdb, `attempts/${id}`));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

// Nomination Items - Realtime Database
export const rtdbNominationItems = {
  async getAll(): Promise<NominationItem[]> {
    try {
      const snapshot = await get(ref(rtdb, 'nominationItems'));
      if (!snapshot.exists()) return [];
      const data = snapshot.val();
      return Object.entries(data).map(([id, item]: [string, any]) => ({ ...item, id }));
    } catch (error) {
      console.error('RTDB Error fetching nomination items:', error);
      return [];
    }
  },

  async create(item: NominationItem): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const newRef = push(ref(rtdb, 'nominationItems'));
      await set(newRef, serializeForRTDB(item));
      return { success: true, id: newRef.key || item.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async update(id: string, data: Partial<NominationItem>): Promise<{ success: boolean; error?: string }> {
    try {
      await update(ref(rtdb, `nominationItems/${id}`), serializeForRTDB(data));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await remove(ref(rtdb, `nominationItems/${id}`));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

// Customer Nominations - Realtime Database
export const rtdbCustomerNominations = {
  async getAll(): Promise<CustomerNomination[]> {
    try {
      const snapshot = await get(ref(rtdb, 'customerNominations'));
      if (!snapshot.exists()) return [];
      const data = snapshot.val();
      return Object.entries(data).map(([id, nom]: [string, any]) => ({ ...nom, id }));
    } catch (error) {
      console.error('RTDB Error fetching nominations:', error);
      return [];
    }
  },

  async getByShop(shopId: string): Promise<CustomerNomination[]> {
    try {
      const q = rtdbQuery(ref(rtdb, 'customerNominations'), equalTo('shopId', shopId));
      const snapshot = await get(q);
      if (!snapshot.exists()) return [];
      const data = snapshot.val();
      return Object.entries(data).map(([id, nom]: [string, any]) => ({ ...nom, id }));
    } catch (error) {
      console.error('RTDB Error fetching nominations by shop:', error);
      return [];
    }
  },

  async create(nomination: CustomerNomination): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const newRef = push(ref(rtdb, 'customerNominations'));
      await set(newRef, serializeForRTDB(nomination));
      return { success: true, id: newRef.key || nomination.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async update(id: string, data: Partial<CustomerNomination>): Promise<{ success: boolean; error?: string }> {
    try {
      await update(ref(rtdb, `customerNominations/${id}`), serializeForRTDB(data));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await remove(ref(rtdb, `customerNominations/${id}`));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

// Admins - Realtime Database
export const rtdbAdmins = {
  async getAll(): Promise<Admin[]> {
    try {
      const snapshot = await get(ref(rtdb, 'admins'));
      if (!snapshot.exists()) return [];
      const data = snapshot.val();
      return Object.entries(data).map(([id, admin]: [string, any]) => ({ ...admin, id }));
    } catch (error) {
      console.error('RTDB Error fetching admins:', error);
      return [];
    }
  },

  async get(id: string): Promise<Admin | null> {
    try {
      const snapshot = await get(ref(rtdb, `admins/${id}`));
      if (!snapshot.exists()) return null;
      return { ...snapshot.val(), id };
    } catch (error) {
      console.error('RTDB Error fetching admin:', error);
      return null;
    }
  },

  async save(admin: Admin): Promise<{ success: boolean; error?: string }> {
    try {
      await set(ref(rtdb, `admins/${admin.id}`), serializeForRTDB(admin));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async update(id: string, data: Partial<Admin>): Promise<{ success: boolean; error?: string }> {
    try {
      await update(ref(rtdb, `admins/${id}`), { ...serializeForRTDB(data), updatedAt: new Date().toISOString() });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await remove(ref(rtdb, `admins/${id}`));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

// Settings - Realtime Database
export const rtdbSettings = {
  async get(key: string): Promise<any> {
    try {
      const snapshot = await get(ref(rtdb, `settings/${key}`));
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('RTDB Error fetching setting:', error);
      return null;
    }
  },

  async set(key: string, value: any): Promise<{ success: boolean; error?: string }> {
    try {
      await set(ref(rtdb, `settings/${key}`), convertToSerializable(value));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async update(key: string, value: any): Promise<{ success: boolean; error?: string }> {
    try {
      await update(ref(rtdb, `settings/${key}`), convertToSerializable(value));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};
