'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, LogIn, UserPlus } from 'lucide-react';
import { useAuthStore, useUIStore, useShopStore } from '@/store';
import { firebaseAuth, rtdbAdmins } from '@/lib/firebase';
import { getDeviceId } from '@/lib/device';
import { localAdmins, localShops } from '@/lib/local-db';
import type { Admin, AdminLevel } from '@/types';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignupMode, setIsSignupMode] = useState(false); // Default to LOGIN
  const [signupName, setSignupName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const { setAdmin } = useAuthStore();
  const { setCurrentView } = useUIStore();
  const { setCurrentShop } = useShopStore();

  // Default to login mode - signup is for first time only
  useEffect(() => {
    // Just check localStorage directly - don't wait for async
    const hasAdmin = localStorage.getItem('metofun-auth');
    if (!hasAdmin) {
      setIsSignupMode(true); // First time user
    }
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

      const adminData: Admin = {
        id: uid,
        email: email.toLowerCase(),
        phone: '',
        name: signupName,
        level: 'super_admin' as AdminLevel,
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
      setCurrentView('admin');

    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login started', { email });
    setError('');

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      setError('Login timed out. Please try again.');
    }, 15000);

    try {
      console.log('Calling Firebase signIn...');
      const result = await firebaseAuth.signIn(email, password);
      console.log('Firebase result:', result);
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
      
      // Check local first (fast)
      let existingAdmin: Admin | null = null;
      try {
        const localAdminsList = await localAdmins.getAll();
        existingAdmin = localAdminsList.find(a => a.id === uid) || null;
      } catch (err) {
        console.log('Local admin lookup failed');
      }

      // Try RTDB lookup in background
      let firebaseAdmin: Admin | null = null;
      if (!existingAdmin) {
        try {
          firebaseAdmin = await rtdbAdmins.get(uid);
        } catch (err) {
          console.log('RTDB lookup skipped');
        }
      }

      // If no admin record found but Firebase Auth succeeded, create one
      let adminToUse = existingAdmin || firebaseAdmin;
      if (!adminToUse) {
        console.log('No admin record found, creating from auth user');
        adminToUse = {
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
        // Try to save to RTDB in background
        try {
          await rtdbAdmins.save(adminToUse);
        } catch (err) {
          console.log('RTDB save failed, continuing with local only');
        }
      }

      const adminData = adminToUse;
      const admin: Admin = {
        id: uid,
        email: adminData!.email || email,
        phone: adminData!.phone || '',
        name: adminData!.name || email.split('@')[0],
        level: adminData!.level,
        createdAt: adminData!.createdAt || new Date(),
        lastLogin: new Date(),
        isActive: adminData!.isActive ?? true,
        region: adminData!.region || 'Default Region',
        assignedShops: adminData!.assignedShops || [],
        deviceId: adminData!.deviceId,
        deviceLocked: adminData!.deviceLocked ?? false
      };

      // Save to local (skip RTDB if failing)
      try {
        await localAdmins.save(admin);
      } catch (err) {
        console.error('Local save error:', err);
      }
      
      setAdmin(admin);
      localStorage.setItem('metofun-auth', JSON.stringify(admin));

      if (admin.level === 'shop_admin') {
        const deviceId = getDeviceId();
        let shop = await localShops.getByDeviceId(deviceId);
        if (!shop) {
          const shops = await localShops.getAll();
          shop = shops.find(s => s.adminEmail?.toLowerCase() === email.toLowerCase());
        }
        if (shop) {
          setCurrentShop(shop);
          setCurrentView('customer');
        } else {
          setError('No shop assigned to this device. Contact super admin.');
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
