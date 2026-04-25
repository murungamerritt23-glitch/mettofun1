'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useUIStore, useShopStore, useAuthStore } from '@/store';
import { localShops, localAdmins } from '@/lib/local-db';
import { rtdbAdmins } from '@/lib/firebase';
import { getDeviceId } from '@/lib/device';
import type { Admin } from '@/types';

const LoginPage = dynamic(() => import('@/components/LoginPage'), { ssr: false });
const AdminDashboard = dynamic(() => import('@/components/AdminDashboard'), { ssr: false });
const GameMode = dynamic(() => import('@/components/GameMode'), { ssr: false });

export default function Home() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const { currentView, setCurrentView } = useUIStore();
  const { setShops, setCurrentShop, setShops: setLocalShops } = useShopStore();
  const { setAdmin, admin } = useAuthStore();

  // Timeout to prevent infinite hang during auth restore
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isHandled = false;
    let isAuthCompleted = false;

    const handleAuthTimeout = () => {
      if (isHandled || isAuthCompleted) return;
      isHandled = true;
      console.error('Auth restore timed out - clearing auth to prevent loop');
      localStorage.removeItem('metofun-auth');
      localStorage.removeItem('metofun-auth-pw');
      localStorage.removeItem('metofun-load-timeout');
      setCurrentShop(null);
      setCurrentView('login');
      setReady(true);
      setLoading(false);
    };

    // Check for previous load timeout - prevent loop by clearing auth
    const loadTimeout = localStorage.getItem('metofun-load-timeout');
    if (loadTimeout) {
      const timeoutAge = Date.now() - parseInt(loadTimeout, 10);
      // If timeout was within last 5 minutes, clear auth to prevent loop
      if (timeoutAge < 5 * 60 * 1000) {
        console.log('Previous load timeout detected, clearing auth');
        localStorage.removeItem('metofun-auth');
        localStorage.removeItem('metofun-auth-pw');
        localStorage.removeItem('metofun-load-timeout');
        setCurrentShop(null);
        setCurrentView('login');
        setReady(true);
        setLoading(false);
        return;
      } else {
        // Timeout is old, clear the flag
        localStorage.removeItem('metofun-load-timeout');
      }
    }

    timeoutId = setTimeout(handleAuthTimeout, 30000); // 30 second timeout for auth

    const checkAuth = async () => {
      try {
        const authData = localStorage.getItem('metofun-auth');
        if (authData) {
          const adminData: Admin = JSON.parse(authData);
          if (adminData && adminData.isActive) {
            // Validate admin level
            if (!['super_admin', 'agent_admin', 'shop_admin'].includes(adminData.level)) {
              localStorage.removeItem('metofun-auth');
              localStorage.removeItem('metofun-auth-pw');
              setCurrentShop(null);
              setCurrentView('login');
              isAuthCompleted = true;
              clearTimeout(timeoutId);
              setReady(true);
              setLoading(false);
              return;
            }
            // Verify admin exists in local database to prevent localStorage tampering
            let localAdmin;
            try {
              localAdmin = await localAdmins.getAll();
            } catch (dbError) {
              console.error('Failed to load local admins:', dbError);
              localStorage.removeItem('metofun-auth');
              localStorage.removeItem('metofun-auth-pw');
              setCurrentShop(null);
              setCurrentView('login');
              isAuthCompleted = true;
              clearTimeout(timeoutId);
              setReady(true);
              setLoading(false);
              return;
            }
            const verifiedAdmin = localAdmin.find(a => a.id === adminData.id || a.email === adminData.email);
            if (!verifiedAdmin) {
              // Admin record not found locally - clear invalid auth
              localStorage.removeItem('metofun-auth');
              localStorage.removeItem('metofun-auth-pw');
              setCurrentShop(null);
              setCurrentView('login');
              isAuthCompleted = true;
              clearTimeout(timeoutId);
              setReady(true);
              setLoading(false);
              return;
            }
            // Use verified admin data from database, not localStorage
            setAdmin(verifiedAdmin);
            
            // Skip blocking RTDB sync - do in background only
            if (verifiedAdmin.level === 'shop_admin') {
              // Load shop first, then set view - with timeout
              let allShops;
              const shopLoadTimeout = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Shop load timeout')), 15000)
              );
              
               try {
                 allShops = await Promise.race([
                   localShops.getAll(),
                   shopLoadTimeout
                 ]);
               } catch (dbError) {
                 console.error('Failed to load shops:', dbError);
                 localStorage.setItem('metofun-load-timeout', Date.now().toString());
                 localStorage.removeItem('metofun-auth');
                 localStorage.removeItem('metofun-auth-pw');
                 setCurrentShop(null);
                 setCurrentView('login');
                 isAuthCompleted = true;
                 clearTimeout(timeoutId);
                 setReady(true);
                 setLoading(false);
                 return;
               }
              const deviceId = getDeviceId();
              let shop = allShops.find(s => s.adminEmail?.toLowerCase() === verifiedAdmin.email?.toLowerCase());
              if (!shop && verifiedAdmin.assignedShops?.length) {
                shop = allShops.find(s => verifiedAdmin.assignedShops!.includes(s.id));
              }
              if (!shop) {
                const shopsByDevice = allShops.filter(s => s.deviceId === deviceId);
                if (shopsByDevice.length === 1) shop = shopsByDevice[0];
              }
              if (shop) {
                console.log('[Auth] Shop found for shop_admin, setting customer view:', shop.id);
                setCurrentShop(shop);
                setCurrentView('customer');
              } else {
                // No shop found for shop_admin - keep user logged in but redirect appropriately
                console.warn('[Auth] No shop found for shop_admin:', verifiedAdmin.email);
                setCurrentShop(null);
                // For shop_admin with no shop, redirect to login with a message
                setCurrentView('login');
                // Don't clear auth completely - let them try login again
                isAuthCompleted = true;
                clearTimeout(timeoutId);
                setReady(true);
                setLoading(false);
                return;
              }
            } else {
              // super_admin or agent_admin - load shops in background - with timeout
              let shops;
              const shopLoadTimeout = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Shop load timeout')), 15000)
              );
              
              try {
                shops = await Promise.race([
                  localShops.getAll(),
                  shopLoadTimeout
                ]);
               } catch (dbError) {
                 console.error('Failed to load shops for admin:', dbError);
                 localStorage.setItem('metofun-load-timeout', Date.now().toString());
                 localStorage.removeItem('metofun-auth');
                 localStorage.removeItem('metofun-auth-pw');
                 setCurrentShop(null);
                 setCurrentView('login');
                 isAuthCompleted = true;
                 clearTimeout(timeoutId);
                 setReady(true);
                 setLoading(false);
                 return;
               }
              setShops(shops);
              setCurrentView('admin');
            }
          }
        }
      } finally {
        // Auth completed - clear the timeout and mark as completed
        isAuthCompleted = true;
        clearTimeout(timeoutId);
        setReady(true);
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      checkAuth();
    }, 500);
    return () => {
      clearTimeout(timer);
      clearTimeout(timeoutId);
    };
  }, [setAdmin, setCurrentView, setCurrentShop, setShops]);

  // View switching is handled by auth restore logic - don't auto-switch here

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  // CRITICAL: Ensure we ALWAYS have a valid view to prevent blank screens
  console.log('[App] Rendering with currentView:', currentView, 'ready:', ready, 'loading:', loading);

  if (currentView === 'admin') {
    console.log('[App] Showing AdminDashboard');
    return <AdminDashboard />;
  }

  if (currentView === 'customer') {
    console.log('[App] Showing GameMode');
    return <GameMode />;
  }

  // If view is invalid or undefined, force it to login
  if (!currentView || currentView !== 'login') {
    console.warn('[App] Invalid or missing currentView, forcing login:', currentView);
    // Use setTimeout to avoid state update during render
    setTimeout(() => {
      console.log('[App] Setting view to login');
      setCurrentView('login');
    }, 0);
    return <LoginPage />;
  }

  console.log('[App] Showing LoginPage');
  return <LoginPage />;
}
