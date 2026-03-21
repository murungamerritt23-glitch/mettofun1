'use client';

import { useEffect, useState } from 'react';
import SplashScreen from '@/components/SplashScreen';
import LoginPage from '@/components/LoginPage';
import { SyncStatus } from '@/components/SyncStatus';
import { useUIStore, useShopStore, useAuthStore } from '@/store';
import { rtdbShops } from '@/lib/firebase';
import { initDB, localAdmins, localShops } from '@/lib/local-db';
import { getDeviceId } from '@/lib/device';

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const { currentView, setCurrentView } = useUIStore();
  const { setShops, setCurrentShop } = useShopStore();
  const { admin, setAdmin } = useAuthStore();

  useEffect(() => {
    const init = async () => {
      try {
        await initDB();
        
        // Load shops
        let shops = await localShops.getAll();
        if (shops.length === 0) {
          try {
            shops = await rtdbShops.getAll();
          } catch {}
        }
        setShops(shops);
        
        // Restore session
        const storedAdmins = await localAdmins.getAll();
        if (storedAdmins.length > 0) {
          const storedAdmin = storedAdmins[0];
          setAdmin(storedAdmin);
          
          const assignedShops = storedAdmin.assignedShops || [];
          if (storedAdmin.level === 'shop_admin' && assignedShops.length > 0) {
            const shop = shops.find(s => assignedShops.includes(s.id));
            if (shop) {
              setCurrentShop(shop);
              setCurrentView('customer');
            } else {
              setCurrentView('admin');
            }
          } else {
            setCurrentView(storedAdmin.level === 'shop_admin' ? 'customer' : 'admin');
          }
        }
      } catch (e) {
        console.error('Init error:', e);
      }
      setIsLoading(false);
    };

    init();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  if (currentView === 'login') {
    return <LoginPage />;
  }

  if (currentView === 'customer') {
    return (
      <>
        <LoginPage />
        <SyncStatus />
      </>
    );
  }

  return <LoginPage />;
}
