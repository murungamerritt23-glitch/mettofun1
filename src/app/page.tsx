'use client';

import { useEffect, useState } from 'react';
import SplashScreen from '@/components/SplashScreen';
import LoginPage from '@/components/LoginPage';
import ShopSelector from '@/components/ShopSelector';
import GameMode from '@/components/GameMode';
import AdminDashboard from '@/components/AdminDashboard';
import { useUIStore, useShopStore } from '@/store';
import { initDB, localShops } from '@/lib/local-db';

export default function Home() {
  const [isInitialized, setIsInitialized] = useState(false);
  const { currentView, showSplash, setShowSplash } = useUIStore();
  const { setShops, setCurrentShop } = useShopStore();

  useEffect(() => {
    // Initialize local database
    const init = async () => {
      try {
        await initDB();
        
        // Ensure default shop exists and load shops
        const defaultShop = await localShops.ensureDefaultShop();
        const allShops = await localShops.getAll();
        setShops(allShops);
        
        // If no current shop is set but there's a default, set it
        const storedShop = useShopStore.getState().currentShop;
        if (!storedShop && defaultShop) {
          setCurrentShop(defaultShop);
        }
      } catch (error) {
        console.error('Failed to initialize database:', error);
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
