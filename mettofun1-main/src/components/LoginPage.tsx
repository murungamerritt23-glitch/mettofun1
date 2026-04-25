'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, LogIn, AlertCircle } from 'lucide-react';
import { useAuthStore, useUIStore, useShopStore } from '@/store';
import { firebaseAuth, rtdbAdmins } from '@/lib/firebase';
import { getDeviceId } from '@/lib/device';
import { localAdmins, localShops } from '@/lib/local-db';
import type { Admin, Shop } from '@/types';

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

  // Safety timeout - reset loading after 30 seconds to prevent infinite hang
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false);
        setError('Login request timed out. Please try again.');
        // Don't clear auth here - let the app handle auth restoration
      }, 30000);
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
     try {
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
               try {
                 const shops = await localShops.getAll();
                 let shop = shops.find(s => s.adminEmail?.toLowerCase() === email.toLowerCase());
                 if (!shop && cachedAdmin.assignedShops?.length) {
                   shop = shops.find(s => cachedAdmin.assignedShops!.includes(s.id));
                 }
                  if (shop) {
                    setCurrentShop(shop);
                    setCurrentView('customer');
                  } else {
                    // No shop found - clear invalid session and show error
                    localStorage.removeItem('metofun-auth');
                    localStorage.removeItem('metofun-auth-pw');
                    setError('No shop assigned to this admin. Please contact your administrator.');
                    setIsLoading(false);
                    return;
                  }
               } catch (error) {
                 console.error('Failed to load shops during offline login:', error);
                 localStorage.removeItem('metofun-auth');
                 localStorage.removeItem('metofun-auth-pw');
                 setError('Failed to load shop data. Please try online login.');
                 return;
        }
      } else {
               setCurrentView('admin');
             }
             return;
           }
         }
       }
     } catch (error) {
       console.error('Error parsing cached auth data:', error);
       localStorage.removeItem('metofun-auth');
       localStorage.removeItem('metofun-auth-pw');
       // Continue to online login
     }

    setIsLoading(true);

     // Always try Firebase Auth sign in first
     let result;
     try {
       result = await firebaseAuth.signIn(email, password);
     } catch (authError) {
       console.error('Firebase Auth sign in failed:', authError);
       setError('Authentication service unavailable. Please check your connection and try again.');
       setIsLoading(false);
       return;
     }
     
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
             // Firebase offline - treat as first time if no local admins either
             isFirstTime = localAdminsList.length === 0;
           }
         }
       } catch (e) {
         // DB error - check RTDB directly
         try {
           const rtdbAdminsList = await rtdbAdmins.getAll();
           if (rtdbAdminsList.length === 0) {
             isFirstTime = true;
           }
         } catch (rtdbError) {
           console.error('Failed to check admin existence:', rtdbError);
           // Assume not first time to prevent accidental account creation
           isFirstTime = false;
         }
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
              deviceId: getDeviceId(), // getDeviceId is synchronous
             deviceLocked: false
           };
           
           try {
             await rtdbAdmins.save(adminData);
             await localAdmins.save(adminData);
             setAdmin(adminData);
             localStorage.setItem('metofun-auth', JSON.stringify(adminData));
             const pwHash = await hashPassword(password);
             localStorage.setItem('metofun-auth-pw', pwHash);
             setCurrentView('admin');
             setIsLoading(false);
             return;
           } catch (dbError) {
             console.error('Failed to save admin data:', dbError);
             setError('Failed to save account data. Please try again.');
             setIsLoading(false);
             return;
           }
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

     // Check local first - with timeout protection
     let localAdminsList: Admin[] = [];
     try {
       localAdminsList = await localAdmins.getAll();
     } catch (err) {
       console.error('Failed to load local admins:', err);
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
       try {
         await localAdmins.save(adminToUse);
       } catch (saveError) {
         console.error('Failed to update local admin:', saveError);
         setError('Failed to save account data. Please try again.');
         setIsLoading(false);
         return;
       }

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
           try {
             await localAdmins.save(adminToUse);
           } catch (saveError) {
             console.error('Failed to save admin from RTDB:', saveError);
             setError('Failed to save account data. Please try again.');
             setIsLoading(false);
             return;
           }
         } else {
           // Not in RTDB either - but Firebase Auth succeeded
           // This means the account exists in Auth but not in our admin system
           // Create a temporary admin record from Auth info
           try {
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
             
             try {
               await localAdmins.save(adminToUse);
             } catch (saveError) {
               console.error('Failed to save new admin:', saveError);
               setError('Failed to save account data. Please try again.');
               setIsLoading(false);
               return;
             }
           } catch (firebaseError) {
             console.error('Failed to get Firebase user data:', firebaseError);
             setError('Failed to retrieve account information. Please try again.');
             setIsLoading(false);
             return;
           }
         }
       } catch (rtdbErr) {
         // RTDB fetch failed - create admin from Auth info as fallback
         try {
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
           
           try {
             await localAdmins.save(adminToUse);
           } catch (saveError) {
             console.error('Failed to save admin from Firebase fallback:', saveError);
             setError('Failed to save account data. Please try again.');
             setIsLoading(false);
             return;
           }
         } catch (firebaseError) {
           console.error('Failed to get Firebase user data in fallback:', firebaseError);
           setError('Failed to retrieve account information. Please try again.');
           setIsLoading(false);
           return;
         }
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
        const deviceId = getDeviceId(); // getDeviceId is synchronous
       
       const assignedShopIds = adminToUse!.assignedShops || [];
       let shop: Shop | undefined = undefined;
       
        // Priority 1: Match by adminEmail (most reliable - each email links to exactly one shop)
       let localShopsList: Shop[] = [];
       try {
         // Read local shops without any race or timeout to avoid hangs/crashes
         localShopsList = await localShops.getAll();
       } catch (e) {
         console.error('Local shops read failed:', e);
         setError('Failed to load shops. Please try again.');
         setIsLoading(false);
         return;
       }
 
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
 
       // Priority 4: Fetch from RTDB if still not found (background fallback)
       if (!shop) {
         try {
           const { rtdbShops: rtdbShopApi } = await import('@/lib/firebase');
           const fbShops = await rtdbShopApi.getAll();
           if (fbShops && fbShops.length > 0) {
             // Save to local for offline access and future fast lookups (upsert by timestamp)
             for (const s of fbShops) {
               try {
                 const local = await localShops.get(s.id);
                 if (!local || new Date(s.updatedAt || 0) > new Date(local.updatedAt || 0)) {
                   await localShops.save(s);
                 }
               } catch (saveError) {
                 console.warn('Failed to save shop to local DB:', saveError);
                 // Continue with other shops
               }
             }
             // Find shop by admin email first
             shop = fbShops.find(s => s.adminEmail?.toLowerCase() === email.toLowerCase());
             // Then by assigned shops
             if (!shop && assignedShopIds.length > 0) {
               shop = fbShops.find(s => assignedShopIds.includes(s.id));
              }
            }
          } catch (rtdbErr) {
            console.warn('RTDB shop fetch failed:', rtdbErr);
            // Do not block login; if still no shop, show assign error below
          }
      }

      // Handle device lock and shop setup for shop_admin
      if (adminToUse!.level === 'shop_admin') {
       if (shop) {
         try {
           if (shop.deviceLocked && shop.deviceId !== deviceId) {
             // Shop is device-locked to a different device - update to this device
             const updatedShop = { ...shop, deviceId: deviceId };
             await localShops.save(updatedShop);
             try {
               const { rtdbShops: rtdbShopApi } = await import('@/lib/firebase');
               await rtdbShopApi.save(updatedShop);
             } catch (saveError) {
               console.warn('Failed to save updated shop to RTDB:', saveError);
               // Continue with local save only
             }
             shop = updatedShop;
           } else if (!shop.deviceLocked) {
             // Not locked, lock to this device
             const updatedShop = { ...shop, deviceId: deviceId, deviceLocked: true };
             await localShops.save(updatedShop);
             try {
               const { rtdbShops: rtdbShopApi } = await import('@/lib/firebase');
               await rtdbShopApi.save(updatedShop);
             } catch (saveError) {
               console.warn('Failed to save locked shop to RTDB:', saveError);
               // Continue with local save only
             }
             shop = updatedShop;
           }
         } catch (lockError) {
           console.error('Failed to handle device lock:', lockError);
           // Continue with existing shop data
         }
       }
       
              if (shop) {
                console.log('[LoginPage] Shop found, setting customer view:', shop.id);
                setCurrentShop(shop);
                setCurrentView('customer');
              } else {
                console.log('[LoginPage] No shop found for shop_admin, showing error');
                setError('No shop assigned to this admin. Contact super admin.');
                setIsLoading(false);
                return;
              }
      }
    }

    // For super_admin/agent_admin, set admin view
    if (adminToUse!.level !== 'shop_admin') {
      setCurrentView('admin');
    }

    // View setting is handled above - all admin types have views set

    // Shop assignment and view setting is handled above - login complete

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
