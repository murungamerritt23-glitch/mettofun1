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
import type { Shop, Subscription, SubscriptionTier, Admin } from '@/types';
import { localSettings } from './local-db';

// Firebase configuration - Replace with your own config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== 'undefined') {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  
  // Connect to emulators only if explicitly set to 'true'
  // Default is production (safer default)
  const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';
  
  if (useEmulators) {
    // Only use emulators if explicitly enabled
    if (process.env.NODE_ENV === 'development') {
      connectAuthEmulator(auth, "http://localhost:9099");
      connectFirestoreEmulator(db, 'localhost', 8080);
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
      createdAt: doc.createdAt?.toDate?.() || new Date(doc.createdAt),
      updatedAt: doc.updatedAt?.toDate?.() || new Date(doc.updatedAt),
      createdBy: doc.createdBy,
      backupEnabled: doc.backupEnabled
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
      createdAt: doc.createdAt?.toDate?.() || new Date(doc.createdAt),
      updatedAt: doc.updatedAt?.toDate?.() || new Date(doc.updatedAt),
      createdBy: doc.createdBy,
      backupEnabled: doc.backupEnabled
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
      createdAt: shop.createdAt,
      createdBy: shop.createdBy,
      backupEnabled: shop.backupEnabled
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
          createdAt: doc.createdAt?.toDate?.() || new Date(doc.createdAt),
          updatedAt: doc.updatedAt?.toDate?.() || new Date(doc.updatedAt),
          createdBy: doc.createdBy,
          backupEnabled: doc.backupEnabled,
          location: doc.location,
          subscriptionTier: doc.subscriptionTier,
          subscriptionStatus: doc.subscriptionStatus,
          subscriptionId: doc.subscriptionId,
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
      createdAt: doc.createdAt?.toDate?.() || new Date(doc.createdAt),
      updatedAt: doc.updatedAt?.toDate?.() || new Date(doc.updatedAt),
      createdBy: doc.createdBy,
      backupEnabled: doc.backupEnabled,
      location: doc.location,
      subscriptionTier: doc.subscriptionTier,
      subscriptionStatus: doc.subscriptionStatus,
      subscriptionId: doc.subscriptionId,
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
