'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, LogIn, AlertCircle } from 'lucide-react';
import { useAuthStore, useUIStore, useShopStore } from '@/store';
import { firebaseAuth, rtdbAdmins } from '@/lib/firebase';
import { getDeviceId } from '@/lib/device';
import { localAdmins, localShops } from '@/lib/local-db';
import type { Admin } from '@/types';

// Simple password hash for offline verification
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { setAdmin } = useAuthStore();
  const { setCurrentView } = useUIStore();
  const { setCurrentShop } = useShopStore();

  // Safety timeout - reset loading after 60 seconds to prevent infinite hang
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false);
        setError('Request timed out. Please try again.');
      }, 60000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    // Check for existing session in localStorage (offline login)
    const cachedAuth = localStorage.getItem('metofun-auth');
    const cachedPwHash = localStorage.getItem('metofun-auth-pw');
    if (cachedAuth && cachedPwHash) {
      const cachedAdmin: Admin = JSON.parse(cachedAuth);
      if (cachedAdmin.email?.toLowerCase() === email.toLowerCase()) {
        // Validate admin level before allowing login
        if (!['super_admin', 'agent_admin', 'shop_admin'].includes(cachedAdmin.level)) {
          setError('Access denied. Invalid admin role.');
          return;
        }
        const inputHash = await hashPassword(password);
        if (inputHash === cachedPwHash) {
          setAdmin(cachedAdmin);
          if (cachedAdmin.level === 'shop_admin') {
            // Set view only after shop is found
            localShops.getAll().then((shops: any[]) => {
              let shop = shops.find(s => s.adminEmail?.toLowerCase() === email.toLowerCase());
              if (!shop && cachedAdmin.assignedShops?.length) {
                shop = shops.find(s => cachedAdmin.assignedShops!.includes(s.id));
              }
              if (shop) {
                setCurrentShop(shop);
                setCurrentView('customer');
              }
            }).catch(() => {});
          } else {
            setCurrentView('admin');
          }
          return;
        }
      }
    }

    setIsLoading(true);

    // Always try Firebase Auth sign in first
    const result = await firebaseAuth.signIn(email, password);
    
    if (result.error) {
      // Sign in failed - check if this is first time (no admin exists anywhere)
      let isFirstTime = false;
      try {
        const localAdminsList = await localAdmins.getAll();
        if (localAdminsList.length === 0) {
          try {
            const rtdbAdminsList = await rtdbAdmins.getAll();
            if (rtdbAdminsList.length === 0) {
              isFirstTime = true;
            }
          } catch (e) {
            // Firebase offline
          }
        }
      } catch (e) {
        // DB error
      }
      
      if (isFirstTime) {
        // No admin exists - create Super Admin
        try {
          const signUpResult = await firebaseAuth.signUp(email, password);
          if (signUpResult.error) {
            setError(signUpResult.error);
            setIsLoading(false);
            return;
          }
          
          const uid = signUpResult.user!.uid;
          const adminData: Admin = {
            id: uid,
            email: email.toLowerCase(),
            phone: '',
            name: email.split('@')[0],
            level: 'super_admin',
            createdAt: new Date(),
            lastLogin: new Date(),
            isActive: true,
            region: 'Default Region',
            assignedShops: [],
            deviceId: getDeviceId(),
            deviceLocked: false
          };
          
          await rtdbAdmins.save(adminData);
          await localAdmins.save(adminData);
          setAdmin(adminData);
          localStorage.setItem('metofun-auth', JSON.stringify(adminData));
          const pwHash = await hashPassword(password);
          localStorage.setItem('metofun-auth-pw', pwHash);
          setCurrentView('admin');
          setIsLoading(false);
          return;
        } catch (err: any) {
          setError(err.message || 'First time setup failed. Please try again.');
          setIsLoading(false);
          return;
        }
      }
      
      // Not first time - show login error
      setError('Invalid email or password');
      setIsLoading(false);
      return;
    }

    if (!result.user) {
      setError('Login failed. Please try again.');
      setIsLoading(false);
      return;
    }

    // Sign in succeeded - continue with login
    const uid = result.user!.uid;
    const userEmail = email.toLowerCase();

    // Check local first
    let localAdminsList: Admin[] = [];
    try {
      localAdminsList = await localAdmins.getAll();
    } catch (err) {
      setError('Database error. Please try again.');
      setIsLoading(false);
      return;
    }
    
    let adminFromLocal: Admin | undefined = localAdminsList.find(a => a.email?.toLowerCase() === userEmail);
    if (!adminFromLocal) {
      adminFromLocal = localAdminsList.find(a => a.id === uid);
    }

    let adminToUse: Admin;
    
    if (adminFromLocal) {
      adminToUse = {
        ...adminFromLocal,
        id: uid,
        lastLogin: new Date()
      };
      await localAdmins.save(adminToUse);
    } else {
      // Try to fetch from Firebase RTDB
      try {
        const rtdbAdminsList = await rtdbAdmins.getAll();
        const adminFromRTDB = rtdbAdminsList.find(a => a.email?.toLowerCase() === userEmail);
        
        if (adminFromRTDB) {
          adminToUse = {
            ...adminFromRTDB,
            id: uid,
            lastLogin: new Date()
          };
          await localAdmins.save(adminToUse);
        } else {
          // Not in RTDB either - but Firebase Auth succeeded
          // This means the account exists in Auth but not in our admin system
          // Create a temporary admin record from Auth info
          const firebaseUser = result.user!;
          adminToUse = {
            id: uid,
            email: userEmail,
            phone: firebaseUser.phoneNumber || '',
            name: firebaseUser.displayName || userEmail.split('@')[0],
            level: 'shop_admin', // Default to shop_admin for new logins
            createdAt: new Date(),
            lastLogin: new Date(),
            isActive: true,
            assignedShops: [],
            deviceLocked: false
          };
          await localAdmins.save(adminToUse);
        }
      } catch (rtdbErr) {
        // RTDB fetch failed - but Auth succeeded, create admin from Auth info
        const firebaseUser = result.user!;
        adminToUse = {
          id: uid,
          email: userEmail,
          phone: firebaseUser.phoneNumber || '',
          name: firebaseUser.displayName || userEmail.split('@')[0],
          level: 'shop_admin',
          createdAt: new Date(),
          lastLogin: new Date(),
          isActive: true,
          assignedShops: [],
          deviceLocked: false
        };
        await localAdmins.save(adminToUse);
      }
    }

    if (adminToUse!.isActive === false) {
      await firebaseAuth.signOut();
      setError('Account has been deactivated.');
      setIsLoading(false);
      return;
    }

    if (!['super_admin', 'agent_admin', 'shop_admin'].includes(adminToUse!.level)) {
      await firebaseAuth.signOut();
      setError('Access denied. Invalid admin role.');
      setIsLoading(false);
      return;
    }

    setAdmin(adminToUse!);
    localStorage.setItem('metofun-auth', JSON.stringify(adminToUse!));
    const pwHash = await hashPassword(password);
    localStorage.setItem('metofun-auth-pw', pwHash);

    // Save admin to RTDB with Firebase Auth UID so security rules pass
    // This is critical: RTDB rules check root.child('admins').child(auth.uid).exists()
    // Without this, ALL RTDB writes fail (attempts, shops, items, deletes)
    let adminInRTDB = false;
    for (let attempt = 0; attempt < 3 && !adminInRTDB; attempt++) {
      const saveResult = await rtdbAdmins.save(adminToUse!);
      if (saveResult.success) {
        // Verify it actually saved by reading it back
        const verify = await rtdbAdmins.get(adminToUse!.id);
        if (verify) {
          adminInRTDB = true;
          console.log('[Auth] Admin synced to RTDB successfully');
        } else {
          console.error(`[Auth] Admin save verification failed on attempt ${attempt + 1}`);
        }
      } else {
        console.error(`[Auth] Admin save attempt ${attempt + 1} failed:`, saveResult.error);
      }
      if (!adminInRTDB && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    if (!adminInRTDB) {
      console.error('[Auth] CRITICAL: Admin could not be saved to RTDB - all writes will fail');
    }

    // Role-based navigation
    if (adminToUse!.level === 'shop_admin') {
      const deviceId = getDeviceId();
      const assignedShopIds = adminToUse!.assignedShops || [];
      let shop: Awaited<ReturnType<typeof localShops.getByDeviceId>> = undefined;
      
      // Priority 1: Match by adminEmail (most reliable - each email links to exactly one shop)
      const localShopsList = await localShops.getAll();
      shop = localShopsList.find(s => s.adminEmail?.toLowerCase() === email.toLowerCase());
      
      // Priority 2: Match by assignedShops (set by super_admin when creating the admin)
      if (!shop && assignedShopIds.length > 0) {
        shop = localShopsList.find(s => assignedShopIds.includes(s.id));
      }

      // Priority 3: Match by deviceId (least reliable - can cause collisions across shops)
      if (!shop) {
        const shopsByDevice = localShopsList.filter(s => s.deviceId === deviceId);
        // Only use deviceId match if exactly one shop matches (no ambiguity)
        if (shopsByDevice.length === 1) {
          shop = shopsByDevice[0];
        }
      }

      // Priority 4: Fetch from RTDB if still not found
      if (!shop) {
        try {
          const { rtdbShops: rtdbShopApi } = await import('@/lib/firebase');
          const fbShops = await rtdbShopApi.getAll();
          if (fbShops && fbShops.length > 0) {
            // Save to local for offline access
            for (const s of fbShops) {
              await localShops.save(s);
            }
            // Find shop by admin email first
            shop = fbShops.find(s => s.adminEmail?.toLowerCase() === email.toLowerCase());
            // Then by assigned shops
            if (!shop && assignedShopIds.length > 0) {
              shop = fbShops.find(s => assignedShopIds.includes(s.id));
            }
          }
        } catch (err) {
          // RTDB fetch failed
        }
      }

      // Handle device lock for shop_admin
      if (shop && shop.deviceLocked && shop.deviceId !== deviceId) {
        // Shop is device-locked to a different device - update to this device
        const updatedShop = { ...shop, deviceId: deviceId };
        await localShops.save(updatedShop);
        try {
          const { rtdbShops: rtdbShopApi } = await import('@/lib/firebase');
          await rtdbShopApi.save(updatedShop);
        } catch (err) {
          // RTDB save failed
        }
        shop = updatedShop;
      } else if (shop && !shop.deviceLocked) {
        // Not locked, lock to this device
        const updatedShop = { ...shop, deviceId: deviceId, deviceLocked: true };
        await localShops.save(updatedShop);
        try {
          const { rtdbShops: rtdbShopApi } = await import('@/lib/firebase');
          await rtdbShopApi.save(updatedShop);
        } catch (err) {
          // RTDB save failed
        }
        shop = updatedShop;
      }
      
      if (shop) {
        setCurrentShop(shop);
        setCurrentView('customer');
      } else {
        setError('No shop assigned to this admin. Contact super admin.');
        setIsLoading(false);
        return;
      }
    } else {
      setCurrentView('admin');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A1628] via-[#0F2744] to-[#0A1628] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <img src="/metofun-logo.png" alt="ETO FUN" className="w-40 h-auto mx-auto" />
        </div>

        <div className="card-gold">
          <h2 className="gold-gradient-text text-2xl font-bold text-center mb-2">
            Admin Login
          </h2>
          <p className="text-gray-400 text-center mb-6">
            Enter your credentials to access
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-500 rounded-lg"
              >
                <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-gold w-full py-3 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  Login
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
