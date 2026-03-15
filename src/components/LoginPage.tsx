'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, Lock, Eye, EyeOff, Loader2, FileText, CheckCircle } from 'lucide-react';
import { useAuthStore, useUIStore, useShopStore, useGameStore } from '@/store';
import { firebaseAuth, firebaseSettings, firebaseShops } from '@/lib/firebase';
import { getDeviceId } from '@/lib/device';
import { localAdmins, localShops } from '@/lib/local-db';
import type { AdminLevel, Admin } from '@/types';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<AdminLevel>('super_admin');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [termsContent, setTermsContent] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showRealLogin, setShowRealLogin] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [setupRole, setSetupRole] = useState<AdminLevel>('super_admin');
  
  const { setAdmin, setLoading, setError: setAuthError } = useAuthStore();
  const { setCurrentView } = useUIStore();
  const { currentShop, setCurrentShop } = useShopStore();
  const { clearTestData } = useGameStore();

  // Simple demo login - auto-detects admin type

  // Check if device is authorized for admin
  const checkDeviceAuthorization = (admin: { deviceId?: string; deviceLocked?: boolean }): string | null => {
    if (!admin.deviceLocked) return null; // No device locking, allow
    if (!admin.deviceId) return 'This admin account is locked to a device but no device is registered. Contact super admin.';
    
    const currentDeviceId = getDeviceId();
    if (currentDeviceId !== admin.deviceId) {
      return 'Device not authorized. This admin account is locked to a different device.';
    }
    return null;
  };

  // Fetch admin from local DB to get device settings
  const fetchAdminSettings = async (email: string): Promise<Partial<Admin> | null> => {
    try {
      const admins = await localAdmins.getAll();
      const admin = admins.find(a => a.email.toLowerCase() === email.toLowerCase());
      return admin || null;
    } catch {
      return null;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setLoading(true);

    try {
      // Try Firebase login first
      const result = await firebaseAuth.signIn(email, password);
      
      if (result.error) {
        // Firebase login failed - check local DB
        const storedAdmin = await fetchAdminSettings(email);
        
        // Only allow login if admin exists in local database
        if (!storedAdmin) {
          setError('Invalid credentials. Admin not found.');
          setIsLoading(false);
          setLoading(false);
          return;
        }
        
        // Use stored admin data
        const admin: Admin = {
          id: storedAdmin.id || 'unknown',
          email: storedAdmin.email || email,
          phone: storedAdmin.phone || '',
          name: storedAdmin.name || email.split('@')[0],
          level: storedAdmin.level || 'super_admin',
          createdAt: storedAdmin.createdAt || new Date(),
          lastLogin: new Date(),
          isActive: storedAdmin.isActive ?? true,
          region: storedAdmin.region || 'Demo Region',
          assignedShops: storedAdmin.assignedShops,
          deviceId: storedAdmin.deviceId,
          deviceLocked: storedAdmin.deviceLocked ?? false
        };
        
        // Check device authorization
        const deviceError = checkDeviceAuthorization(admin);
        if (deviceError) {
          setError(deviceError);
          setIsLoading(false);
          setLoading(false);
          return;
        }
        
        setAdmin(admin);
        
        // Auto-select shop for shop admins based on device ID and email match
        if (admin.level === 'shop_admin') {
          const currentDeviceId = getDeviceId();
          let shop = await localShops.getByDeviceId(currentDeviceId);
          if (!shop) {
            const allShops = await localShops.getAll();
            shop = allShops.find(s => 
              s.adminEmail?.toLowerCase() === email.toLowerCase()
            );
          }
          if (!shop) {
            try {
              const firebaseShop = await firebaseShops.getByEmail(email);
              shop = firebaseShop || undefined;
              if (shop) {
                await localShops.save(shop);
              }
            } catch (e) {
              console.error('Error fetching shop from Firebase:', e);
            }
          }
          if (shop) {
            if (shop.adminEmail && shop.adminEmail.toLowerCase() !== email.toLowerCase()) {
              setError('This device is not authorized for your account. Please contact support.');
              setIsLoading(false);
              setLoading(false);
              return;
            }
            const updatedAdmin = { ...admin, assignedShops: [shop.id] };
            setAdmin(updatedAdmin);
            setCurrentShop(shop);
          } else {
            setError('No shop assigned to this device or email. Please contact your administrator.');
            setIsLoading(false);
            setLoading(false);
            return;
          }
          setCurrentView('customer');
        } else {
          setCurrentView('admin');
        }
      } else if (result.user) {
        // Firebase login successful
        const storedAdmin = await fetchAdminSettings(email);
        const admin: Admin = {
          id: result.user.uid,
          email: result.user.email || '',
          phone: result.user.phoneNumber || '',
          name: result.user.displayName || email.split('@')[0],
          level: storedAdmin?.level || selectedRole,
          createdAt: storedAdmin?.createdAt || new Date(),
          lastLogin: new Date(),
          isActive: storedAdmin?.isActive ?? true,
          region: storedAdmin?.region,
          assignedShops: storedAdmin?.assignedShops,
          deviceId: storedAdmin?.deviceId,
          deviceLocked: storedAdmin?.deviceLocked ?? false
        };
        
        // Check device authorization
        const deviceError = checkDeviceAuthorization(admin);
        if (deviceError) {
          setError(deviceError);
          setIsLoading(false);
          setLoading(false);
          return;
        }
        
        setAdmin(admin);
        
        // Auto-select shop for shop admins
        if (admin.level === 'shop_admin') {
          const currentDeviceId = getDeviceId();
          let shop = await localShops.getByDeviceId(currentDeviceId);
          if (!shop) {
            const allShops = await localShops.getAll();
            shop = allShops.find(s => 
              s.adminEmail?.toLowerCase() === email.toLowerCase()
            );
          }
          if (!shop) {
            try {
              const firebaseShop = await firebaseShops.getByEmail(email);
              shop = firebaseShop || undefined;
              if (shop) {
                await localShops.save(shop);
              }
            } catch (e) {
              console.error('Error fetching shop from Firebase:', e);
            }
          }
          if (shop) {
            if (shop.adminEmail && shop.adminEmail.toLowerCase() !== email.toLowerCase()) {
              setError('This device is not authorized for your account. Please contact support.');
              setIsLoading(false);
              setLoading(false);
              return;
            }
            const updatedAdmin = { ...admin, assignedShops: [shop.id] };
            setAdmin(updatedAdmin);
            setCurrentShop(shop);
          } else {
            setError('No shop assigned to this device or email. Please contact your administrator.');
            setIsLoading(false);
            setLoading(false);
            return;
          }
          setCurrentView('customer');
        } else {
          setCurrentView('admin');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  const handleDemoLogin = (adminLevel: AdminLevel = 'super_admin') => {
    const levelNames: Record<AdminLevel, string> = {
      super_admin: 'Super Admin',
      agent_admin: 'Agent Admin',
      shop_admin: 'Shop Admin'
    };
    
    const demoAdmin: Admin = {
      id: 'demo-admin',
      email: 'demo@metofun.com',
      phone: '+254123456789',
      name: `Demo ${levelNames[adminLevel]}`,
      level: adminLevel,
      createdAt: new Date(),
      lastLogin: new Date(),
      isActive: true,
      region: 'Demo Region',
      deviceLocked: false
    };
    
    setAdmin(demoAdmin);
    // Shop admin goes directly to customer mode, others go to admin dashboard
    if (adminLevel === 'shop_admin') {
      setCurrentView('customer');
    } else {
      setCurrentView('admin');
    }
  };

  const handleCustomerMode = () => {
    // Go directly to customer mode using device's pre-configured shop
    // One shop = one device - the device determines which shop
    const currentDeviceId = getDeviceId();
    
    localShops.getByDeviceId(currentDeviceId).then(shop => {
      if (shop) {
        setCurrentShop(shop);
        setCurrentView('customer');
      } else {
        // Fallback: try to find any active shop
        localShops.getAll().then(shops => {
          const activeShop = shops.find(s => s.isActive);
          if (activeShop) {
            setCurrentShop(activeShop);
            setCurrentView('customer');
          } else {
            setError('No shop configured for this device. Please contact the shop admin.');
          }
        });
      }
    });
  };

  // Check if Firebase is properly configured (not using demo credentials)
  const isFirebaseConfigured = typeof window !== 'undefined' && 
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && 
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'demo-project';

  const handleSetupShop = () => {
    // Guide user to set up their shop
    alert('To create a real shop:\n\n1. Set up Firebase:\n   - Go to console.firebase.google.com\n   - Create a new project\n   - Enable Firestore & Authentication\n   - Get your config from Project Settings\n\n2. Add Firebase config to .env.local\n\n3. Log in as Super Admin\n\n4. Go to Shops tab to create your shop\n\nSee SETUP.md for detailed instructions.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #f59e0b 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center mb-4"
          >
            <img 
              src="/metofun-logo.png" 
              alt="METOFUN" 
              className="w-24 h-auto"
            />
          </motion.div>
          <h1 className="gold-gradient-text text-4xl font-bold">metofun</h1>
          <p className="text-gray-400 mt-2">Admin Login</p>
        </div>

        {/* Login Form */}
        <div className="card-gold">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Admin Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as AdminLevel)}
                className="input"
              >
                <option value="super_admin">Super Admin</option>
                <option value="agent_admin">Agent Admin</option>
                <option value="shop_admin">Shop Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="Enter your password"
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
                className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded-lg text-sm"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-gold w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-gray-500 text-xs text-center mb-3">Demo Logins</p>
            <button
              onClick={() => handleDemoLogin('super_admin')}
              className="btn-gold w-full mb-2"
            >
              Demo Login (Super Admin)
            </button>
            <button
              onClick={() => handleDemoLogin('agent_admin')}
              className="btn-gold-outline w-full mb-2"
            >
              Demo Login (Agent Admin)
            </button>
            <button
              onClick={() => handleDemoLogin('shop_admin')}
              className="text-gray-400 text-sm hover:text-gold-400 w-full text-center mb-3"
            >
              Demo Login (Shop Admin)
            </button>

            <button
              onClick={() => setShowRealLogin(true)}
              className="mt-4 text-gold-500 text-sm hover:text-gold-400 w-full text-center font-semibold"
            >
              🔑 Use Real Credentials Instead
            </button>

            <button
              onClick={() => setShowSetup(true)}
              className="mt-4 text-blue-400 text-sm hover:text-blue-300 w-full text-center"
            >
              ⚙️ Setup New Admin
            </button>
          </div>
        </div>

        {/* Offline indicator */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-2 h-2 rounded-full status-online" />
            Online Mode
          </div>
          <button
            onClick={() => setShowTerms(true)}
            className="text-gray-500 text-sm hover:text-gold-400 mt-3 flex items-center justify-center gap-1"
          >
            <FileText size={14} />
            Terms & Conditions
          </button>
        </div>
      </motion.div>

      {/* Terms Modal */}
      {showTerms && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => setShowTerms(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="gold-gradient-text text-2xl font-bold mb-4">Terms & Conditions</h2>
            <div className="text-gray-400 text-sm mb-6 space-y-2">
              {termsContent ? (
                <p className="whitespace-pre-wrap">{termsContent}</p>
              ) : (
                <>
                  <p>1. Use of this application is subject to these terms.</p>
                  <p>2. Shop administrators must maintain accurate records.</p>
                  <p>3. Game outcomes are final and cannot be disputed.</p>
                  <p>4. The system is provided as-is without warranties.</p>
                  <p>5. Administrators are responsible for device security.</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="agreeTerms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="w-4 h-4 accent-gold-500"
              />
              <label htmlFor="agreeTerms" className="text-gray-300 text-sm">
                I agree to these terms and conditions
              </label>
            </div>
            <button
              onClick={() => {
                setAgreedToTerms(true);
                setShowTerms(false);
              }}
              disabled={!agreedToTerms}
              className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Accept
            </button>
            <button
              onClick={() => setShowTerms(false)}
              className="w-full text-center text-gray-400 text-sm mt-3 hover:text-white"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* Setup Admin Modal */}
      {showSetup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => setShowSetup(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="gold-gradient-text text-2xl font-bold mb-2 text-center">Setup Admin</h2>
            <p className="text-gray-400 text-sm mb-6 text-center">Create your admin account</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                <input
                  type="text"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  className="input"
                  placeholder="Your name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  className="input"
                  placeholder="admin@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  className="input"
                  placeholder="Password"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={setupConfirmPassword}
                  onChange={(e) => setSetupConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="Confirm password"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Admin Role</label>
                <select
                  value={setupRole}
                  onChange={(e) => setSetupRole(e.target.value as AdminLevel)}
                  className="input"
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="agent_admin">Agent Admin</option>
                  <option value="shop_admin">Shop Admin</option>
                </select>
              </div>
              
              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}
              
              <button
                onClick={async () => {
                  if (!setupName || !setupEmail || !setupPassword) {
                    setError('Please fill all fields');
                    return;
                  }
                  if (setupPassword !== setupConfirmPassword) {
                    setError('Passwords do not match');
                    return;
                  }
                  if (setupPassword.length < 6) {
                    setError('Password must be at least 6 characters');
                    return;
                  }
                  
                  setIsLoading(true);
                  try {
                    const admin: Admin = {
                      id: `admin-${Date.now()}`,
                      email: setupEmail.toLowerCase(),
                      phone: '',
                      name: setupName,
                      level: setupRole,
                      createdAt: new Date(),
                      lastLogin: new Date(),
                      isActive: true,
                      region: 'Default Region',
                      deviceLocked: false
                    };
                    
                    await localAdmins.save(admin);
                    setAdmin(admin);
                    setShowSetup(false);
                    setCurrentView('admin');
                  } catch (err: any) {
                    setError(err.message || 'Failed to create admin');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
                className="btn-gold w-full"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : 'Create Admin'}
              </button>
              
              <button
                onClick={() => setShowSetup(false)}
                className="w-full text-center text-gray-400 text-sm mt-2 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
