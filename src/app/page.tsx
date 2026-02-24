'use client';

import { useEffect, useState } from 'react';
import SplashScreen from '@/components/SplashScreen';
import LoginPage from '@/components/LoginPage';
import ShopSelector from '@/components/ShopSelector';
import GameMode from '@/components/GameMode';
import AdminDashboard from '@/components/AdminDashboard';
import { useUIStore } from '@/store';
import { initDB } from '@/lib/local-db';

export default function Home() {
  const [isInitialized, setIsInitialized] = useState(false);
  const { currentView, showSplash, setShowSplash } = useUIStore();

  useEffect(() => {
    // Initialize local database
    const init = async () => {
      try {
        await initDB();
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
  }, [setShowSplash]);

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
