'use client';

import { useState } from 'react';
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
        const inputHash = await hashPassword(password);
        if (inputHash === cachedPwHash) {
          setAdmin(cachedAdmin);
          if (cachedAdmin.level === 'shop_admin') {
            setCurrentView('customer');
          } else {
            setCurrentView('admin');
          }
          return;
        }
      }
    }

    setIsLoading(true);

    // Check if this is first time (no admin exists)
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
          // Firebase offline, assume first time
          isFirstTime = true;
        }
      }
    } catch (e) {
      // DB error, proceed with normal login
    }

    // First time login - create Super Admin automatically
    if (isFirstTime) {
      try {
        // Try to sign up
        const signUpResult = await firebaseAuth.signUp(email, password);
        
        if (signUpResult.error) {
          // If email already exists, try to sign in
          const signInResult = await firebaseAuth.signIn(email, password);
          if (signInResult.error) {
            setError('Failed to create account. Please try again.');
            setIsLoading(false);
            return;
          }
          // Signed in successfully with existing account
          const uid = signInResult.user!.uid;
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
        }

        // Account created successfully
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

    // Normal login with Firebase Auth
    try {
      const result = await firebaseAuth.signIn(email, password);
      
      if (result.error) {
        setError('Invalid email or password');
        setIsLoading(false);
        return;
      }

      if (!result.user) {
        setError('Login failed. Please try again.');
        setIsLoading(false);
        return;
      }

      const uid = result.user.uid;
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
            await firebaseAuth.signOut();
            setError('Access denied. Please contact admin to create your account.');
            setIsLoading(false);
            return;
          }
        } catch (rtdbErr) {
          await firebaseAuth.signOut();
          setError('Access denied. Please contact admin to create your account.');
          setIsLoading(false);
          return;
        }
      }

      if (adminToUse.isActive === false) {
        await firebaseAuth.signOut();
        setError('Account has been deactivated.');
        setIsLoading(false);
        return;
      }

      if (!['super_admin', 'agent_admin', 'shop_admin'].includes(adminToUse.level)) {
        await firebaseAuth.signOut();
        setError('Access denied. Invalid admin role.');
        setIsLoading(false);
        return;
      }

      setAdmin(adminToUse);
      localStorage.setItem('metofun-auth', JSON.stringify(adminToUse));
      const pwHash = await hashPassword(password);
      localStorage.setItem('metofun-auth-pw', pwHash);

      // Role-based navigation
      if (adminToUse.level === 'shop_admin') {
        const deviceId = getDeviceId();
        let shop = await localShops.getByDeviceId(deviceId);
        
        if (!shop) {
          const shops = await localShops.getAll();
          shop = shops.find(s => s.adminEmail?.toLowerCase() === email.toLowerCase());
        }
        
        const assignedShopIds = adminToUse.assignedShops || [];
        if (!shop && assignedShopIds.length > 0) {
          const shops = await localShops.getAll();
          shop = shops.find(s => assignedShopIds.includes(s.id));
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

    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
