'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, LogIn, UserPlus } from 'lucide-react';
import { useAuthStore, useUIStore, useShopStore } from '@/store';
import { firebaseAuth, rtdbAdmins } from '@/lib/firebase';
import { getDeviceId } from '@/lib/device';
import { localAdmins, localShops } from '@/lib/local-db';
import type { Admin, AdminLevel } from '@/types';

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
  const [isSignupMode, setIsSignupMode] = useState(false); // Default to LOGIN
  const [signupName, setSignupName] = useState('');
  const [signupLevel, setSignupLevel] = useState<AdminLevel>('shop_admin');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const { setAdmin } = useAuthStore();
  const { setCurrentView } = useUIStore();
  const { setCurrentShop } = useShopStore();

  // Check if any admin exists - check both local and Firebase
  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        // Check local first
        const localAdminsList = await localAdmins.getAll();
        if (localAdminsList.length > 0) {
          return; // Admin exists locally, stay in login mode
        }
        // Also check Firebase RTDB
        try {
          const rtdbAdminsList = await rtdbAdmins.getAll();
          if (rtdbAdminsList.length > 0) {
            return; // Admin exists in Firebase, stay in login mode
          }
        } catch (e) {
          // Firebase might be offline, continue
        }
        // No admin found - enable signup mode
        setIsSignupMode(true);
      } catch (err) {
        // If error, stay in login mode
      }
    };
    checkFirstTime();
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!signupName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const result = await firebaseAuth.signUp(email, password);
      
      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      if (!result.user) {
        setError('Signup failed. Please try again.');
        setIsLoading(false);
        return;
      }

      const uid = result.user.uid;

      // Check if any admin exists - signup only allowed when NO admin exists
      const existingAdmins = await localAdmins.getAll();
      
      // Also check Firebase
      let rtdbAdminsList: Admin[] = [];
      try {
        rtdbAdminsList = await rtdbAdmins.getAll();
      } catch (e) {
        // Firebase might be offline, continue
      }
      
      if (existingAdmins.length > 0 || rtdbAdminsList.length > 0) {
        // Admins already exist - deny signup, force login
        await firebaseAuth.signOut();
        setError('Admin already exists. Please Login.');
        setIsLoading(false);
        return;
      }

      // First signup - create Super Admin
      const adminData: Admin = {
        id: uid,
        email: email.toLowerCase(),
        phone: '',
        name: signupName,
        level: 'super_admin', // First signup is always Super Admin
        createdAt: new Date(),
        lastLogin: new Date(),
        isActive: true,
        region: 'Default Region',
        assignedShops: [],
        deviceId: getDeviceId(),
        deviceLocked: false
      };

      const rtdbResult = await rtdbAdmins.save(adminData);
      if (!rtdbResult.success) {
        console.error('RTDB save error:', rtdbResult.error);
        await firebaseAuth.signOut();
        setError('Failed to create admin record. Please try again.');
        setIsLoading(false);
        return;
      }

      await localAdmins.save(adminData);
      setAdmin(adminData);
      localStorage.setItem('metofun-auth', JSON.stringify(adminData));
      // Store password hash for offline login verification
      const pwHash = await hashPassword(password);
      localStorage.setItem('metofun-auth-pw', pwHash);
      setCurrentView('admin');

    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

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
      // Verify email and password hash
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

    // Online login with Firebase Auth
    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      setError('Login timed out. Please try again.');
    }, 15000);

    try {
      const result = await firebaseAuth.signIn(email, password);
      clearTimeout(timeoutId);
      
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
      
      // Check local first - prioritize email match to keep original level
      let localAdminsList: Admin[] = [];
      try {
        localAdminsList = await localAdmins.getAll();
      } catch (err) {
        setError('Database error. Please try again.');
        setIsLoading(false);
        return;
      }
      
      // Find by email first (to preserve level from staff creation)
      let adminFromLocal: Admin | undefined = localAdminsList.find(a => a.email?.toLowerCase() === userEmail);
      
      // Also try by UID
      if (!adminFromLocal) {
        adminFromLocal = localAdminsList.find(a => a.id === uid);
      }

      let adminToUse: Admin;
      
      if (adminFromLocal) {
        // Update the ID to match Firebase UID and update lastLogin
        adminToUse = {
          ...adminFromLocal,
          id: uid, // Ensure ID matches Firebase UID
          lastLogin: new Date()
        };
        await localAdmins.save(adminToUse);
      } else {
        // DENY access if no admin record - require super_admin to create staff first
        await firebaseAuth.signOut();
        setError('Access denied. Please contact admin to create your account.');
        setIsLoading(false);
        return;
      }

      // Check if admin is active
      if (adminToUse.isActive === false) {
        await firebaseAuth.signOut();
        setError('Account has been deactivated.');
        setIsLoading(false);
        return;
      }

      // Check valid role
      if (!['super_admin', 'agent_admin', 'shop_admin'].includes(adminToUse.level)) {
        await firebaseAuth.signOut();
        setError('Access denied. Invalid admin role.');
        setIsLoading(false);
        return;
      }

      setAdmin(adminToUse);
      localStorage.setItem('metofun-auth', JSON.stringify(adminToUse));
      // Store password hash for offline login verification
      const pwHash = await hashPassword(password);
      localStorage.setItem('metofun-auth-pw', pwHash);

      // Role-based navigation
      if (adminToUse.level === 'shop_admin') {
        // Load shop data for shop admin - check multiple sources
        const deviceId = getDeviceId();
        let shop = await localShops.getByDeviceId(deviceId);
        
        // Try by admin email
        if (!shop) {
          const shops = await localShops.getAll();
          shop = shops.find(s => s.adminEmail?.toLowerCase() === email.toLowerCase());
        }
        
        // Try by assigned shops
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
      console.error('Login error:', err);
      clearTimeout(timeoutId);
      setError(err.message || 'Login failed');
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1628] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <img src="/metofun-logo.png" alt="ETO FUN" className="w-40 h-auto mx-auto" />
        </div>

        {isSignupMode && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500 rounded-lg text-center">
            <p className="text-green-400 text-sm">First time? Create your Super Admin account</p>
          </div>
        )}

        <div className="card-gold">
          <h2 className="gold-gradient-text text-2xl font-bold text-center mb-2">
            {isSignupMode ? 'Create Account' : 'Admin Login'}
          </h2>
          <p className="text-gray-400 text-center mb-6">
            {isSignupMode ? 'Set up your admin account' : 'Enter your credentials to access'}
          </p>

          <form onSubmit={isSignupMode ? handleSignup : handleLogin} className="space-y-4">
            {isSignupMode && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="input"
                  placeholder="Your full name"
                  required
                />
              </div>
            )}

            {isSignupMode && (
              <div className="p-3 bg-amber-900/30 border border-amber-500 rounded-lg">
                <p className="text-amber-400 text-sm font-medium">
                  You are the first admin - your account will be Super Admin
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="admin@metofun.com"
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

            {isSignupMode && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="Confirm password"
                  required
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-500 rounded-lg">
                <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-gold w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {isSignupMode ? 'Creating Account...' : 'Logging in...'}
                </>
              ) : (
                <>
                  {isSignupMode ? <UserPlus size={20} /> : <LogIn size={20} />}
                  {isSignupMode ? 'Create Account' : 'Login'}
                </>
              )}
            </button>
          </form>

          {!isSignupMode && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsSignupMode(true)}
                className="text-gold-400 hover:text-gold-300 text-sm"
              >
                First time? Sign Up
              </button>
            </div>
          )}

          {isSignupMode && (
            <div className="mt-4 text-center">
              <button
                onClick={() => { setIsSignupMode(false); setError(''); }}
                className="text-gray-400 hover:text-gray-300 text-sm"
              >
                Already have an account? Login
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>&copy; 2024 ETO FUN. All rights reserved.</p>
        </div>
      </motion.div>
    </div>
  );
}
