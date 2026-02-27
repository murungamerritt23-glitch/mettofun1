'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, Lock, Eye, EyeOff, ShoppingCart, Loader2 } from 'lucide-react';
import { useAuthStore, useUIStore, useShopStore } from '@/store';
import { firebaseAuth } from '@/lib/firebase';
import { getDeviceId } from '@/lib/device';
import { localAdmins, localShops } from '@/lib/local-db';
import type { AdminLevel, Admin } from '@/types';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<AdminLevel>('admin');
  
  const { setAdmin, setLoading, setError: setAuthError } = useAuthStore();
  const { setCurrentView } = useUIStore();
  const { currentShop, setCurrentShop } = useShopStore();

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
        // For demo/offline mode, use local authentication
        if (email && password) {
          // Check if admin exists in local DB with device settings
          const storedAdmin = await fetchAdminSettings(email);
          
          // Demo login - in production this would validate against Firebase
          const demoAdmin = {
            id: storedAdmin?.id || 'demo-admin',
            email,
            phone: storedAdmin?.phone || '',
            name: storedAdmin?.name || email.split('@')[0],
            level: storedAdmin?.level || selectedRole,
            createdAt: storedAdmin?.createdAt || new Date(),
            lastLogin: new Date(),
            isActive: storedAdmin?.isActive ?? true,
            region: storedAdmin?.region || 'Demo Region',
            assignedShops: storedAdmin?.assignedShops,
            deviceId: storedAdmin?.deviceId,
            deviceLocked: storedAdmin?.deviceLocked ?? false
          };
          
          // Check device authorization
          const deviceError = checkDeviceAuthorization(demoAdmin);
          if (deviceError) {
            setError(deviceError);
            setIsLoading(false);
            setLoading(false);
            return;
          }
          
          setAdmin(demoAdmin);
          
          // Auto-select shop for shop admins if they have assigned shops
          if (demoAdmin.level === 'shop_admin' && demoAdmin.assignedShops && demoAdmin.assignedShops.length > 0) {
            const shop = await localShops.get(demoAdmin.assignedShops[0]);
            if (shop) {
              setCurrentShop(shop);
            }
          }
          
          setCurrentView('admin');
        } else {
          setError(result.error);
        }
      } else if (result.user) {
        // Create admin record from Firebase user
        const storedAdmin = await fetchAdminSettings(email);
        const admin = {
          id: result.user.uid,
          email: result.user.email || '',
          phone: result.user.phoneNumber || '',
          name: result.user.displayName || email.split('@')[0],
          level: storedAdmin?.level || selectedRole, // Would be fetched from Firestore
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
        
        // Auto-select shop for shop admins if they have assigned shops
        if (admin.level === 'shop_admin' && admin.assignedShops && admin.assignedShops.length > 0) {
          const shop = await localShops.get(admin.assignedShops[0]);
          if (shop) {
            setCurrentShop(shop);
          }
        }
        
        setCurrentView('admin');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  const handleDemoLogin = (role: AdminLevel = 'admin') => {
    // Quick demo login for testing
    const demoAdmin = {
      id: 'demo-admin',
      email: 'demo@metofun.com',
      phone: '+255123456789',
      name: 'Demo Admin',
      level: role,
      createdAt: new Date(),
      lastLogin: new Date(),
      isActive: true,
      region: 'Demo Region',
      deviceLocked: false
    };
    
    // Check device authorization for demo login
    const deviceError = checkDeviceAuthorization(demoAdmin);
    if (deviceError) {
      setError(deviceError);
      return;
    }
    
    setAdmin(demoAdmin);
    setCurrentView('admin');
  };

  const handleCustomerMode = () => {
    // Go directly to customer mode
    // If no shop is selected, we'll use the first available shop or show a message
    const shops = useShopStore.getState().shops;
    const currentShop = useShopStore.getState().currentShop;
    
    if (!currentShop && shops.length > 0) {
      // Auto-select first shop
      setCurrentShop(shops[0]);
    } else if (!currentShop) {
      setError('No shop configured. Please contact the shop admin.');
      return;
    }
    
    setCurrentView('customer');
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
            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              boxShadow: '0 0 30px rgba(245,158,11,0.4)'
            }}
          >
            <ShoppingCart size={40} className="text-black" />
          </motion.div>
          <h1 className="gold-gradient-text text-4xl font-bold">MetoFun</h1>
          <p className="text-gray-400 mt-2">Admin Login</p>
        </div>

        {/* Login Form */}
        <div className="card-gold">
          <form onSubmit={handleLogin} className="space-y-4">
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
            {/* Role selector for testing */}
            <div className="mb-4">
              <label className="text-gray-400 text-xs mb-2 block">Select Role (Demo):</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRole('admin')}
                  className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-colors ${
                    selectedRole === 'admin'
                      ? 'bg-gold-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('shop_admin')}
                  className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-colors ${
                    selectedRole === 'shop_admin'
                      ? 'bg-gold-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Shop Admin
                </button>
              </div>
            </div>
            <button
              onClick={() => handleDemoLogin(selectedRole)}
              className="btn-gold-outline w-full mb-3"
            >
              Demo Login ({selectedRole.replace('_', ' ')})
            </button>
            <button
              onClick={handleCustomerMode}
              className="text-gray-400 text-sm hover:text-gold-400 w-full text-center"
            >
              Continue as Customer →
            </button>
          </div>
        </div>

        {/* Offline indicator */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-2 h-2 rounded-full status-online" />
            Online Mode
          </div>
        </div>
      </motion.div>
    </div>
  );
}
