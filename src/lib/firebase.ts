import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  Auth,
  User
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
  serverTimestamp
} from 'firebase/firestore';
import type { Shop } from '@/types';

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

if (typeof window !== 'undefined' && !getApps().length) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else if (typeof window !== 'undefined') {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
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
          backupEnabled: doc.backupEnabled
        }));
        callback(shops);
      }
    );
  }
};
