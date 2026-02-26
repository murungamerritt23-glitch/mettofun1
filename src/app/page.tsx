'use client';

import { useEffect, useState } from 'react';
import SplashScreen from '@/components/SplashScreen';
import LoginPage from '@/components/LoginPage';
import ShopSelector from '@/components/ShopSelector';
import GameMode from '@/components/GameMode';
import AdminDashboard from '@/components/AdminDashboard';
import { useUIStore, useShopStore } from '@/store';
import type { Shop } from '@/types';
import { firebaseShops } from '@/lib/firebase';
import { initDB } from '@/lib/local-db';

export default function Home() {
  const [isInitialized, setIsInitialized] = useState(false);
  const { currentView, showSplash, setShowSplash } = useUIStore();
  const { setShops, setCurrentShop } = useShopStore();

  useEffect(() => {
    // Initialize local database and load shops from Firebase
    const init = async () => {
      try {
        // Initialize local DB for offline support
        await initDB();
        
        // Load shops from Firebase with timeout
        const loadShopsPromise = firebaseShops.getAllActive();
        
        // Race between Firebase load and timeout
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => resolve([]), 5000) // 5 second timeout
        );
        
        const shops = await Promise.race([loadShopsPromise, timeoutPromise]) as Shop[];
        console.log('Loaded shops from Firebase:', shops);
        setShops(shops || []);
        
        // If no current shop but there are shops, set the first one
        const storedShop = useShopStore.getState().currentShop;
        if (!storedShop && shops && shops.length > 0) {
          setCurrentShop(shops[0]);
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
        // Still initialize even on error - app can work with empty data
      }
      setIsInitialized(true);
    };
    
    init();

    // Hide splash after 3 seconds
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [setShowSplash, setShops, setCurrentShop]);

  // Show splash screen while loading
  if (showSplash || !isInitialized) {
    return <SplashScreen />;
  }

  // Render based on current view
  switch (currentView) {
    case 'login':
      return <LoginPage />;
    case 'shop-select':
      return <ShopSelector />;
    case 'customer':
      return <GameMode />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <LoginPage />;
  }
}
