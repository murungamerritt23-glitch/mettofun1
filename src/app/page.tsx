'use client';

import { useEffect, useState, lazy, Suspense } from 'react';
import SplashScreen from '@/components/SplashScreen';
import LoginPage from '@/components/LoginPage';
import { SyncStatus } from '@/components/SyncStatus';
import { useUIStore, useShopStore } from '@/store';
import type { Shop } from '@/types';
import { firebaseShops } from '@/lib/firebase';
import { initDB } from '@/lib/local-db';
import { getDeviceId } from '@/lib/device';

// Lazy load heavy components
const GameMode = lazy(() => import('@/components/GameMode'));
const AdminDashboard = lazy(() => import('@/components/AdminDashboard'));

// Loading fallback for lazy components
function ComponentLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A1628]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
    </div>
  );
}

export default function Home() {
  const [isInitialized, setIsInitialized] = useState(false);
  const { currentView, showSplash, setShowSplash, setCurrentView } = useUIStore();
  const { setShops, setCurrentShop } = useShopStore();

  useEffect(() => {
    // Initialize local database and load shops - prioritize local data
    const init = async () => {
      try {
        // Initialize local DB first (fast, no network)
        await initDB();
        
        // Try to load from local storage first (instant)
        const localShops = useShopStore.getState().shops;
        if (localShops && localShops.length > 0) {
          console.log('Loaded shops from local storage:', localShops.length);
          
          // Update current shop if needed
          const storedShop = useShopStore.getState().currentShop;
          if (!storedShop && localShops.length > 0) {
            setCurrentShop(localShops[0]);
          }
        }
        
        // Then fetch from Firebase in background (with timeout)
        try {
          const loadShopsPromise = firebaseShops.getAllActive();
          const timeoutPromise = new Promise((resolve) => 
            setTimeout(() => resolve([]), 3000) // 3 second timeout (reduced from 5)
          );
          
          const shops = await Promise.race([loadShopsPromise, timeoutPromise]) as Shop[];
          
          if (shops && shops.length > 0) {
            console.log('Loaded shops from Firebase:', shops.length);
            setShops(shops);
            
            // Update current shop with fresh data
            const storedShop = useShopStore.getState().currentShop;
            if (storedShop) {
              const updatedShop = shops.find(s => s.id === storedShop.id);
              if (updatedShop) {
                setCurrentShop(updatedShop);
              }
            } else if (shops.length > 0) {
              setCurrentShop(shops[0]);
            }
          }
        } catch (fbError) {
          console.log('Firebase shops load failed, using local data:', fbError);
          // Already have local data, no problem
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
      setIsInitialized(true);
    };
    
    init();

    // Hide splash after 2 seconds (reduced from 3)
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [setShowSplash, setShops, setCurrentShop]);

  // Check if this device is a registered kiosk (shop device)
  useEffect(() => {
    if (!isInitialized || currentView !== 'login') return;
    
    const checkKioskMode = async () => {
      const shops = useShopStore.getState().shops;
      const currentDeviceId = await getDeviceId();
      
      // Find a shop that has this device locked
      const kioskShop = shops.find(shop => 
        shop.deviceLocked && shop.deviceId === currentDeviceId
      );
      
      if (kioskShop) {
        // This device is a registered kiosk - go directly to customer mode
        setCurrentShop(kioskShop);
        setCurrentView('customer');
      }
    };
    
    checkKioskMode();
  }, [isInitialized, currentView, setCurrentShop, setCurrentView]);

  // Show splash screen while loading
  if (showSplash || !isInitialized) {
    return <SplashScreen />;
  }

  // Render based on current view
  switch (currentView) {
    case 'login':
      return <LoginPage />;
    case 'customer':
      return (
        <>
          <Suspense fallback={<ComponentLoader />}>
            <GameMode />
          </Suspense>
          <SyncStatus />
        </>
      );
    case 'admin':
      return (
        <>
          <Suspense fallback={<ComponentLoader />}>
            <AdminDashboard />
          </Suspense>
          <SyncStatus />
        </>
      );
    default:
      return <LoginPage />;
  }
}
