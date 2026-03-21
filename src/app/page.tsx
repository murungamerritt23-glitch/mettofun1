'use client';

import { useEffect, useState } from 'react';
import LoginPage from '@/components/LoginPage';
import { useUIStore, useShopStore, useAuthStore } from '@/store';

export default function Home() {
  const [ready, setReady] = useState(false);
  const { currentView, setCurrentView } = useUIStore();
  const { setShops, setCurrentShop } = useShopStore();
  const { setAdmin } = useAuthStore();

  useEffect(() => {
    // Quick init - skip IndexedDB for now
    const timer = setTimeout(() => {
      setReady(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return <LoginPage />;
}
