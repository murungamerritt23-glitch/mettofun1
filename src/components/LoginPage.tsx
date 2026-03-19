'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, Lock, Eye, EyeOff, Loader2, FileText, CheckCircle, AlertCircle, UserPlus, LogIn } from 'lucide-react';
import { useAuthStore, useUIStore, useShopStore, useGameStore } from '@/store';
import { firebaseAuth, rtdbShops, rtdbAdmins } from '@/lib/firebase';
import { getDeviceId } from '@/lib/device';
import { localAdmins, localShops } from '@/lib/local-db';
import type { AdminLevel, Admin } from '@/types';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignupMode, setIsSignupMode] = useState(true);
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Check admin status on mount
  const [existingAdmin, setExistingAdmin] = useState<Admin | null>(null);
  const [isFirstAdmin, setIsFirstAdmin] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkAdminStatus = async () => {
      const admins = await localAdmins.getAll();
      if (admins.length > 0) {
        setExistingAdmin(admins[0]);
        setIsFirstAdmin(false);
        setIsSignupMode(false); // Show login if admin exists
      } else {
        setIsFirstAdmin(true);
        setIsSignupMode(true); // Show signup for first admin
      }
    };
    checkAdminStatus();
  }, []);
  
  const { setAdmin, setLoading } = useAuthStore();
  const { setCurrentView } = useUIStore();
  const { setCurrentShop } = useShopStore();
  const { clearTestData } = useGameStore();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!signupName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!termsAccepted) {
      setError('Please accept the Terms & Conditions');
      return;
    }

    setIsLoading(true);

    try {
      // Create Firebase auth user
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

      // First admin becomes super_admin automatically
      const adminLevel: AdminLevel = isFirstAdmin ? 'super_admin' : 'shop_admin';

      // Create admin record in Firebase
      const adminData: Admin = {
        id: uid,
        email: email.toLowerCase(),
        phone: signupPhone || '',
        name: signupName,
        level: adminLevel,
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

      setSuccessMessage(isFirstAdmin ? 'Welcome! You are now the Super Admin.' : 'Account created successfully!');
      
      setTimeout(() => {
        if (adminLevel === 'shop_admin') {
          setCurrentView('customer');
        } else {
          setCurrentView('admin');
        }
      }, 1500);

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

    setIsLoading(true);

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
      const firebaseAdmin = await rtdbAdmins.get(uid);

      if (!firebaseAdmin) {
        await firebaseAuth.signOut();
        setError('Admin record not found. Contact super admin.');
        setIsLoading(false);
        return;
      }

      if (firebaseAdmin.isActive === false) {
        await firebaseAuth.signOut();
        setError('Account has been deactivated.');
        setIsLoading(false);
        return;
      }

      const admin: Admin = {
        id: uid,
        email: firebaseAdmin.email || email,
        phone: firebaseAdmin.phone || '',
        name: firebaseAdmin.name || email.split('@')[0],
        level: firebaseAdmin.level,
        createdAt: firebaseAdmin.createdAt || new Date(),
        lastLogin: new Date(),
        isActive: firebaseAdmin.isActive ?? true,
        region: firebaseAdmin.region || 'Default Region',
        assignedShops: firebaseAdmin.assignedShops || [],
        deviceId: firebaseAdmin.deviceId,
        deviceLocked: firebaseAdmin.deviceLocked ?? false
      };

      await localAdmins.save(admin);
      setAdmin(admin);

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
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  // If loading admin status
  if (isFirstAdmin === null) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1628] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/metofun-logo.png" alt="ETO FUN" className="w-40 h-auto mx-auto" />
        </div>

        {successMessage ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="card-gold text-center"
          >
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Success!</h2>
            <p className="text-gray-300">{successMessage}</p>
          </motion.div>
        ) : (
          <>
            {/* Mode Toggle */}
            <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setIsSignupMode(true)}
                className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-all ${
                  isSignupMode ? 'bg-gold-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <UserPlus size={18} />
                Sign Up
              </button>
              <button
                onClick={() => setIsSignupMode(false)}
                className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-all ${
                  !isSignupMode ? 'bg-gold-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <LogIn size={18} />
                Login
              </button>
            </div>

            {/* First Admin Notice */}
            {isFirstAdmin && isSignupMode && (
              <div className="mb-4 p-3 bg-green-900/30 border border-green-500 rounded-lg text-center">
                <p className="text-green-400 text-sm">You are creating the first admin account. You will become Super Admin.</p>
              </div>
            )}

            <div className="card-gold">
              <h2 className="gold-gradient-text text-2xl font-bold text-center mb-6">
                {isSignupMode ? 'Create Account' : 'Admin Login'}
              </h2>

              <form onSubmit={isSignupMode ? handleSignup : handleLogin} className="space-y-4">
                {isSignupMode && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        className="input"
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        className="input"
                        placeholder="+254..."
                      />
                    </div>
                  </>
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
                      placeholder="admin@shop.com"
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
                      value={isSignupMode ? signupPassword : password}
                      onChange={(e) => isSignupMode ? setSignupPassword(e.target.value) : setPassword(e.target.value)}
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
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      className="input"
                      placeholder="Confirm password"
                      required
                    />
                  </div>
                )}

                {isSignupMode && (
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-1"
                    />
                    <label htmlFor="terms" className="text-sm text-gray-400">
                      I accept the Terms & Conditions
                    </label>
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
                      {isSignupMode ? 'Sign Up' : 'Login'}
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-6 text-center text-gray-500 text-sm">
              <p>&copy; 2024 ETO FUN. All rights reserved.</p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
